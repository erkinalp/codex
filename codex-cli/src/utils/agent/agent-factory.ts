import type { ApprovalPolicy } from "../../approvals.js";
import type { AppConfig } from "../config.js";
import type { CommandConfirmation } from "./agent-loop.js";
import type { ResponseItem } from "openai/resources/responses/responses.mjs";

import { AgentLoop } from "./agent-loop.js";
import { DevinAgent } from "./devin/devin-agent.js";
import { log } from "../logger/log.js";
import { isDevinModel } from "../model-utils-devin.js";

/**
 * Factory function to create the appropriate agent based on the model type
 */
export function createAgent({
  model,
  config,
  instructions,
  approvalPolicy,
  onItem,
  onLoading,
  getCommandConfirmation,
  onLastResponseId,
}: {
  model: string;
  config?: AppConfig;
  instructions?: string;
  approvalPolicy: ApprovalPolicy;
  onItem: (item: ResponseItem) => void;
  onLoading: (loading: boolean) => void;
  getCommandConfirmation: (
    command: Array<string>,
    applyPatch: unknown,
  ) => Promise<CommandConfirmation>;
  onLastResponseId: (lastResponseId: string) => void;
}): AgentLoop | DevinAgent {
  log(`Creating agent for model: ${model}`);

  if (isDevinModel(model)) {
    log(`Creating DevinAgent for model: ${model}`);
    return new DevinAgent({
      apiKey: config?.DEVIN_API_KEY || "",
      approvalPolicy,
      config: config as AppConfig,
      onItem,
      onLoading,
      getCommandConfirmation,
      onLastResponseId,
    });
  }

  return new AgentLoop({
    model,
    config,
    instructions,
    approvalPolicy,
    onItem,
    onLoading,
    getCommandConfirmation,
    onLastResponseId,
    additionalWritableRoots: [],
  });
}
