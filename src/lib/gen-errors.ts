export type GenErrorCode = "timeout" | "invalid" | "unavailable";

/**
 * Map internal failure strings (provider names, Zod paths, abort messages) to a small
 * user-safe category. The raw reason never reaches the UI.
 */
export function classifyFailure(why: string[]): GenErrorCode {
  const t = why.join(" | ").toLowerCase();
  if (/(timed? ?out|timeout|out of time|abort)/.test(t)) return "timeout";
  if (/(nodes?\.\d+\.label|must contain|not valid json|invalid output|output was cut off|schema|validation|too long)/.test(t)) return "invalid";
  return "unavailable";
}

/** User-facing explanation; deliberately contains no provider/model/schema details. */
export function friendlyGenerationError(code: GenErrorCode | undefined): string {
  switch (code) {
    case "timeout":
      return "The AI service was too slow to finish this diagram in time. Your previous diagram is unchanged.";
    case "invalid":
      return "The AI produced a diagram that didn't pass our automatic checks — usually because one step description was too long. Your previous diagram is unchanged.";
    default:
      return "The AI service couldn't complete this request right now. Your previous diagram is unchanged.";
  }
}

export const generationErrorHint =
  "Try again in a moment. If it keeps happening, shorten unusually long step descriptions or split the methodology into two diagrams.";
