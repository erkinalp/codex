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
      .replace(/api[_-]?key[=:]\s*[a-zA-Z0-9._-]+/gi, 'api_key=[REDACTED]')
      .replace(/apikey[=:]\s*[a-zA-Z0-9._-]+/gi, 'apikey=[REDACTED]');
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
 * Interface for file output response
 */
interface ResponseOutputFile {
  type: "output_file";
  file_url: string;
  filename: string;
  mime_type: string;
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
  plan?: {
    content: string;
    status: "pending" | "approved" | "rejected";
  };
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
   * @param planningModeAgency The planning mode agency (auto_confirm or sync_confirm)
   */
  private async createSession(
    prompt: string, 
    effortLevel: "standard" | "deep" = "standard",
    planningModeAgency?: "auto_confirm" | "sync_confirm"
  ): Promise<string> {
    try {
      this.retryCount = 0;
      
      if (!planningModeAgency) {
        planningModeAgency = this._approvalPolicy === "full-auto" ? 
          "auto_confirm" : 
          (this._approvalPolicy === "approve-plan" ? "sync_confirm" : "auto_confirm");
      }
      
      if (isLoggingEnabled()) {
        log(`DevinAgent.createSession() using planning_mode_agency: ${planningModeAgency}`);
      }
      
      const response = await axios.post(
        `${this.baseUrl}/sessions`,
        {
          prompt,
          effort_level: effortLevel,
          planning_mode_agency: planningModeAgency,
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
      
      // Handle "out of credits" errors
      if (axiosError.response?.status === 402 || 
          (axiosError.response?.data?.error && 
           typeof axiosError.response.data.error === 'string' && 
           (axiosError.response.data.error.includes('insufficient credits') || 
            axiosError.response.data.error.includes('out of credits') ||
            axiosError.response.data.error.includes('credit limit')))) {
        throw new Error("Insufficient credits. Your Devin AI account has run out of credits. Please add more credits to your account and try again.");
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
   * @param sessionId The ID of the session to send the message to
   * @param message The message content
   * @param attachments Optional array of file URLs to attach to the message
   */
  private async sendMessage(sessionId: string, message: string, attachments?: string[]): Promise<void> {
    try {
      this.retryCount = 0;
      
      const messageData: { content: string; attachments?: string[] } = {
        content: message
      };
      
      if (attachments && attachments.length > 0) {
        messageData.attachments = attachments;
        
        if (isLoggingEnabled()) {
          log(`DevinAgent.sendMessage() attaching ${attachments.length} files to message`);
        }
      }
      
      await axios.post(
        `${this.baseUrl}/sessions/${sessionId}/messages`,
        messageData,
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
      
      // Handle "out of credits" errors
      if (axiosError.response?.status === 402 || 
          (axiosError.response?.data?.error && 
           typeof axiosError.response.data.error === 'string' && 
           (axiosError.response.data.error.includes('insufficient credits') || 
            axiosError.response.data.error.includes('out of credits') ||
            axiosError.response.data.error.includes('credit limit')))) {
        throw new Error("Insufficient credits. Your Devin AI account has run out of credits. Please add more credits to your account and try again.");
      }
      
      // Handle rate limiting and server errors with retry logic
      if (axiosError.response && (axiosError.response.status === 429 || axiosError.response.status >= 500) && this.retryCount < this.maxRetries) {
        this.retryCount++;
        const delay = this.retryDelayMs * this.retryCount;
        
        if (isLoggingEnabled()) {
          log(`DevinAgent.sendMessage() retrying in ${delay}ms (attempt ${this.retryCount}/${this.maxRetries})`);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.sendMessage(sessionId, message, attachments);
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
   * @param presentToAgent Whether to automatically present the file to the agent in the next message
   * @returns URL to the uploaded file
   */
  public async uploadFile(filePath: string, fileContent: Buffer | string, presentToAgent: boolean = true): Promise<string> {
    try {
      this.retryCount = 0;
      
      const formData = new FormData();
      const buffer = typeof fileContent === 'string' ? Buffer.from(fileContent) : fileContent;
      
      let mimeType = 'application/octet-stream';
      try {
        const { fileTypeFromBuffer } = await import('file-type');
        const fileType = await fileTypeFromBuffer(buffer);
        if (fileType) {
          mimeType = fileType.mime;
        } else {
          if (filePath.endsWith('.js') || filePath.endsWith('.ts')) mimeType = 'application/javascript';
          else if (filePath.endsWith('.json')) mimeType = 'application/json';
          else if (filePath.endsWith('.html')) mimeType = 'text/html';
          else if (filePath.endsWith('.css')) mimeType = 'text/css';
          else if (filePath.endsWith('.md')) mimeType = 'text/markdown';
          else if (filePath.endsWith('.txt')) mimeType = 'text/plain';
          else if (filePath.endsWith('.py')) mimeType = 'text/x-python';
          else if (filePath.endsWith('.java')) mimeType = 'text/x-java';
          else if (filePath.endsWith('.c') || filePath.endsWith('.cpp') || filePath.endsWith('.h')) mimeType = 'text/x-c';
          else if (filePath.endsWith('.go')) mimeType = 'text/x-go';
          else if (filePath.endsWith('.rs')) mimeType = 'text/x-rust';
          else if (filePath.endsWith('.rb')) mimeType = 'text/x-ruby';
          else if (filePath.endsWith('.php')) mimeType = 'text/x-php';
        }
      } catch (error) {
        if (isLoggingEnabled()) {
          log(`MIME type detection failed, using default: ${error}`);
        }
      }
      
      const blob = new Blob([buffer], { type: mimeType });
      const fileName = filePath.split('/').pop() || 'file';
      formData.append('file', blob, fileName);
      
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
      
      const fileUploadResponse = response.data as FileUploadResponse;
      const fileUrl = fileUploadResponse.url;
      
      if (isLoggingEnabled()) {
        log(`DevinAgent.uploadFile() uploaded file: ${filePath} with URL: ${fileUrl}`);
      }
      
      if (presentToAgent && this.sessionId) {
        await this.presentFileToAgent(this.sessionId, fileUrl, fileName);
      }
      
      return fileUrl;
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
      
      // Handle "out of credits" errors
      if (axiosError.response?.status === 402 || 
          (axiosError.response?.data?.error && 
           typeof axiosError.response.data.error === 'string' && 
           (axiosError.response.data.error.includes('insufficient credits') || 
            axiosError.response.data.error.includes('out of credits') ||
            axiosError.response.data.error.includes('credit limit')))) {
        throw new Error("Insufficient credits. Your Devin AI account has run out of credits. Please add more credits to your account and try again.");
      }
      
      // Handle rate limiting and server errors with retry logic
      if (axiosError.response && (axiosError.response.status === 429 || axiosError.response.status >= 500) && this.retryCount < this.maxRetries) {
        this.retryCount++;
        const delay = this.retryDelayMs * this.retryCount;
        
        if (isLoggingEnabled()) {
          log(`DevinAgent.uploadFile() retrying in ${delay}ms (attempt ${this.retryCount}/${this.maxRetries})`);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.uploadFile(filePath, fileContent, presentToAgent);
      }
      
      // Handle network connectivity errors
      const networkError = error as { code?: string };
      if (networkError.code === 'ECONNREFUSED' || networkError.code === 'ENOTFOUND' || networkError.code === 'ETIMEDOUT') {
        throw new Error(`Network error: Could not connect to Devin AI API. Please check your internet connection and try again. (${networkError.code})`);
      }
      
      throw error;
    }
  }
  
  /**
   * Present a file to the Devin agent
   * @param sessionId The ID of the session to present the file to
   * @param fileUrl The URL of the file to present
   * @param fileName The name of the file
   */
  private async presentFileToAgent(sessionId: string, fileUrl: string, fileName: string): Promise<void> {
    try {
      const message = `I've uploaded a file named "${fileName}" for you to review.`;
      await this.sendMessage(sessionId, message, [fileUrl]);
      
      if (isLoggingEnabled()) {
        log(`DevinAgent.presentFileToAgent() presented file ${fileName} to session: ${sessionId}`);
      }
      
      // Notify the user that the file was presented to the agent
      const responseItem = {
        id: `file-upload-${Date.now()}`,
        type: "message",
        role: "system",
        content: [
          {
            type: "input_text",
            text: `File "${fileName}" has been uploaded and presented to Devin.`,
          } as ResponseInputText,
        ],
      } as ResponseItem;
      this.onItem(responseItem);
    } catch (error) {
      if (isLoggingEnabled()) {
        log(`DevinAgent.presentFileToAgent() error: ${SecureCredentials.sanitizeErrorMessage(error)}`);
      }
      
      const errorItem = {
        id: `error-${Date.now()}`,
        type: "message",
        role: "system",
        content: [
          {
            type: "input_text",
            text: `Error presenting file to Devin: ${(error as Error)?.message || String(error)}`,
          } as ResponseInputText,
        ],
      } as ResponseItem;
      this.onItem(errorItem);
    }
  }

  /**
   * Run the agent with the given input
   * @param input Array of response input items
   * @param previousResponseId Optional ID of a previous session to continue
   * @param fileAttachments Optional array of file URLs to attach to the message
   */
  public async run(
    input: Array<ResponseInputItem>,
    previousResponseId: string = "",
    fileAttachments: string[] = [],
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
      
      const planningModeAgency = this._approvalPolicy === "full-auto" ? 
        "auto_confirm" : 
        (this._approvalPolicy === "approve-plan" ? "sync_confirm" : "auto_confirm");
      
      if (isLoggingEnabled()) {
        log(`DevinAgent.run(): using planning_mode_agency: ${planningModeAgency}`);
      }
      
      try {
        const extractedAttachments = this.extractFileAttachments(input);
        
        const allAttachments = [...fileAttachments, ...extractedAttachments];
        
        if (isLoggingEnabled() && allAttachments.length > 0) {
          log(`DevinAgent.run(): found ${allAttachments.length} file attachments to include`);
        }
        
        if (this.sessionId) {
          await this.sendMessage(this.sessionId, prompt, allAttachments.length > 0 ? allAttachments : undefined);
        } else {
          this.sessionId = await this.createSession(prompt, effortLevel, planningModeAgency);
          this.onLastResponseId(this.sessionId);
          
          if (allAttachments.length > 0) {
            await this.sendMessage(
              this.sessionId, 
              "Here are the files related to my request:", 
              allAttachments
            );
          }
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
   * Extract file attachments from input items
   * @param input Array of response input items
   * @returns Array of file URLs
   */
  private extractFileAttachments(input: Array<ResponseInputItem>): string[] {
    const attachments: string[] = [];
    
    for (const item of input) {
      // Handle message items with content
      if (item.type === "message" && "content" in item) {
        const messageItem = item as ResponseInputItem.Message;
        
        // Look for file content in the message
        for (const contentItem of messageItem.content || []) {
          if (contentItem.type === "input_image" && "image_url" in contentItem) {
            const imageUrl = contentItem.image_url;
            if (typeof imageUrl === 'string' && imageUrl) {
              attachments.push(imageUrl);
            }
          }
          
          if (contentItem.type === "input_file" && "file_url" in contentItem) {
            const fileUrl = contentItem.file_url;
            if (typeof fileUrl === 'string' && fileUrl) {
              attachments.push(fileUrl);
            }
          }
        }
      }
    }
    
    if (isLoggingEnabled() && attachments.length > 0) {
      log(`DevinAgent.extractFileAttachments(): found ${attachments.length} file attachments`);
    }
    
    return attachments;
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
      if (sessionData.plan) {
        const planStatus = sessionData.plan.status;
        const planPrefix = planStatus === "pending" ? 
          "📋 **Plan Awaiting Approval**\n\n" : 
          (planStatus === "approved" ? "✅ **Plan Approved**\n\n" : "❌ **Plan Rejected**\n\n");
        
        const responseItem = {
          id: `devin-plan-${Date.now()}`,
          type: "message",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text: `${planPrefix}${sessionData.plan.content}`,
              annotations: [],
            } as ResponseOutputText,
          ],
        } as ResponseItem;
        this.onItem(responseItem);
        
        if (planStatus === "pending" && this._approvalPolicy === "approve-plan") {
          const approvalItem = {
            id: `devin-plan-approval-${Date.now()}`,
            type: "message",
            role: "system",
            content: [
              {
                type: "input_text",
                text: "Do you want to approve this plan? (Type 'yes' to approve or 'no' to reject)",
              } as ResponseInputText,
            ],
          } as ResponseItem;
          this.onItem(approvalItem);
        }
      }
      
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
          } else if (output.type === "table") {
            // Handle table output
            const table = output.content as { headers: string[], rows: string[][] };
            let tableMarkdown = "";
            
            if (table.headers && table.headers.length > 0) {
              tableMarkdown += `| ${table.headers.join(" | ")} |\n`;
              tableMarkdown += `| ${table.headers.map(() => "---").join(" | ")} |\n`;
              
              if (table.rows && table.rows.length > 0) {
                table.rows.forEach(row => {
                  tableMarkdown += `| ${row.join(" | ")} |\n`;
                });
              }
            }
            
            const responseItem = {
              id: `devin-${Date.now()}`,
              type: "message",
              role: "assistant",
              content: [
                {
                  type: "output_text",
                  text: tableMarkdown,
                  annotations: [],
                } as ResponseOutputText,
              ],
            } as ResponseItem;
            this.onItem(responseItem);
          } else if (output.type === "list") {
            // Handle list output
            const list = output.content as { items: string[], ordered: boolean };
            let listMarkdown = "";
            
            if (list.items && list.items.length > 0) {
              list.items.forEach((item, index) => {
                if (list.ordered) {
                  listMarkdown += `${index + 1}. ${item}\n`;
                } else {
                  listMarkdown += `* ${item}\n`;
                }
              });
            }
            
            const responseItem = {
              id: `devin-${Date.now()}`,
              type: "message",
              role: "assistant",
              content: [
                {
                  type: "output_text",
                  text: listMarkdown,
                  annotations: [],
                } as ResponseOutputText,
              ],
            } as ResponseItem;
            this.onItem(responseItem);
          } else if (output.type === "attachment") {
            // Handle attachment output
            const attachment = output.content as { url: string; filename?: string; mime_type?: string };
            
            if (attachment.url) {
              const attachmentFilename = attachment.filename || `attachment-${Date.now()}`;
              const attachmentMimeType = attachment.mime_type || 'application/octet-stream';
              
              const responseItem = {
                id: `devin-${Date.now()}`,
                type: "message",
                role: "assistant",
                content: [
                  {
                    type: "output_text",
                    text: `File: ${attachmentFilename}`,
                    annotations: [],
                  } as ResponseOutputText,
                  {
                    type: "output_file",
                    file_url: attachment.url,
                    filename: attachmentFilename,
                    mime_type: attachmentMimeType,
                  } as ResponseOutputFile,
                ],
              } as ResponseItem;
              
              if (isLoggingEnabled()) {
                log(`DevinAgent.processSessionOutput(): processing attachment ${attachmentFilename} (${attachmentMimeType})`);
              }
              
              this.onItem(responseItem);
            }
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
