import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { checkSchedule } from "./check-schedule.ts";
import { MODEL, getClient } from "./client.ts";
import { RUN_OF_SHOW_SYSTEM } from "./prompts.ts";
import {
  CHECK_SCHEDULE,
  CHECK_SCHEDULE_TOOL,
  PROPOSE_BLOCKS,
  PROPOSE_BLOCKS_TOOL,
  ProposedBlocksSchema,
  type ProposedBlock,
} from "./tools.ts";

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
  | { ok: true; blocks: ProposedBlock[]; usage: DraftUsage; turns: number }
  /** `error` is safe to show the organizer; `detail` is for the audit log. */
  | { ok: false; error: string; detail: string; usage: DraftUsage | null };

/** The one SDK method this module uses, so tests can pass a fake. */
export type MessagesClient = {
  messages: { create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> };
};

/**
 * Hard cap on model calls per draft. The last turn forces propose_blocks, so a model
 * that keeps checking still has to commit, and a draft costs at most MAX_TURNS calls.
 */
export const MAX_TURNS = 4;

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

function apiFailure(err: unknown, usage: DraftUsage | null): DraftResult {
  if (err instanceof Anthropic.RateLimitError) {
    return { ok: false, error: "The AI service is busy. Try again in a minute.", detail: err.message, usage };
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return { ok: false, error: "Couldn't reach the AI service. Try again.", detail: err.message, usage };
  }
  if (err instanceof Anthropic.APIError) {
    return {
      ok: false,
      error: "The AI service returned an error. Try again later.",
      detail: `${err.status ?? "?"}: ${err.message}`,
      usage,
    };
  }
  if (err instanceof Anthropic.AnthropicError) {
    return { ok: false, error: "AI drafting isn't set up yet.", detail: err.message, usage };
  }
  throw err;
}

/**
 * A small agent loop: the model drafts, may call check_schedule to test the draft
 * against the real schedule, revises, and commits with propose_blocks. Tools only
 * compute; nothing is written here. Never throws on bad output.
 */
export async function draftRunOfShow(
  ctx: DraftContext,
  prompt: string,
  client?: MessagesClient,
): Promise<DraftResult> {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: `<event>\n${describeEvent(ctx)}\n</event>\n\n<request>\n${prompt}\n</request>` },
  ];
  const usage: DraftUsage = { inputTokens: 0, outputTokens: 0 };
  let lastProblem = "no propose_blocks call";

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    const final = turn === MAX_TURNS;
    let response: Anthropic.Message;
    try {
      // Resolved inside the try: a missing ANTHROPIC_API_KEY throws from the constructor.
      response = await (client ?? getClient()).messages.create({
        model: MODEL,
        max_tokens: 1500,
        // Breakpoint on system covers tools + system; the top-level one caches the growing
        // conversation, so each turn re-reads earlier turns at the cached rate.
        cache_control: { type: "ephemeral" },
        system: [{ type: "text", text: RUN_OF_SHOW_SYSTEM, cache_control: { type: "ephemeral" } }],
        tools: [CHECK_SCHEDULE_TOOL, PROPOSE_BLOCKS_TOOL],
        // Every turn must be a tool call (no paid chat turns), one at a time. The last
        // turn can only commit.
        tool_choice: final
          ? { type: "tool", name: PROPOSE_BLOCKS, disable_parallel_tool_use: true }
          : { type: "any", disable_parallel_tool_use: true },
        messages: [...messages],
      });
    } catch (err) {
      return apiFailure(err, turn > 1 ? usage : null);
    }

    usage.inputTokens += response.usage.input_tokens;
    usage.outputTokens += response.usage.output_tokens;

    if (response.stop_reason === "max_tokens") {
      return { ok: false, error: "That request needs too many blocks. Try a shorter programme.", detail: `turn ${turn}: stop_reason max_tokens`, usage };
    }
    if (response.stop_reason === "refusal") {
      return { ok: false, error: "The AI declined this request. Try rewording it.", detail: `turn ${turn}: stop_reason refusal`, usage };
    }

    const call = response.content.find((block): block is Anthropic.ToolUseBlock => block.type === "tool_use");
    if (!call) return { ok: false, error: UNREADABLE, detail: `turn ${turn}: no tool call`, usage };

    // Both tools take the same draft, so it's validated the same way either way.
    const parsed = ProposedBlocksSchema.safeParse(call.input);
    let result: string;
    let isError = false;

    if (!parsed.success) {
      lastProblem = parsed.error.message.slice(0, 1000);
      result = `Invalid input, nothing was checked or saved:\n${lastProblem}`;
      isError = true;
    } else if (call.name === PROPOSE_BLOCKS) {
      return { ok: true, blocks: parsed.data.blocks, usage, turns: turn };
    } else if (call.name === CHECK_SCHEDULE) {
      const issues = checkSchedule(ctx, parsed.data.blocks);
      result = issues.length ? issues.map((i) => `- ${i}`).join("\n") : "No issues found.";
    } else {
      result = `Unknown tool "${call.name}".`;
      isError = true;
    }

    // Feed the result back; append-only, so the cached prefix stays valid.
    messages.push({ role: "assistant", content: response.content });
    messages.push({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: call.id, content: result, is_error: isError }],
    });
  }

  return { ok: false, error: UNREADABLE, detail: `gave up after ${MAX_TURNS} turns: ${lastProblem}`, usage };
}
