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
  static boldMonospacedSystemFont(size) { return new Font("mono-bold", size); }
  static semiboldMonospacedSystemFont(size) { return new Font("mono-semibold", size); }
  static regularMonospacedSystemFont(size) { return new Font("mono-regular", size); }
  static monospacedSystemFont(size) { return new Font("mono", size); }
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
assert.strictEqual(api.SCRIPT_VERSION, "3.0.0");
assert.ok(api.looksLikePoppyScript(src));
assert.strictEqual(api.extractScriptVersion(src), "3.0.0");

const evening = new Date("2026-11-15T18:05:00-05:00");
const morning = new Date("2026-11-15T12:40:00-05:00");
const saturdayMorning = new Date("2026-11-14T10:00:00-05:00");

function eq(a, b) {
  assert.strictEqual(JSON.stringify(a), JSON.stringify(b), JSON.stringify(a) + " != " + JSON.stringify(b));
}
eq(api.parseWidgetParam("auto"), { kind: "auto" });
eq(api.parseWidgetParam(" SAT "), { kind: "weekday", weekday: "sat" });
eq(api.parseWidgetParam("Sunday"), { kind: "weekday", weekday: "sun" });
eq(api.parseWidgetParam("day2"), { kind: "index", index: 1 });
eq(api.parseWidgetParam("day 1"), { kind: "index", index: 0 });
eq(api.parseWidgetParam("nope"), { kind: "auto" });

const days = api.meetDays(feed.meet);
assert.strictEqual(days.length, 2);
assert.strictEqual(days[0].rows.length, 5);
assert.strictEqual(days[1].rows.length, 4);
assert.strictEqual(days[0].weekday, "sat");
assert.strictEqual(days[1].weekday, "sun");

assert.strictEqual(api.selectDay(feed.meet, evening, "auto").date, "2026-11-15");
assert.strictEqual(api.selectDay(feed.meet, evening, "sat").date, "2026-11-14");
assert.strictEqual(api.selectDay(feed.meet, evening, "day1").date, "2026-11-14");
assert.strictEqual(api.selectDay(feed.meet, evening, "day2").date, "2026-11-15");
assert.strictEqual(api.selectDay(feed.meet, saturdayMorning, "auto").date, "2026-11-14");

const focusEvening = api.pickFocusEvent(feed.meet, evening, "auto");
assert.strictEqual(focusEvening.name, "50 Back");
assert.strictEqual(api.ehlText(focusEvening), "359 · 14 · 3");

const focusMorning = api.pickFocusEvent(feed.meet, morning, "auto");
assert.strictEqual(focusMorning.name, "50 Fly");
assert.strictEqual(api.ehlText(focusMorning), "343 · 12 · 1");

const focusSat = api.pickFocusEvent(feed.meet, evening, "sat");
assert.strictEqual(focusSat.name, "200 Free Relay");

const medEvening = api.eventsForMedium(feed.meet, evening, "auto");
eq(medEvening.rows.map((r) => r.eventNumber), ["337", "343", "349"]);

const medMorning = api.eventsForMedium(feed.meet, morning, "auto");
eq(medMorning.rows.map((r) => r.eventNumber), ["343", "349", "359"]);

const medSat = api.eventsForMedium(feed.meet, evening, "sat");
eq(medSat.rows.map((r) => r.eventNumber), ["231", "237", "243"]);

const groups = api.groupEventsByDay(feed.meet);
assert.strictEqual(groups.length, 2);
assert.strictEqual(groups[0].rows.length, 5);
assert.strictEqual(groups[1].rows.length, 4);

const relay = feed.meet.events[0];
assert.strictEqual(api.ehlText(relay), "231 · TBA · TBA");

function texts(family, now, param) {
  const w = api.buildWidget(feed, family, now || evening, param);
  const out = [];
  collectText(w, out);
  assert.ok(w.url && w.url.includes("poppy-swim"));
  assert.ok(w.refreshAfterDate instanceof Date);
  const delta = (w.refreshAfterDate - (now || evening)) / 60000;
  assert.ok(delta >= 29 && delta <= 31, "refreshAfterDate should be ~30 minutes");
  return out.join(" | ");
}

function assertNoGoalsOrStarts(s) {
  assert.doesNotMatch(s, /AAAA|AAA|AA\b|1:22\.09|1:10\.59|35\.09|34\.39|1:24\.69|38\.89|1:20\.99/);
  assert.doesNotMatch(s, /3:16 PM|12:30 PM|12:57 PM|1:37 PM|1:07 PM|2:07 PM|3:19 PM|3:49 PM/);
  assert.doesNotMatch(s, /Kevin|screenshot|unofficial ranks|chat|Warm-up/i);
}

const small = texts("small", evening, "auto");
assert.match(small, /Mason Invite/);
assert.match(small, /Sun Nov 15/);
assert.match(small, /EVENT/);
assert.match(small, /HEAT/);
assert.match(small, /LANE/);
assert.match(small, /STROKE/);
assert.match(small, /BEST/);
assert.match(small, /359/);
assert.match(small, /14/);
assert.match(small, /\b3\b/);
assert.match(small, /BK/);
assert.match(small, /50 Back/);
assert.match(small, /35\.77/);
assert.doesNotMatch(small, /100 Back/);
assertNoGoalsOrStarts(small);

const medium = texts("medium", evening, "auto");
assert.match(medium, /Mason Invite/);
assert.match(medium, /Sun Nov 15/);
assert.match(medium, /EVENT/);
assert.match(medium, /HEAT/);
assert.match(medium, /LANE/);
assert.match(medium, /STROKE/);
assert.match(medium, /BEST/);
assert.match(medium, /337/);
assert.match(medium, /200 Medley Relay A/);
assert.match(medium, /50 Fly/);
assert.match(medium, /36\.43/);
assert.match(medium, /100 Breast/);
assert.doesNotMatch(medium, /50 Back/); // fourth Sunday race, day is over
assert.doesNotMatch(medium, /100 Back/);
assertNoGoalsOrStarts(medium);

const mediumMorning = texts("medium", morning, "auto");
assert.match(mediumMorning, /50 Fly/);
assert.match(mediumMorning, /100 Breast/);
assert.match(mediumMorning, /50 Back/);
assert.doesNotMatch(mediumMorning, /200 Medley Relay A/); // already started at 12:30

const large = texts("large", evening, "auto");
assert.match(large, /Mason Invite/);
assert.match(large, /Sun Nov 15/);
assert.match(large, /EVENT/);
assert.match(large, /337/);
assert.match(large, /MR/);
assert.match(large, /200 Medley Relay A/);
assert.match(large, /50 Back/);
assert.match(large, /35\.77/);
assert.doesNotMatch(large, /Sat Nov 14/);
assert.doesNotMatch(large, /100 Back/);
assert.doesNotMatch(large, /231/);
assert.doesNotMatch(large, /Mason Aquatic Center/);
assertNoGoalsOrStarts(large);

const largeSat = texts("large", evening, "sat");
assert.match(largeSat, /Sat Nov 14/);
assert.match(largeSat, /231/);
assert.match(largeSat, /TBA/);
assert.match(largeSat, /FR-R/);
assert.match(largeSat, /200 Free Relay/);
assert.match(largeSat, /100 IM/);
assert.match(largeSat, /1:22\.32/);
assert.doesNotMatch(largeSat, /Sun Nov 15/);
assert.doesNotMatch(largeSat, /50 Back/);
assertNoGoalsOrStarts(largeSat);

const largeDay2 = texts("large", evening, "day2");
assert.match(largeDay2, /Sun Nov 15/);
assert.match(largeDay2, /50 Back/);

const lock = texts("accessoryRectangular", evening, "auto");
assert.match(lock, /EVENT/);
assert.match(lock, /HEAT/);
assert.match(lock, /LANE/);
assert.match(lock, /359/);
assert.match(lock, /14/);
assert.match(lock, /50 Back/);
assert.match(lock, /35\.77/);
assertNoGoalsOrStarts(lock);

const inline = texts("accessoryInline", evening, "auto");
assert.match(inline, /Poppy/);
assert.match(inline, /359 · 14 · 3/);
assert.match(inline, /50 Back/);

texts("accessoryCircular", evening, "auto");
texts("extraLarge", evening, "sun");

// Deadline fallback: Little Elves after Mason ends.
const deadlineFeed = JSON.parse(fs.readFileSync("/tmp/widget-nov16.json", "utf8"));
const dl = api.buildWidget(deadlineFeed, "small", new Date("2026-11-16T09:00:00-05:00"), "auto");
const dlText = [];
collectText(dl, dlText);
const joined = dlText.join(" | ");
assert.match(joined, /Little Elves/);
assert.match(joined, /ENTRIES DUE/);
assert.match(joined, /Nov 27/);

const dlLarge = api.buildWidget(deadlineFeed, "large", new Date("2026-11-16T09:00:00-05:00"), "auto");
const dlLargeText = [];
collectText(dlLarge, dlLargeText);
assert.match(dlLargeText.join(" | "), /ENTRIES DUE/);

// New script still works if the feed has no days array (older widget.json).
const legacy = JSON.parse(JSON.stringify(feed));
delete legacy.meet.days;
const legacyDay = api.selectDay(legacy.meet, evening, "sun");
assert.strictEqual(legacyDay.date, "2026-11-15");
const legacyText = texts.call({ feed: legacy }, "large", evening, "auto");
void legacyText;
const wLegacy = api.buildWidget(legacy, "large", evening, "sat");
const legacyOut = [];
collectText(wLegacy, legacyOut);
assert.match(legacyOut.join(" | "), /100 Back/);

console.log("ok — v3 layout stubs passed for small, medium, large, lock, params, and deadline fallback");
console.log("evening focus:", api.ehlText(focusEvening), focusEvening.name, focusEvening.best);
console.log("morning focus:", api.ehlText(focusMorning), focusMorning.name);
console.log("medium evening:", medEvening.rows.map((r) => r.name).join(", "));
console.log("medium morning:", medMorning.rows.map((r) => r.name).join(", "));
