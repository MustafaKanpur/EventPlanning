import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { MODEL, getClient } from "./client.ts";
import { RUN_OF_SHOW_SYSTEM } from "./prompts.ts";
import { PROPOSE_BLOCKS, PROPOSE_BLOCKS_TOOL, ProposedBlocksSchema, type ProposedBlock } from "./tools.ts";

/** Plain data, so this module knows nothing about Prisma. */
export type DraftContext = {
  eventName: string;
  /** "YYYY-MM-DD" */
  eventDate: string;
  venue: string | null;
  capacity: number | null;
  /** Times as "HH:MM", null when the block isn't placed. */
  existingBlocks: { title: string; start: string | null; end: string | null; location: string | null }[];
};

export type DraftUsage = { inputTokens: number; outputTokens: number };

export type DraftResult =
  | { ok: true; blocks: ProposedBlock[]; usage: DraftUsage }
  /** `error` is safe to show the organizer; `detail` is for the audit log. */
  | { ok: false; error: string; detail: string; usage: DraftUsage | null };

/** The one SDK method this module uses, so tests can pass a fake. */
export type MessagesClient = {
  messages: { create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> };
};

const UNREADABLE = "The draft came back in a shape we couldn't use. Try rewording your request.";

function describeEvent(ctx: DraftContext): string {
  const lines = [
    `Name: ${ctx.eventName}`,
    `Date: ${ctx.eventDate}`,
    ctx.venue ? `Venue: ${ctx.venue}` : null,
    ctx.capacity !== null ? `Capacity: ${ctx.capacity}` : null,
    ctx.existingBlocks.length ? "Existing blocks:" : "Existing blocks: none",
    ...ctx.existingBlocks.map((b) => {
      const when = b.start && b.end ? ` (${b.start}–${b.end})` : " (not placed)";
      return `- ${b.title}${when}${b.location ? ` @ ${b.location}` : ""}`;
    }),
  ];
  return lines.filter((line): line is string => line !== null).join("\n");
}

/** One forced tool call; the model proposes, never places. Never throws on bad output. */
export async function draftRunOfShow(
  ctx: DraftContext,
  prompt: string,
  client?: MessagesClient,
): Promise<DraftResult> {
  let response: Anthropic.Message;
  try {
    // Resolved inside the try: a missing ANTHROPIC_API_KEY throws from the constructor.
    response = await (client ?? getClient()).messages.create({
      model: MODEL,
      max_tokens: 1500,
      // Tools render before system, so this breakpoint covers both.
      system: [{ type: "text", text: RUN_OF_SHOW_SYSTEM, cache_control: { type: "ephemeral" } }],
      tools: [PROPOSE_BLOCKS_TOOL],
      tool_choice: { type: "tool", name: PROPOSE_BLOCKS },
      messages: [
        {
          role: "user",
          content: `<event>\n${describeEvent(ctx)}\n</event>\n\n<request>\n${prompt}\n</request>`,
        },
      ],
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return { ok: false, error: "The AI service is busy. Try again in a minute.", detail: err.message, usage: null };
    }
    if (err instanceof Anthropic.APIConnectionError) {
      return { ok: false, error: "Couldn't reach the AI service. Try again.", detail: err.message, usage: null };
    }
    if (err instanceof Anthropic.APIError) {
      return {
        ok: false,
        error: "The AI service returned an error. Try again later.",
        detail: `${err.status ?? "?"}: ${err.message}`,
        usage: null,
      };
    }
    if (err instanceof Anthropic.AnthropicError) {
      return { ok: false, error: "AI drafting isn't set up yet.", detail: err.message, usage: null };
    }
    throw err;
  }

  const usage = { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };

  if (response.stop_reason === "max_tokens") {
    return { ok: false, error: "That request needs too many blocks. Try a shorter programme.", detail: "stop_reason: max_tokens", usage };
  }
  if (response.stop_reason === "refusal") {
    return { ok: false, error: "The AI declined this request. Try rewording it.", detail: "stop_reason: refusal", usage };
  }

  const call = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === PROPOSE_BLOCKS,
  );
  if (!call) return { ok: false, error: UNREADABLE, detail: "no propose_blocks call", usage };

  const parsed = ProposedBlocksSchema.safeParse(call.input);
  if (!parsed.success) {
    return { ok: false, error: UNREADABLE, detail: parsed.error.message.slice(0, 1000), usage };
  }
  return { ok: true, blocks: parsed.data.blocks, usage };
}
