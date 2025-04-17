import { DEVIN_API_KEY } from "./config.js";


export const DEVIN_MODELS: Array<string> = ["devin-standard", "devin-deep"];

/**
 * Check if a model is a Devin AI model
 */
export function isDevinModel(model: string | undefined | null): boolean {
  if (typeof model !== "string" || model.trim() === "") {
    return false;
  }
  
  return model.startsWith("devin-");
}

/**
 * Verify that the provided Devin model identifier is valid
 */
export async function isDevinModelSupported(
  model: string | undefined | null,
): Promise<boolean> {
  if (typeof model !== "string" || model.trim() === "") {
    return false;
  }
  
  return DEVIN_MODELS.includes(model.trim());
}
