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
