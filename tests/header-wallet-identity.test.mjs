import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../src/components/Header.tsx", import.meta.url),
  "utf8",
);

test("connected wallet identity uses strong project typography on desktop and mobile", () => {
  assert.match(
    source,
    /font-art-sans text-xs font-extrabold tracking-\[-0\.015em\]/,
  );
  assert.match(
    source,
    /max-w-\[112px\][^"\n]*text-xs font-extrabold tracking-\[-0\.015em\]/,
  );
});
