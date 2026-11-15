// Poppy Swim — Scriptable widget
// Fetches the current meet from https://grosskc.github.io/poppy-swim/widget.json
// and draws Event · Heat · Lane, plus best and goal times.
//
// Add this script in Scriptable, then add a Scriptable widget on your Home
// Screen or Lock Screen and select "Poppy Swim". Tap the widget to open the
// family dashboard.

const FEED_URL = "https://grosskc.github.io/poppy-swim/widget.json"
const DASHBOARD_URL = "https://grosskc.github.io/poppy-swim/#meets"
const CACHE_NAME = "poppy-swim-widget.json"
const REFRESH_MINUTES = 30
const SCRIPT_NAME = "Poppy Swim"

// ---------------------------------------------------------------------------
// Theme — navy and teal from the family dashboard, with a gold accent.
// ---------------------------------------------------------------------------

function themeFor(family, mode) {
  const lock = String(family || "").startsWith("accessory")
  if (lock) {
    // Lock Screen widgets sit on the system material. Keep type light and simple.
    const ink = Color.white()
    return {
      lock: true,
      bg: null,
      ink,
      soft: Color.white(),
      muted: Color.white(),
      teal: Color.white(),
      gold: Color.white(),
      line: Color.white(),
      accent: Color.white(),
    }
  }
  return {
    lock: false,
    bg: Color.dynamic(new Color("#F4F7FA"), new Color("#0C1B2E")),
    ink: Color.dynamic(new Color("#0C1B2E"), new Color("#F4F7FA")),
    soft: Color.dynamic(new Color("#24364A"), new Color("#C5D2DE")),
    muted: Color.dynamic(new Color("#5A6B7C"), new Color("#8A9AAB")),
    teal: Color.dynamic(new Color("#0A5E5E"), new Color("#5EC8C8")),
    gold: Color.dynamic(new Color("#8A6D3B"), new Color("#E0C37A")),
    line: Color.dynamic(new Color("#D7E0E7"), new Color("#1C2E44")),
    accent: Color.dynamic(new Color("#0C7C7C"), new Color("#5EC8C8")),
  }
}

function applyBackground(widget, theme) {
  if (theme.lock || !theme.bg) return
  const g = new LinearGradient()
  g.colors = [theme.accent, theme.accent, theme.bg, theme.bg]
  g.locations = [0, 0.012, 0.012, 1]
  g.startPoint = new Point(0, 0)
  g.endPoint = new Point(0, 1)
  widget.backgroundGradient = g
}

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

function isoDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return y + "-" + m + "-" + day
}

function isNS(ev) {
  const s = String((ev && ev.status) || "").toUpperCase()
  return s === "NS" || s === "NO SWIM"
}

function isUpcoming(ev, now) {
  if (!ev) return false
  const today = isoDate(now)
  if (ev.date) {
    if (ev.date > today) return true
    if (ev.date < today) return false
  }
  if (ev.startAt) {
    const t = new Date(ev.startAt)
    if (!isNaN(t.getTime())) return t.getTime() > now.getTime()
  }
  return false
}

function pickFocusEvent(meet, now) {
  const events = (meet && meet.events) || []
  const upcoming = events.filter((e) => isUpcoming(e, now) && !isNS(e))
  if (upcoming.length) return upcoming[0]
  const today = isoDate(now)
  const todayRows = events.filter((e) => e.date === today)
  if (todayRows.length) return todayRows[todayRows.length - 1]
  if (events.length) return events[events.length - 1]
  return null
}

function sessionFor(meet, date) {
  const sessions = (meet && meet.sessions) || []
  for (const s of sessions) {
    if (s.date === date) return s
  }
  return null
}

function eventsForMedium(meet, now) {
  const events = (meet && meet.events) || []
  const today = isoDate(now)
  const ofDay = (day) => events.filter((e) => e.date === day)
  const todayRows = ofDay(today)
  if (todayRows.length) {
    return { date: today, rows: todayRows, session: sessionFor(meet, today) }
  }
  const future = events.filter((e) => e.date && e.date >= today)
  const pool = future.length ? future : events
  if (!pool.length) return { date: null, rows: [], session: null }
  const day = pool[0].date
  return { date: day, rows: ofDay(day), session: sessionFor(meet, day) }
}

function groupEventsByDay(meet) {
  const groups = []
  const index = new Map()
  for (const ev of (meet && meet.events) || []) {
    const key = ev.date || ev.dayLabel || ""
    if (!index.has(key)) {
      const g = {
        date: ev.date,
        dayLabel: ev.dayLabel || ev.dayShort || "",
        dayShort: ev.dayShort,
        session: sessionFor(meet, ev.date),
        rows: [],
      }
      index.set(key, g)
      groups.push(g)
    }
    index.get(key).rows.push(ev)
  }
  return groups
}

function ehlText(ev) {
  const num = ev && ev.eventNumber ? String(ev.eventNumber) : "—"
  const heat = ev && ev.heat != null && ev.heat !== "" ? String(ev.heat) : "TBA"
  const lane = ev && ev.lane != null && ev.lane !== "" ? String(ev.lane) : "TBA"
  return num + " · " + heat + " · " + lane
}

function startLabel(ev, compact) {
  if (!ev || !ev.start) return ""
  if (compact) return String(ev.start).replace(/\s*(AM|PM)$/i, "").trim()
  return ev.start
}

function bestGoalParts(ev) {
  if (!ev) return null
  if (ev.best && ev.goal && ev.goal.time) {
    return { best: ev.best, cut: ev.goal.label, goal: ev.goal.time }
  }
  if (ev.best) return { best: ev.best, cut: null, goal: null }
  return null
}

function dayKicker(meet, ev, now) {
  if (ev && ev.dayShort) return ev.dayShort.toUpperCase()
  if (meet && meet.startDate === meet.endDate && ev && ev.dayShort) return ev.dayShort.toUpperCase()
  const today = isoDate(now)
  if (meet && meet.startDate && meet.endDate && meet.startDate <= today && today <= meet.endDate) {
    return "TODAY"
  }
  return (meet && meet.datesLabel) || ""
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

function addKicker(parent, text, theme, size) {
  const t = parent.addText(text)
  t.font = Font.semiboldSystemFont(size)
  t.textColor = theme.teal
  t.lineLimit = 1
  t.minimumScaleFactor = 0.8
  return t
}

function addTitle(parent, text, theme, size) {
  const t = parent.addText(text)
  t.font = Font.boldSystemFont(size)
  t.textColor = theme.ink
  t.lineLimit = 1
  t.minimumScaleFactor = 0.7
  return t
}

function addMuted(parent, text, theme, size) {
  const t = parent.addText(text)
  t.font = Font.mediumSystemFont(size)
  t.textColor = theme.muted
  t.lineLimit = 1
  t.minimumScaleFactor = 0.7
  return t
}

function addBestGoal(parent, ev, theme, size, tight) {
  const parts = bestGoalParts(ev)
  if (!parts) {
    const t = parent.addText("—")
    t.font = Font.mediumSystemFont(size)
    t.textColor = theme.muted
    t.lineLimit = 1
    return t
  }
  const row = parent.addStack()
  row.layoutHorizontally()
  row.centerAlignContent()
  row.spacing = tight ? 4 : 5
  const best = row.addText(parts.best)
  best.font = Font.semiboldSystemFont(size)
  best.textColor = theme.ink
  best.lineLimit = 1
  best.minimumScaleFactor = 0.7
  if (parts.goal) {
    const arrow = row.addText("→")
    arrow.font = Font.mediumSystemFont(size)
    arrow.textColor = theme.gold
    const cut = row.addText(parts.cut)
    cut.font = Font.boldSystemFont(Math.max(9, size - 1))
    cut.textColor = theme.teal
    cut.lineLimit = 1
    const goal = row.addText(parts.goal)
    goal.font = Font.semiboldSystemFont(size)
    goal.textColor = theme.ink
    goal.lineLimit = 1
    goal.minimumScaleFactor = 0.7
  }
  return row
}

function headerLine(meet) {
  return (meet && (meet.shortName || meet.name)) || "Meet"
}

function sessionBlurb(session) {
  if (!session) return ""
  const bits = []
  if (session.warmup) bits.push("Warm-up " + session.warmup)
  if (session.start) bits.push("Start " + session.start)
  return bits.join("  ·  ")
}

function buildSmall(widget, data, now, theme) {
  widget.setPadding(12, 14, 12, 14)
  const meet = data.meet
  if (!meet) return buildEmpty(widget, data, theme)

  if (data.mode !== "entries") {
    addKicker(widget, (data.swimmer || "POPPY").toUpperCase(), theme, 9)
    widget.addSpacer(2)
    addTitle(widget, headerLine(meet), theme, 15)
    widget.addSpacer(8)
    addMuted(widget, meet.datesLabel || "", theme, 11)
    if (meet.venueShort || meet.venue) {
      widget.addSpacer(2)
      addMuted(widget, meet.venueShort || meet.venue, theme, 11)
    }
    widget.addSpacer(10)
    const dl = meet.deadline
    if (dl && dl.label) {
      addKicker(widget, "ENTRIES DUE", theme, 9)
      widget.addSpacer(2)
      addTitle(widget, dl.label.replace(/, 20\d\d/, ""), theme, 13)
    } else {
      addMuted(widget, "Events not posted yet.", theme, 12)
    }
    return
  }

  const ev = pickFocusEvent(meet, now)
  addKicker(widget, (data.swimmer || "Poppy").toUpperCase() + "  ·  " + dayKicker(meet, ev, now), theme, 9)
  widget.addSpacer(1)
  addTitle(widget, headerLine(meet), theme, 13)
  widget.addSpacer(8)
  if (!ev) {
    addMuted(widget, "Events not posted yet.", theme, 12)
    return
  }
  const ehl = widget.addText(ehlText(ev))
  ehl.font = Font.boldSystemFont(22)
  ehl.textColor = theme.ink
  ehl.lineLimit = 1
  ehl.minimumScaleFactor = 0.55
  widget.addSpacer(1)
  const stroke = widget.addText(ev.stroke || "")
  stroke.font = Font.boldSystemFont(12)
  stroke.textColor = theme.teal
  stroke.lineLimit = 1
  widget.addSpacer(8)
  addTitle(widget, ev.name || "", theme, 13)
  widget.addSpacer(4)
  addBestGoal(widget, ev, theme, 12, true)
  const start = startLabel(ev, false)
  if (start) {
    widget.addSpacer(3)
    addMuted(widget, start, theme, 11)
  }
}

function addEventRow(parent, ev, theme, opts) {
  opts = opts || {}
  const fontEhl = opts.ehl || 12
  const fontBody = opts.body || 12
  const fontTime = opts.time || 11
  const showStart = opts.showStart !== false
  const row = parent.addStack()
  row.layoutHorizontally()
  row.topAlignContent()
  row.spacing = 8

  const ehlCol = row.addStack()
  ehlCol.layoutVertically()
  ehlCol.size = new Size(opts.ehlWidth || 90, 0)
  const ehl = ehlCol.addText(ehlText(ev))
  ehl.font = Font.semiboldSystemFont(fontEhl)
  ehl.textColor = theme.ink
  ehl.lineLimit = 1
  ehl.minimumScaleFactor = 0.5
  const stroke = ehlCol.addText(ev.stroke || "")
  stroke.font = Font.boldSystemFont(Math.max(9, fontBody - 2))
  stroke.textColor = theme.teal
  stroke.lineLimit = 1

  const mid = row.addStack()
  mid.layoutVertically()
  mid.topAlignContent()
  const name = mid.addText(ev.name || "")
  name.font = Font.mediumSystemFont(fontBody)
  name.textColor = theme.ink
  name.lineLimit = 1
  name.minimumScaleFactor = 0.65
  addBestGoal(mid, ev, theme, fontTime, true)

  if (showStart) {
    const start = startLabel(ev, true)
    const st = row.addText(start || "")
    st.font = Font.mediumSystemFont(fontTime)
    st.textColor = theme.muted
    st.lineLimit = 1
    st.rightAlignText()
    st.minimumScaleFactor = 0.7
  }
  return row
}

function buildMedium(widget, data, now, theme) {
  widget.setPadding(7, 14, 7, 14)
  const meet = data.meet
  if (!meet) return buildEmpty(widget, data, theme)

  const top = widget.addStack()
  top.layoutHorizontally()
  top.bottomAlignContent()
  const left = top.addStack()
  left.layoutVertically()
  addKicker(left, (data.swimmer || "Poppy").toUpperCase(), theme, 9)
  left.addSpacer(1)
  addTitle(left, headerLine(meet), theme, 15)
  top.addSpacer()
  const right = top.addStack()
  right.layoutVertically()
  right.endAlignContent && right.endAlignContent()

  if (data.mode !== "entries") {
    const dl = meet.deadline
    addMuted(right, meet.datesLabel || "", theme, 10)
    widget.addSpacer(10)
    if (meet.venueShort || meet.venue) addMuted(widget, meet.venueShort || meet.venue, theme, 11)
    widget.addSpacer(10)
    if (dl && dl.label) {
      addKicker(widget, "ENTRIES DUE", theme, 9)
      widget.addSpacer(2)
      addTitle(widget, dl.label, theme, 16)
    } else {
      addMuted(widget, "Events not posted yet.", theme, 13)
    }
    return
  }

  const day = eventsForMedium(meet, now)
  const dayLabel = (day.rows[0] && (day.rows[0].dayLabel || day.rows[0].dayShort)) || meet.datesLabel || ""
  addMuted(right, dayLabel, theme, 10)
  widget.addSpacer(8)
  if (!day.rows.length) {
    addMuted(widget, "Events not posted yet.", theme, 12)
    return
  }
  for (let i = 0; i < day.rows.length; i++) {
    if (i) widget.addSpacer(3)
    addEventRow(widget, day.rows[i], theme, { ehl: 12, body: 12, time: 11, showStart: true, ehlWidth: 90 })
  }
}

function buildLarge(widget, data, now, theme) {
  widget.setPadding(12, 16, 11, 16)
  const meet = data.meet
  if (!meet) return buildEmpty(widget, data, theme)

  addKicker(widget, (data.swimmer || "Poppy").toUpperCase(), theme, 10)
  widget.addSpacer(1)
  addTitle(widget, headerLine(meet), theme, 18)
  widget.addSpacer(2)
  const sub = [meet.datesLabel, meet.venueShort || meet.venue].filter(Boolean).join("  ·  ")
  if (sub) addMuted(widget, sub, theme, 11)

  if (data.mode !== "entries") {
    widget.addSpacer(16)
    const dl = meet.deadline
    if (dl && dl.label) {
      addKicker(widget, "ENTRIES DUE", theme, 10)
      widget.addSpacer(3)
      addTitle(widget, dl.label, theme, 18)
    } else {
      addMuted(widget, "Events not posted yet.", theme, 14)
    }
    const suggested = meet.suggestedEvents || []
    if (suggested.length) {
      widget.addSpacer(14)
      addMuted(widget, "Suggested  ·  " + suggested.join("  ·  "), theme, 12)
    }
    return
  }

  widget.addSpacer(8)
  const groups = groupEventsByDay(meet)
  for (let g = 0; g < groups.length; g++) {
    const group = groups[g]
    if (g) widget.addSpacer(5)
    const band = widget.addStack()
    band.layoutHorizontally()
    band.bottomAlignContent()
    const day = band.addText((group.dayLabel || "").toUpperCase())
    day.font = Font.semiboldSystemFont(9)
    day.textColor = theme.teal
    day.lineLimit = 1
    const blurb = sessionBlurb(group.session)
    if (blurb) {
      band.addSpacer()
      const b = band.addText(blurb)
      b.font = Font.mediumSystemFont(9)
      b.textColor = theme.muted
      b.lineLimit = 1
      b.minimumScaleFactor = 0.7
    }
    widget.addSpacer(3)
    for (let i = 0; i < group.rows.length; i++) {
      if (i) widget.addSpacer(3)
      addEventRow(widget, group.rows[i], theme, { ehl: 12, body: 12, time: 11, showStart: true, ehlWidth: 92 })
    }
  }
}

function buildLockRect(widget, data, now, theme) {
  widget.setPadding(4, 6, 4, 6)
  const meet = data.meet
  if (!meet) {
    const t = widget.addText("No meet posted")
    t.font = Font.mediumSystemFont(11)
    t.textColor = theme.ink
    t.lineLimit = 1
    return
  }
  if (data.mode !== "entries") {
    addTitle(widget, headerLine(meet), theme, 13)
    widget.addSpacer(2)
    const dl = meet.deadline
    addMuted(widget, (dl && dl.label) || meet.datesLabel || "Events not posted yet.", theme, 11)
    return
  }
  const ev = pickFocusEvent(meet, now)
  if (!ev) {
    addMuted(widget, "Events not posted yet.", theme, 11)
    return
  }
  const top = widget.addStack()
  top.layoutHorizontally()
  top.centerAlignContent()
  const ehl = top.addText(ehlText(ev))
  ehl.font = Font.boldSystemFont(13)
  ehl.textColor = theme.ink
  ehl.lineLimit = 1
  ehl.minimumScaleFactor = 0.6
  top.addSpacer(6)
  const st = top.addText(ev.stroke || "")
  st.font = Font.boldSystemFont(12)
  st.textColor = theme.teal
  top.addSpacer()
  const when = startLabel(ev, false)
  if (when) addMuted(top, when, theme, 11)
  widget.addSpacer(2)
  addTitle(widget, ev.name || "", theme, 12)
  widget.addSpacer(1)
  addBestGoal(widget, ev, theme, 11, true)
}

function buildLockInline(widget, data, now, theme) {
  const meet = data.meet
  let text = (data.swimmer || "Poppy")
  if (!meet) {
    widget.addText(text + "  ·  no meet posted")
    return
  }
  if (data.mode !== "entries") {
    const dl = meet.deadline
    text += "  ·  " + headerLine(meet)
    if (dl && dl.label) text += "  ·  due " + dl.label
    const t = widget.addText(text)
    t.font = Font.mediumSystemFont(12)
    t.lineLimit = 1
    t.minimumScaleFactor = 0.6
    return
  }
  const ev = pickFocusEvent(meet, now)
  if (ev) {
    text += "  ·  " + ehlText(ev) + "  " + (ev.stroke || "") + "  " + (ev.name || "")
  } else {
    text += "  ·  " + headerLine(meet)
  }
  const t = widget.addText(text)
  t.font = Font.mediumSystemFont(12)
  t.lineLimit = 1
  t.minimumScaleFactor = 0.5
}

function buildLockCircular(widget, data, now, theme) {
  widget.setPadding(4, 4, 4, 4)
  const meet = data.meet
  const ev = meet && data.mode === "entries" ? pickFocusEvent(meet, now) : null
  if (!ev) {
    const t = widget.addText((meet && meet.shortName) || "Poppy")
    t.font = Font.boldSystemFont(10)
    t.textColor = theme.ink
    t.centerAlignText()
    t.minimumScaleFactor = 0.5
    t.lineLimit = 2
    return
  }
  const num = widget.addText(ev.eventNumber ? String(ev.eventNumber) : "—")
  num.font = Font.boldSystemFont(16)
  num.textColor = theme.ink
  num.centerAlignText()
  num.minimumScaleFactor = 0.6
  const hl = widget.addText(
    (ev.heat != null ? String(ev.heat) : "TBA") + " · " + (ev.lane != null ? String(ev.lane) : "TBA")
  )
  hl.font = Font.semiboldSystemFont(10)
  hl.textColor = theme.ink
  hl.centerAlignText()
  hl.minimumScaleFactor = 0.5
  const st = widget.addText(ev.stroke || "")
  st.font = Font.boldSystemFont(10)
  st.textColor = theme.teal
  st.centerAlignText()
}

function buildEmpty(widget, data, theme) {
  addKicker(widget, (data && data.swimmer || "Poppy").toUpperCase(), theme, 9)
  widget.addSpacer(6)
  addTitle(widget, "No upcoming meet", theme, 15)
  widget.addSpacer(4)
  addMuted(widget, "Tap to open the dashboard.", theme, 11)
}

function buildError(message) {
  const widget = new ListWidget()
  const theme = themeFor("medium")
  applyBackground(widget, theme)
  widget.setPadding(14, 14, 14, 14)
  widget.url = DASHBOARD_URL
  addTitle(widget, "Poppy Swim", theme, 15)
  widget.addSpacer(6)
  addMuted(widget, message || "Couldn't load meet data. Tap to open the dashboard.", theme, 12)
  return widget
}

function buildWidget(data, family, now) {
  now = now || new Date()
  family = family || "medium"
  const widget = new ListWidget()
  const theme = themeFor(family)
  applyBackground(widget, theme)
  widget.url = (data && data.dashboardUrl) || DASHBOARD_URL
  widget.refreshAfterDate = new Date(now.getTime() + REFRESH_MINUTES * 60 * 1000)
  if (family === "small") buildSmall(widget, data, now, theme)
  else if (family === "medium") buildMedium(widget, data, now, theme)
  else if (family === "large" || family === "extraLarge") buildLarge(widget, data, now, theme)
  else if (family === "accessoryRectangular") buildLockRect(widget, data, now, theme)
  else if (family === "accessoryInline") buildLockInline(widget, data, now, theme)
  else if (family === "accessoryCircular") buildLockCircular(widget, data, now, theme)
  else buildMedium(widget, data, now, theme)
  return widget
}

// ---------------------------------------------------------------------------
// Load + cache
// ---------------------------------------------------------------------------

function cacheFile() {
  const fm = FileManager.local()
  return fm.joinPath(fm.documentsDirectory(), CACHE_NAME)
}

function readCache() {
  try {
    const fm = FileManager.local()
    const p = cacheFile()
    if (!fm.fileExists(p)) return null
    return JSON.parse(fm.readString(p))
  } catch (e) {
    return null
  }
}

function writeCache(data) {
  try {
    FileManager.local().writeString(cacheFile(), JSON.stringify(data))
  } catch (e) {}
}

async function fetchFeed() {
  const req = new Request(FEED_URL)
  req.timeoutInterval = 12
  req.headers = { "Cache-Control": "no-cache", "Accept": "application/json" }
  const data = await req.loadJSON()
  if (!data || typeof data !== "object") throw new Error("empty feed")
  writeCache(data)
  return data
}

async function loadData() {
  try {
    return await fetchFeed()
  } catch (e) {
    const cached = readCache()
    if (cached) return cached
    throw e
  }
}

async function main() {
  const family = (typeof config !== "undefined" && config.widgetFamily) || "medium"
  let data
  try {
    data = await loadData()
  } catch (e) {
    const err = buildError("Couldn't load meet data. Tap to open the dashboard.")
    if (typeof config !== "undefined" && config.runsInWidget) {
      Script.setWidget(err)
    } else {
      await err.presentMedium()
    }
    Script.complete()
    return
  }
  const widget = buildWidget(data, family || "medium", new Date())
  if (typeof config !== "undefined" && config.runsInWidget) {
    Script.setWidget(widget)
  } else {
    // Re-build in the size the person picks so the preview matches.
    const alert = new Alert()
    alert.title = SCRIPT_NAME
    alert.message = "Choose a size to preview. When you are ready, add a Scriptable widget on your Home Screen or Lock Screen and select this script."
    alert.addAction("Small")
    alert.addAction("Medium")
    alert.addAction("Large")
    alert.addAction("Lock Screen")
    alert.addCancelAction("Cancel")
    const i = await alert.presentAlert()
    const pick = i === 0 ? "small" : i === 1 ? "medium" : i === 2 ? "large" : i === 3 ? "accessoryRectangular" : null
    if (pick) {
      const preview = buildWidget(data, pick, new Date())
      if (pick === "small") await preview.presentSmall()
      else if (pick === "medium") await preview.presentMedium()
      else if (pick === "large") await preview.presentLarge()
      else await preview.presentAccessoryRectangular()
    }
  }
  Script.complete()
}

const IS_SCRIPTABLE = typeof Script !== "undefined" && typeof config !== "undefined"
if (IS_SCRIPTABLE) {
  main()
}

if (typeof globalThis !== "undefined") {
  globalThis.PoppySwim = {
    FEED_URL,
    DASHBOARD_URL,
    REFRESH_MINUTES,
    buildWidget,
    pickFocusEvent,
    eventsForMedium,
    groupEventsByDay,
    ehlText,
    isUpcoming,
    bestGoalParts,
    startLabel,
    loadData,
    themeFor,
  }
}
