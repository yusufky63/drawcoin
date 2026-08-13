import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const headerSource = await readFile(
  new URL("../src/components/Header.tsx", import.meta.url),
  "utf8",
);

test("Create uses the primary blue treatment only on the active route", () => {
  assert.match(headerSource, /else \{\s*\/\/ Never carry[\s\S]*setCurrentTab\(""\)/);

  assert.match(
    headerSource,
    /isCreate\s*\?\s*isActive\s*\?\s*`\$\{desktopPrimaryButton\}/,
  );

  const mobileCreateStart = headerSource.indexOf("if (isCreate)");
  const mobileCreateBranch = headerSource.slice(
    mobileCreateStart,
    headerSource.indexOf("\n            return (", mobileCreateStart),
  );

  assert.match(
    mobileCreateBranch,
    /isActive\s*\?\s*"[^"]*bg-\[var\(--base-blue\)\][^"]*text-white/,
  );
  assert.match(
    mobileCreateBranch,
    /:\s*"bg-white text-\[var\(--base-blue\)\]/,
  );
});
