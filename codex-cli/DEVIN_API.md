# Devin AI API Support for Codex CLI

This document provides information about using Devin AI API with the Codex CLI tool.

## Overview

Codex CLI now supports Devin AI API integration, allowing you to leverage Devin's advanced capabilities directly from the command line. This integration enables the same functionality that works with OpenAI to work with Devin AI, to the extent that the Devin API allows.

## Configuration

### API Key

To use Devin AI with Codex CLI, you need to set your Devin API key. Devin API keys start with `apk_`.

You can set your API key in one of the following ways:

1. **Environment Variable**:
   ```bash
   export DEVIN_API_KEY=your_apk_key_here
   ```

2. **Configuration File**:
   Add your API key to your Codex CLI configuration file.

3. **Command Line**:
   ```bash
   codex --devin-api-key your_apk_key_here
   ```

### Available Models

Codex CLI supports the following Devin models:

- `devin-standard`: Standard Devin model for most tasks
- `devin-deep`: Deep effort Devin model for more complex tasks

## Usage

### Basic Usage

To use Devin AI with Codex CLI, specify a Devin model when running the command:

```bash
codex --model devin-standard
```

or

```bash
codex --model devin-deep
```

### Approval Modes

Devin AI supports two approval modes:

- `sync_confirm` (Approve Plan): Devin will create a plan and wait for your approval before executing it
- `auto_confirm` (Full Auto): Devin will automatically execute the plan without waiting for approval

You can specify the approval mode when running Codex CLI:

```bash
# Approve Plan mode
codex --model devin-standard --approval-mode approve-plan

# Full Auto mode
codex --model devin-standard --approval-mode full-auto
```

### File Uploads

Codex CLI supports file uploads to Devin AI. When you reference a file in your conversation, Codex CLI will automatically upload the file and present it to the Devin agent.

Example:

```bash
codex --model devin-standard
> Please analyze the code in src/main.js
```

The file `src/main.js` will be automatically uploaded and presented to the Devin agent.

### Structured Output

Devin AI supports structured output, which Codex CLI leverages to enhance its UI components. This allows for richer and more interactive presentations than simple text responses.

## Features

### Session Management

Codex CLI manages Devin AI sessions automatically, handling session creation, message sending, and session termination.

### Secure Credential Handling

Codex CLI implements secure credential handling for Devin API keys, including:

- API key validation
- Credential masking in logs
- Error message sanitization to prevent credential exposure

### File Upload Presentation

Codex CLI handles the presentation of uploaded files to the Devin agent, ensuring that files are correctly accessible to the agent during the conversation.

### Returned Attachments

Codex CLI also handles attachments returned by the Devin agent in responses. When the Devin API returns attachments, they are properly processed and displayed to the user in the CLI interface.

Example:

```bash
codex --model devin-standard
> Can you generate a diagram for me?
```

If the Devin agent generates and returns an attachment (like an image or a file), it will be properly displayed or linked in the CLI interface.

### Local File Path Detection

Codex CLI detects when users refer to local file paths in their messages and prompts them for remote processing, as the Devin agent can only manipulate files it has access to.

Example:

```bash
codex --model devin-standard
> Can you analyze the file at /home/user/myproject/src/main.js?
```

In this scenario, Codex CLI will detect the local file path and add a prompt to the message:

```
Note: I noticed you referenced local file path(s): /home/user/myproject/src/main.js. 
The Devin agent can only access files that are explicitly shared. 
Would you like to upload this file, use remote processing instead, or cancel this request?
```

This helps users understand that the Devin agent cannot directly access files on their local system and gives them options to proceed, including uploading the file, using remote processing, or canceling the request entirely if the file is not suitable for remote processing.

#### File Path URL Substitution

When users choose to upload files from the local file path prompt, Codex CLI automatically:

1. Uploads the file to the Devin API
2. Substitutes the local file path in the original message with a markdown-formatted link to the uploaded file
3. Sends the modified message with the substituted URL to the Devin agent

For example, if the user chooses to upload the file from the previous example, the message sent to Devin would look like:

```
Can you analyze the file at [main.js](https://api.devin.ai/v1/files/file_abc123)?
```

This seamless substitution ensures that:
- The Devin agent can access and process the file content
- The context of the original request is preserved
- The user doesn't need to manually upload and reference the file
- The conversation flow remains natural and uninterrupted

## Examples

### Example 1: Basic Conversation

```bash
codex --model devin-standard
> What is the time complexity of a binary search?
```

### Example 2: Code Analysis with File Upload

```bash
codex --model devin-deep
> Please analyze the performance of the algorithm in src/algorithm.js
```

### Example 3: Multi-file Project Analysis

```bash
codex --model devin-deep --full-context
> Please review my React component structure and suggest improvements
```

## Troubleshooting

### API Key Issues

If you encounter authentication errors, ensure that:

1. Your Devin API key is correctly set
2. Your API key starts with `apk_`
3. Your API key has not expired

### Session Errors

If you encounter session-related errors:

1. Check your internet connection
2. Verify that your API key has the necessary permissions
3. Try using a different model (e.g., switch from `devin-deep` to `devin-standard`)

## Limitations

- Some features available in the Devin web interface may not be available through the API
- File upload size may be limited by the Devin API
- Session duration may be limited by the Devin API

## Privacy and Security

- Codex CLI implements secure credential handling to protect your API keys
- Files uploaded to Devin AI are subject to Devin's privacy policy
- For private or sensitive code, review Devin's terms of service before uploading

## Further Resources

- [Devin AI API Reference](https://docs.devin.ai/api-reference)
- [Devin AI Documentation](https://docs.devin.ai)
