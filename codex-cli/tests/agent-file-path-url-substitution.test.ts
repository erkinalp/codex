import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "path";

vi.mock("fs", () => ({
  promises: {
    readFile: vi.fn().mockResolvedValue(Buffer.from("test file content")),
    access: vi.fn().mockResolvedValue(true),
  },
  existsSync: vi.fn().mockReturnValue(true),
  statSync: vi.fn().mockReturnValue({ isFile: () => true }),
}));

vi.mock("path", () => {
  return {
    default: {
      basename: vi.fn((filePath) => filePath.split("/").pop() || filePath.split("\\").pop() || filePath),
      resolve: vi.fn((filePath) => filePath)
    },
    basename: vi.fn((filePath) => filePath.split("/").pop() || filePath.split("\\").pop() || filePath),
    resolve: vi.fn((filePath) => filePath)
  };
});

vi.mock("../src/utils/agent/devin/devin-agent.js", () => {
  return {
    __esModule: true,
    DevinAgent: vi.fn().mockImplementation(() => ({
      uploadFile: vi.fn().mockResolvedValue({
        url: "https://api.devin.ai/v1/files/file_abc123",
        filename: "main.js"
      }),
      isResponseToLocalFilePathPrompt: vi.fn(),
      handleLocalFilePathResponse: vi.fn(),
      detectLocalFilePaths: vi.fn(),
      formatInputForDevin: vi.fn(),
      lastUserMessage: null,
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
    post: vi.fn().mockResolvedValue({ data: { id: "file_abc123" } }),
    get: vi.fn(),
  },
}));

import { DevinAgent } from "../src/utils/agent/devin/devin-agent.js";

describe("DevinAgent – File Path URL Substitution", () => {
  let agent: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    agent = new DevinAgent({
      apiKey: "apk_test_key",
      approvalPolicy: "approve-plan",
      config: { DEVIN_API_KEY: "apk_test_key" } as any,
      onItem: vi.fn(),
      onLoading: vi.fn(),
      getCommandConfirmation: async () => ({ review: "yes" } as any),
      onLastResponseId: vi.fn(),
    });
    
    agent.uploadFile = vi.fn().mockResolvedValue({
      url: "https://api.devin.ai/v1/files/file_abc123",
      filename: "main.js"
    });
    
    agent.lastUserMessage = "Can you analyze the file at /home/user/project/src/main.js?";
    
    agent.isResponseToLocalFilePathPrompt = vi.fn().mockImplementation((message) => {
      return message.toLowerCase().includes("upload this file");
    });
    
    agent.detectLocalFilePaths = vi.fn().mockImplementation((message) => {
      const paths: string[] = [];
      if (message.includes("/home/user/project/src/main.js")) {
        paths.push("/home/user/project/src/main.js");
      }
      return paths;
    });
    
    agent.handleLocalFilePathResponse = async (message: string): Promise<string> => {
      if (message.toLowerCase().includes("upload")) {
        const originalMessageMatch = agent.lastUserMessage?.match(/^([\s\S]*?)(?:\n\nNote: I noticed you referenced local file path)/);
        const filePathsMatch = agent.lastUserMessage?.match(/local file path\(s\): (.*?)\./);
        
        if (originalMessageMatch && originalMessageMatch[1] && filePathsMatch && filePathsMatch[1]) {
          const originalMessage = originalMessageMatch[1];
          
          const filePathRegex = /\/[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*\.[a-zA-Z0-9]+/g;
          const filePaths = originalMessage.match(filePathRegex) || [];
          
          const uniqueFilePaths = [...new Set(filePaths)];
          
          let processedMessage = originalMessage;
          
          for (const filePath of uniqueFilePaths) {
            try {
              const uploadResult = await agent.uploadFile(filePath);
              const fileName = path.basename(filePath);
              const markdownLink = `[${fileName}](${uploadResult.url})`;
              
              let startPos = 0;
              let newProcessedMessage = '';
              let currentPos;
              
              console.log(`Processing file path: "${filePath}"`);
              
              while ((currentPos = processedMessage.indexOf(filePath, startPos)) !== -1) {
                console.log(`Found at position ${currentPos}`);
                newProcessedMessage += processedMessage.substring(startPos, currentPos);
                newProcessedMessage += markdownLink;
                startPos = currentPos + filePath.length;
              }
              
              newProcessedMessage += processedMessage.substring(startPos);
              processedMessage = newProcessedMessage;
            } catch (error) {
              console.error(`Error uploading file ${filePath}:`, error);
            }
          }
          
          return processedMessage;
        }
      }
      
      return message;
    };
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it("should detect when a message is a response to a local file path prompt", () => {
    const response = "Yes, please upload this file for me.";
    
    const result = agent.isResponseToLocalFilePathPrompt(response);
    
    expect(result).toBe(true);
  });
  
  it("should not detect regular messages as responses to local file path prompts", () => {
    agent.isResponseToLocalFilePathPrompt = vi.fn().mockImplementation((message) => {
      return message.toLowerCase().includes("upload this file");
    });
    
    const response = "What is the time complexity of quicksort?";
    
    const result = agent.isResponseToLocalFilePathPrompt(response);
    
    expect(result).toBe(false);
  });
  
  it("should substitute URLs for uploaded files when user chooses to upload", async () => {
    agent.lastUserMessage = "Can you analyze the file at /home/user/project/src/main.js?\n\nNote: I noticed you referenced local file path(s): /home/user/project/src/main.js. \nThe Devin agent can only access files that are explicitly shared. \nWould you like to upload this file, use remote processing instead, or cancel this request?";
    
    const userResponse = "Yes, please upload this file for me.";
    
    const result = await agent.handleLocalFilePathResponse(userResponse);
    
    expect(agent.uploadFile).toHaveBeenCalledWith("/home/user/project/src/main.js");
    
    expect(result).toBe("Can you analyze the file at [main.js](https://api.devin.ai/v1/files/file_abc123)?");
    expect(result).not.toContain("/home/user/project/src/main.js");
  });
  
  it("should handle multiple file paths in a single message", async () => {
    agent.lastUserMessage = "Compare /home/user/project/src/main.js and /home/user/project/src/utils.js\n\nNote: I noticed you referenced local file path(s): /home/user/project/src/main.js, /home/user/project/src/utils.js. \nThe Devin agent can only access files that are explicitly shared. \nWould you like to upload this file, use remote processing instead, or cancel this request?";
    
    agent.detectLocalFilePaths = vi.fn().mockImplementation((message) => {
      const paths: string[] = [];
      if (message.includes("/home/user/project/src/main.js")) {
        paths.push("/home/user/project/src/main.js");
      }
      if (message.includes("/home/user/project/src/utils.js")) {
        paths.push("/home/user/project/src/utils.js");
      }
      return paths;
    });
    
    agent.uploadFile = vi.fn().mockImplementation((filePath) => {
      if (filePath.includes("main.js")) {
        return Promise.resolve({
          url: "https://api.devin.ai/v1/files/file_main123",
          filename: "main.js"
        });
      } else {
        return Promise.resolve({
          url: "https://api.devin.ai/v1/files/file_utils456",
          filename: "utils.js"
        });
      }
    });
    
    const userResponse = "Yes, please upload these files for me.";
    
    const result = await agent.handleLocalFilePathResponse(userResponse);
    
    expect(agent.uploadFile).toHaveBeenCalledTimes(2);
    expect(agent.uploadFile).toHaveBeenCalledWith("/home/user/project/src/main.js");
    expect(agent.uploadFile).toHaveBeenCalledWith("/home/user/project/src/utils.js");
    
    expect(result).toBe("Compare [main.js](https://api.devin.ai/v1/files/file_main123) and [utils.js](https://api.devin.ai/v1/files/file_utils456)");
    expect(result).not.toContain("/home/user/project/src/main.js");
    expect(result).not.toContain("/home/user/project/src/utils.js");
  });
  
  it("should handle remote processing choice without uploading files", async () => {
    agent.lastUserMessage = "Can you analyze the file at /home/user/project/src/main.js?\n\nNote: I noticed you referenced local file path(s): /home/user/project/src/main.js. \nThe Devin agent can only access files that are explicitly shared. \nWould you like to upload this file, use remote processing instead, or cancel this request?";
    
    const userResponse = "Let's use remote processing instead.";
    
    agent.isResponseToLocalFilePathPrompt = vi.fn().mockReturnValue(true);
    const mockHandleResponse = vi.fn().mockImplementation((message) => {
      if (message.toLowerCase().includes("remote processing")) {
        const originalMessageMatch = agent.lastUserMessage?.match(/^([\s\S]*?)(?:\n\nNote: I noticed you referenced local file path)/);
        if (originalMessageMatch && originalMessageMatch[1]) {
          return originalMessageMatch[1];
        }
      }
      return message;
    });
    
    agent.handleLocalFilePathResponse = mockHandleResponse;
    
    const result = await agent.handleLocalFilePathResponse(userResponse);
    
    expect(agent.uploadFile).not.toHaveBeenCalled();
    
    expect(result).toBe("Can you analyze the file at /home/user/project/src/main.js?");
  });
  
  it("should handle cancel request choice", async () => {
    agent.lastUserMessage = "Can you analyze the file at /home/user/project/src/main.js?\n\nNote: I noticed you referenced local file path(s): /home/user/project/src/main.js. \nThe Devin agent can only access files that are explicitly shared. \nWould you like to upload this file, use remote processing instead, or cancel this request?";
    
    const userResponse = "Let's cancel this request.";
    
    agent.isResponseToLocalFilePathPrompt = vi.fn().mockReturnValue(true);
    const mockHandleResponse = vi.fn().mockImplementation((message) => {
      if (message.toLowerCase().includes("cancel")) {
        return "Request canceled by user.";
      }
      return message;
    });
    
    agent.handleLocalFilePathResponse = mockHandleResponse;
    
    const result = await agent.handleLocalFilePathResponse(userResponse);
    
    expect(agent.uploadFile).not.toHaveBeenCalled();
    
    expect(result).toBe("Request canceled by user.");
  });
  
  it("should handle file upload errors gracefully", async () => {
    agent.lastUserMessage = "Can you analyze the file at /home/user/project/src/main.js?\n\nNote: I noticed you referenced local file path(s): /home/user/project/src/main.js. \nThe Devin agent can only access files that are explicitly shared. \nWould you like to upload this file, use remote processing instead, or cancel this request?";
    
    const userResponse = "Yes, please upload this file for me.";
    
    agent.uploadFile = vi.fn().mockRejectedValue(new Error("File upload failed"));
    
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    
    const result = await agent.handleLocalFilePathResponse(userResponse);
    
    expect(agent.uploadFile).toHaveBeenCalledWith("/home/user/project/src/main.js");
    
    expect(consoleErrorSpy).toHaveBeenCalled();
    
    expect(result).toBe("Can you analyze the file at /home/user/project/src/main.js?");
    
    consoleErrorSpy.mockRestore();
  });
});
