import "server-only";

import Anthropic from "@anthropic-ai/sdk";

/** The one place the model is named. Swap here to change it everywhere. */
export const MODEL = "claude-haiku-4-5-20251001";

let client: Anthropic | null = null;

/**
 * Built on first use rather than at import, so importing lib/ai never throws when
 * ANTHROPIC_API_KEY is unset (tests, builds). The SDK reads the key from the env.
 */
export function getClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}
