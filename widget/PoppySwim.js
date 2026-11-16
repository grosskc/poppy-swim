// Poppy Swim — Scriptable widget
// Fetches the current meet from https://grosskc.github.io/poppy-swim/widget.json
// and draws one day's Event / Heat / Lane / Stroke / Best table.
//
// Add this script in Scriptable, then add a Scriptable widget on your Home
// Screen or Lock Screen and select "Poppy Swim". Set the widget Parameter
// to auto (default), sat, sun, or day1 / day2 to pick a day. Tap the widget
// to open the family dashboard. The script updates itself about once a day.

const SCRIPT_VERSION = "3.0.0"
const FEED_URL = "https://grosskc.github.io/poppy-swim/widget.json"
const SCRIPT_URL = "https://grosskc.github.io/poppy-swim/widget/PoppySwim.js"
const DASHBOARD_URL = "https://grosskc.github.io/poppy-swim/#meets"
const CACHE_NAME = "poppy-swim-widget.json"
const UPDATE_STAMP = "poppy-swim-self-update.txt"
const REFRESH_MINUTES = 30
const SCRIPT_NAME = "Poppy Swim"

const WEEKDAYS = {
  sun: "sun", sunday: "sun",
  mon: "mon", monday: "mon",
  tue: "tue", tues: "tue", tuesday: "tue",
  wed: "wed", wednesday: "wed",
  thu: "thu", thur: "thu", thurs: "thu", thursday: "thu",
  fri: "fri", friday: "fri",
  sat: "sat", saturday: "sat",
}
const WEEKDAY_FROM_UTC_DAY = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

// ---------------------------------------------------------------------------
// Theme — navy and teal from the family dashboard.
// ---------------------------------------------------------------------------

function themeFor(family, mode) {
  const lock = String(family || "").startsWith("accessory")
  if (lock) {
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

function parseISODate(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  return { y: +m[1], mo: +m[2], d: +m[3] }
}

function weekdayName(iso) {
  const p = parseISODate(iso)
  if (!p) return ""
  const dt = new Date(Date.UTC(p.y, p.mo - 1, p.d, 12, 0, 0))
  return WEEKDAY_FROM_UTC_DAY[dt.getUTCDay()]
}

function compactDay(iso, dayShort) {
  const p = parseISODate(iso)
  if (!p) return dayShort || ""
  const wd = dayShort || WEEKDAY_FROM_UTC_DAY[new Date(Date.UTC(p.y, p.mo - 1, p.d, 12, 0, 0)).getUTCDay()]
  const short = wd ? wd.charAt(0).toUpperCase() + wd.slice(1) : ""
  return (short + " " + MONTH_SHORT[p.mo - 1] + " " + p.d).trim()
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

function isPastOnDay(ev, dayRows, now) {
  if (!ev) return true
  if (isNS(ev)) return true
  const today = isoDate(now)
  if (ev.date && ev.date < today) return true
  if (ev.date && ev.date > today) return false
  if (ev.startAt) {
    const t = new Date(ev.startAt)
    if (!isNaN(t.getTime()) && t.getTime() <= now.getTime()) return true
  }
  const rows = dayRows || []
  const idx = rows.indexOf(ev)
  const start = idx < 0 ? 0 : idx + 1
  for (let i = start; i < rows.length; i++) {
    const next = rows[i]
    if (!next || !next.startAt) continue
    const t = new Date(next.startAt)
    if (!isNaN(t.getTime()) && t.getTime() <= now.getTime()) return true
  }
  return false
}

function heatLaneText(value) {
  if (value == null || value === "") return "TBA"
  return String(value)
}

function ehlText(ev) {
  const num = ev && ev.eventNumber ? String(ev.eventNumber) : "—"
  return num + " · " + heatLaneText(ev && ev.heat) + " · " + heatLaneText(ev && ev.lane)
}

function startLabel(ev, compact) {
  if (!ev || !ev.start) return ""
  if (compact) return String(ev.start).replace(/\s*(AM|PM)$/i, "").trim()
  return ev.start
}

function bestText(ev) {
  if (ev && ev.best) return String(ev.best)
  return ""
}

function bestGoalParts(ev) {
  if (!ev) return null
  if (ev.best && ev.goal && ev.goal.time) {
    return { best: ev.best, cut: ev.goal.label, goal: ev.goal.time }
  }
  if (ev.best) return { best: ev.best, cut: null, goal: null }
  return null
}

function sessionFor(meet, date) {
  const sessions = (meet && meet.sessions) || []
  for (const s of sessions) {
    if (s.date === date) return s
  }
  return null
}

function meetDays(meet) {
  const events = (meet && meet.events) || []
  const groups = []
  const index = new Map()
  for (const d of (meet && meet.days) || []) {
    if (!d || !d.date) continue
    const g = {
      date: d.date,
      dayLabel: d.dayLabel,
      dayShort: d.dayShort,
      dayCompact: d.dayCompact || compactDay(d.date, d.dayShort),
      weekday: d.weekday || weekdayName(d.date),
      session: sessionFor(meet, d.date),
      rows: [],
    }
    index.set(d.date, g)
    groups.push(g)
  }
  for (const ev of events) {
    const key = ev.date || ev.dayLabel || ""
    if (!index.has(key)) {
      const g = {
        date: ev.date,
        dayLabel: ev.dayLabel,
        dayShort: ev.dayShort,
        dayCompact: compactDay(ev.date, ev.dayShort),
        weekday: ev.date ? weekdayName(ev.date) : "",
        session: sessionFor(meet, ev.date),
        rows: [],
      }
      index.set(key, g)
      groups.push(g)
    }
    index.get(key).rows.push(ev)
  }
  return groups.filter((g) => g.rows.length)
}

function groupEventsByDay(meet) {
  return meetDays(meet)
}

function parseWidgetParam(raw) {
  const s = String(raw == null ? "auto" : raw).trim().toLowerCase().replace(/\s+/g, "")
  if (!s || s === "auto" || s === "today") return { kind: "auto" }
  const dayN = s.match(/^day([1-9]\d*)$/)
  if (dayN) return { kind: "index", index: Math.max(0, parseInt(dayN[1], 10) - 1) }
  if (WEEKDAYS[s]) return { kind: "weekday", weekday: WEEKDAYS[s] }
  return { kind: "auto" }
}

function selectDay(meet, now, param) {
  const days = meetDays(meet)
  if (!days.length) return null
  const parsed = parseWidgetParam(param)
  if (parsed.kind === "index") {
    return days[Math.min(parsed.index, days.length - 1)] || days[0]
  }
  if (parsed.kind === "weekday") {
    for (let i = 0; i < days.length; i++) {
      if (days[i].weekday === parsed.weekday) return days[i]
    }
    return days[0]
  }
  const today = isoDate(now || new Date())
  const start = meet && meet.startDate
  const end = meet && meet.endDate
  if (start && end && start <= today && today <= end) {
    for (let i = 0; i < days.length; i++) {
      if (days[i].date === today) return days[i]
    }
    for (let i = 0; i < days.length; i++) {
      if (days[i].date && days[i].date >= today) return days[i]
    }
  }
  return days[0]
}

function remainingRows(day, now) {
  const rows = (day && day.rows) || []
  return rows.filter((ev) => !isPastOnDay(ev, rows, now))
}

function rowsForMedium(day, now) {
  const rows = (day && day.rows) || []
  if (!rows.length) return []
  const today = isoDate(now)
  if (!day.date || day.date !== today) return rows.slice(0, 3)
  const next = remainingRows(day, now)
  if (next.length) return next.slice(0, 3)
  return rows.slice(0, 3)
}

function eventsForMedium(meet, now, param) {
  const day = selectDay(meet, now, param)
  if (!day) return { date: null, rows: [], session: null, day: null }
  return { date: day.date, rows: rowsForMedium(day, now), session: day.session, day: day }
}

function pickDayEvent(day, now) {
  if (!day || !day.rows || !day.rows.length) return null
  const today = isoDate(now)
  if (day.date && day.date !== today) return day.rows[0]
  const next = remainingRows(day, now)
  if (next.length) return next[0]
  return day.rows[day.rows.length - 1]
}

function pickFocusEvent(meet, now, param) {
  const day = selectDay(meet, now, param)
  if (day) return pickDayEvent(day, now)
  const events = (meet && meet.events) || []
  const upcoming = events.filter((e) => isUpcoming(e, now) && !isNS(e))
  if (upcoming.length) return upcoming[0]
  const today = isoDate(now)
  const todayRows = events.filter((e) => e.date === today)
  if (todayRows.length) return todayRows[todayRows.length - 1]
  if (events.length) return events[events.length - 1]
  return null
}

function dayHeader(meet, day) {
  const name = (meet && (meet.shortName || meet.name)) || "Meet"
  const compact = day && (day.dayCompact || compactDay(day.date, day.dayShort))
  if (compact) return name + "  ·  " + compact
  return name
}

function headerLine(meet) {
  return (meet && (meet.shortName || meet.name)) || "Meet"
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

function addCol(parent, text, width, opts) {
  opts = opts || {}
  const col = parent.addStack()
  col.layoutHorizontally()
  col.centerAlignContent()
  col.size = new Size(width, 0)
  if (opts.align === "right") col.addSpacer()
  const t = col.addText(text == null ? "" : String(text))
  t.font = opts.font
  t.textColor = opts.color
  t.lineLimit = 1
  t.minimumScaleFactor = opts.scale || 0.55
  if (opts.align === "right") t.rightAlignText()
  if (opts.align === "left") col.addSpacer()
  return t
}

function columnSpec(family) {
  if (family === "medium") {
    return { event: 46, heat: 38, lane: 38, stroke: 50, best: 64, gap: 6, strokePad: 5 }
  }
  return { event: 56, heat: 46, lane: 46, stroke: 58, best: 72, gap: 8, strokePad: 6 }
}

function addHeaderRow(parent, theme, spec) {
  const row = parent.addStack()
  row.layoutHorizontally()
  row.centerAlignContent()
  row.spacing = spec.gap
  const font = Font.semiboldSystemFont(spec.headerSize || 9)
  const opts = { font: font, color: theme.teal, align: "right", scale: 0.7 }
  addCol(row, "EVENT", spec.event, opts)
  addCol(row, "HEAT", spec.heat, opts)
  addCol(row, "LANE", spec.lane, opts)
  const strokeOpts = { font: font, color: theme.teal, align: "left", scale: 0.7 }
  const stroke = row.addStack()
  stroke.layoutHorizontally()
  stroke.centerAlignContent()
  stroke.size = new Size(spec.stroke, 0)
  stroke.setPadding(0, spec.strokePad, 0, 0)
  const st = stroke.addText("STROKE")
  st.font = font
  st.textColor = theme.teal
  st.lineLimit = 1
  st.minimumScaleFactor = 0.7
  stroke.addSpacer()
  addCol(row, "BEST", spec.best, opts)
  return row
}

function addTableRow(parent, ev, theme, spec) {
  const wrap = parent.addStack()
  wrap.layoutVertically()
  wrap.topAlignContent()

  const row = wrap.addStack()
  row.layoutHorizontally()
  row.centerAlignContent()
  row.spacing = spec.gap

  const numFont = Font.boldSystemFont(spec.numSize)
  const tbaFont = Font.boldSystemFont(spec.tbaSize)
  const evNum = ev && ev.eventNumber ? String(ev.eventNumber) : "—"
  const heat = heatLaneText(ev && ev.heat)
  const lane = heatLaneText(ev && ev.lane)
  addCol(row, evNum, spec.event, { font: numFont, color: theme.ink, align: "right", scale: 0.5 })
  addCol(row, heat, spec.heat, {
    font: heat === "TBA" ? tbaFont : numFont,
    color: theme.ink,
    align: "right",
    scale: 0.5,
  })
  addCol(row, lane, spec.lane, {
    font: lane === "TBA" ? tbaFont : numFont,
    color: theme.ink,
    align: "right",
    scale: 0.5,
  })

  const stroke = row.addStack()
  stroke.layoutHorizontally()
  stroke.centerAlignContent()
  stroke.size = new Size(spec.stroke, 0)
  stroke.setPadding(0, spec.strokePad, 0, 0)
  const st = stroke.addText((ev && ev.stroke) || "")
  st.font = Font.boldSystemFont(spec.strokeSize)
  st.textColor = theme.teal
  st.lineLimit = 1
  st.minimumScaleFactor = 0.6
  stroke.addSpacer()

  const bestVal = bestText(ev)
  addCol(row, bestVal || "—", spec.best, {
    font: Font.semiboldSystemFont(spec.bestSize),
    color: bestVal ? theme.ink : theme.muted,
    align: "right",
    scale: 0.6,
  })

  if (!spec.hideName) {
    const name = wrap.addText((ev && ev.name) || "")
    name.font = Font.semiboldSystemFont(spec.nameSize)
    name.textColor = theme.soft
    name.lineLimit = 1
    name.minimumScaleFactor = 0.7
  }
  return wrap
}

function addMeetHead(parent, meet, day, theme, size) {
  const t = parent.addText(dayHeader(meet, day))
  t.font = Font.semiboldSystemFont(size)
  t.textColor = theme.teal
  t.lineLimit = 1
  t.minimumScaleFactor = 0.7
  return t
}

function addDistributedRows(widget, rows, theme, spec) {
  if (!rows.length) {
    widget.addSpacer()
    addMuted(widget, "Events not posted yet.", theme, 12)
    widget.addSpacer()
    return
  }
  for (let i = 0; i < rows.length; i++) {
    widget.addSpacer()
    addTableRow(widget, rows[i], theme, spec)
  }
  widget.addSpacer()
}

function buildDeadline(widget, data, theme, family) {
  const meet = data.meet
  addKicker(widget, (data.swimmer || "Poppy").toUpperCase(), theme, family === "large" ? 10 : 9)
  widget.addSpacer(family === "small" ? 2 : 3)
  addTitle(widget, headerLine(meet), theme, family === "large" ? 18 : family === "small" ? 15 : 16)
  widget.addSpacer(6)
  if (meet.datesLabel) addMuted(widget, meet.datesLabel, theme, 12)
  const venue = meet.venueShort || meet.venue
  if (venue && family !== "small") {
    widget.addSpacer(2)
    addMuted(widget, venue, theme, 11)
  } else if (venue && family === "small") {
    widget.addSpacer(2)
    addMuted(widget, venue, theme, 11)
  }
  widget.addSpacer(family === "large" ? 16 : 10)
  const dl = meet.deadline
  if (dl && dl.label) {
    addKicker(widget, "ENTRIES DUE", theme, 9)
    widget.addSpacer(3)
    addTitle(widget, family === "small" ? dl.label.replace(/, 20\d\d/, "") : dl.label, theme, family === "large" ? 18 : 15)
  } else {
    addMuted(widget, "Events not posted yet.", theme, 13)
  }
  const suggested = meet.suggestedEvents || []
  if (family === "large" && suggested.length) {
    widget.addSpacer(14)
    addMuted(widget, "Suggested  ·  " + suggested.join("  ·  "), theme, 12)
  }
}

function buildSmall(widget, data, now, theme, param) {
  widget.setPadding(11, 14, 10, 14)
  const meet = data.meet
  if (!meet) return buildEmpty(widget, data, theme)
  if (data.mode !== "entries") return buildDeadline(widget, data, theme, "small")

  const day = selectDay(meet, now, param)
  const ev = pickDayEvent(day, now)
  addMeetHead(widget, meet, day, theme, 11)
  widget.addSpacer(8)
  if (!ev) {
    addMuted(widget, "Events not posted yet.", theme, 12)
    return
  }

  function kv(label, value, valueFont, color) {
    const row = widget.addStack()
    row.layoutHorizontally()
    row.centerAlignContent()
    const k = row.addText(label)
    k.font = Font.semiboldSystemFont(9)
    k.textColor = theme.teal
    k.lineLimit = 1
    row.addSpacer()
    const v = row.addText(value)
    v.font = valueFont
    v.textColor = color
    v.lineLimit = 1
    v.minimumScaleFactor = 0.6
    v.rightAlignText()
    return row
  }

  const numFont = Font.boldSystemFont(22)
  const tbaFont = Font.boldSystemFont(16)
  const heat = heatLaneText(ev.heat)
  const lane = heatLaneText(ev.lane)
  kv("EVENT", ev.eventNumber ? String(ev.eventNumber) : "—", numFont, theme.ink)
  widget.addSpacer(3)
  kv("HEAT", heat, heat === "TBA" ? tbaFont : numFont, theme.ink)
  widget.addSpacer(3)
  kv("LANE", lane, lane === "TBA" ? tbaFont : numFont, theme.ink)
  widget.addSpacer(3)
  kv("STROKE", ev.stroke || "—", Font.boldSystemFont(16), theme.teal)
  widget.addSpacer(6)
  const name = widget.addText(ev.name || "")
  name.font = Font.semiboldSystemFont(13)
  name.textColor = theme.soft
  name.lineLimit = 1
  name.minimumScaleFactor = 0.7
  widget.addSpacer(4)
  const bestVal = bestText(ev)
  kv("BEST", bestVal || "—", Font.semiboldSystemFont(14), bestVal ? theme.ink : theme.muted)
}

function buildMedium(widget, data, now, theme, param) {
  widget.setPadding(10, 14, 8, 14)
  const meet = data.meet
  if (!meet) return buildEmpty(widget, data, theme)
  if (data.mode !== "entries") return buildDeadline(widget, data, theme, "medium")

  const day = selectDay(meet, now, param)
  addMeetHead(widget, meet, day, theme, 11)
  widget.addSpacer(4)
  const spec = columnSpec("medium")
  spec.headerSize = 8
  spec.numSize = 18
  spec.tbaSize = 13
  spec.strokeSize = 12
  spec.bestSize = 13
  spec.nameSize = 11
  addHeaderRow(widget, theme, spec)
  addDistributedRows(widget, rowsForMedium(day, now), theme, spec)
}

function buildLarge(widget, data, now, theme, param) {
  widget.setPadding(15, 16, 12, 16)
  const meet = data.meet
  if (!meet) return buildEmpty(widget, data, theme)
  if (data.mode !== "entries") return buildDeadline(widget, data, theme, "large")

  const day = selectDay(meet, now, param)
  addMeetHead(widget, meet, day, theme, 12)
  widget.addSpacer(6)
  const spec = columnSpec("large")
  spec.headerSize = 9
  spec.numSize = 26
  spec.tbaSize = 16
  spec.strokeSize = 15
  spec.bestSize = 15
  spec.nameSize = 14
  addHeaderRow(widget, theme, spec)
  addDistributedRows(widget, (day && day.rows) || [], theme, spec)
}

function buildLockRect(widget, data, now, theme, param) {
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
  const ev = pickFocusEvent(meet, now, param)
  if (!ev) {
    addMuted(widget, "Events not posted yet.", theme, 11)
    return
  }
  const top = widget.addStack()
  top.layoutHorizontally()
  top.centerAlignContent()
  top.spacing = 6

  function bit(label, value) {
    const k = top.addText(label)
    k.font = Font.semiboldSystemFont(9)
    k.textColor = theme.teal
    k.lineLimit = 1
    const v = top.addText(value)
    v.font = Font.boldSystemFont(13)
    v.textColor = theme.ink
    v.lineLimit = 1
    v.minimumScaleFactor = 0.6
  }
  bit("EVENT ", ev.eventNumber ? String(ev.eventNumber) : "—")
  bit("HEAT ", heatLaneText(ev.heat))
  bit("LANE ", heatLaneText(ev.lane))

  widget.addSpacer(2)
  const mid = widget.addStack()
  mid.layoutHorizontally()
  mid.centerAlignContent()
  const name = mid.addText((ev.name || "") + (ev.stroke ? "  ·  " + ev.stroke : ""))
  name.font = Font.semiboldSystemFont(12)
  name.textColor = theme.ink
  name.lineLimit = 1
  name.minimumScaleFactor = 0.6
  mid.addSpacer()
  const bestVal = bestText(ev)
  const b = mid.addText(bestVal || "—")
  b.font = Font.semiboldSystemFont(12)
  b.textColor = bestVal ? theme.ink : theme.muted
  b.rightAlignText()
}

function buildLockInline(widget, data, now, theme, param) {
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
  const ev = pickFocusEvent(meet, now, param)
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

function buildLockCircular(widget, data, now, theme, param) {
  widget.setPadding(4, 4, 4, 4)
  const meet = data.meet
  const ev = meet && data.mode === "entries" ? pickFocusEvent(meet, now, param) : null
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
  const hl = widget.addText(heatLaneText(ev.heat) + " · " + heatLaneText(ev.lane))
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
  addKicker(widget, ((data && data.swimmer) || "Poppy").toUpperCase(), theme, 9)
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

function buildWidget(data, family, now, param) {
  now = now || new Date()
  family = family || "medium"
  const widget = new ListWidget()
  const theme = themeFor(family)
  applyBackground(widget, theme)
  widget.url = (data && data.dashboardUrl) || DASHBOARD_URL
  widget.refreshAfterDate = new Date(now.getTime() + REFRESH_MINUTES * 60 * 1000)
  if (family === "small") buildSmall(widget, data, now, theme, param)
  else if (family === "medium") buildMedium(widget, data, now, theme, param)
  else if (family === "large" || family === "extraLarge") buildLarge(widget, data, now, theme, param)
  else if (family === "accessoryRectangular") buildLockRect(widget, data, now, theme, param)
  else if (family === "accessoryInline") buildLockInline(widget, data, now, theme, param)
  else if (family === "accessoryCircular") buildLockCircular(widget, data, now, theme, param)
  else buildMedium(widget, data, now, theme, param)
  return widget
}

// ---------------------------------------------------------------------------
// Load + cache + self-update
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

function scriptFileManager() {
  const path = typeof module !== "undefined" && module.filename ? String(module.filename) : ""
  try {
    const icloud = FileManager.iCloud()
    const root = icloud.documentsDirectory()
    if (path && (path.indexOf(root) === 0 || path.indexOf("Mobile Documents") !== -1)) {
      return icloud
    }
  } catch (e) {}
  return FileManager.local()
}

function extractScriptVersion(code) {
  const m = String(code || "").match(/SCRIPT_VERSION\s*=\s*["']([^"']+)["']/)
  return m ? m[1] : null
}

function looksLikePoppyScript(code) {
  if (!code || code.length < 1000) return false
  if (code.indexOf("SCRIPT_VERSION") === -1) return false
  if (code.indexOf(FEED_URL) === -1) return false
  if (code.indexOf("function buildWidget") === -1) return false
  return true
}

async function maybeSelfUpdate() {
  if (typeof module === "undefined" || !module.filename) return false
  const fm = scriptFileManager()
  const scriptPath = module.filename
  const stampPath = fm.joinPath(fm.documentsDirectory(), UPDATE_STAMP)
  const today = isoDate(new Date())
  try {
    if (fm.isFileStoredIniCloud && fm.fileExists(stampPath) && fm.isFileStoredIniCloud(stampPath)) {
      await fm.downloadFileFromiCloud(stampPath)
    }
    if (fm.fileExists(stampPath)) {
      const last = String(fm.readString(stampPath) || "").trim()
      if (last === today) return false
    }
  } catch (e) {}

  const req = new Request(SCRIPT_URL)
  req.timeoutInterval = 8
  req.headers = { "Cache-Control": "no-cache" }
  const code = await req.loadString()
  if (!looksLikePoppyScript(code)) {
    try { fm.writeString(stampPath, today) } catch (e) {}
    return false
  }
  const remoteVersion = extractScriptVersion(code)
  let updated = false
  if (remoteVersion && remoteVersion !== SCRIPT_VERSION) {
    if (fm.isFileStoredIniCloud && fm.fileExists(scriptPath) && fm.isFileStoredIniCloud(scriptPath)) {
      try { await fm.downloadFileFromiCloud(scriptPath) } catch (e) {}
    }
    fm.writeString(scriptPath, code)
    updated = true
  }
  try { fm.writeString(stampPath, today) } catch (e) {}
  return updated
}

async function main() {
  try { await maybeSelfUpdate() } catch (e) {}
  const family = (typeof config !== "undefined" && config.widgetFamily) || "medium"
  const param = (typeof args !== "undefined" && args.widgetParameter) || "auto"
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
  const widget = buildWidget(data, family || "medium", new Date(), param)
  if (typeof config !== "undefined" && config.runsInWidget) {
    Script.setWidget(widget)
  } else {
    const alert = new Alert()
    alert.title = SCRIPT_NAME
    alert.message = "Choose a size to preview. When you are ready, add a Scriptable widget on your Home Screen or Lock Screen and select this script. Use the widget Parameter to pick a day: auto, sat, sun, or day1 / day2."
    alert.addAction("Small")
    alert.addAction("Medium")
    alert.addAction("Large")
    alert.addAction("Lock Screen")
    alert.addCancelAction("Cancel")
    const i = await alert.presentAlert()
    const pick = i === 0 ? "small" : i === 1 ? "medium" : i === 2 ? "large" : i === 3 ? "accessoryRectangular" : null
    if (pick) {
      const preview = buildWidget(data, pick, new Date(), param)
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
    SCRIPT_VERSION,
    FEED_URL,
    SCRIPT_URL,
    DASHBOARD_URL,
    REFRESH_MINUTES,
    buildWidget,
    pickFocusEvent,
    pickDayEvent,
    eventsForMedium,
    rowsForMedium,
    groupEventsByDay,
    meetDays,
    selectDay,
    parseWidgetParam,
    ehlText,
    isUpcoming,
    isPastOnDay,
    bestGoalParts,
    startLabel,
    dayHeader,
    extractScriptVersion,
    looksLikePoppyScript,
    loadData,
    themeFor,
  }
}
