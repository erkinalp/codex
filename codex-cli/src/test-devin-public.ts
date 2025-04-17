/**
 * Test script for Devin API integration using public methods
 */

import { DevinAgent } from './utils/agent/devin/devin-agent.js';
import { isDevinModel } from './utils/model-utils-devin.js';
import { DEVIN_API_KEY } from './utils/config.js';
import type { ApprovalPolicy } from '../approvals.js';
import type { CommandConfirmation } from './utils/agent/agent-loop.js';
import type { ResponseItem } from 'openai/resources/responses/responses.mjs';

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
      approvalPolicy: { mode: 'suggest' } as ApprovalPolicy,
      config: { 
        model: 'devin-standard',
        DEVIN_API_KEY: apiKey,
        instructions: 'Test instructions'
      },
      onItem: (item: ResponseItem) => log(`Received item: ${JSON.stringify(item)}`),
      onLoading: (loading: boolean) => log(`Loading state: ${loading}`),
      getCommandConfirmation: async (): Promise<CommandConfirmation> => ({ review: 'YES' } as CommandConfirmation),
      onLastResponseId: (id: string) => log(`Last response ID: ${id}`)
    });
    
    log('DevinAgent created successfully');
    
    log('\nTesting model detection...');
    log(`Is devin-standard a Devin model: ${isDevinModel('devin-standard')}`);
    log(`Is o3 a Devin model: ${isDevinModel('o3')}`);
    
    log('\nTesting run method...');
    try {
      await agent.run('Test message from Codex CLI');
      log('Run method completed successfully');
    } catch (error: any) {
      log(`Run method error: ${error.message}`);
      if (error.response) {
        log(`Response status: ${error.response.status}`);
        log(`Response data: ${JSON.stringify(error.response.data)}`);
      }
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
