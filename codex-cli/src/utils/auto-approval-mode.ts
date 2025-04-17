export enum AutoApprovalMode {
  SUGGEST = "suggest",
  AUTO_EDIT = "auto-edit",
  FULL_AUTO = "full-auto",
  APPROVE_PLAN = "approve-plan", // Devin-specific: sync_confirm
}

export enum FullAutoErrorMode {
  ASK_USER = "ask-user",
  IGNORE_AND_CONTINUE = "ignore-and-continue",
}
