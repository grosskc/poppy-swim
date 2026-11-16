#!/usr/bin/env python3
"""Generate widget.json from data.json for the Poppy Swim iOS widget.

Source of truth is data.json (same snapshot as the dashboard). After editing
data.json, run this script so GitHub Pages serves a matching widget.json:

    python3 scripts/build_widget.py

The widget (widget/PoppySwim.js) fetches
https://grosskc.github.io/poppy-swim/widget.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, time
from pathlib import Path
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")
ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data.json"
OUT_PATH = ROOT / "widget.json"
DASHBOARD_URL = "https://grosskc.github.io/poppy-swim/#meets"
STD_ORDER = ["B", "BB", "A", "AA", "AAA", "AAAA"]

# Prefer a short, family-readable name on a widget. Generic shortening is used
# when a meet is not in this map.
SHORT_NAMES = {
    "cmu9z1nch03wgt4n37fe1r57i": "Mason Invite",
    "cmw57c22t01b015obb85d0rko": "Little Elves",
    "cmw56w7ib012a13mupz44lma8": "Houk Classic",
}


def to_sec(t):
    if t is None or t == "":
        return float("inf")
    parts = str(t).split(":")
    try:
        if len(parts) == 1:
            return float(parts[0])
        if len(parts) == 2:
            return int(parts[0]) * 60 + float(parts[1])
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
    except ValueError:
        return float("inf")


def course_key(course):
    return "lcm" if course == "LCM" else "scy"


def stroke_abbr(row):
    s = f"{row.get('stroke') or ''} {row.get('name') or ''}"
    if re.search(r"medley\s+relay", s, re.I):
        return "MR"
    if re.search(r"free\s+relay", s, re.I):
        return "FR-R"
    if re.search(r"\bIM\b", s, re.I):
        return "IM"
    if re.search(r"back", s, re.I):
        return "BK"
    if re.search(r"breast", s, re.I):
        return "BR"
    if re.search(r"fly", s, re.I):
        return "FL"
    if re.search(r"free", s, re.I):
        return "FR"
    raw = str(row.get("stroke") or "").strip()
    return (raw or "—")[:4].upper()


def is_relay(row):
    if not row:
        return False
    if row.get("relay"):
        return True
    return bool(re.search(r"relay", f"{row.get('stroke') or ''} {row.get('name') or ''}", re.I))


def entry_event_name(row):
    name = row.get("name") or ""
    team = str(row.get("team") or "")
    if team.startswith("A"):
        name = name + " A"
    return name


def best_before_meet(data, event, course, before_date):
    if not event or not before_date:
        return None
    rows = []
    seen = set()

    def add(swim):
        if not swim or swim.get("event") != event:
            return
        if (swim.get("course") or "SCY") != course:
            return
        if not swim.get("time") or not swim.get("date") or swim["date"] >= before_date:
            return
        status = str(swim.get("status") or "").upper()
        if status in {"NS", "DQ", "SCR", "DFS"} or swim.get("relay") or swim.get("ns"):
            return
        key = "|".join([swim.get("event") or "", swim.get("course") or "SCY", swim["date"], swim["time"]])
        if key in seen:
            return
        seen.add(key)
        rows.append(swim)

    for swim in data.get("officialTimes") or []:
        add(swim)
    for swim in data.get("swimHistory") or []:
        add(swim)
    for swim in data.get("provisionalTimes") or []:
        add(swim)
    if not rows:
        return None
    return min(rows, key=lambda s: to_sec(s["time"]))


def standard_for(data, course, event, time_str):
    cuts = (data.get("standards") or {}).get(course_key(course), {}).get(event)
    if not cuts:
        return {"std": None, "next": None, "cuts": None}
    t = to_sec(time_str)
    achieved = None
    for label in STD_ORDER:
        cut = cuts.get(label)
        if cut and t <= to_sec(cut):
            achieved = label
    if achieved is None:
        return {"std": None, "next": "B", "cuts": cuts}
    if achieved == "AAAA":
        return {"std": "AAAA", "next": None, "cuts": cuts}
    return {"std": achieved, "next": STD_ORDER[STD_ORDER.index(achieved) + 1], "cuts": cuts}


def goal_for_entry(data, row, meet):
    if not row or is_relay(row):
        return None
    course = meet.get("course") or "SCY"
    before = meet.get("startDate") or ""
    best = best_before_meet(data, row.get("name"), course, before)
    if not best or not best.get("time"):
        return None
    info = standard_for(data, course, row.get("name"), best["time"])
    if not info["next"]:
        return {"label": "PB", "time": best["time"]}
    cuts = info["cuts"]
    if not cuts or not cuts.get(info["next"]):
        return None
    return {"label": info["next"], "time": cuts[info["next"]]}


def short_name(meet):
    mid = meet.get("id")
    if mid in SHORT_NAMES:
        return SHORT_NAMES[mid]
    name = meet.get("name") or "Meet"
    name = re.sub(r"^City of\s+", "", name)
    name = re.sub(r"\s+Invitational$", " Invite", name)
    name = re.sub(r"\s+Championships$", " Champs", name)
    name = re.sub(r"\s+Classic$", " Classic", name)
    return name


def short_venue(name):
    if not name:
        return None
    s = name.split(",")[0].strip()
    s = s.replace("Municipal ", "")
    return s


def day_labels(iso):
    d = datetime.strptime(iso, "%Y-%m-%d")
    return d.strftime("%A, %b %-d"), d.strftime("%a")


def day_compact(iso):
    d = datetime.strptime(iso, "%Y-%m-%d")
    return d.strftime("%a %b %-d")


def days_payload(events):
    """Ordered unique meet days. Backwards compatible extra field; events stay flat."""
    days = []
    seen = set()
    for ev in events or []:
        date = ev.get("date")
        if not date or date in seen:
            continue
        seen.add(date)
        label, short = day_labels(date)
        days.append({
            "date": date,
            "dayLabel": ev.get("dayLabel") or label,
            "dayShort": ev.get("dayShort") or short,
            "dayCompact": day_compact(date),
            "weekday": datetime.strptime(date, "%Y-%m-%d").strftime("%a").lower(),
        })
    return days


def parse_clock(label):
    """Parse a time like '3:16 PM' or '12:30 PM' into a time object. None if TBA."""
    if not label:
        return None
    text = str(label).strip()
    m = re.search(r"(\d{1,2}):(\d{2})\s*(AM|PM)\b", text, re.I)
    if not m:
        return None
    hour = int(m.group(1))
    minute = int(m.group(2))
    ampm = m.group(3).upper()
    if ampm == "PM" and hour != 12:
        hour += 12
    if ampm == "AM" and hour == 12:
        hour = 0
    return time(hour, minute)


def start_at_iso(date_iso, start_label):
    clock = parse_clock(start_label)
    if not clock:
        return None
    dt = datetime.strptime(date_iso, "%Y-%m-%d").replace(
        hour=clock.hour, minute=clock.minute, second=0, tzinfo=ET
    )
    return dt.isoformat()


def has_entries(meet):
    return bool(meet.get("entries"))


def is_eligible(meet):
    elig = meet.get("eligibility") or {}
    if "eligible" not in elig:
        return True
    return bool(elig.get("eligible"))


def select_meet(meets, today):
    """Pick the current or next meet.

    1. A meet in progress today (startDate <= today <= endDate). Prefer one
       that already has entries if more than one overlaps.
    2. Else the nearest future meet that has entries.
    3. Else the next upcoming meet (prefer eligible), shown with its deadline.
    """
    in_progress = [
        m for m in meets
        if m.get("startDate") and m.get("endDate") and m["startDate"] <= today <= m["endDate"]
    ]
    if in_progress:
        in_progress.sort(key=lambda m: (0 if has_entries(m) else 1, m["startDate"], m.get("name") or ""))
        return in_progress[0], "in_progress"

    future_with_entries = [
        m for m in meets
        if m.get("startDate") and m["startDate"] > today and has_entries(m)
    ]
    if future_with_entries:
        future_with_entries.sort(key=lambda m: (m["startDate"], m.get("name") or ""))
        return future_with_entries[0], "upcoming"

    upcoming = [
        m for m in meets
        if m.get("endDate") and m["endDate"] >= today
    ]
    if not upcoming:
        return None, "none"
    upcoming.sort(
        key=lambda m: (
            0 if is_eligible(m) else 1,
            m.get("startDate") or m["endDate"],
            m.get("name") or "",
        )
    )
    return upcoming[0], "upcoming"


def session_payload(session, fallback_date=None):
    date = session.get("date") or fallback_date
    if not date:
        return None
    day_label, day_short = day_labels(date)
    return {
        "date": date,
        "dayLabel": day_label,
        "dayShort": day_short,
        "label": session.get("label"),
        "warmup": session.get("warmup"),
        "start": session.get("start"),
        "deckOpens": session.get("deckOpens"),
    }


def event_payload(data, meet, row):
    date = row.get("date") or meet.get("startDate")
    day_label = row.get("dayLabel")
    day_short = None
    if date:
        computed_label, day_short = day_labels(date)
        day_label = day_label or computed_label
    course = meet.get("course") or "SCY"
    best_row = None
    if not is_relay(row):
        best_row = best_before_meet(data, row.get("name"), course, meet.get("startDate") or "")
    best_time = (best_row or {}).get("time") or row.get("seed")
    start = row.get("estStart")
    status = row.get("status")
    if row.get("ns") and not status:
        status = "NS"
    return {
        "date": date,
        "dayLabel": day_label,
        "dayShort": day_short,
        "session": row.get("session"),
        "eventNumber": "" if row.get("eventNumber") is None else str(row.get("eventNumber")),
        "heat": row.get("heat"),
        "lane": row.get("lane"),
        "stroke": stroke_abbr(row),
        "name": entry_event_name(row),
        "relay": is_relay(row),
        "seed": row.get("seed"),
        "best": best_time,
        "goal": goal_for_entry(data, row, meet),
        "start": start,
        "startAt": start_at_iso(date, start) if date else None,
        "status": status or None,
    }


def deadline_payload(meet):
    entry = meet.get("entry") or {}
    if not entry.get("deadline") and not entry.get("deadlineLabel"):
        return None
    return {
        "date": (entry.get("deadline") or "")[:10] or None,
        "label": entry.get("deadlineLabel"),
        "kind": entry.get("deadlineKind"),
        "open": entry.get("open"),
        "hostDeadlineLabel": entry.get("hostDeadlineLabel"),
    }


def venue_name(meet):
    venue = meet.get("venue") or {}
    if isinstance(venue, str):
        return venue, venue, None, None
    name = venue.get("name")
    return name, short_venue(name), venue.get("address"), venue.get("mapsUrl")


def build_meet(data, meet, today, status):
    venue, venue_short, address, maps_url = venue_name(meet)
    sessions = []
    seen_dates = set()
    for session in meet.get("sessions") or []:
        payload = session_payload(session)
        if payload:
            sessions.append(payload)
            seen_dates.add(payload["date"])
    # If a session exists only as fields on an entry row, don't invent times;
    # the event list already carries day / warm-up / start when present.
    events = [event_payload(data, meet, row) for row in (meet.get("entries") or [])]
    mode = "entries" if events else "deadline"
    poppy = meet.get("poppy") or {}
    suggested = poppy.get("suggestedEvents") or []
    payload = {
        "id": meet.get("id"),
        "name": meet.get("name"),
        "shortName": short_name(meet),
        "datesLabel": meet.get("datesLabel"),
        "startDate": meet.get("startDate"),
        "endDate": meet.get("endDate"),
        "status": status,
        "venue": venue,
        "venueShort": venue_short,
        "address": address,
        "mapsUrl": maps_url,
        "sessions": sessions,
        "deadline": deadline_payload(meet),
        "days": days_payload(events),
        "events": events,
    }
    if mode == "deadline" and suggested:
        payload["suggestedEvents"] = list(suggested)
    return payload, mode


def build(data, now=None):
    now = now or datetime.now(ET)
    today = now.date().isoformat()
    meets = data.get("meets") or []
    meet, status = select_meet(meets, today)
    meta = data.get("meta") or {}
    generated_at = now.isoformat(timespec="seconds")
    if meet is None:
        return {
            "version": 1,
            "generatedAt": generated_at,
            "asOfDate": today,
            "dashboardUrl": DASHBOARD_URL,
            "swimmer": (meta.get("swimmer") or "Poppy").split()[0],
            "swimmerFull": meta.get("swimmer") or "Poppy",
            "club": meta.get("club"),
            "mode": "empty",
            "meet": None,
        }
    meet_payload, mode = build_meet(data, meet, today, status)
    return {
        "version": 1,
        "generatedAt": generated_at,
        "asOfDate": today,
        "dashboardUrl": DASHBOARD_URL,
        "swimmer": (meta.get("swimmer") or "Poppy").split()[0],
        "swimmerFull": meta.get("swimmer") or "Poppy",
        "club": meta.get("club"),
        "mode": mode,
        "meet": meet_payload,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description="Generate widget.json from data.json")
    parser.add_argument("--data", type=Path, default=DATA_PATH, help="Path to data.json")
    parser.add_argument("--out", type=Path, default=OUT_PATH, help="Path to write widget.json")
    parser.add_argument(
        "--date",
        help="Override 'today' as YYYY-MM-DD (America/New_York). For testing selection only.",
    )
    args = parser.parse_args(argv)
    data = json.loads(args.data.read_text())
    now = datetime.now(ET)
    if args.date:
        now = datetime.strptime(args.date, "%Y-%m-%d").replace(
            hour=now.hour, minute=now.minute, second=now.second, tzinfo=ET
        )
    payload = build(data, now=now)
    args.out.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    meet = payload.get("meet") or {}
    n = len(meet.get("events") or [])
    print(
        f"Wrote {args.out.relative_to(ROOT) if args.out.is_relative_to(ROOT) else args.out}: "
        f"mode={payload['mode']} status={(meet.get('status') or 'none')} "
        f"meet={meet.get('shortName') or '—'} events={n} asOf={payload['asOfDate']}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
