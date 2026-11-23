import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../events/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/events.css", import.meta.url), "utf8");

test("approved wording and compact programme presentation remain present", () => {
 assert.match(html, /Join our daily Triple Trouble runs/);
 assert.match(html, /<h2 id="next-title">Upcoming Activities<\/h2>/);
 assert.match(css, /\.events-upcoming-list/);
 assert.match(css, /\.events-upcoming-item\.is-highlighted/);
 assert.match(css, /\.events-upcoming-item\.is-started/);
});
