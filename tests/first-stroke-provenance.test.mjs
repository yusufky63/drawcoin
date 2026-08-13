import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeSource = await readFile(
  new URL("../src/app/api/coins/create/route.ts", import.meta.url),
  "utf8"
);
const missionServiceSource = await readFile(
  new URL("../src/lib/missions/service.ts", import.meta.url),
  "utf8"
);

test("legacy verification preserves the recorded artwork classification", () => {
  const verifiedFieldsStart = routeSource.indexOf(
    "const verifiedCoinFields = {"
  );
  const verifiedFieldsEnd = routeSource.indexOf(
    "} as const;",
    verifiedFieldsStart
  );
  const verifiedFields = routeSource.slice(
    verifiedFieldsStart,
    verifiedFieldsEnd
  );

  assert.ok(verifiedFieldsStart >= 0 && verifiedFieldsEnd > verifiedFieldsStart);
  assert.doesNotMatch(verifiedFields, /creation_type/);
  assert.match(routeSource, /\.update\(verifiedCoinFields\)/);
  assert.match(
    routeSource,
    /\.insert\(\{[\s\S]*?\.\.\.verifiedCoinFields,[\s\S]*?creation_type:\s*"hand-drawn"/
  );
});

test("First Stroke counts every verified DrawCoin creation", () => {
  assert.match(missionServiceSource, /verified_creation:/);
  assert.doesNotMatch(
    missionServiceSource,
    /\.eq\(\s*"creation_type"\s*,\s*"hand-drawn"\s*\)/
  );
  assert.match(missionServiceSource, /\.not\("verified_at", "is", null\)/);
});
