import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const createPageSource = await readFile(
  new URL("../src/components/create/CreatePage.tsx", import.meta.url),
  "utf8"
);

test("create page omits the decorative mode badge and large progress stepper", () => {
  assert.doesNotMatch(createPageSource, />Hand Draw</);
  assert.doesNotMatch(createPageSource, /Unlocks First Stroke on Base/);
  assert.doesNotMatch(createPageSource, /getStepStatus/);
  assert.doesNotMatch(createPageSource, /Progress Steps - Responsive Design/);
});

test("create navigation keeps progress compact and accessible", () => {
  assert.match(createPageSource, /const STEP_LABELS =/);
  assert.match(createPageSource, /aria-label="Create token progress"/);
  assert.match(createPageSource, /aria-live="polite"/);
  assert.match(createPageSource, /Compact navigation below the active step/);
  assert.doesNotMatch(createPageSource, /Compact navigation - desktop/);
  assert.match(
    createPageSource,
    /\{currentStep\}\/\{totalSteps\} · \{currentStepLabel\}/
  );
});
