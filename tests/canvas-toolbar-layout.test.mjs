import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const desktopSource = await readFile(
  new URL(
    "../src/components/ui/CustomCanvas/components/DesktopToolbar.tsx",
    import.meta.url
  ),
  "utf8"
);
const mobileSource = await readFile(
  new URL(
    "../src/components/ui/CustomCanvas/components/MobileToolbar.tsx",
    import.meta.url
  ),
  "utf8"
);
const canvasSource = await readFile(
  new URL("../src/components/ui/CustomCanvas/index.tsx", import.meta.url),
  "utf8"
);

test("desktop canvas uses a top tool strip and a contextual right inspector", () => {
  assert.match(desktopSource, /aria-label="Drawing tools"/);
  assert.match(desktopSource, /export const DesktopInspector/);
  assert.match(desktopSource, /Tool settings/);
  assert.doesNotMatch(desktopSource, /overflow-y-auto/);
  assert.doesNotMatch(desktopSource, /w-48 shrink-0 self-start/);
  assert.doesNotMatch(desktopSource, /Add image|type="file"|image\/\*/);
});

test("mobile canvas exposes one essential five-action dock without horizontal scroll", () => {
  for (const label of ["Pen", "Erase", "Color", "Undo", "More"]) {
    assert.match(mobileSource, new RegExp(`label="${label}"`));
  }
  assert.match(mobileSource, /grid grid-cols-5/);
  assert.doesNotMatch(mobileSource, /overflow-x-auto/);
  assert.doesNotMatch(mobileSource, /Row 2: History/);
  assert.doesNotMatch(mobileSource, /label="Image"|type="file"|image\/\*/);
});

test("the drawing surface is stable and keeps its native 1024 square", () => {
  assert.match(canvasSource, /width=\{DEFAULT_CANVAS_SIZE\}/);
  assert.match(canvasSource, /height=\{DEFAULT_CANVAS_SIZE\}/);
  assert.match(canvasSource, /aspect-square/);
  assert.match(canvasSource, /DesktopToolbar/);
  assert.match(canvasSource, /DesktopInspector/);
  assert.match(canvasSource, /calc\(100dvh-12rem\)/);
  assert.match(canvasSource, /48rem/);
  assert.doesNotMatch(canvasSource, /handleImageUpload/);
  assert.doesNotMatch(
    canvasSource,
    /className="hand-drawn-card w-full overflow-hidden/
  );
});
