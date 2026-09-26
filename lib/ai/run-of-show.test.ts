// npm test — runs with Node's built-in runner; no network, the client is faked.
import assert from "node:assert/strict";
import { test } from "node:test";

import type Anthropic from "@anthropic-ai/sdk";

import { MODEL } from "./client.ts";
import { draftRunOfShow, type DraftContext, type MessagesClient } from "./run-of-show.ts";

const ctx: DraftContext = {
  eventName: "Salam Week night",
  eventDate: "2026-10-10",
  venue: "Student Union",
  capacity: 120,
  existingBlocks: [],
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

function toolCall(input: unknown) {
  return { type: "tool_use", id: "toolu_test", name: "propose_blocks", input };
}

/** A fake that returns `message` and records what it was asked. */
function fakeClient(message: Anthropic.Message) {
  const calls: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const client: MessagesClient = {
    messages: {
      async create(params) {
        calls.push(params);
        return message;
      },
    },
  };
  return { client, calls };
}

const doors = { title: "Doors open", durationMinutes: 30, suggestedStart: "18:00", location: null, notes: null };

test("returns validated blocks and sends a forced, cached, capped request", async () => {
  const isha = { title: "Isha prayer", durationMinutes: 15, suggestedStart: "20:15", location: " Prayer room ", notes: "" };
  const { client, calls } = fakeClient(reply([toolCall({ blocks: [doors, isha] })]));

  const result = await draftRunOfShow(ctx, "doors at 6, Isha at 8:15", client);

  assert.equal(result.ok, true);
  assert.ok(result.ok);
  assert.deepEqual(result.blocks[1], { ...isha, location: "Prayer room", notes: null });
  assert.deepEqual(result.usage, { inputTokens: 900, outputTokens: 200 });

  const [request] = calls;
  assert.equal(request.model, MODEL);
  assert.equal(request.max_tokens, 1500);
  assert.deepEqual(request.tool_choice, { type: "tool", name: "propose_blocks" });
  assert.ok(Array.isArray(request.system));
  assert.deepEqual(request.system[0].cache_control, { type: "ephemeral" });
  // The organizer's text is wrapped as data, after the event context.
  assert.match(String(request.messages[0].content), /<request>\ndoors at 6, Isha at 8:15\n<\/request>$/);
});

test("malformed tool input is rejected without throwing", async () => {
  const malformed = [
    { blocks: [{ ...doors, suggestedStart: "6pm" }] },
    { blocks: [{ ...doors, title: "" }] },
    { blocks: [{ ...doors, durationMinutes: 2000 }] },
    { blocks: "Doors open at 6" },
    { blocks: [] },
    {},
  ];
  for (const input of malformed) {
    const { client } = fakeClient(reply([toolCall(input)]));
    const result = await draftRunOfShow(ctx, "anything", client);
    assert.equal(result.ok, false, JSON.stringify(input));
    assert.ok(!result.ok);
    assert.match(result.error, /couldn't use/);
    assert.deepEqual(result.usage, { inputTokens: 900, outputTokens: 200 });
  }
});

test("a reply with no propose_blocks call is rejected", async () => {
  const { client } = fakeClient(reply([{ type: "text", text: "Here is your plan!" }], "end_turn"));
  const result = await draftRunOfShow(ctx, "anything", client);
  assert.equal(result.ok, false);
});

test("a reply cut off at max_tokens is rejected even if it parsed", async () => {
  const { client } = fakeClient(reply([toolCall({ blocks: [doors] })], "max_tokens"));
  const result = await draftRunOfShow(ctx, "anything", client);
  assert.ok(!result.ok);
  assert.match(result.error, /too many blocks/);
});
