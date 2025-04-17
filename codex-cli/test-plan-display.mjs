// Test script to demonstrate plan display in both approval modes
import axios from 'axios';
import readline from 'readline';

// Mock DevinAgent class to demonstrate plan display
class MockDevinAgent {
  constructor(approvalPolicy = "approve-plan") {
    this._approvalPolicy = approvalPolicy;
    console.log(`\nInitializing MockDevinAgent with approval policy: ${approvalPolicy}\n`);
  }

  // Process and display session output including plans
  processSessionOutput(sessionData) {
    console.log("\n===== SESSION OUTPUT =====\n");
    
    // Display plan if available
    if (sessionData.plan) {
      const planStatus = sessionData.plan.status;
      const planPrefix = planStatus === "pending" ? 
        "📋 **Plan Awaiting Approval**\n\n" : 
        (planStatus === "approved" ? "✅ **Plan Approved**\n\n" : "❌ **Plan Rejected**\n\n");
      
      console.log(`${planPrefix}${sessionData.plan.content}`);
      
      // If plan is pending and we're in approve-plan mode, show approval options
      if (planStatus === "pending" && this._approvalPolicy === "approve-plan") {
        console.log("\nDo you want to approve this plan? (Type 'yes' to approve or 'no' to reject)");
        
        // In a real implementation, we would wait for user input here
        // For this demo, we'll simulate approval after a delay
        setTimeout(() => {
          console.log("\nUser input: yes");
          console.log("\n✅ **Plan Approved**\n");
          console.log("Proceeding with plan execution...\n");
          
          // Simulate execution output
          setTimeout(() => {
            console.log("Step 1: Completed successfully");
            console.log("Step 2: Completed successfully");
            console.log("Step 3: Completed successfully");
            console.log("\n✅ Task completed successfully!\n");
          }, 1000);
        }, 2000);
      } else if (this._approvalPolicy === "full-auto") {
        // In full-auto mode, we proceed without waiting for approval
        console.log("\nProceeding with plan execution (full-auto mode)...\n");
        
        // Simulate execution output
        setTimeout(() => {
          console.log("Step 1: Completed successfully");
          console.log("Step 2: Completed successfully");
          console.log("Step 3: Completed successfully");
          console.log("\n✅ Task completed successfully!\n");
        }, 1000);
      }
    }
    
    // Display regular output if available
    if (sessionData.output) {
      if (typeof sessionData.output === "string") {
        console.log("\n----- Regular Output -----\n");
        console.log(sessionData.output);
      } else if (Array.isArray(sessionData.output)) {
        console.log("\n----- Structured Output -----\n");
        for (const output of sessionData.output) {
          if (output.type === "text") {
            console.log(output.content);
          } else if (output.type === "code") {
            console.log(`\`\`\`${output.content.language || ""}\n${output.content.code}\n\`\`\``);
          }
        }
      }
    }
    
    console.log("\n===== END SESSION OUTPUT =====\n");
  }
}

// Mock session data with plan for demonstration
const mockSessionDataWithPendingPlan = {
  id: "session-123",
  status: "in_progress",
  plan: {
    content: `# Plan for Adding User Authentication

## Task Analysis
The task requires implementing user authentication in the application. This involves:
1. Setting up user registration
2. Implementing login functionality
3. Adding session management
4. Creating protected routes

## Implementation Steps
1. Create User model with email and password fields
2. Implement password hashing using bcrypt
3. Create registration endpoint
4. Create login endpoint with JWT token generation
5. Add middleware for authentication
6. Update routes to use authentication middleware

## Testing Strategy
- Unit tests for User model
- Integration tests for authentication endpoints
- End-to-end tests for protected routes

I'll start by implementing the User model and registration functionality.`,
    status: "pending"
  },
  output: [
    {
      type: "text",
      content: "I'll help you implement user authentication in your application. I've created a plan to approach this task."
    }
  ]
};

// Mock session data with plan for full-auto mode
const mockSessionDataWithApprovedPlan = {
  id: "session-456",
  status: "in_progress",
  plan: {
    content: `# Plan for Adding User Authentication

## Task Analysis
The task requires implementing user authentication in the application. This involves:
1. Setting up user registration
2. Implementing login functionality
3. Adding session management
4. Creating protected routes

## Implementation Steps
1. Create User model with email and password fields
2. Implement password hashing using bcrypt
3. Create registration endpoint
4. Create login endpoint with JWT token generation
5. Add middleware for authentication
6. Update routes to use authentication middleware

## Testing Strategy
- Unit tests for User model
- Integration tests for authentication endpoints
- End-to-end tests for protected routes

I'll start by implementing the User model and registration functionality.`,
    status: "approved"
  },
  output: [
    {
      type: "text",
      content: "I'll help you implement user authentication in your application. I've created a plan to approach this task."
    }
  ]
};

// Mock session data for standard mode (no step-by-step plan)
const mockSessionDataStandardMode = {
  id: "session-789",
  status: "in_progress",
  // No detailed plan, but still has plan confirmation
  output: [
    {
      type: "text",
      content: "I'll help you implement user authentication in your application. Before I proceed, I'd like to confirm my approach with you."
    },
    {
      type: "text",
      content: "I plan to implement user registration, login functionality with JWT tokens, session management, and protected routes. Does this approach sound good to you?"
    }
  ]
};

// Function to demonstrate approve-plan mode
function demonstrateApprovePlanMode() {
  console.log("\n\n========================================");
  console.log("DEMONSTRATING APPROVE-PLAN MODE (sync_confirm)");
  console.log("========================================\n");
  
  const agent = new MockDevinAgent("approve-plan");
  agent.processSessionOutput(mockSessionDataWithPendingPlan);
  
  // Also demonstrate standard mode with plan confirmation
  setTimeout(() => {
    console.log("\n\n========================================");
    console.log("DEMONSTRATING STANDARD MODE WITH PLAN CONFIRMATION");
    console.log("========================================\n");
    
    console.log("Note: Standard mode sessions don't return a step-by-step plan,");
    console.log("but they can still ask for plan confirmation.\n");
    
    const standardAgent = new MockDevinAgent("approve-plan");
    standardAgent.processSessionOutput(mockSessionDataStandardMode);
    
    // Simulate user approval
    setTimeout(() => {
      console.log("\nUser input: yes");
      console.log("\nProceeding with implementation...\n");
      
      // Simulate execution output
      setTimeout(() => {
        console.log("Implementation completed successfully!");
      }, 1000);
    }, 2000);
  }, 6000);
}

// Function to demonstrate full-auto mode
function demonstrateFullAutoMode() {
  setTimeout(() => {
    console.log("\n\n========================================");
    console.log("DEMONSTRATING FULL-AUTO MODE (auto_confirm)");
    console.log("========================================\n");
    
    const agent = new MockDevinAgent("full-auto");
    agent.processSessionOutput(mockSessionDataWithApprovedPlan);
  }, 12000);
}

// Run the demonstrations
console.log("DEMONSTRATING PLAN DISPLAY IN BOTH APPROVAL MODES");
console.log("=================================================\n");

demonstrateApprovePlanMode();
demonstrateFullAutoMode();

// Exit after all demonstrations are complete
setTimeout(() => {
  console.log("\n\nDemonstration complete!");
  process.exit(0);
}, 18000);
