import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export const PROPOSE_BLOCKS = "propose_blocks";
export const CHECK_SCHEDULE = "check_schedule";

/**
 * Hand-written to mirror ProposedBlocksSchema below. `strict` keeps the model to this
 * shape; Zod still checks the limits this schema doesn't express (lengths, ranges, the
 * HH:MM pattern) before anything reaches the database. Both tools take the same draft.
 */
const BLOCKS_INPUT: Anthropic.Tool["input_schema"] = {
  type: "object",
  properties: {
    blocks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          durationMinutes: { type: "integer" },
          suggestedStart: { type: ["string", "null"], description: '24-hour "HH:MM", or null' },
          location: { type: ["string", "null"] },
          notes: { type: ["string", "null"] },
        },
        required: ["title", "durationMinutes", "suggestedStart", "location", "notes"],
        additionalProperties: false,
      },
    },
  },
  required: ["blocks"],
  additionalProperties: false,
};

/** The agent's one lookup: checks a draft and returns issues. Changes nothing. */
export const CHECK_SCHEDULE_TOOL: Anthropic.Tool = {
  name: CHECK_SCHEDULE,
  description:
    "Check a draft before proposing it. Returns overlaps between timed blocks, clashes with the event's existing blocks, duplicates, and the draft's total span. Changes nothing.",
  strict: true,
  input_schema: BLOCKS_INPUT,
};

/** The final answer. Calling it ends the draft; the blocks are parked for the organizer to place. */
export const PROPOSE_BLOCKS_TOOL: Anthropic.Tool = {
  name: PROPOSE_BLOCKS,
  description: "Submit the final run-of-show blocks for the event. They are parked for the organizer to place.",
  strict: true,
  input_schema: BLOCKS_INPUT,
};

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => v || null);

export const ProposedBlockSchema = z.object({
  title: z.string().trim().min(1).max(120),
  durationMinutes: z.number().int().min(5).max(480),
  suggestedStart: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
  location: optionalText(120),
  notes: optionalText(500),
});

export const ProposedBlocksSchema = z.object({
  blocks: z.array(ProposedBlockSchema).min(1).max(20),
});

export type ProposedBlock = z.infer<typeof ProposedBlockSchema>;
