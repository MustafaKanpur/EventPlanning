// node --experimental-strip-types lib/volunteers.check.mjs
import assert from "node:assert/strict";

import { ageOn, shiftBlocker } from "./volunteers.ts";

const day = new Date("2026-10-10T09:00:00");
const shift = { startTime: day, capacity: 2, minAge: 18, gender: "Female", minHours: 5 };
const ok = { birthDate: new Date("2000-01-01"), gender: "Female", approvedHours: 5 };

assert.equal(ageOn(new Date("2008-10-10"), day), 18);
assert.equal(ageOn(new Date("2008-10-11"), day), 17);
assert.equal(shiftBlocker(shift, 1, ok), null);
assert.match(shiftBlocker(shift, 2, ok), /full/);
assert.match(shiftBlocker(shift, 0, { ...ok, birthDate: null }), /date of birth/);
assert.match(shiftBlocker(shift, 0, { ...ok, birthDate: new Date("2008-10-11") }), /18/);
assert.match(shiftBlocker(shift, 0, { ...ok, gender: "Male" }), /Female/);
assert.match(shiftBlocker(shift, 0, { ...ok, approvedHours: 4 }), /5 approved/);
assert.equal(shiftBlocker({ ...shift, minAge: null, gender: null, minHours: null }, 0, { birthDate: null, gender: null, approvedHours: 0 }), null);
console.log("volunteers ok");
