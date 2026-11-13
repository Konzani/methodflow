import { describe, expect, it } from "vitest";
import { classifyFailure, friendlyGenerationError, generationErrorHint } from "@/lib/gen-errors";

describe("generation error privacy", () => {
  it("classifies technical reasons", () => {
    expect(classifyFailure(["deepseek-v4-pro: timed out | deepseek-flash: nodes.4.label: String must contain at most 120 character(s)"])).toBe("timeout");
    expect(classifyFailure(["deepseek-flash: nodes.4.label: String must contain at most 120 character(s)"])).toBe("invalid");
    expect(classifyFailure(["deepseek-flash: HTTP 500"])).toBe("unavailable");
  });

  it("user-facing text never contains provider/model/schema internals", () => {
    const text = [friendlyGenerationError("timeout"), friendlyGenerationError("invalid"), friendlyGenerationError("unavailable"), generationErrorHint].join(" ");
    expect(text).not.toMatch(/deepseek|openai|zod|nodes\.\d|label:|timeout|HTTP|\|/i);
    expect(text).toMatch(/previous diagram is unchanged/);
    expect(text).toMatch(/Try again/);
  });
});
