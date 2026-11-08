export type Plan = "pro" | "free";

export function planFor(status: string | undefined, endsAt: string | null | undefined, now: number = Date.now()): Plan {
  switch (status) {
    case "active":
    case "on_trial":
    case "past_due":
      return "pro";
    case "cancelled": {
      const t = endsAt ? Date.parse(endsAt) : NaN;
      return Number.isFinite(t) && t > now ? "pro" : "free";
    }
    default:
      return "free";
  }
}

export const LIFECYCLE_EVENTS = new Set([
  "subscription_created",
  "subscription_updated",
  "subscription_cancelled",
  "subscription_resumed",
  "subscription_expired",
]);
