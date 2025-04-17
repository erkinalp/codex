# Codex CLI Usage Guide

This guide provides examples and best practices for using Codex CLI with both OpenAI and Devin AI models.

## Table of Contents

- [Basic Usage](#basic-usage)
- [OpenAI Models](#openai-models)
- [Devin AI Models](#devin-ai-models)
- [File Operations](#file-operations)
- [Project Analysis](#project-analysis)
- [Structured Output](#structured-output)
- [Advanced Features](#advanced-features)
- [Troubleshooting](#troubleshooting)

## Basic Usage

Codex CLI can be used in interactive mode or with a prompt as input:

```bash
# Interactive mode
codex

# With a prompt
codex "explain this codebase to me"

# With a prompt and full auto mode (OpenAI)
codex --approval-mode full-auto "create a todo-list app"

# With a prompt and Devin's full auto mode
codex --model devin-standard --approval-mode full-auto "create a todo-list app"

# With a prompt and Devin's approve plan mode
codex --model devin-standard --approval-mode approve-plan "create a todo-list app"
```

## OpenAI Models

By default, Codex CLI uses the OpenAI API with the `o4-mini` model. You can specify a different model using the `--model` flag:

```bash
# Use GPT-4o
codex --model gpt-4o "optimize this function for performance"

# Use o3
codex --model o3 "explain the difference between promises and async/await"
```

## Devin AI Models

Codex CLI supports Devin AI models, which provide enhanced capabilities for software development tasks:

```bash
# Use Devin standard model
codex --model devin-standard "analyze this codebase and suggest improvements"

# Use Devin deep effort model for complex tasks
codex --model devin-deep "refactor our authentication system to use JWT tokens"
```

### Setting Up Devin API Key

Before using Devin models, you need to set up your Devin API key:

```bash
# Set API key as environment variable
export DEVIN_API_KEY="your_devin_api_key_here"

# Or provide it directly in the command
codex --model devin-standard --devin-api-key "your_devin_api_key_here" "your prompt here"
```

You can also add your Devin API key to the Codex configuration file:

```yaml
# ~/.codex/config.yaml
model: devin-standard
DEVIN_API_KEY: your_devin_api_key_here
```

## File Operations

Codex CLI can perform various file operations, including creating, modifying, and analyzing files:

### With OpenAI Models

```bash
# Create a new file
codex "create a file called app.js that implements a simple Express server"

# Modify an existing file
codex "update the error handling in server.js to use try/catch blocks"

# Analyze a file
codex "explain what this code does in utils.js"
```

### With Devin AI Models

```bash
# Create a new file with Devin
codex --model devin-standard "create a React component for a user profile page"

# Modify an existing file with Devin
codex --model devin-standard "refactor the authentication middleware in auth.js to use JWT"

# Analyze a file with Devin
codex --model devin-deep "analyze the performance issues in DataTable.tsx"
```

## Project Analysis

Codex CLI can analyze entire projects and provide insights:

### With OpenAI Models

```bash
# Analyze a project
codex "analyze this project and suggest improvements"

# Generate documentation
codex "generate documentation for this project"
```

### With Devin AI Models

```bash
# Comprehensive project analysis with Devin
codex --model devin-deep "perform a comprehensive analysis of this project and suggest architectural improvements"

# Code quality review
codex --model devin-standard "review the code quality of this project and suggest best practices"

# Security audit
codex --model devin-deep "perform a security audit of this codebase and identify potential vulnerabilities"
```

## File Upload Functionality

Codex CLI supports file uploads to Devin AI. When you reference a file in your conversation, Codex CLI will automatically upload the file and present it to the Devin agent:

```bash
# Analyze a specific file
codex --model devin-standard "analyze the code in src/main.js"

# Analyze multiple files
codex --model devin-deep "compare the implementations in auth.js and auth-v2.js"

# Analyze image files
codex --model devin-standard "what's in these images?" image1.jpg image2.png
```

## Structured Output

Devin AI models support structured output, which enhances the presentation in Codex CLI:

```bash
# Generate a structured report
codex --model devin-standard "create a detailed code review report for this repository"

# Generate a structured analysis
codex --model devin-deep "analyze the performance of our database queries and present the results in a structured format"
```

Example of structured output:

```
# Code Review Report

## Overview
This repository contains a React application with several performance issues.

## Issues Found
1. **Unnecessary Re-renders**
   - Component: `UserList.tsx`
   - Issue: Missing dependency array in useEffect
   - Severity: High

2. **Memory Leaks**
   - Component: `DataFetcher.tsx`
   - Issue: Unsubscribed event listeners
   - Severity: Medium

## Recommendations
- Add proper dependency arrays to all useEffect hooks
- Implement proper cleanup functions in useEffect
- Consider using React.memo for expensive components
```

## Advanced Features

### Deep Effort Sessions

For complex tasks, use the `devin-deep` model which provides more thorough analysis:

```bash
# Refactoring a complex system
codex --model devin-deep "refactor our authentication system to use JWT tokens and implement proper error handling"

# Architectural design
codex --model devin-deep "design a scalable microservice architecture for our e-commerce platform"
```

### Multi-file Project Analysis

Analyze multiple files or entire projects with Devin AI:

```bash
# Analyze multiple files
codex --model devin-deep --full-context "review our React component structure and suggest improvements"

# Analyze project architecture
codex --model devin-deep --full-context "analyze our project architecture and suggest improvements for scalability"
```

## Troubleshooting

### API Key Issues

If you encounter authentication errors:

1. Ensure your Devin API key is correctly set
2. Verify that your API key starts with `apk_`
3. Check that your API key has not expired

```bash
# Verify your API key is set
echo $DEVIN_API_KEY

# Test with a simple command
codex --model devin-standard "Hello, Devin"
```

### Session Errors

If you encounter session-related errors:

1. Check your internet connection
2. Verify that your API key has the necessary permissions
3. Try using a different model (e.g., switch from `devin-deep` to `devin-standard`)

```bash
# Try with a different model
codex --model devin-standard "your prompt here"
```

### File Upload Issues

If you encounter issues with file uploads:

1. Check that the file exists and is readable
2. Verify that the file size is within the limits
3. Try uploading a smaller file first

```bash
# Test with a small file
codex --model devin-standard "what's in this file?" small-test-file.txt
```

## Examples

Here are some complete examples of using Codex CLI with Devin AI:

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

### Example 4: Structured Output Report

```bash
codex --model devin-standard
> Generate a structured report on the code quality of this repository
```

### Example 5: Refactoring with Deep Effort

```bash
codex --model devin-deep
> Refactor the authentication system in auth.js to use JWT tokens and implement proper error handling
```

For more detailed information about the Devin AI API, refer to the [DEVIN_API.md](./DEVIN_API.md) and [API_REFERENCE.md](./API_REFERENCE.md) files.
