import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../src/app/portfolio/page.tsx", import.meta.url),
  "utf8",
);

test("portfolio has one client loading boundary instead of a mounted gate", () => {
  assert.match(source, /dynamic\(/);
  assert.match(source, /ssr: false/);
  assert.doesNotMatch(source, /useState|useEffect|setMounted|if \(!mounted\)/);
});
