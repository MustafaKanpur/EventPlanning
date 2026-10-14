// npm test
import assert from "node:assert/strict";
import { test } from "node:test";

import { hashPassword, verifyPassword } from "./password.ts";

test("the right password verifies, a wrong one doesn't", async () => {
  const stored = await hashPassword("correct horse");
  assert.equal(await verifyPassword("correct horse", stored), true);
  assert.equal(await verifyPassword("correct hors", stored), false);
});

test("the same password hashes differently each time (salted), and isn't stored as typed", async () => {
  const a = await hashPassword("same password");
  const b = await hashPassword("same password");
  assert.notEqual(a, b);
  assert.ok(!a.includes("same password"));
});

test("a malformed stored value never verifies", async () => {
  assert.equal(await verifyPassword("anything", "not-a-hash"), false);
});
