import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const eventsCSS = readFileSync(new URL("../css/events.css", import.meta.url), "utf8");
const homeCSS = readFileSync(new URL("../css/style.css", import.meta.url), "utf8");

test("focused Today button retains high-contrast text and fill", () => {
  assert.match(eventsCSS, /\.events-week-toolbar \[data-today\]:hover,\s*\.events-week-toolbar \[data-today\]:focus-visible\s*\{[^}]*color:\s*#[0-9a-f]+;[^}]*background:\s*#[0-9a-f]+;/i);
});

test("homepage date badges retain small, no-wrap type without inheriting category style", () => {
  assert.match(homeCSS, /\.date-badge span\s*\{[^}]*font-size:\s*\.58rem;[^}]*white-space:\s*nowrap;/);
  assert.match(homeCSS, /\.events-board article > div:not\(\.date-badge\) > span\s*\{/);
  assert.doesNotMatch(homeCSS, /\.events-board article > div > span\s*\{/);
});
