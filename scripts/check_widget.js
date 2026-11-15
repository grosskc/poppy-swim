#!/usr/bin/env node
// Syntax-check and exercise PoppySwim.js with stubbed Scriptable APIs.
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const src = fs.readFileSync(path.join(root, "widget/PoppySwim.js"), "utf8");
const feed = JSON.parse(fs.readFileSync(path.join(root, "widget.json"), "utf8"));

class Color {
  constructor(hex, alpha) {
    this.hex = hex;
    this.alpha = alpha;
  }
  static dynamic(light, dark) {
    return { dynamic: true, light, dark };
  }
  static white() {
    return new Color("#FFFFFF");
  }
  static black() {
    return new Color("#000000");
  }
}

class Font {
  constructor(name, size) {
    this.name = name;
    this.size = size;
  }
  static systemFont(size) { return new Font("system", size); }
  static regularSystemFont(size) { return new Font("regular", size); }
  static mediumSystemFont(size) { return new Font("medium", size); }
  static semiboldSystemFont(size) { return new Font("semibold", size); }
  static boldSystemFont(size) { return new Font("bold", size); }
  static monospacedDigitSystemFont(size) { return new Font("mono-digit", size); }
}

class LinearGradient {
  constructor() {
    this.colors = [];
    this.locations = [];
    this.startPoint = null;
    this.endPoint = null;
  }
}
class Point { constructor(x, y) { this.x = x; this.y = y; } }
class Size { constructor(w, h) { this.width = w; this.height = h; } }

class WidgetText {
  constructor(text) {
    this.type = "text";
    this.text = String(text);
    this.font = null;
    this.textColor = null;
    this.lineLimit = null;
    this.minimumScaleFactor = 1;
    this._align = "left";
  }
  leftAlignText() { this._align = "left"; }
  centerAlignText() { this._align = "center"; }
  rightAlignText() { this._align = "right"; }
}

class WidgetStack {
  constructor() {
    this.type = "stack";
    this.children = [];
    this.axis = "horizontal";
    this.spacing = 0;
    this.backgroundColor = null;
    this.size = null;
    this._align = "top";
  }
  layoutHorizontally() { this.axis = "horizontal"; }
  layoutVertically() { this.axis = "vertical"; }
  centerAlignContent() { this._align = "center"; }
  topAlignContent() { this._align = "top"; }
  bottomAlignContent() { this._align = "bottom"; }
  setPadding() {}
  addText(t) { const n = new WidgetText(t); this.children.push(n); return n; }
  addStack() { const n = new WidgetStack(); this.children.push(n); return n; }
  addSpacer(n) { this.children.push({ type: "spacer", n }); }
}

class ListWidget {
  constructor() {
    this.type = "widget";
    this.children = [];
    this.url = null;
    this.refreshAfterDate = null;
    this.backgroundColor = null;
    this.backgroundGradient = null;
  }
  setPadding() {}
  addText(t) { const n = new WidgetText(t); this.children.push(n); return n; }
  addStack() { const n = new WidgetStack(); this.children.push(n); return n; }
  addSpacer(n) { this.children.push({ type: "spacer", n }); }
  async presentSmall() {}
  async presentMedium() {}
  async presentLarge() {}
  async presentAccessoryRectangular() {}
}

function collectText(node, out) {
  if (!node) return;
  if (Array.isArray(node)) {
    node.forEach((n) => collectText(n, out));
    return;
  }
  if (node.type === "text") out.push(node.text);
  if (node.children) collectText(node.children, out);
}

const sandbox = {
  Color,
  Font,
  LinearGradient,
  Point,
  Size,
  ListWidget,
  Date,
  JSON,
  Math,
  String,
  Number,
  Boolean,
  Array,
  Object,
  Error,
  Infinity,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  undefined,
  console,
  setTimeout,
  clearTimeout,
  globalThis: {},
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: "PoppySwim.js" });
const api = sandbox.PoppySwim;
assert.ok(api, "PoppySwim API was not exported");
assert.strictEqual(api.FEED_URL, "https://grosskc.github.io/poppy-swim/widget.json");

const evening = new Date("2026-11-15T18:05:00-05:00");
const morning = new Date("2026-11-15T12:40:00-05:00");

const focusEvening = api.pickFocusEvent(feed.meet, evening);
assert.strictEqual(focusEvening.name, "50 Back");
assert.strictEqual(api.ehlText(focusEvening), "359 · 14 · 3");

const focusMorning = api.pickFocusEvent(feed.meet, morning);
assert.strictEqual(focusMorning.name, "50 Fly");
assert.strictEqual(api.ehlText(focusMorning), "343 · 12 · 1");

const med = api.eventsForMedium(feed.meet, evening);
assert.deepStrictEqual(med.rows.map((r) => r.eventNumber), ["337", "343", "349", "359"]);

const groups = api.groupEventsByDay(feed.meet);
assert.strictEqual(groups.length, 2);
assert.strictEqual(groups[0].rows.length, 5);
assert.strictEqual(groups[1].rows.length, 4);

const relay = feed.meet.events[0];
assert.strictEqual(api.ehlText(relay), "231 · TBA · TBA");

function texts(family, now) {
  const w = api.buildWidget(feed, family, now || evening);
  const out = [];
  collectText(w, out);
  assert.ok(w.url && w.url.includes("poppy-swim"));
  assert.ok(w.refreshAfterDate instanceof Date);
  const delta = (w.refreshAfterDate - (now || evening)) / 60000;
  assert.ok(delta >= 29 && delta <= 31, "refreshAfterDate should be ~30 minutes");
  return out.join(" | ");
}

const small = texts("small", evening);
assert.match(small, /POPPY/);
assert.match(small, /Mason Invite/);
assert.match(small, /359 · 14 · 3/);
assert.match(small, /BK/);
assert.match(small, /50 Back/);
assert.match(small, /35\.77/);
assert.match(small, /AAA/);
assert.match(small, /34\.39/);
assert.match(small, /3:16 PM/);
assert.doesNotMatch(small, /Kevin|screenshot|unofficial ranks|chat/i);

const medium = texts("medium", evening);
assert.match(medium, /Sunday, Nov 15/);
assert.match(medium, /337 · 2 · 5/);
assert.match(medium, /200 Medley Relay A/);
assert.match(medium, /50 Fly/);
assert.match(medium, /36\.43/);
assert.match(medium, /AA/);
assert.match(medium, /35\.09/);
assert.match(medium, /100 Breast/);
assert.match(medium, /50 Back/);
assert.doesNotMatch(medium, /100 Back/); // Saturday, not today
assert.match(medium, /50 Back/);

const large = texts("large", evening);
assert.match(large, /SATURDAY, NOV 14/);
assert.match(large, /SUNDAY, NOV 15/);
assert.match(large, /231 · TBA · TBA/);
assert.match(large, /FR-R/);
assert.match(large, /100 IM/);
assert.match(large, /1:22\.32/);
assert.match(large, /1:22\.09/);
assert.match(large, /Mason Aquatic Center/);

const lock = texts("accessoryRectangular", evening);
assert.match(lock, /359 · 14 · 3/);
assert.match(lock, /50 Back/);
assert.match(lock, /35\.77/);

const inline = texts("accessoryInline", evening);
assert.match(inline, /Poppy/);
assert.match(inline, /359 · 14 · 3/);
assert.match(inline, /50 Back/);

texts("accessoryCircular", evening);
texts("extraLarge", evening);

// Deadline fallback: Little Elves after Mason ends.
const deadlineFeed = JSON.parse(fs.readFileSync("/tmp/widget-nov16.json", "utf8"));
const dl = api.buildWidget(deadlineFeed, "small", new Date("2026-11-16T09:00:00-05:00"));
const dlText = [];
collectText(dl, dlText);
const joined = dlText.join(" | ");
assert.match(joined, /Little Elves/);
assert.match(joined, /ENTRIES DUE/);
assert.match(joined, /Nov 27/);

console.log("ok — layout stubs passed for small, medium, large, lock, and deadline fallback");
console.log("evening focus:", api.ehlText(focusEvening), focusEvening.name, focusEvening.best, "→", focusEvening.goal.label, focusEvening.goal.time);
console.log("morning focus:", api.ehlText(focusMorning), focusMorning.name);
