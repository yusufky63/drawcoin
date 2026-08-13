import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Pinata failures never log Axios request configuration or authorization", async () => {
  const source = await readFile(
    new URL("../src/services/pinata.js", import.meta.url),
    "utf8"
  );

  assert.match(source, /^import "server-only";/m);
  assert.match(
    source,
    /console\.error\(message, getSafePinataErrorDetails\(error\)\)/
  );
  assert.doesNotMatch(
    source,
    /console\.(?:error|warn|log)\([^;]*,\s*(?:error|err)\s*\);/
  );
  assert.doesNotMatch(source, /error\.(?:config|request|toJSON|message)\b/);
});
