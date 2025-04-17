#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { DevinAgent } = require('./dist/utils/agent/devin/devin-agent.js');

const log = (message) => console.log(`[${new Date().toISOString()}] ${message}`);

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

    log('Testing listSessions()...');
    const sessions = await agent.listSessions();
    log(`Found ${sessions.length} active sessions`);
    sessions.forEach(session => {
      log(`Session: ${session.id}, Status: ${session.status}, Title: ${session.title}`);
    });

    log('Testing uploadFile()...');
    const testFilePath = path.join(__dirname, 'test-file.txt');
    fs.writeFileSync(testFilePath, 'This is a test file for Devin API');
    const fileContent = fs.readFileSync(testFilePath);
    const fileUrl = await agent.uploadFile(testFilePath, fileContent);
    log(`File uploaded successfully: ${fileUrl}`);

    log('Testing createRecursiveSession()...');
    const sessionId = await agent.createRecursiveSession('Test recursive session from Codex CLI');
    log(`Created recursive session with ID: ${sessionId}`);

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

testDevinFeatures();
