// npm test — runs with Node's built-in runner; no network, the client is faked.
import assert from "node:assert/strict";
import { test } from "node:test";

import type Anthropic from "@anthropic-ai/sdk";

import { checkSchedule } from "./check-schedule.ts";
import { MODEL } from "./client.ts";
import { MAX_TURNS, draftRunOfShow, type DraftContext, type MessagesClient } from "./run-of-show.ts";

const ctx: DraftContext = {
  eventName: "Salam Week night",
  eventDate: "2026-10-10",
  venue: "Student Union",
  capacity: 120,
  existingBlocks: [{ title: "Setup", start: "17:00", end: "18:00", location: null }],
};

function reply(content: unknown[], stop_reason: Anthropic.Message["stop_reason"] = "tool_use"): Anthropic.Message {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: MODEL,
    content,
    stop_reason,
    stop_sequence: null,
    usage: { input_tokens: 900, output_tokens: 200 },
  } as Anthropic.Message;
}

let nextId = 0;
const call = (name: "check_schedule" | "propose_blocks", input: unknown) => ({
  type: "tool_use",
  id: `toolu_${++nextId}`,
  name,
  input,
});

/** Plays back `script` one reply per call (repeating the last) and records each request. */
function fakeClient(...script: Anthropic.Message[]) {
  const calls: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const client: MessagesClient = {
    messages: {
      async create(params) {
        calls.push(params);
        return script[Math.min(calls.length, script.length) - 1];
      },
    },
  };
  return { client, calls };
}

/** Text of the tool_result sent back on the `n`th request (1-based). */
function toolResultSent(calls: Anthropic.MessageCreateParamsNonStreaming[], n: number) {
  const last = calls[n - 1].messages.at(-1);
  assert.ok(last && Array.isArray(last.content));
  const block = last.content[0];
  assert.equal(block.type, "tool_result");
  return block;
}

const doors = { title: "Doors open", durationMinutes: 30, suggestedStart: "18:00", location: null, notes: null };
const talk = { title: "Speaker", durationMinutes: 60, suggestedStart: "18:15", location: null, notes: null };
const talkFixed = { ...talk, suggestedStart: "18:30" };

test("checks, sees the overlap, revises, then proposes", async () => {
  const { client, calls } = fakeClient(
    reply([call("check_schedule", { blocks: [doors, talk] })]),
    reply([call("propose_blocks", { blocks: [doors, talkFixed] })]),
  );

  const result = await draftRunOfShow(ctx, "doors at 6, then a speaker", client);

  assert.ok(result.ok);
  assert.deepEqual(result.blocks, [doors, talkFixed]);
  assert.equal(result.turns, 2);
  assert.deepEqual(result.usage, { inputTokens: 1800, outputTokens: 400 }, "tokens add up across turns");

  // The real schedule check went back to the model.
  const sent = toolResultSent(calls, 2);
  assert.match(String(sent.content), /"Doors open" \(18:00–18:30\) overlaps "Speaker"/);

  const [first] = calls;
  assert.equal(first.model, MODEL);
  assert.equal(first.max_tokens, 1500);
  assert.deepEqual(first.tool_choice, { type: "any", disable_parallel_tool_use: true });
  assert.deepEqual(first.tools?.map((t) => ("name" in t ? t.name : null)), ["check_schedule", "propose_blocks"]);
  assert.ok(Array.isArray(first.system));
  assert.deepEqual(first.system[0].cache_control, { type: "ephemeral" });
  assert.match(String(first.messages[0].content), /<request>\ndoors at 6, then a speaker\n<\/request>$/);
});

test("proposing straight away is fine and costs one call", async () => {
  const { client, calls } = fakeClient(reply([call("propose_blocks", { blocks: [doors] })]));
  const result = await draftRunOfShow(ctx, "just doors", client);
  assert.ok(result.ok);
  assert.equal(calls.length, 1);
});

test("a model that keeps checking is forced to commit on the last turn", async () => {
  const { client, calls } = fakeClient(
    reply([call("check_schedule", { blocks: [doors] })]),
    reply([call("check_schedule", { blocks: [doors] })]),
    reply([call("check_schedule", { blocks: [doors] })]),
    reply([call("propose_blocks", { blocks: [doors] })]),
  );
  const result = await draftRunOfShow(ctx, "doors", client);
  assert.ok(result.ok);
  assert.equal(calls.length, MAX_TURNS);
  assert.deepEqual(calls[MAX_TURNS - 1].tool_choice, {
    type: "tool",
    name: "propose_blocks",
    disable_parallel_tool_use: true,
  });
});

test("malformed proposals are sent back as errors, and a fixed one is accepted", async () => {
  const { client, calls } = fakeClient(
    reply([call("propose_blocks", { blocks: [{ ...doors, suggestedStart: "6pm" }] })]),
    reply([call("propose_blocks", { blocks: [doors] })]),
  );
  const result = await draftRunOfShow(ctx, "doors", client);
  assert.ok(result.ok);
  const sent = toolResultSent(calls, 2);
  assert.equal(sent.is_error, true);
  assert.match(String(sent.content), /nothing was checked or saved/);
});

test("output that stays malformed fails after the turn cap without throwing", async () => {
  for (const input of [{ blocks: [{ ...doors, title: "" }] }, { blocks: "Doors at 6" }, { blocks: [] }, {}]) {
    const { client, calls } = fakeClient(reply([call("propose_blocks", input)]));
    const result = await draftRunOfShow(ctx, "anything", client);
    assert.ok(!result.ok, JSON.stringify(input));
    assert.match(result.error, /couldn't use/);
    assert.equal(calls.length, MAX_TURNS);
    assert.deepEqual(result.usage, { inputTokens: 900 * MAX_TURNS, outputTokens: 200 * MAX_TURNS });
  }
});

test("a reply with no tool call is rejected", async () => {
  const { client } = fakeClient(reply([{ type: "text", text: "Here is your plan!" }], "end_turn"));
  const result = await draftRunOfShow(ctx, "anything", client);
  assert.equal(result.ok, false);
});

test("a reply cut off at max_tokens is rejected even if it parsed", async () => {
  const { client } = fakeClient(reply([call("propose_blocks", { blocks: [doors] })], "max_tokens"));
  const result = await draftRunOfShow(ctx, "anything", client);
  assert.ok(!result.ok);
  assert.match(result.error, /too many blocks/);
});

test("checkSchedule reports clashes with existing blocks, duplicates, and the span", () => {
  const issues = checkSchedule(ctx, [
    { ...doors, suggestedStart: "17:45" },
    { title: "setup", durationMinutes: 15, suggestedStart: null, location: null, notes: null },
  ]);
  assert.ok(issues.some((i) => i.includes('clashes with existing block "Setup"')));
  assert.ok(issues.some((i) => i.includes('"setup" already exists')));
  assert.ok(issues.some((i) => i.includes("span 17:45–18:15 (0h 30m)")));
  assert.ok(issues.some((i) => i.includes("1 block has no suggested time")));
});
