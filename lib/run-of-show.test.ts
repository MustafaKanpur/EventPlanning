// npm test
import assert from "node:assert/strict";
import { test } from "node:test";

import { findOverlaps, onEventDay, timeValueToMinutes, type PlacedBlock } from "./run-of-show.ts";

const day = new Date(2026, 9, 10);
const block = (id: string, from: string, to: string): PlacedBlock => ({
  id,
  title: id,
  location: null,
  notes: null,
  startTime: onEventDay(day, timeValueToMinutes(from)!),
  endTime: onEventDay(day, timeValueToMinutes(to)!),
  tasks: [],
  budgetLine: null,
});

const pairs = (blocks: PlacedBlock[]) =>
  findOverlaps(blocks).map(({ block, earlier }) => `${earlier.id}>${block.id}`).sort();

test("back-to-back blocks don't clash", () => {
  assert.deepEqual(pairs([block("doors", "18:00", "18:30"), block("talk", "18:30", "19:15")]), []);
});

test("a block dropped into another's time clashes with it", () => {
  assert.deepEqual(pairs([block("talk", "18:30", "19:15"), block("dinner", "19:00", "20:00")]), ["talk>dinner"]);
});

test("a block inside a long one is caught even after a short one ends", () => {
  const hall = block("hall", "18:00", "22:00");
  const talk = block("talk", "18:30", "19:00");
  const qa = block("qa", "19:30", "20:00");
  assert.deepEqual(pairs([qa, hall, talk]), ["hall>qa", "hall>talk"]);
});

test("time values parse strictly", () => {
  assert.equal(timeValueToMinutes("18:30"), 1110);
  assert.equal(timeValueToMinutes("00:00"), 0);
  assert.equal(timeValueToMinutes("24:00"), null);
  assert.equal(timeValueToMinutes("6pm"), null);
  assert.equal(timeValueToMinutes(""), null);
});

test("onEventDay keeps the event's date", () => {
  const at = onEventDay(day, 20 * 60 + 15);
  assert.deepEqual([at.getDate(), at.getHours(), at.getMinutes()], [10, 20, 15]);
});
