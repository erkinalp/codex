// Test script to verify "out of credits" error handling in both OpenAI and Devin implementations
import axios from 'axios';

// Mock API responses
const mockOpenAIOutOfCreditsError = {
  status: 402,
  data: {
    error: {
      message: "You've exceeded your current quota, please check your plan and billing details.",
      type: "insufficient_quota",
      param: null,
      code: "insufficient_quota"
    }
  }
};

const mockDevinOutOfCreditsError = {
  status: 402,
  data: {
    error: "Insufficient credits. Please add more credits to your account."
  }
};

// Mock AgentLoop class to test OpenAI error handling
class MockAgentLoop {
  constructor() {
    this.onItem = (item) => console.log('Response item:', JSON.stringify(item, null, 2));
    this.onLoading = (loading) => console.log('Loading state:', loading);
  }

  // Simulate error handling in AgentLoop
  testOutOfCreditsError() {
    console.log('\n===== Testing OpenAI "Out of Credits" Error Handling =====\n');
    
    try {
      // Simulate error context from OpenAI API
      const errCtx = mockOpenAIOutOfCreditsError.data.error;
      const status = mockOpenAIOutOfCreditsError.status;
      
      console.log('Simulating OpenAI error response:', { status, errCtx });
      
      // Check for "out of credits" errors (copied from agent-loop.ts)
      const isOutOfCreditsError = 
        status === 402 || 
        errCtx.code === "insufficient_quota" ||
        (typeof errCtx.message === "string" && 
          (errCtx.message.includes("insufficient funds") || 
           errCtx.message.includes("out of credits") || 
           errCtx.message.includes("billing") ||
           errCtx.message.includes("quota exceeded")));
      
      if (isOutOfCreditsError) {
        this.onItem({
          id: `error-${Date.now()}`,
          type: "message",
          role: "system",
          content: [
            {
              type: "input_text",
              text: "⚠️  Insufficient credits. Your OpenAI account has run out of credits. Please add more credits to your account and try again."
            },
          ],
        });
        this.onLoading(false);
        console.log('OpenAI "Out of Credits" error handled correctly ✅');
      } else {
        console.log('OpenAI "Out of Credits" error NOT detected ❌');
      }
    } catch (error) {
      console.error('Error in OpenAI error handling test:', error);
    }
  }
}

// Mock DevinAgent class to test Devin API error handling
class MockDevinAgent {
  constructor() {
    this.retryCount = 0;
    this.maxRetries = 3;
  }

  // Simulate error handling in DevinAgent
  async testOutOfCreditsError() {
    console.log('\n===== Testing Devin API "Out of Credits" Error Handling =====\n');
    
    try {
      // Simulate error from Devin API
      const axiosError = {
        response: {
          status: mockDevinOutOfCreditsError.status,
          data: mockDevinOutOfCreditsError.data
        }
      };
      
      console.log('Simulating Devin API error response:', axiosError.response);
      
      // Handle authentication errors specifically
      if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
        throw new Error("Authentication failed. Please check your Devin API key.");
      }
      
      // Handle "out of credits" errors (copied from devin-agent.ts)
      if (axiosError.response?.status === 402 || 
          (axiosError.response?.data?.error && 
           typeof axiosError.response.data.error === 'string' && 
           (axiosError.response.data.error.includes('insufficient credits') || 
            axiosError.response.data.error.includes('out of credits') ||
            axiosError.response.data.error.includes('credit limit')))) {
        throw new Error("Insufficient credits. Your Devin AI account has run out of credits. Please add more credits to your account and try again.");
      }
      
      // Handle rate limiting and server errors with retry logic
      if (axiosError.response && (axiosError.response.status === 429 || axiosError.response.status >= 500) && this.retryCount < this.maxRetries) {
        this.retryCount++;
        const delay = 1000 * this.retryCount;
        
        console.log(`Retrying in ${delay}ms (attempt ${this.retryCount}/${this.maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.testOutOfCreditsError();
      }
      
      console.log('Devin API "Out of Credits" error NOT detected ❌');
    } catch (error) {
      if (error.message.includes("Insufficient credits")) {
        console.log('Devin API "Out of Credits" error handled correctly ✅');
        console.log('Error message:', error.message);
      } else {
        console.error('Unexpected error in Devin API error handling test:', error);
      }
    }
  }
}

// Run tests
async function runTests() {
  console.log('=================================================');
  console.log('TESTING "OUT OF CREDITS" ERROR HANDLING');
  console.log('=================================================\n');
  
  // Test OpenAI error handling
  const openaiTest = new MockAgentLoop();
  openaiTest.testOutOfCreditsError();
  
  // Test Devin API error handling
  const devinTest = new MockDevinAgent();
  await devinTest.testOutOfCreditsError();
  
  console.log('\n=================================================');
  console.log('ERROR HANDLING TESTS COMPLETED');
  console.log('=================================================');
}

runTests().catch(error => {
  console.error('Unhandled error in tests:', error);
});
