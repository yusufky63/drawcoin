import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const successModalSource = await readFile(
  new URL("../src/components/create/SuccessModal.tsx", import.meta.url),
  "utf8"
);
const dailyPromptSource = await readFile(
  new URL("../src/components/create/DailyDrawingPrompt.tsx", import.meta.url),
  "utf8"
);

test("creation result refocuses its current primary action after sync status changes", () => {
  assert.match(
    successModalSource,
    /const primaryAction = primaryActionRef\.current;[\s\S]*?primaryAction\.focus\(\)/
  );
  assert.match(successModalSource, /\[isOpen, isRecorded\]/);
  assert.match(
    successModalSource,
    /!dialogRef\.current\.contains\(document\.activeElement\)/
  );
});

test("daily prompt reschedules at local midnight and refreshes after tab sleep", () => {
  assert.match(dailyPromptSource, /nextMidnight\.setHours\(24, 0, 0, 0\)/);
  assert.match(
    dailyPromptSource,
    /window\.setTimeout\([\s\S]*?millisecondsUntilNextLocalDay\(now\)/
  );
  assert.match(dailyPromptSource, /visibilitychange/);
  assert.match(dailyPromptSource, /document\.visibilityState !== "visible"/);
});
