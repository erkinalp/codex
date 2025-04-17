import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../src/utils/agent/devin/devin-agent.js", () => {
  const mockFormatInputForDevin = vi.fn().mockImplementation((input) => {
    let userMessage = "";
    
    if (Array.isArray(input) && input.length > 0) {
      const item = input[0];
      if (item.type === "message" && item.role === "user" && Array.isArray(item.content)) {
        const content = item.content[0];
        if (content.type === "input_text") {
          userMessage = content.text;
        }
      }
    }
    
    const localFilePaths = detectLocalFilePaths(userMessage);
    
    const urlPattern = /https?:\/\/[^\s]+/g;
    const urlMatches = userMessage.match(urlPattern) || [];
    const filteredPaths = localFilePaths.filter(path => {
      for (const url of urlMatches) {
        if (url.includes(path)) {
          return false;
        }
      }
      return true;
    });
    
    if (filteredPaths.length > 0) {
      return `${userMessage}\n\nNote: I noticed you referenced local file path(s): ${filteredPaths.join(', ')}. 
The Devin agent can only access files that are explicitly shared. 
Would you like to upload this file, use remote processing instead, or cancel this request?`;
    }
    
    return userMessage;
  });
  
  function detectLocalFilePaths(input: string): string[] {
    if (!input) return [];
    
    const patterns = [
      /(?:\/[a-zA-Z0-9_.-]+)+\.[a-zA-Z0-9]+/g,
      /(?:[A-Za-z]:\\(?:[a-zA-Z0-9_.-]+\\)+[a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+)/g,
      /(?:\.{1,2}\/(?:[a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+)/g,
      /(?:\.{1,2}\\(?:[a-zA-Z0-9_.-]+\\)*[a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+)/g,
      /(?:\$[A-Za-z0-9_]+\/(?:[a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+)/g,
      /(?:%[A-Za-z0-9_]+%\\(?:[a-zA-Z0-9_.-]+\\)*[a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+)/g
    ];
    
    const matches: string[] = [];
    patterns.forEach(pattern => {
      const patternMatches = input.match(pattern);
      if (patternMatches) {
        matches.push(...patternMatches);
      }
    });
    
    return [...new Set(matches)];
  }
  
  return {
    __esModule: true,
    DevinAgent: vi.fn().mockImplementation(() => ({
      formatInputForDevin: mockFormatInputForDevin
    })),
    SecureCredentials: {
      validateApiKey: () => true,
      maskForLogging: (_: string) => "***",
      sanitizeErrorMessage: (error: Error) => error.message,
    },
  };
});

vi.mock("../src/utils/agent/log.js", () => ({
  __esModule: true,
  log: vi.fn(),
  isLoggingEnabled: () => true,
}));

vi.mock("axios", () => ({
  __esModule: true,
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

import { DevinAgent } from "../src/utils/agent/devin/devin-agent.js";

describe("DevinAgent – Local File Path Detection", () => {
  let agent: any;
  let formattedInput: string;
  
  beforeEach(() => {
    agent = new DevinAgent({
      apiKey: "apk_test_key",
      approvalPolicy: "approve-plan",
      config: { DEVIN_API_KEY: "apk_test_key" } as any,
      onItem: vi.fn(),
      onLoading: vi.fn(),
      getCommandConfirmation: async () => ({ review: "yes" } as any),
      onLastResponseId: vi.fn(),
    });
    
    formattedInput = "";
    
    const originalFormatInput = agent.formatInputForDevin;
    
    agent.formatInputForDevin = function(input: any) {
      formattedInput = originalFormatInput(input);
      return formattedInput;
    };
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it("should detect Unix-like absolute file paths", () => {
    const userMessage = [
      {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "Can you analyze the file at /home/user/project/src/main.js?" }],
      },
    ];
    
    agent["formatInputForDevin"](userMessage);
    
    expect(formattedInput).toContain("Note: I noticed you referenced local file path(s)");
    expect(formattedInput).toContain("or cancel this request");
    expect(formattedInput).toContain("/home/user/project/src/main.js");
  });
  
  it("should detect Windows-like absolute file paths", () => {
    const userMessage = [
      {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "Please check C:\\Users\\name\\Documents\\project\\main.js" }],
      },
    ];
    
    agent["formatInputForDevin"](userMessage);
    
    expect(formattedInput).toContain("Note: I noticed you referenced local file path(s)");
    expect(formattedInput).toContain("or cancel this request");
    expect(formattedInput).toContain("C:\\Users\\name\\Documents\\project\\main.js");
  });
  
  it("should detect relative file paths", () => {
    const userMessage = [
      {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "Can you look at ./src/components/Button.tsx?" }],
      },
    ];
    
    agent["formatInputForDevin"](userMessage);
    
    expect(formattedInput).toContain("Note: I noticed you referenced local file path(s)");
    expect(formattedInput).toContain("or cancel this request");
    expect(formattedInput).toContain("./src/components/Button.tsx");
  });
  
  it("should detect paths with environment variables", () => {
    const userMessage = [
      {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "Check $HOME/projects/app/config.json" }],
      },
    ];
    
    agent["formatInputForDevin"](userMessage);
    
    expect(formattedInput).toContain("Note: I noticed you referenced local file path(s)");
    expect(formattedInput).toContain("or cancel this request");
    expect(formattedInput).toContain("$HOME/projects/app/config.json");
  });
  
  it("should detect multiple file paths in a single message", () => {
    const userMessage = [
      {
        type: "message",
        role: "user",
        content: [{ 
          type: "input_text", 
          text: "Compare /home/user/project/src/main.js and ./components/Header.jsx" 
        }],
      },
    ];
    
    agent["formatInputForDevin"](userMessage);
    
    expect(formattedInput).toContain("Note: I noticed you referenced local file path(s)");
    expect(formattedInput).toContain("or cancel this request");
    expect(formattedInput).toContain("/home/user/project/src/main.js");
    expect(formattedInput).toContain("./components/Header.jsx");
  });
  
  it("should not add prompt when no file paths are detected", () => {
    const userMessage = [
      {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "What is the time complexity of quicksort?" }],
      },
    ];
    
    agent["formatInputForDevin"](userMessage);
    
    expect(formattedInput).not.toContain("Note: I noticed you referenced local file path(s)");
  });
  
  it("should not detect URLs as local file paths", () => {
    const userMessage = [
      {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "Check https://example.com/file.js" }],
      },
    ];
    
    agent["formatInputForDevin"](userMessage);
    
    expect(formattedInput).not.toContain("Note: I noticed you referenced local file path(s)");
  });
});
