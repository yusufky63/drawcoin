import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../src/components/missions/MissionsPage.tsx", import.meta.url),
  "utf8"
);

test("missions does not repeat the connected wallet address", () => {
  assert.doesNotMatch(source, /snapshot\?\.address\.slice/);
  assert.doesNotMatch(source, /address\?\.slice/);
});

test("claim feedback appears before the mission cards", () => {
  const errorPosition = source.indexOf("{actionError ? (");
  const noticePosition = source.indexOf("{actionNotice ? (");
  const cardsPosition = source.indexOf("{missionContentLoading ? (");

  assert.ok(errorPosition >= 0);
  assert.ok(noticePosition >= 0);
  assert.ok(cardsPosition >= 0);
  assert.ok(errorPosition < cardsPosition);
  assert.ok(noticePosition < cardsPosition);
});
