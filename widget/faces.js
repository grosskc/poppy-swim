(function (root) {
  function isoDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }
  function isNS(ev) {
    const s = String((ev && ev.status) || "").toUpperCase();
    return s === "NS" || s === "NO SWIM";
  }
  function isUpcoming(ev, now) {
    if (!ev) return false;
    const today = isoDate(now);
    if (ev.date) {
      if (ev.date > today) return true;
      if (ev.date < today) return false;
    }
    if (ev.startAt) {
      const t = new Date(ev.startAt);
      if (!isNaN(t.getTime())) return t.getTime() > now.getTime();
    }
    return false;
  }
  function pickFocusEvent(meet, now) {
    const events = (meet && meet.events) || [];
    const upcoming = events.filter((e) => isUpcoming(e, now) && !isNS(e));
    if (upcoming.length) return upcoming[0];
    const today = isoDate(now);
    const todayRows = events.filter((e) => e.date === today);
    if (todayRows.length) return todayRows[todayRows.length - 1];
    if (events.length) return events[events.length - 1];
    return null;
  }
  function sessionFor(meet, date) {
    return ((meet && meet.sessions) || []).find((s) => s.date === date) || null;
  }
  function eventsForMedium(meet, now) {
    const events = (meet && meet.events) || [];
    const today = isoDate(now);
    const ofDay = (day) => events.filter((e) => e.date === day);
    const todayRows = ofDay(today);
    if (todayRows.length) return { date: today, rows: todayRows, session: sessionFor(meet, today) };
    const future = events.filter((e) => e.date && e.date >= today);
    const pool = future.length ? future : events;
    if (!pool.length) return { date: null, rows: [], session: null };
    const day = pool[0].date;
    return { date: day, rows: ofDay(day), session: sessionFor(meet, day) };
  }
  function groupEventsByDay(meet) {
    const groups = [];
    const index = new Map();
    for (const ev of (meet && meet.events) || []) {
      const key = ev.date || ev.dayLabel || "";
      if (!index.has(key)) {
        const g = {
          date: ev.date,
          dayLabel: ev.dayLabel || ev.dayShort || "",
          session: sessionFor(meet, ev.date),
          rows: [],
        };
        index.set(key, g);
        groups.push(g);
      }
      index.get(key).rows.push(ev);
    }
    return groups;
  }
  function ehlText(ev) {
    const num = ev && ev.eventNumber ? String(ev.eventNumber) : "—";
    const heat = ev && ev.heat != null && ev.heat !== "" ? String(ev.heat) : "TBA";
    const lane = ev && ev.lane != null && ev.lane !== "" ? String(ev.lane) : "TBA";
    return num + " · " + heat + " · " + lane;
  }
  function startLabel(ev, compact) {
    if (!ev || !ev.start) return "";
    if (compact) return String(ev.start).replace(/\s*(AM|PM)$/i, "").trim();
    return ev.start;
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function timesHtml(ev) {
    if (!ev) return '<span class="empty">—</span>';
    if (ev.best && ev.goal && ev.goal.time) {
      return (
        '<span class="best">' + escapeHtml(ev.best) + "</span>" +
        '<span class="arrow">→</span>' +
        '<span class="cut">' + escapeHtml(ev.goal.label) + "</span>" +
        '<span class="goal">' + escapeHtml(ev.goal.time) + "</span>"
      );
    }
    if (ev.best) return '<span class="best">' + escapeHtml(ev.best) + "</span>";
    return '<span class="empty">—</span>';
  }
  function headerLine(meet) {
    return (meet && (meet.shortName || meet.name)) || "Meet";
  }
  function sessionBlurb(session) {
    if (!session) return "";
    const bits = [];
    if (session.warmup) bits.push("Warm-up " + session.warmup);
    if (session.start) bits.push("Start " + session.start);
    return bits.join("  ·  ");
  }
  function dayKicker(meet, ev, now) {
    if (ev && ev.dayShort) return ev.dayShort.toUpperCase();
    const today = isoDate(now);
    if (meet && meet.startDate && meet.endDate && meet.startDate <= today && today <= meet.endDate) {
      return "TODAY";
    }
    return (meet && meet.datesLabel) || "";
  }
  function rowHtml(ev) {
    return (
      '<div class="row">' +
        '<div class="ehl">' + escapeHtml(ehlText(ev)) + "</div>" +
        '<div class="stroke">' + escapeHtml(ev.stroke || "") + "</div>" +
        '<div class="evname">' + escapeHtml(ev.name || "") + "</div>" +
        '<div class="times">' + timesHtml(ev) + "</div>" +
        '<div class="when">' + escapeHtml(startLabel(ev, true)) + "</div>" +
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
    if (family === "small") {
      return (
        '<div class="kicker">' + escapeHtml((data.swimmer || "POPPY").toUpperCase()) + "</div>" +
        '<div class="ttl">' + escapeHtml(headerLine(meet)) + "</div>" +
        '<div class="muted when" style="margin-top:8px">' + escapeHtml(meet.datesLabel || "") + "</div>" +
        (venue ? '<div class="muted when" style="margin-top:2px">' + escapeHtml(venue) + "</div>" : "") +
        (due
          ? '<div class="kicker due-label">ENTRIES DUE</div><div class="ttl due-time">' +
            escapeHtml(due.replace(/, 20\d\d/, "")) +
            "</div>"
          : '<div class="muted" style="margin-top:10px">Events not posted yet.</div>')
      );
    }
    return (
      '<div class="whead"><div class="left">' +
        '<div class="kicker">' + escapeHtml((data.swimmer || "Poppy").toUpperCase()) + "</div>" +
        '<div class="ttl">' + escapeHtml(headerLine(meet)) + "</div>" +
      '</div><div class="right muted">' + escapeHtml(meet.datesLabel || "") + "</div></div>" +
      (venue ? '<div class="muted session-line">' + escapeHtml(venue) + "</div>" : "") +
      (due
        ? '<div class="kicker due-label">ENTRIES DUE</div><div class="ttl due-time">' + escapeHtml(due) + "</div>"
        : '<div class="muted" style="margin-top:10px">Events not posted yet.</div>') +
      extra
    );
  }
  function innerHtml(data, family, now) {
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

    if (family === "small") {
      const ev = pickFocusEvent(meet, now);
      if (!ev) {
        return (
          '<div class="kicker">' + escapeHtml((data.swimmer || "Poppy").toUpperCase()) + "</div>" +
          '<div class="ttl">' + escapeHtml(headerLine(meet)) + "</div>" +
          '<div class="muted" style="margin-top:8px">Events not posted yet.</div>'
        );
      }
      return (
        '<div class="kicker">' + escapeHtml((data.swimmer || "Poppy").toUpperCase() + "  ·  " + dayKicker(meet, ev, now)) + "</div>" +
        '<div class="ttl">' + escapeHtml(headerLine(meet)) + "</div>" +
        '<div class="ehl">' + escapeHtml(ehlText(ev)) + "</div>" +
        '<div class="stroke">' + escapeHtml(ev.stroke || "") + "</div>" +
        '<div class="evname">' + escapeHtml(ev.name || "") + "</div>" +
        '<div class="times">' + timesHtml(ev) + "</div>" +
        (startLabel(ev, false) ? '<div class="muted when">' + escapeHtml(startLabel(ev, false)) + "</div>" : "")
      );
    }
    if (family === "medium") {
      const day = eventsForMedium(meet, now);
      const dayLabel = (day.rows[0] && (day.rows[0].dayLabel || day.rows[0].dayShort)) || meet.datesLabel || "";
      const blurb = sessionBlurb(day.session);
      return (
        '<div class="whead"><div class="left">' +
          '<div class="kicker">' + escapeHtml((data.swimmer || "Poppy").toUpperCase()) + "</div>" +
          '<div class="ttl">' + escapeHtml(headerLine(meet)) + "</div>" +
        '</div><div class="right">' + escapeHtml(dayLabel) + "</div></div>" +
        (blurb ? '<div class="muted session-line">' + escapeHtml(blurb) + "</div>" : "") +
        '<div class="rows">' + day.rows.map(rowHtml).join("") + "</div>"
      );
    }
    if (family === "large") {
      const sub = [meet.datesLabel, meet.venueShort || meet.venue].filter(Boolean).join("  ·  ");
      const groups = groupEventsByDay(meet)
        .map((g) => {
          const blurb = sessionBlurb(g.session);
          return (
            '<div class="group"><div class="dayband">' +
              '<div class="day">' + escapeHtml((g.dayLabel || "").toUpperCase()) + "</div>" +
              (blurb ? '<div class="blurb">' + escapeHtml(blurb) + "</div>" : "") +
            '</div><div class="rows">' + g.rows.map(rowHtml).join("") + "</div></div>"
          );
        })
        .join("");
      return (
        '<div class="kicker">' + escapeHtml((data.swimmer || "Poppy").toUpperCase()) + "</div>" +
        '<div class="ttl">' + escapeHtml(headerLine(meet)) + "</div>" +
        (sub ? '<div class="muted sub">' + escapeHtml(sub) + "</div>" : "") +
        '<div class="groups">' + groups + "</div>"
      );
    }
    if (family === "accessoryRectangular" || family === "lock-rect") {
      const ev = pickFocusEvent(meet, now);
      if (!ev) return '<div class="muted">Events not posted yet.</div>';
      return (
        '<div class="top"><div class="ehl">' + escapeHtml(ehlText(ev)) + '</div>' +
        '<div class="stroke">' + escapeHtml(ev.stroke || "") + "</div>" +
        (startLabel(ev, false) ? '<div class="muted when">' + escapeHtml(startLabel(ev, false)) + "</div>" : "") +
        '</div><div class="mid evname">' + escapeHtml(ev.name || "") + "</div>" +
        '<div class="times">' + timesHtml(ev) + "</div>"
      );
    }
    if (family === "accessoryInline" || family === "lock-inline") {
      const ev = pickFocusEvent(meet, now);
      let text = data.swimmer || "Poppy";
      if (ev) text += "  ·  " + ehlText(ev) + "  " + (ev.stroke || "") + "  " + (ev.name || "");
      else text += "  ·  " + headerLine(meet);
      return '<div class="txt">' + escapeHtml(text) + "</div>";
    }
    return innerHtml(data, "medium", now);
  }
  function faceClass(family, mode) {
    const lock = family === "accessoryRectangular" || family === "lock-rect"
      ? "lock-rect"
      : family === "accessoryInline" || family === "lock-inline"
        ? "lock-inline"
        : family === "accessoryCircular"
          ? "lock-rect"
          : family;
    const hs = lock.startsWith("lock") ? "" : " hs";
    return "w " + lock + hs + (mode === "dark" ? " dark" : " light");
  }
  function renderFace(el, data, family, now, mode) {
    el.className = faceClass(family, mode);
    el.setAttribute("data-family", family);
    el.setAttribute("data-mode", mode || "light");
    el.innerHTML = innerHtml(data, family, now);
    return el;
  }
  root.PoppySwimFaces = {
    isoDate,
    pickFocusEvent,
    eventsForMedium,
    groupEventsByDay,
    ehlText,
    startLabel,
    innerHtml,
    renderFace,
    faceClass,
  };
})(typeof window !== "undefined" ? window : globalThis);
