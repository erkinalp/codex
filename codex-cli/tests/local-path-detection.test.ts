import { describe, it, expect } from "vitest";

describe("Local File Path Detection", () => {
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
  
  function formatInputForDevin(input: any): string {
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
  }
  
  it("should detect Unix-like absolute file paths", () => {
    const userMessage = [
      {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "Can you analyze the file at /home/user/project/src/main.js?" }],
      },
    ];
    
    const result = formatInputForDevin(userMessage);
    
    expect(result).toContain("Note: I noticed you referenced local file path(s)");
    expect(result).toContain("/home/user/project/src/main.js");
    expect(result).toContain("or cancel this request");
  });
  
  it("should detect Windows-like absolute file paths", () => {
    const userMessage = [
      {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "Please check C:\\Users\\name\\Documents\\project\\main.js" }],
      },
    ];
    
    const result = formatInputForDevin(userMessage);
    
    expect(result).toContain("Note: I noticed you referenced local file path(s)");
    expect(result).toContain("C:\\Users\\name\\Documents\\project\\main.js");
    expect(result).toContain("or cancel this request");
  });
  
  it("should detect relative file paths", () => {
    const userMessage = [
      {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "Can you look at ./src/components/Button.tsx?" }],
      },
    ];
    
    const result = formatInputForDevin(userMessage);
    
    expect(result).toContain("Note: I noticed you referenced local file path(s)");
    expect(result).toContain("./src/components/Button.tsx");
    expect(result).toContain("or cancel this request");
  });
  
  it("should detect paths with environment variables", () => {
    const userMessage = [
      {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "Check $HOME/projects/app/config.json" }],
      },
    ];
    
    const result = formatInputForDevin(userMessage);
    
    expect(result).toContain("Note: I noticed you referenced local file path(s)");
    expect(result).toContain("$HOME/projects/app/config.json");
    expect(result).toContain("or cancel this request");
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
    
    const result = formatInputForDevin(userMessage);
    
    expect(result).toContain("Note: I noticed you referenced local file path(s)");
    expect(result).toContain("/home/user/project/src/main.js");
    expect(result).toContain("./components/Header.jsx");
    expect(result).toContain("or cancel this request");
  });
  
  it("should not add prompt when no file paths are detected", () => {
    const userMessage = [
      {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "What is the time complexity of quicksort?" }],
      },
    ];
    
    const result = formatInputForDevin(userMessage);
    
    expect(result).not.toContain("Note: I noticed you referenced local file path(s)");
    expect(result).not.toContain("or cancel this request");
  });
  
  it("should not detect URLs as local file paths", () => {
    const userMessage = [
      {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "Check https://example.com/file.js" }],
      },
    ];
    
    const result = formatInputForDevin(userMessage);
    
    expect(result).not.toContain("Note: I noticed you referenced local file path(s)");
    expect(result).not.toContain("or cancel this request");
  });
});
