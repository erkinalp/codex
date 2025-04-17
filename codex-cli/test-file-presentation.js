#!/usr/bin/env node

/**
 * Test script for Devin API file upload and presentation
 * This script tests the enhanced file upload functionality
 */

const { DevinAgent } = require('./src/utils/agent/devin/devin-agent');
const fs = require('fs/promises');
const path = require('path');

const log = (message) => console.log(`[${new Date().toISOString()}] ${message}`);

async function testFilePresentation() {
  log('Testing File Upload and Presentation');
  log('==================================');
  
  const apiKey = process.env.DEVIN_API_KEY;
  if (!apiKey) {
    log('DEVIN_API_KEY environment variable is required');
    process.exit(1);
  }
  
  try {
    log('Creating DevinAgent...');
    const agent = new DevinAgent({
      apiKey,
      approvalPolicy: { mode: 'suggest' },
      config: { 
        DEVIN_API_KEY: apiKey,
        model: 'devin-standard',
        instructions: 'Test instructions'
      },
      onItem: (item) => log(`Received item: ${JSON.stringify(item)}`),
      onLoading: (loading) => log(`Loading state: ${loading}`),
      getCommandConfirmation: async () => ({ review: 'YES' }),
      onLastResponseId: (id) => log(`Last response ID: ${id}`)
    });
    
    log('DevinAgent created successfully');
    
    log('\nCreating test files...');
    const testDir = path.join(process.cwd(), 'test-files');
    await fs.mkdir(testDir, { recursive: true });
    
    const textFilePath = path.join(testDir, 'test-file.txt');
    await fs.writeFile(textFilePath, 'This is a test file for Devin API');
    
    const jsonFilePath = path.join(testDir, 'test-config.json');
    await fs.writeFile(jsonFilePath, JSON.stringify({
      name: "test-config",
      version: "1.0.0",
      description: "Test configuration file for Devin API"
    }, null, 2));
    
    log(`Created test files in ${testDir}`);
    
    log('\nTest 1: Upload file with automatic presentation');
    try {
      const textFileContent = await fs.readFile(textFilePath);
      const textFileUrl = await agent.uploadFile(textFilePath, textFileContent);
      log(`Text file uploaded successfully: ${textFileUrl}`);
    } catch (error) {
      log(`Text file upload error: ${error.message}`);
    }
    
    log('\nTest 2: Upload file without automatic presentation');
    try {
      const jsonFileContent = await fs.readFile(jsonFilePath);
      const jsonFileUrl = await agent.uploadFile(jsonFilePath, jsonFileContent, false);
      log(`JSON file uploaded successfully: ${jsonFileUrl}`);
      
      log('Manually presenting file to agent...');
      await agent.sendMessage(agent.sessionId, 'Here is a configuration file', [jsonFileUrl]);
      log('File presented successfully');
    } catch (error) {
      log(`JSON file upload/presentation error: ${error.message}`);
    }
    
    log('\nTest 3: Run with file attachments');
    try {
      await agent.run([{
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "Analyze these files" }]
      }], "", [textFileUrl, jsonFileUrl]);
      log('Run with file attachments completed successfully');
    } catch (error) {
      log(`Run with file attachments error: ${error.message}`);
    }
    
    log('\nAll tests completed!');
  } catch (error) {
    log(`Error: ${error.message}`);
    if (error.response) {
      log(`Response status: ${error.response.status}`);
      log(`Response data: ${JSON.stringify(error.response.data)}`);
    }
  } finally {
    try {
      const testDir = path.join(process.cwd(), 'test-files');
      await fs.rm(testDir, { recursive: true, force: true });
      log('Test files cleaned up');
    } catch (error) {
      log(`Error cleaning up test files: ${error.message}`);
    }
  }
}

testFilePresentation().catch(error => {
  log(`Unhandled error: ${error.message}`);
  process.exit(1);
});
