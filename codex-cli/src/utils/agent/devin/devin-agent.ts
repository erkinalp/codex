import type { ApplyPatchCommand, ApprovalPolicy } from "../../../approvals.js";
import type { AppConfig } from "../../config.js";
import type { CommandConfirmation } from "../agent-loop.js";
import type { 
  ResponseItem, 
  ResponseInputItem,
  ResponseOutputText,
  ResponseInputText
} from "openai/resources/responses/responses.mjs";

import { log, isLoggingEnabled } from "../log.js";
import axios from "axios";

/**
 * Utility functions for secure credential handling
 */
const SecureCredentials = {
  /**
   * Validate API key format
   * @param apiKey API key to validate
   * @returns True if the API key is valid, false otherwise
   */
  validateApiKey(apiKey: string): boolean {
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      return false;
    }
    
    return apiKey.startsWith('apk_') && apiKey.length >= 32;
  },
  
  /**
   * Mask sensitive information for logging
   * @param value Value to mask
   * @returns Masked value safe for logging
   */
  maskForLogging(value: string): string {
    if (!value || value.length < 8) {
      return '***';
    }
    
    return `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
  },
  
  /**
   * Sanitize error messages to prevent credential exposure
   * @param error Error object or message
   * @returns Sanitized error message
   */
  sanitizeErrorMessage(error: unknown): string {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return errorMessage.replace(/Bearer\s+[a-zA-Z0-9._-]+/g, 'Bearer [REDACTED]')
      .replace(/api[_-]?key[=:]\s*[a-zA-Z0-9._-]+/gi, 'api_key=[REDACTED]');
  }
};

type TimeoutId = ReturnType<typeof setTimeout>;

/**
 * Interface for Devin API structured output
 */
interface DevinStructuredOutput {
  type: string;
  content: unknown;
}

/**
 * Interface for file upload response
 */
interface FileUploadResponse {
  url: string;
}

/**
 * Interface for Devin API response
 */
interface DevinApiResponse {
  id: string;
  status: string;
  output?: string | Array<DevinStructuredOutput>;
  error?: string;
}

/**
 * DevinAgent - Implementation of the Devin AI API for Codex CLI
 * 
 * This class provides an interface to the Devin AI API that mirrors the
 * functionality of the OpenAI agent implementation in agent-loop.ts.
 */
export class DevinAgent {
  private apiKey: string;
  private sessionId: string | null = null;
  // @ts-expect-error - Will be used in future implementations
  private _approvalPolicy: ApprovalPolicy;
  private config: AppConfig;
  private baseUrl: string = "https://api.devin.ai/v1";
  // @ts-expect-error - Used to track cancellation state
  private _canceled = false;
  private execAbortController: AbortController | null = null;
  private generation = 0;
  private terminated = false;
  private hardAbort = new AbortController();
  private pollingInterval: TimeoutId | null = null;
  private retryCount = 0;
  private maxRetries = 3;
  private retryDelayMs = 2500;
  private activeSessions: Map<string, {status: string; title: string}> = new Map();

  private onItem: (item: ResponseItem) => void;
  private onLoading: (loading: boolean) => void;
  // @ts-expect-error - Will be used in future implementations
  private _getCommandConfirmation: (
    command: Array<string>,
    applyPatch: ApplyPatchCommand | undefined,
  ) => Promise<CommandConfirmation>;
  private onLastResponseId: (lastResponseId: string) => void;

  constructor({
    apiKey,
    approvalPolicy,
    config,
    onItem,
    onLoading,
    getCommandConfirmation,
    onLastResponseId,
  }: {
    apiKey: string;
    approvalPolicy: ApprovalPolicy;
    config: AppConfig;
    onItem: (item: ResponseItem) => void;
    onLoading: (loading: boolean) => void;
    getCommandConfirmation: (
      command: Array<string>,
      applyPatch: ApplyPatchCommand | undefined,
    ) => Promise<CommandConfirmation>;
    onLastResponseId: (lastResponseId: string) => void;
  }) {
    if (!SecureCredentials.validateApiKey(apiKey)) {
      throw new Error("Invalid Devin API key provided. Please check your credentials.");
    }
    
    this.apiKey = apiKey;
    this._approvalPolicy = approvalPolicy;
    this.config = config;
    this.onItem = onItem;
    this.onLoading = onLoading;
    this._getCommandConfirmation = getCommandConfirmation;
    this.onLastResponseId = onLastResponseId;
    this.execAbortController = new AbortController();

    this.hardAbort.signal.addEventListener(
      "abort",
      () => this.execAbortController?.abort(),
      { once: true },
    );
    
    if (isLoggingEnabled()) {
      log(`DevinAgent initialized with model: ${config.model}, API key: ${SecureCredentials.maskForLogging(apiKey)}`);
    }
  }

  /**
   * Cancel the current operation
   */
  public cancel(): void {
    if (this.terminated) {
      return;
    }

    if (isLoggingEnabled()) {
      log(
        `DevinAgent.cancel() invoked – execAbortController=${Boolean(
          this.execAbortController,
        )} generation=${this.generation}`,
      );
    }

    this._canceled = true;

    this.execAbortController?.abort();

    this.execAbortController = new AbortController();
    if (isLoggingEnabled()) {
      log("DevinAgent.cancel(): execAbortController.abort() called");
    }

    this.onLoading(false);
    this.generation += 1;
    
    if (isLoggingEnabled()) {
      log(`DevinAgent.cancel(): generation bumped to ${this.generation}`);
    }
  }

  /**
   * Terminate the agent
   */
  public terminate(): void {
    if (this.terminated) {
      return;
    }
    this.terminated = true;

    this.hardAbort.abort();
    this.cancel();
  }

  /**
   * Create a new Devin session
   * @param prompt The prompt to send to Devin
   * @param effortLevel The effort level for the session (standard or deep)
   */
  private async createSession(prompt: string, effortLevel: "standard" | "deep" = "standard"): Promise<string> {
    try {
      this.retryCount = 0;
      
      const response = await axios.post(
        `${this.baseUrl}/sessions`,
        {
          prompt,
          effort_level: effortLevel,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          signal: this.execAbortController?.signal,
        }
      );

      if (isLoggingEnabled()) {
        log(`DevinAgent.createSession() created session with ID: ${response.data.id}`);
      }

      return response.data.id;
    } catch (error) {
      if (isLoggingEnabled()) {
        // Use sanitized error message to prevent credential exposure
        log(`DevinAgent.createSession() error: ${SecureCredentials.sanitizeErrorMessage(error)}`);
      }
      
      // Handle authentication errors specifically
      const axiosError = error as { response?: { status: number; data?: { error?: string } } };
      if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
        throw new Error("Authentication failed. Please check your Devin API key.");
      }
      
      // Handle rate limiting and server errors with retry logic
      if (axiosError.response && (axiosError.response.status === 429 || axiosError.response.status >= 500) && this.retryCount < this.maxRetries) {
        this.retryCount++;
        const delay = this.retryDelayMs * this.retryCount;
        
        if (isLoggingEnabled()) {
          log(`DevinAgent.createSession() retrying in ${delay}ms (attempt ${this.retryCount}/${this.maxRetries})`);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.createSession(prompt, effortLevel);
      }
      
      throw error;
    }
  }

  /**
   * Send a message to an existing Devin session
   */
  private async sendMessage(sessionId: string, message: string): Promise<void> {
    try {
      this.retryCount = 0;
      
      await axios.post(
        `${this.baseUrl}/sessions/${sessionId}/messages`,
        {
          content: message,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          signal: this.execAbortController?.signal,
        }
      );
      
      if (isLoggingEnabled()) {
        log(`DevinAgent.sendMessage() sent message to session: ${sessionId}`);
      }
    } catch (error) {
      if (isLoggingEnabled()) {
        // Use sanitized error message to prevent credential exposure
        log(`DevinAgent.sendMessage() error: ${SecureCredentials.sanitizeErrorMessage(error)}`);
      }
      
      // Handle authentication errors specifically
      const axiosError = error as { response?: { status: number; data?: { error?: string } } };
      if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
        throw new Error("Authentication failed. Please check your Devin API key.");
      }
      
      // Handle rate limiting and server errors with retry logic
      if (axiosError.response && (axiosError.response.status === 429 || axiosError.response.status >= 500) && this.retryCount < this.maxRetries) {
        this.retryCount++;
        const delay = this.retryDelayMs * this.retryCount;
        
        if (isLoggingEnabled()) {
          log(`DevinAgent.sendMessage() retrying in ${delay}ms (attempt ${this.retryCount}/${this.maxRetries})`);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.sendMessage(sessionId, message);
      }
      
      throw error;
    }
  }
  
  /**
   * Get session status and output
   */
  private async getSessionStatus(sessionId: string): Promise<DevinApiResponse> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/sessions/${sessionId}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          signal: this.execAbortController?.signal,
        }
      );
      
      if (response.data.status && response.data.title) {
        this.activeSessions.set(sessionId, {
          status: response.data.status,
          title: response.data.title
        });
      }
      
      return response.data;
    } catch (error) {
      if (isLoggingEnabled()) {
        // Use sanitized error message to prevent credential exposure
        log(`DevinAgent.getSessionStatus() error: ${SecureCredentials.sanitizeErrorMessage(error)}`);
      }
      
      // Handle authentication errors specifically
      const axiosError = error as { response?: { status: number; data?: { error?: string } } };
      if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
        throw new Error("Authentication failed. Please check your Devin API key.");
      }
      
      throw error;
    }
  }
  
  /**
   * Upload a file to Devin
   * @param filePath Path to the file to upload
   * @param fileContent Content of the file
   * @returns URL to the uploaded file
   */
  public async uploadFile(filePath: string, fileContent: Buffer | string): Promise<string> {
    try {
      this.retryCount = 0;
      
      const formData = new FormData();
      const blob = new Blob([fileContent], { type: 'application/octet-stream' });
      formData.append('file', blob, filePath.split('/').pop());
      
      const response = await axios.post(
        `${this.baseUrl}/attachments`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'multipart/form-data',
          },
          signal: this.execAbortController?.signal,
        }
      );
      
      if (isLoggingEnabled()) {
        log(`DevinAgent.uploadFile() uploaded file: ${filePath}`);
      }
      
      const fileUploadResponse = response.data as FileUploadResponse;
      return fileUploadResponse.url;
    } catch (error) {
      if (isLoggingEnabled()) {
        // Use sanitized error message to prevent credential exposure
        log(`DevinAgent.uploadFile() error: ${SecureCredentials.sanitizeErrorMessage(error)}`);
      }
      
      // Handle authentication errors specifically
      const axiosError = error as { response?: { status: number; data?: { error?: string } } };
      if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
        throw new Error("Authentication failed. Please check your Devin API key.");
      }
      
      // Handle rate limiting and server errors with retry logic
      if (axiosError.response && (axiosError.response.status === 429 || axiosError.response.status >= 500) && this.retryCount < this.maxRetries) {
        this.retryCount++;
        const delay = this.retryDelayMs * this.retryCount;
        
        if (isLoggingEnabled()) {
          log(`DevinAgent.uploadFile() retrying in ${delay}ms (attempt ${this.retryCount}/${this.maxRetries})`);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.uploadFile(filePath, fileContent);
      }
      
      throw error;
    }
  }

  /**
   * Run the agent with the given input
   */
  public async run(
    input: Array<ResponseInputItem>,
    previousResponseId: string = "",
  ): Promise<void> {
    try {
      if (this.terminated) {
        throw new Error("DevinAgent has been terminated");
      }

      // Start time for this operation - unused for now but may be used for timeouts later
      // const startTime = Date.now();
      const thisGeneration = ++this.generation;

      this._canceled = false;

      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
      }

      this.execAbortController = new AbortController();
      if (isLoggingEnabled()) {
        log(
          `DevinAgent.run(): new execAbortController created for generation ${this.generation}`,
        );
      }

      this.sessionId = previousResponseId;
      this.onLoading(true);

      const prompt = this.formatInputForDevin(input);
      const modelName = this.config.model || "devin-standard";
      const effortLevel = modelName === "devin-deep" ? "deep" : "standard";
      
      try {
        if (this.sessionId) {
          await this.sendMessage(this.sessionId, prompt);
        } else {
          this.sessionId = await this.createSession(prompt, effortLevel);
          this.onLastResponseId(this.sessionId);
        }

        const initialResponseItem = {
          id: `devin-${Date.now()}`,
          type: "message",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text: `Processing request with Devin AI (${effortLevel} effort)...`,
              annotations: [],
            } as ResponseOutputText,
          ],
        } as ResponseItem;
        this.onItem(initialResponseItem);

        // Start polling for session status and output
        this.startPollingSession(this.sessionId, thisGeneration);
      } catch (error) {
        const errorItem = {
          id: `error-${Date.now()}`,
          type: "message",
          role: "system",
          content: [
            {
              type: "input_text",
              text: `Error communicating with Devin AI: ${(error as Error)?.message || String(error)}`,
            } as ResponseInputText,
          ],
        } as ResponseItem;

        this.onItem(errorItem);
        this.onLoading(false);
      }
    } catch (error) {
      const errorItem = {
        id: `error-${Date.now()}`,
        type: "message",
        role: "system",
        content: [
          {
            type: "input_text",
            text: `Unexpected error: ${(error as Error)?.message || String(error)}`,
          } as ResponseInputText,
        ],
      } as ResponseItem;

      this.onItem(errorItem);
      this.onLoading(false);
    }
  }

  /**
   * Start polling for session status and output
   */
  private startPollingSession(sessionId: string, generation: number): void {
    this.pollingInterval = setInterval(async () => {
      if (generation !== this.generation) {
        if (this.pollingInterval) {
          clearInterval(this.pollingInterval);
          this.pollingInterval = null;
        }
        return;
      }

      try {
        const sessionData = await this.getSessionStatus(sessionId);
        
        if (sessionData.status === "completed" || sessionData.status === "failed") {
          if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
          }
          
          if (sessionData.status === "completed" && sessionData.output) {
            this.processSessionOutput(sessionData);
          } else if (sessionData.status === "failed") {
            const errorItem = {
              id: `error-${Date.now()}`,
              type: "message",
              role: "system",
              content: [
                {
                  type: "input_text",
                  text: `Devin AI session failed: ${sessionData.error || "Unknown error"}`,
                } as ResponseInputText,
              ],
            } as ResponseItem;
            this.onItem(errorItem);
          }
          
          this.onLoading(false);
        }
      } catch (error) {
        if (isLoggingEnabled()) {
          log(`Error polling session: ${(error as Error)?.message || String(error)}`);
        }
      }
    }, 2000);
  }

  /**
   * Process structured output from Devin API
   */
  private processSessionOutput(sessionData: DevinApiResponse): void {
    try {
      if (typeof sessionData.output === "string") {
        const responseItem = {
          id: `devin-${Date.now()}`,
          type: "message",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text: sessionData.output,
              annotations: [],
            } as ResponseOutputText,
          ],
        } as ResponseItem;
        this.onItem(responseItem);
      } else if (Array.isArray(sessionData.output)) {
        // Handle structured output
        for (const output of sessionData.output) {
          if (output.type === "text") {
            const responseItem = {
              id: `devin-${Date.now()}`,
              type: "message",
              role: "assistant",
              content: [
                {
                  type: "output_text",
                  text: String(output.content),
                  annotations: [],
                } as ResponseOutputText,
              ],
            } as ResponseItem;
            this.onItem(responseItem);
          } else if (output.type === "code") {
            const responseItem = {
              id: `devin-${Date.now()}`,
              type: "message",
              role: "assistant",
              content: [
                {
                  type: "output_text",
                  text: `\`\`\`${(output.content as {language?: string, code: string}).language || ""}\n${(output.content as {language?: string, code: string}).code}\n\`\`\``,
                  annotations: [],
                } as ResponseOutputText,
              ],
            } as ResponseItem;
            this.onItem(responseItem);
          }
        }
      }
    } catch (error) {
      if (isLoggingEnabled()) {
        log(`Error processing session output: ${(error as Error)?.message || String(error)}`);
      }
      
      const errorItem = {
        id: `error-${Date.now()}`,
        type: "message",
        role: "system",
        content: [
          {
            type: "input_text",
            text: `Error processing Devin AI output: ${(error as Error)?.message || String(error)}`,
          } as ResponseInputText,
        ],
      } as ResponseItem;
      this.onItem(errorItem);
    }
  }

  /**
   * Format the input for the Devin API
   */
  /**
   * Format the input for the Devin API
   */
  private formatInputForDevin(input: Array<ResponseInputItem>): string {
    return input
      .map((item) => {
        if (item.type === "message" && item.role === "user") {
          if (typeof item.content === "string") {
            return item.content;
          } else if (Array.isArray(item.content)) {
            return (item.content as Array<{type: string; text: string}>)
              .map((content: {type: string; text: string}) => {
                if (content.type === "input_text") {
                  return content.text;
                }
                return "";
              })
              .join("");
          }
        }
        return "";
      })
      .join("\n");
  }
  
  /**
   * List all active Devin sessions
   * @returns Array of session information
   */
  public async listSessions(): Promise<Array<{id: string; status: string; title: string}>> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/sessions`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          signal: this.execAbortController?.signal,
        }
      );
      
      if (Array.isArray(response.data.sessions)) {
        response.data.sessions.forEach((session: {session_id: string; status: string; title: string}) => {
          this.activeSessions.set(session.session_id, {
            status: session.status,
            title: session.title
          });
        });
      }
      
      if (isLoggingEnabled()) {
        log(`DevinAgent.listSessions() found ${response.data.sessions?.length || 0} sessions`);
      }
      
      return (response.data.sessions || []).map((session: {session_id: string; status: string; title: string}) => ({
        id: session.session_id,
        status: session.status,
        title: session.title
      }));
    } catch (error) {
      if (isLoggingEnabled()) {
        // Use sanitized error message to prevent credential exposure
        log(`DevinAgent.listSessions() error: ${SecureCredentials.sanitizeErrorMessage(error)}`);
      }
      
      // Handle authentication errors specifically
      const axiosError = error as { response?: { status: number; data?: { error?: string } } };
      if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
        throw new Error("Authentication failed. Please check your Devin API key.");
      }
      
      throw error;
    }
  }
  
  /**
   * Get active sessions from local cache
   * @returns Map of session ID to session information
   */
  public getActiveSessions(): Map<string, {status: string; title: string}> {
    return this.activeSessions;
  }
  
  /**
   * Create a recursive session that can spawn additional sessions
   * @param prompt The prompt to send to Devin
   * @param parentSessionId Optional parent session ID for tracking hierarchy
   * @returns Session ID of the new session
   */
  public async createRecursiveSession(prompt: string, parentSessionId?: string): Promise<string> {
    try {
      const sessionMetadata = parentSessionId ? { parent_session_id: parentSessionId } : {};
      
      const response = await axios.post(
        `${this.baseUrl}/sessions`,
        {
          prompt,
          effort_level: "standard",
          metadata: {
            ...sessionMetadata,
            is_recursive: true,
            spawned_by: "codex-cli"
          }
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          signal: this.execAbortController?.signal,
        }
      );
      
      const sessionId = response.data.id;
      
      if (isLoggingEnabled()) {
        log(`DevinAgent.createRecursiveSession() created session with ID: ${sessionId}`);
      }
      
      this.activeSessions.set(sessionId, {
        status: "running",
        title: prompt.substring(0, 50) + (prompt.length > 50 ? "..." : "")
      });
      
      return sessionId;
    } catch (error) {
      if (isLoggingEnabled()) {
        // Use sanitized error message to prevent credential exposure
        log(`DevinAgent.createRecursiveSession() error: ${SecureCredentials.sanitizeErrorMessage(error)}`);
      }
      
      // Handle authentication errors specifically
      const axiosError = error as { response?: { status: number; data?: { error?: string } } };
      if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
        throw new Error("Authentication failed. Please check your Devin API key.");
      }
      
      throw error;
    }
  }
}
