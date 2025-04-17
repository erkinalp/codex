#!/usr/bin/env node

/**
 * Test script for Devin API integration with Codex CLI
 * This script tests both OpenAI and Devin model functionality
 */

import { createAgent } from './dist/utils/agent/agent-factory.js';
import { isDevinModel } from './dist/utils/model-utils-devin.js';

// Simple logger with timestamps
const log = (message) => console.log(`[${new Date().toISOString()}] ${message}`);

// Test function for agent creation and basic functionality
async function testAgentCreation() {
  log('Testing Agent Creation and Basic Functionality');
  log('=============================================');
  
  // Test OpenAI agent creation
  log('\nTest 1: OpenAI Agent Creation');
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
        onItem: (item) => log(`Received item: ${JSON.stringify(item)}`),
        onLoading: (loading) => log(`Loading state: ${loading}`),
        getCommandConfirmation: async () => ({ review: 'YES' }),
        onLastResponseId: (id) => log(`Last response ID: ${id}`)
      });
      
      log('OpenAI agent created successfully');
      log(`Agent type: ${isDevinModel('o3') ? 'DevinAgent' : 'AgentLoop'}`);
    } catch (error) {
      log(`Error creating OpenAI agent: ${error.message}`);
    }
  }
  
  // Test Devin agent creation
  log('\nTest 2: Devin Agent Creation');
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
        onItem: (item) => log(`Received item: ${JSON.stringify(item)}`),
        onLoading: (loading) => log(`Loading state: ${loading}`),
        getCommandConfirmation: async () => ({ review: 'YES' }),
        onLastResponseId: (id) => log(`Last response ID: ${id}`)
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

// Run tests
testAgentCreation();
