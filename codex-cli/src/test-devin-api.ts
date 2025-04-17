/**
 * Test script for Devin API integration
 * This TypeScript file tests the DevinAgent implementation directly
 */

import { DevinAgent } from './utils/agent/devin/devin-agent.js';
import { isDevinModel } from './utils/model-utils-devin.js';
import { DEVIN_API_KEY } from './utils/config.js';

const log = (message: string): void => {
  console.log(`[${new Date().toISOString()}] ${message}`);
};

async function testDevinAgent(): Promise<void> {
  log('Testing DevinAgent Implementation');
  log('===============================');
  
  const apiKey = DEVIN_API_KEY || process.env.DEVIN_API_KEY;
  if (!apiKey) {
    log('DEVIN_API_KEY environment variable or config value is required');
    return;
  }
  
  try {
    log('Creating DevinAgent...');
    const agent = new DevinAgent({
      apiKey,
      approvalPolicy: { mode: 'suggest' },
      config: { 
        model: 'devin-standard',
        DEVIN_API_KEY: apiKey,
        instructions: 'Test instructions'
      },
      onItem: (item) => log(`Received item: ${JSON.stringify(item)}`),
      onLoading: (loading) => log(`Loading state: ${loading}`),
      getCommandConfirmation: async () => ({ review: 'YES' }),
      onLastResponseId: (id) => log(`Last response ID: ${id}`)
    });
    
    log('DevinAgent created successfully');
    
    log('\nTesting API key validation...');
    log(`Is valid API key: ${agent.secureCredentials.validateApiKey(apiKey)}`);
    
    log('\nTesting session creation...');
    try {
      const sessionId = await agent.createSession('Test session from Codex CLI');
      log(`Created session with ID: ${sessionId}`);
      
      log('\nTesting sending a message...');
      await agent.sendMessage(sessionId, 'Hello from Codex CLI test');
      log('Message sent successfully');
      
      log('\nTesting getting session status...');
      const status = await agent.getSessionStatus(sessionId);
      log(`Session status: ${JSON.stringify(status)}`);
      
      log('\nTesting structured output handling...');
      log('Processing session output...');
      await agent.startPollingSession(sessionId);
      log('Session polling started');
    } catch (error: any) {
      log(`Session operation error: ${error.message}`);
      if (error.response) {
        log(`Response status: ${error.response.status}`);
        log(`Response data: ${JSON.stringify(error.response.data)}`);
      }
    }
    
    log('\nTesting file upload...');
    try {
      const fileUrl = await agent.uploadFile('test-file.txt', Buffer.from('Test file content'));
      log(`File uploaded successfully: ${fileUrl}`);
    } catch (error: any) {
      log(`File upload error: ${error.message}`);
    }
    
    log('\nTesting listing sessions...');
    try {
      const sessions = await agent.listSessions();
      log(`Found ${sessions.length} active sessions`);
      sessions.forEach(session => {
        log(`Session: ${session.id}, Status: ${session.status}, Title: ${session.title}`);
      });
    } catch (error: any) {
      log(`List sessions error: ${error.message}`);
    }
    
    log('\nAll tests completed!');
  } catch (error: any) {
    log(`Error: ${error.message}`);
    if (error.response) {
      log(`Response status: ${error.response.status}`);
      log(`Response data: ${JSON.stringify(error.response.data)}`);
    }
  }
}

testDevinAgent().catch(error => {
  log(`Unhandled error: ${error.message}`);
  process.exit(1);
});
