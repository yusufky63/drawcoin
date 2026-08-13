import assert from "node:assert/strict";
import test from "node:test";
import {
  DAILY_DRAWING_PROMPTS,
  getDailyDrawingPrompt,
  getLocalDateKey,
} from "../src/components/create/dailyDrawingPrompts.ts";

test("returns the same prompt for the same calendar day", () => {
  assert.deepEqual(
    getDailyDrawingPrompt("2026-08-12"),
    getDailyDrawingPrompt("2026-08-12")
  );
});

test("advances to the next prompt on the next calendar day", () => {
  const current = getDailyDrawingPrompt("2026-08-12");
  const next = getDailyDrawingPrompt("2026-08-13");
  const currentIndex = DAILY_DRAWING_PROMPTS.findIndex(
    (prompt) => prompt.id === current.id
  );
  const expectedNext =
    DAILY_DRAWING_PROMPTS[(currentIndex + 1) % DAILY_DRAWING_PROMPTS.length];

  assert.equal(next.id, expectedNext.id);
});

test("builds a zero-padded local date key", () => {
  assert.equal(getLocalDateKey(new Date(2026, 7, 2, 12)), "2026-08-02");
});

test("rejects malformed or impossible dates", () => {
  assert.throws(() => getDailyDrawingPrompt("08/12/2026"), TypeError);
  assert.throws(() => getDailyDrawingPrompt("2026-02-30"), RangeError);
  assert.throws(() => getLocalDateKey(new Date(Number.NaN)), RangeError);
});

test("keeps the prompt library concise, unique, and drawing-only", () => {
  assert.ok(DAILY_DRAWING_PROMPTS.length >= 14);
  assert.equal(
    new Set(DAILY_DRAWING_PROMPTS.map((prompt) => prompt.id)).size,
    DAILY_DRAWING_PROMPTS.length
  );

  for (const prompt of DAILY_DRAWING_PROMPTS) {
    assert.match(prompt.idea, /^Draw /);
    assert.ok(prompt.idea.length <= 64);
    assert.doesNotMatch(prompt.idea.toLowerCase(), /mixed media/);
  }
});
