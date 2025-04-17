#!/usr/bin/env node

// Test script for Devin API features
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { DevinAgent } from './src/utils/agent/devin/devin-agent.js';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple logger
const log = (message) => console.log(`[${new Date().toISOString()}] ${message}`);

// Test function
async function testDevinFeatures() {
  try {
    const apiKey = process.env.DEVIN_API_KEY;
    if (!apiKey) {
      throw new Error('DEVIN_API_KEY environment variable is required');
    }

    log('Initializing DevinAgent...');
    const agent = new DevinAgent({
      apiKey,
      approvalPolicy: { mode: 'suggest' },
      config: { model: 'devin-standard' },
      onItem: (item) => log(`Received item: ${JSON.stringify(item)}`),
      onLoading: (loading) => log(`Loading state: ${loading}`),
      getCommandConfirmation: async () => ({ review: 'YES' }),
      onLastResponseId: (id) => log(`Last response ID: ${id}`)
    });

    // Test 1: List sessions
    log('Testing listSessions()...');
    const sessions = await agent.listSessions();
    log(`Found ${sessions.length} active sessions`);
    sessions.forEach(session => {
      log(`Session: ${session.id}, Status: ${session.status}, Title: ${session.title}`);
    });

    // Test 2: Upload file
    log('Testing uploadFile()...');
    const testFilePath = path.join(__dirname, 'test-file.txt');
    fs.writeFileSync(testFilePath, 'This is a test file for Devin API');
    const fileContent = fs.readFileSync(testFilePath);
    const fileUrl = await agent.uploadFile(testFilePath, fileContent);
    log(`File uploaded successfully: ${fileUrl}`);

    // Test 3: Create recursive session
    log('Testing createRecursiveSession()...');
    const sessionId = await agent.createRecursiveSession('Test recursive session from Codex CLI');
    log(`Created recursive session with ID: ${sessionId}`);

    // Test 4: Get active sessions
    log('Testing getActiveSessions()...');
    const activeSessions = agent.getActiveSessions();
    log(`Active sessions count: ${activeSessions.size}`);
    for (const [id, info] of activeSessions.entries()) {
      log(`Session: ${id}, Status: ${info.status}, Title: ${info.title}`);
    }

    log('All tests completed successfully!');
  } catch (error) {
    log(`Error: ${error.message}`);
    if (error.response) {
      log(`Response status: ${error.response.status}`);
      log(`Response data: ${JSON.stringify(error.response.data)}`);
    }
  }
}

// Run tests
testDevinFeatures();
