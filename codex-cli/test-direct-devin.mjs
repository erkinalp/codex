#!/usr/bin/env node

// Use ts-node to run TypeScript files directly
import { DevinAgent } from './src/utils/agent/devin/devin-agent.ts';
import { isDevinModel } from './src/utils/model-utils-devin.ts';

// Simple logger
const log = (message) => console.log(`[${new Date().toISOString()}] ${message}`);

async function testDevinAgent() {
  log('Testing DevinAgent directly');
  log('=========================');
  
  const devinApiKey = process.env.DEVIN_API_KEY;
  if (!devinApiKey) {
    log('DEVIN_API_KEY environment variable is required');
    return;
  }
  
  try {
    log('Creating DevinAgent...');
    const agent = new DevinAgent({
      apiKey: devinApiKey,
      approvalPolicy: { mode: 'suggest' },
      config: { model: 'devin-standard' },
      onItem: (item) => log(`Received item: ${JSON.stringify(item)}`),
      onLoading: (loading) => log(`Loading state: ${loading}`),
      getCommandConfirmation: async () => ({ review: 'YES' }),
      onLastResponseId: (id) => log(`Last response ID: ${id}`)
    });
    
    log('DevinAgent created successfully');
    log('Testing API key validation...');
    log(`Is valid API key: ${agent.secureCredentials.validateApiKey(devinApiKey)}`);
    
    log('Testing session creation...');
    const sessionId = await agent.createSession('Test session from Codex CLI');
    log(`Created session with ID: ${sessionId}`);
    
    log('All tests completed successfully!');
  } catch (error) {
    log(`Error: ${error.message}`);
    if (error.response) {
      log(`Response status: ${error.response.status}`);
      log(`Response data: ${JSON.stringify(error.response.data)}`);
    }
  }
}

testDevinAgent();
