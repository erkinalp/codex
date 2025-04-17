# Codex CLI API Reference

This document provides a comprehensive reference for the APIs used by Codex CLI, including both OpenAI and Devin AI endpoints.

## Table of Contents

- [OpenAI API](#openai-api)
- [Devin AI API](#devin-ai-api)
  - [Authentication](#authentication)
  - [Sessions](#sessions)
  - [Messages](#messages)
  - [Files](#files)
  - [Structured Output](#structured-output)
  - [Error Handling](#error-handling)

## OpenAI API

Codex CLI uses the OpenAI API for its default functionality. For details on the OpenAI API, refer to the [OpenAI API Reference](https://platform.openai.com/docs/api-reference).

## Devin AI API

Codex CLI now supports integration with the Devin AI API, allowing you to leverage Devin's advanced capabilities directly from the command line.

### Authentication

All requests to the Devin AI API require authentication using an API key.

```typescript
// Authentication example
const headers = {
  'Authorization': `Bearer ${DEVIN_API_KEY}`,
  'Content-Type': 'application/json'
};
```

API keys for Devin AI start with `apk_`. The API key can be provided in several ways:

1. Environment variable: `DEVIN_API_KEY`
2. Configuration file: `~/.codex/config.yaml`
3. Command line: `--devin-api-key`

### Sessions

#### Create Session

Creates a new Devin AI session.

**Endpoint:** `POST https://api.devin.ai/v1/sessions`

**Request Body:**

```json
{
  "title": "Session title",
  "effort": "standard", // or "deep"
  "planning_mode_agency": "auto_confirm" // or "sync_confirm"
}
```

**Response:**

```json
{
  "id": "session_123456789",
  "title": "Session title",
  "status": "created",
  "created_at": "2025-04-17T08:30:00Z"
}
```

**Implementation in Codex CLI:**

```typescript
async createSession(
  title: string, 
  effort: "standard" | "deep" = "standard",
  planningModeAgency: "auto_confirm" | "sync_confirm" = "auto_confirm"
): Promise<string> {
  try {
    const response = await axios.post(
      "https://api.devin.ai/v1/sessions",
      { 
        title, 
        effort,
        planning_mode_agency: planningModeAgency
      },
      { headers: this.headers }
    );
    return response.data.id;
  } catch (error) {
    this.handleApiError(error, "Failed to create session");
    throw error;
  }
}
```

#### Get Session Status

Retrieves the status of a Devin AI session.

**Endpoint:** `GET https://api.devin.ai/v1/sessions/{session_id}`

**Response:**

```json
{
  "id": "session_123456789",
  "title": "Session title",
  "status": "running",
  "created_at": "2025-04-17T08:30:00Z"
}
```

**Implementation in Codex CLI:**

```typescript
async getSessionStatus(sessionId: string): Promise<any> {
  try {
    const response = await axios.get(
      `https://api.devin.ai/v1/sessions/${sessionId}`,
      { headers: this.headers }
    );
    return response.data;
  } catch (error) {
    this.handleApiError(error, "Failed to get session status");
    throw error;
  }
}
```

#### List Sessions

Lists all active Devin AI sessions.

**Endpoint:** `GET https://api.devin.ai/v1/sessions`

**Response:**

```json
{
  "sessions": [
    {
      "id": "session_123456789",
      "title": "Session title",
      "status": "running",
      "created_at": "2025-04-17T08:30:00Z"
    }
  ]
}
```

**Implementation in Codex CLI:**

```typescript
async listSessions(): Promise<Array<any>> {
  try {
    const response = await axios.get(
      "https://api.devin.ai/v1/sessions",
      { headers: this.headers }
    );
    return response.data.sessions || [];
  } catch (error) {
    this.handleApiError(error, "Failed to list sessions");
    throw error;
  }
}
```

#### Terminate Session

Terminates a Devin AI session.

**Endpoint:** `DELETE https://api.devin.ai/v1/sessions/{session_id}`

**Response:**

```json
{
  "id": "session_123456789",
  "status": "terminated"
}
```

**Implementation in Codex CLI:**

```typescript
async terminateSession(sessionId: string): Promise<void> {
  try {
    await axios.delete(
      `https://api.devin.ai/v1/sessions/${sessionId}`,
      { headers: this.headers }
    );
  } catch (error) {
    this.handleApiError(error, "Failed to terminate session");
    throw error;
  }
}
```

### Messages

#### Send Message

Sends a message to a Devin AI session.

**Endpoint:** `POST https://api.devin.ai/v1/sessions/{session_id}/messages`

**Request Body:**

```json
{
  "content": "Your message here",
  "attachments": ["file_url_1", "file_url_2"]
}
```

**Response:**

```json
{
  "id": "message_123456789",
  "session_id": "session_123456789",
  "status": "sent",
  "created_at": "2025-04-17T08:35:00Z"
}
```

**Implementation in Codex CLI:**

```typescript
async sendMessage(
  sessionId: string, 
  content: string, 
  attachments: Array<string> = []
): Promise<any> {
  try {
    const response = await axios.post(
      `https://api.devin.ai/v1/sessions/${sessionId}/messages`,
      { content, attachments },
      { headers: this.headers }
    );
    return response.data;
  } catch (error) {
    this.handleApiError(error, "Failed to send message");
    throw error;
  }
}
```

#### Get Messages

Retrieves messages from a Devin AI session.

**Endpoint:** `GET https://api.devin.ai/v1/sessions/{session_id}/messages`

**Response:**

```json
{
  "messages": [
    {
      "id": "message_123456789",
      "session_id": "session_123456789",
      "role": "user",
      "content": "Your message here",
      "created_at": "2025-04-17T08:35:00Z"
    },
    {
      "id": "message_987654321",
      "session_id": "session_123456789",
      "role": "assistant",
      "content": "Devin's response",
      "created_at": "2025-04-17T08:36:00Z"
    }
  ]
}
```

**Implementation in Codex CLI:**

```typescript
async getMessages(sessionId: string): Promise<Array<any>> {
  try {
    const response = await axios.get(
      `https://api.devin.ai/v1/sessions/${sessionId}/messages`,
      { headers: this.headers }
    );
    return response.data.messages || [];
  } catch (error) {
    this.handleApiError(error, "Failed to get messages");
    throw error;
  }
}
```

### Files

#### Upload File

Uploads a file to be used in a Devin AI session.

**Endpoint:** `POST https://api.devin.ai/v1/files`

**Request Body:**

Multipart form data with:
- `file`: The file to upload
- `purpose`: The purpose of the file (e.g., "attachment")

**Response:**

```json
{
  "id": "file_123456789",
  "url": "https://api.devin.ai/v1/files/file_123456789",
  "filename": "example.txt",
  "size": 1024,
  "created_at": "2025-04-17T08:40:00Z"
}
```

**Implementation in Codex CLI:**

```typescript
async uploadFile(
  filename: string, 
  content: Buffer, 
  autoPresent: boolean = true
): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('file', new Blob([content]), filename);
    formData.append('purpose', 'attachment');
    
    const response = await axios.post(
      "https://api.devin.ai/v1/files",
      formData,
      { 
        headers: {
          ...this.headers,
          'Content-Type': 'multipart/form-data'
        }
      }
    );
    
    const fileUrl = response.data.url;
    
    // Automatically present the file to the current session if requested
    if (autoPresent && this.sessionId) {
      await this.sendMessage(this.sessionId, `Here is the file ${filename}`, [fileUrl]);
    }
    
    return fileUrl;
  } catch (error) {
    this.handleApiError(error, "Failed to upload file");
    throw error;
  }
}
```

#### Get File

Retrieves a file from the Devin AI API.

**Endpoint:** `GET https://api.devin.ai/v1/files/{file_id}`

**Response:**

The file content with appropriate Content-Type header.

**Implementation in Codex CLI:**

```typescript
async getFile(fileId: string): Promise<Buffer> {
  try {
    const response = await axios.get(
      `https://api.devin.ai/v1/files/${fileId}`,
      { 
        headers: this.headers,
        responseType: 'arraybuffer'
      }
    );
    return Buffer.from(response.data);
  } catch (error) {
    this.handleApiError(error, "Failed to get file");
    throw error;
  }
}
```

### Structured Output

Devin AI supports structured output, which allows for richer and more interactive presentations than simple text responses. The structured output is returned as part of the message content in a specific format.

#### Structured Output Format

```json
{
  "type": "structured_output",
  "content": {
    "format": "markdown",
    "text": "# Heading\n\nContent in markdown format",
    "sections": [
      {
        "title": "Section Title",
        "content": "Section content"
      }
    ],
    "code_blocks": [
      {
        "language": "typescript",
        "code": "console.log('Hello, world!');"
      }
    ],
    "tables": [
      {
        "headers": ["Column 1", "Column 2"],
        "rows": [
          ["Value 1", "Value 2"],
          ["Value 3", "Value 4"]
        ]
      }
    ]
  }
}
```

**Implementation in Codex CLI:**

```typescript
// Example of processing structured output
processStructuredOutput(message: any): ResponseItem {
  if (message.type === "structured_output") {
    // Convert structured output to a format compatible with Codex CLI UI
    return {
      type: "message",
      role: "assistant",
      content: this.formatStructuredContent(message.content),
      name: "devin"
    };
  }
  
  // Handle regular messages
  return {
    type: "message",
    role: "assistant",
    content: message.content,
    name: "devin"
  };
}

formatStructuredContent(content: any): string {
  let formattedContent = "";
  
  // Add main text
  if (content.text) {
    formattedContent += content.text + "\n\n";
  }
  
  // Add sections
  if (content.sections && content.sections.length > 0) {
    content.sections.forEach((section: any) => {
      formattedContent += `## ${section.title}\n\n${section.content}\n\n`;
    });
  }
  
  // Add code blocks
  if (content.code_blocks && content.code_blocks.length > 0) {
    content.code_blocks.forEach((codeBlock: any) => {
      formattedContent += `\`\`\`${codeBlock.language}\n${codeBlock.code}\n\`\`\`\n\n`;
    });
  }
  
  // Add tables
  if (content.tables && content.tables.length > 0) {
    content.tables.forEach((table: any) => {
      if (table.headers && table.headers.length > 0) {
        formattedContent += `| ${table.headers.join(" | ")} |\n`;
        formattedContent += `| ${table.headers.map(() => "---").join(" | ")} |\n`;
        
        if (table.rows && table.rows.length > 0) {
          table.rows.forEach((row: any) => {
            formattedContent += `| ${row.join(" | ")} |\n`;
          });
        }
        
        formattedContent += "\n";
      }
    });
  }
  
  return formattedContent;
}
```

### Error Handling

The Devin AI API returns standard HTTP status codes to indicate the success or failure of a request. Error responses include a JSON object with details about the error.

#### Error Response Format

```json
{
  "error": {
    "message": "Error message",
    "type": "error_type",
    "code": "error_code"
  }
}
```

**Common Error Codes:**

- `401`: Authentication error (invalid API key)
- `404`: Resource not found
- `429`: Rate limit exceeded
- `500`: Internal server error

**Implementation in Codex CLI:**

```typescript
handleApiError(error: any, context: string): void {
  // Sanitize error message to remove API key if present
  const sanitizedError = this.secureCredentials.sanitizeError(error);
  
  if (sanitizedError.response) {
    const { status, data } = sanitizedError.response;
    
    switch (status) {
      case 401:
        throw new Error(`${context}: Authentication failed. Please check your Devin API key.`);
      case 404:
        throw new Error(`${context}: Resource not found.`);
      case 429:
        throw new Error(`${context}: Rate limit exceeded. Please try again later.`);
      case 500:
        throw new Error(`${context}: Internal server error. Please try again later.`);
      default:
        throw new Error(`${context}: ${data?.error?.message || 'Unknown error'}`);
    }
  } else if (sanitizedError.request) {
    throw new Error(`${context}: No response received from server.`);
  } else {
    throw new Error(`${context}: ${sanitizedError.message}`);
  }
}
```

## API Key Validation

Codex CLI includes validation for Devin API keys to ensure they are in the correct format before making API requests.

```typescript
validateApiKey(apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }
  
  // Devin API keys start with 'apk_'
  return apiKey.trim().startsWith('apk_');
}
```

## Secure Credential Handling

Codex CLI implements secure credential handling for Devin API keys, including:

- API key validation
- Credential masking in logs
- Error message sanitization to prevent credential exposure

```typescript
sanitizeError(error: any): any {
  if (!error) {
    return error;
  }
  
  // Create a deep copy of the error to avoid modifying the original
  const sanitizedError = JSON.parse(JSON.stringify(error));
  
  // Sanitize error message
  if (sanitizedError.message) {
    sanitizedError.message = this.sanitizeString(sanitizedError.message);
  }
  
  // Sanitize response data
  if (sanitizedError.response && sanitizedError.response.data) {
    if (typeof sanitizedError.response.data === 'string') {
      sanitizedError.response.data = this.sanitizeString(sanitizedError.response.data);
    } else if (sanitizedError.response.data.error && sanitizedError.response.data.error.message) {
      sanitizedError.response.data.error.message = this.sanitizeString(
        sanitizedError.response.data.error.message
      );
    }
  }
  
  return sanitizedError;
}

sanitizeString(str: string): string {
  if (!str || typeof str !== 'string') {
    return str;
  }
  
  // Replace API key in string with [REDACTED]
  if (this.apiKey) {
    return str.replace(new RegExp(this.apiKey, 'g'), '[REDACTED]');
  }
  
  // Also redact any string that looks like an API key
  return str.replace(/apk_[a-zA-Z0-9]{16,}/g, '[REDACTED]');
}
```

---

For more information about the Devin AI API, refer to the [official Devin AI API Reference](https://docs.devin.ai/api-reference).
