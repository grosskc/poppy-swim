(function (root) {
  const WEEKDAYS = {
    sun: "sun", sunday: "sun",
    mon: "mon", monday: "mon",
    tue: "tue", tues: "tue", tuesday: "tue",
    wed: "wed", wednesday: "wed",
    thu: "thu", thur: "thu", thurs: "thu", thursday: "thu",
    fri: "fri", friday: "fri",
    sat: "sat", saturday: "sat",
  };
  const WEEKDAY_FROM_UTC_DAY = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function isoDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }
  function parseISODate(iso) {
    const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    return { y: +m[1], mo: +m[2], d: +m[3] };
  }
  function weekdayName(iso) {
    const p = parseISODate(iso);
    if (!p) return "";
    const dt = new Date(Date.UTC(p.y, p.mo - 1, p.d, 12, 0, 0));
    return WEEKDAY_FROM_UTC_DAY[dt.getUTCDay()];
  }
  function compactDay(iso, dayShort) {
    const p = parseISODate(iso);
    if (!p) return dayShort || "";
    const wd = dayShort || WEEKDAY_FROM_UTC_DAY[new Date(Date.UTC(p.y, p.mo - 1, p.d, 12, 0, 0)).getUTCDay()];
    const short = wd ? wd.charAt(0).toUpperCase() + wd.slice(1) : "";
    return (short + " " + MONTH_SHORT[p.mo - 1] + " " + p.d).trim();
  }
  function isNS(ev) {
    const s = String((ev && ev.status) || "").toUpperCase();
    return s === "NS" || s === "NO SWIM";
  }
  function isPastOnDay(ev, dayRows, now) {
    if (!ev) return true;
    if (isNS(ev)) return true;
    const today = isoDate(now);
    if (ev.date && ev.date < today) return true;
    if (ev.date && ev.date > today) return false;
    if (ev.startAt) {
      const t = new Date(ev.startAt);
      if (!isNaN(t.getTime()) && t.getTime() <= now.getTime()) return true;
    }
    const rows = dayRows || [];
    const idx = rows.indexOf(ev);
    const start = idx < 0 ? 0 : idx + 1;
    for (let i = start; i < rows.length; i++) {
      const next = rows[i];
      if (!next || !next.startAt) continue;
      const t = new Date(next.startAt);
      if (!isNaN(t.getTime()) && t.getTime() <= now.getTime()) return true;
    }
    return false;
  }
  function heatLaneText(value) {
    if (value == null || value === "") return "TBA";
    return String(value);
  }
  function ehlText(ev) {
    const num = ev && ev.eventNumber ? String(ev.eventNumber) : "—";
    return num + " · " + heatLaneText(ev && ev.heat) + " · " + heatLaneText(ev && ev.lane);
  }
  function sessionFor(meet, date) {
    return ((meet && meet.sessions) || []).find((s) => s.date === date) || null;
  }
  function meetDays(meet) {
    const events = (meet && meet.events) || [];
    const groups = [];
    const index = new Map();
    for (const d of (meet && meet.days) || []) {
      if (!d || !d.date) continue;
      const g = {
        date: d.date,
        dayLabel: d.dayLabel,
        dayShort: d.dayShort,
        dayCompact: d.dayCompact || compactDay(d.date, d.dayShort),
        weekday: d.weekday || weekdayName(d.date),
        session: sessionFor(meet, d.date),
        rows: [],
      };
      index.set(d.date, g);
      groups.push(g);
    }
    for (const ev of events) {
      const key = ev.date || ev.dayLabel || "";
      if (!index.has(key)) {
        const g = {
          date: ev.date,
          dayLabel: ev.dayLabel,
          dayShort: ev.dayShort,
          dayCompact: compactDay(ev.date, ev.dayShort),
          weekday: ev.date ? weekdayName(ev.date) : "",
          session: sessionFor(meet, ev.date),
          rows: [],
        };
        index.set(key, g);
        groups.push(g);
      }
      index.get(key).rows.push(ev);
    }
    return groups.filter((g) => g.rows.length);
  }
  function parseWidgetParam(raw) {
    const s = String(raw == null ? "auto" : raw).trim().toLowerCase().replace(/\s+/g, "");
    if (!s || s === "auto" || s === "today") return { kind: "auto" };
    const dayN = s.match(/^day([1-9]\d*)$/);
    if (dayN) return { kind: "index", index: Math.max(0, parseInt(dayN[1], 10) - 1) };
    if (WEEKDAYS[s]) return { kind: "weekday", weekday: WEEKDAYS[s] };
    return { kind: "auto" };
  }
  function selectDay(meet, now, param) {
    const days = meetDays(meet);
    if (!days.length) return null;
    const parsed = parseWidgetParam(param);
    if (parsed.kind === "index") return days[Math.min(parsed.index, days.length - 1)] || days[0];
    if (parsed.kind === "weekday") {
      const found = days.find((d) => d.weekday === parsed.weekday);
      return found || days[0];
    }
    const today = isoDate(now || new Date());
    const start = meet && meet.startDate;
    const end = meet && meet.endDate;
    if (start && end && start <= today && today <= end) {
      const todayDay = days.find((d) => d.date === today);
      if (todayDay) return todayDay;
      const next = days.find((d) => d.date && d.date >= today);
      return next || days[0];
    }
    return days[0];
  }
  function remainingRows(day, now) {
    const rows = (day && day.rows) || [];
    return rows.filter((ev) => !isPastOnDay(ev, rows, now));
  }
  function rowsForMedium(day, now) {
    const rows = (day && day.rows) || [];
    if (!rows.length) return [];
    const today = isoDate(now);
    if (!day.date || day.date !== today) return rows.slice(0, 3);
    const next = remainingRows(day, now);
    if (next.length) return next.slice(0, 3);
    return rows.slice(0, 3);
  }
  function pickDayEvent(day, now) {
    if (!day || !day.rows || !day.rows.length) return null;
    const today = isoDate(now);
    if (day.date && day.date !== today) return day.rows[0];
    const next = remainingRows(day, now);
    if (next.length) return next[0];
    return day.rows[day.rows.length - 1];
  }
  function dayHeader(meet, day) {
    const name = (meet && (meet.shortName || meet.name)) || "Meet";
    const compact = day && (day.dayCompact || compactDay(day.date, day.dayShort));
    if (compact) return name + "  ·  " + compact;
    return name;
  }
  function headerLine(meet) {
    return (meet && (meet.shortName || meet.name)) || "Meet";
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function headerRow() {
    return (
      '<div class="cols labels">' +
        '<div class="col-e">Event</div>' +
        '<div class="col-h">Heat</div>' +
        '<div class="col-l">Lane</div>' +
        '<div class="col-s">Stroke</div>' +
        '<div class="col-b">Best</div>' +
      "</div>"
    );
  }
  function rowHtml(ev) {
    const heat = heatLaneText(ev && ev.heat);
    const lane = heatLaneText(ev && ev.lane);
    const best = ev && ev.best ? escapeHtml(ev.best) : "—";
    return (
      '<div class="trow">' +
        '<div class="cols">' +
          '<div class="col-e num">' + escapeHtml(ev && ev.eventNumber ? ev.eventNumber : "—") + "</div>" +
          '<div class="col-h num' + (heat === "TBA" ? " tba" : "") + '">' + escapeHtml(heat) + "</div>" +
          '<div class="col-l num' + (lane === "TBA" ? " tba" : "") + '">' + escapeHtml(lane) + "</div>" +
          '<div class="col-s stroke">' + escapeHtml((ev && ev.stroke) || "") + "</div>" +
          '<div class="col-b best' + (ev && ev.best ? "" : " empty") + '">' + best + "</div>" +
        "</div>" +
        '<div class="ename">' + escapeHtml((ev && ev.name) || "") + "</div>" +
      "</div>"
    );
  }
  function deadlineInner(data, family) {
    const meet = data.meet || {};
    const dl = meet.deadline || {};
    const venue = meet.venueShort || meet.venue || "";
    const due = dl.label || "";
    const extra =
      family === "large" && (meet.suggestedEvents || []).length
        ? '<div class="suggested muted">Suggested  ·  ' + escapeHtml(meet.suggestedEvents.join("  ·  ")) + "</div>"
        : "";
    return (
      '<div class="kicker">' + escapeHtml((data.swimmer || "Poppy").toUpperCase()) + "</div>" +
      '<div class="ttl">' + escapeHtml(headerLine(meet)) + "</div>" +
      (meet.datesLabel ? '<div class="muted when" style="margin-top:6px">' + escapeHtml(meet.datesLabel) + "</div>" : "") +
      (venue ? '<div class="muted when" style="margin-top:2px">' + escapeHtml(venue) + "</div>" : "") +
      (due
        ? '<div class="kicker due-label">ENTRIES DUE</div><div class="ttl due-time">' +
          escapeHtml(family === "small" ? due.replace(/, 20\d\d/, "") : due) +
          "</div>"
        : '<div class="muted" style="margin-top:10px">Events not posted yet.</div>') +
      extra
    );
  }
  function kvRow(label, value, extraClass) {
    return (
      '<div class="kv">' +
        '<div class="k">' + escapeHtml(label) + "</div>" +
        '<div class="v' + (extraClass ? " " + extraClass : "") + '">' + escapeHtml(value) + "</div>" +
      "</div>"
    );
  }
  function innerHtml(data, family, now, param) {
    now = now || new Date();
    const meet = data && data.meet;
    if (!meet) {
      return (
        '<div class="kicker">' + escapeHtml((data && data.swimmer || "Poppy").toUpperCase()) + "</div>" +
        '<div class="ttl" style="margin-top:6px">No upcoming meet</div>' +
        '<div class="muted" style="margin-top:4px">Tap to open the dashboard.</div>'
      );
    }
    if (data.mode !== "entries") return deadlineInner(data, family);

    const day = selectDay(meet, now, param);
    const head = '<div class="head">' + escapeHtml(dayHeader(meet, day)) + "</div>";

    if (family === "small") {
      const ev = pickDayEvent(day, now);
      if (!ev) {
        return head + '<div class="muted" style="margin-top:8px">Events not posted yet.</div>';
      }
      const heat = heatLaneText(ev.heat);
      const lane = heatLaneText(ev.lane);
      return (
        head +
        kvRow("Event", ev.eventNumber ? ev.eventNumber : "—", "num") +
        kvRow("Heat", heat, "num" + (heat === "TBA" ? " tba" : "")) +
        kvRow("Lane", lane, "num" + (lane === "TBA" ? " tba" : "")) +
        kvRow("Stroke", ev.stroke || "—", "stroke") +
        '<div class="ename">' + escapeHtml(ev.name || "") + "</div>" +
        kvRow("Best", ev.best || "—", ev.best ? "best" : "best empty")
      );
    }
    if (family === "medium") {
      const rows = rowsForMedium(day, now);
      return head + headerRow() + '<div class="trows">' + rows.map(rowHtml).join("") + "</div>";
    }
    if (family === "large" || family === "extraLarge") {
      const rows = (day && day.rows) || [];
      return head + headerRow() + '<div class="trows">' + rows.map(rowHtml).join("") + "</div>";
    }
    if (family === "accessoryRectangular" || family === "lock-rect") {
      const ev = pickDayEvent(day, now);
      if (!ev) return '<div class="muted">Events not posted yet.</div>';
      return (
        '<div class="lock-bits">' +
          '<span class="k">Event</span> <span class="v">' + escapeHtml(ev.eventNumber || "—") + "</span>" +
          '<span class="k">Heat</span> <span class="v">' + escapeHtml(heatLaneText(ev.heat)) + "</span>" +
          '<span class="k">Lane</span> <span class="v">' + escapeHtml(heatLaneText(ev.lane)) + "</span>" +
        "</div>" +
        '<div class="lock-mid">' +
          '<div class="ename">' + escapeHtml((ev.name || "") + (ev.stroke ? "  ·  " + ev.stroke : "")) + "</div>" +
          '<div class="best' + (ev.best ? "" : " empty") + '">' + escapeHtml(ev.best || "—") + "</div>" +
        "</div>"
      );
    }
    if (family === "accessoryInline" || family === "lock-inline") {
      const ev = pickDayEvent(day, now);
      let text = data.swimmer || "Poppy";
      if (ev) text += "  ·  " + ehlText(ev) + "  " + (ev.stroke || "") + "  " + (ev.name || "");
      else text += "  ·  " + headerLine(meet);
      return '<div class="txt">' + escapeHtml(text) + "</div>";
    }
    return innerHtml(data, "medium", now, param);
  }
  function faceClass(family, mode) {
    const lock = family === "accessoryRectangular" || family === "lock-rect"
      ? "lock-rect"
      : family === "accessoryInline" || family === "lock-inline"
        ? "lock-inline"
        : family === "accessoryCircular"
          ? "lock-rect"
          : family === "extraLarge"
            ? "large"
            : family;
    const hs = lock.startsWith("lock") ? "" : " hs";
    return "w " + lock + hs + (mode === "dark" ? " dark" : " light");
  }
  function renderFace(el, data, family, now, mode, param) {
    el.className = faceClass(family, mode);
    el.setAttribute("data-family", family);
    el.setAttribute("data-mode", mode || "light");
    el.innerHTML = innerHtml(data, family, now, param);
    return el;
  }
  root.PoppySwimFaces = {
    isoDate,
    selectDay,
    pickDayEvent,
    rowsForMedium,
    meetDays,
    ehlText,
    dayHeader,
    innerHtml,
    renderFace,
    faceClass,
  };
})(typeof window !== "undefined" ? window : globalThis);
