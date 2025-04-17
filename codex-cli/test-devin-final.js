#!/usr/bin/env node

/**
 * Final test script for Devin API integration
 * Tests both OpenAI and Devin model functionality
 */

import { createAgent } from './dist/utils/agent/agent-factory.js';
import { isDevinModel } from './dist/utils/model-utils-devin.js';

const log = (message) => console.log(`[${new Date().toISOString()}] ${message}`);

async function testAgentCreation() {
  log('Testing Agent Creation and Basic Functionality');
  log('=============================================');
  
  log('\nTest 1: Model Detection');
  log(`Is devin-standard a Devin model: ${isDevinModel('devin-standard')}`);
  log(`Is o3 a Devin model: ${isDevinModel('o3')}`);
  
  log('\nTest 2: OpenAI Agent Creation');
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    log('OPENAI_API_KEY environment variable is required for OpenAI tests');
  } else {
    try {
      const openaiAgent = createAgent({
        model: 'o3',
        config: { 
          apiKey: openaiApiKey,
          model: 'o3',
          instructions: 'Test instructions'
        },
        approvalPolicy: { mode: 'suggest' },
        onItem: (item) => log(`Received OpenAI item: ${JSON.stringify(item)}`),
        onLoading: (loading) => log(`OpenAI loading state: ${loading}`),
        getCommandConfirmation: async () => ({ review: 'YES' }),
        onLastResponseId: (id) => log(`OpenAI last response ID: ${id}`)
      });
      
      log('OpenAI agent created successfully');
      log(`Agent type: ${isDevinModel('o3') ? 'DevinAgent' : 'AgentLoop'}`);
    } catch (error) {
      log(`Error creating OpenAI agent: ${error.message}`);
    }
  }
  
  log('\nTest 3: Devin Agent Creation');
  const devinApiKey = process.env.DEVIN_API_KEY;
  if (!devinApiKey) {
    log('DEVIN_API_KEY environment variable is required for Devin tests');
  } else {
    try {
      const devinAgent = createAgent({
        model: 'devin-standard',
        config: { 
          DEVIN_API_KEY: devinApiKey,
          model: 'devin-standard',
          instructions: 'Test instructions'
        },
        approvalPolicy: { mode: 'suggest' },
        onItem: (item) => log(`Received Devin item: ${JSON.stringify(item)}`),
        onLoading: (loading) => log(`Devin loading state: ${loading}`),
        getCommandConfirmation: async () => ({ review: 'YES' }),
        onLastResponseId: (id) => log(`Devin last response ID: ${id}`)
      });
      
      log('Devin agent created successfully');
      log(`Agent type: ${isDevinModel('devin-standard') ? 'DevinAgent' : 'AgentLoop'}`);
      
    } catch (error) {
      log(`Error creating Devin agent: ${error.message}`);
    }
  }
  
  log('\nTest Summary');
  log('===========');
  log('Agent creation tests completed');
}

testAgentCreation().catch(error => {
  log(`Unhandled error: ${error.message}`);
  process.exit(1);
});
