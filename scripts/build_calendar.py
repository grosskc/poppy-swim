#!/usr/bin/env python3
"""Generate practices.ics from data.json for the Poppy Swim practice calendar.

Source of truth is data.json (the practices section). After editing that
section, run this script so GitHub Pages serves a matching feed:

    python3 scripts/build_calendar.py

The hosted subscribe URL is

    webcal://grosskc.github.io/poppy-swim/practices.ics

and the HTTPS copy is

    https://grosskc.github.io/poppy-swim/practices.ics

Do not hand-edit practices.ics. Meets are not included in this feed: most
upcoming meets still lack session times or a firm entry, so mixing them with
the weekly practice series would clutter the calendar.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

try:
    from icalendar import Calendar, Event, Timezone, TimezoneDaylight, TimezoneStandard, vRecur
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "scripts/build_calendar.py needs the icalendar package. Install it with: pip install icalendar"
    ) from exc

ET = ZoneInfo("America/New_York")
UTC = timezone.utc
ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data.json"
OUT_PATH = ROOT / "practices.ics"
CAL_URL = "https://grosskc.github.io/poppy-swim/practices.ics"
UID_HOST = "poppy-swim.grosskc.github.io"

WEEKDAYS = {
    "monday": 0,
    "mon": 0,
    "tuesday": 1,
    "tue": 1,
    "tues": 1,
    "wednesday": 2,
    "wed": 2,
    "thursday": 3,
    "thu": 3,
    "thur": 3,
    "thurs": 3,
    "friday": 4,
    "fri": 4,
    "saturday": 5,
    "sat": 5,
    "sunday": 6,
    "sun": 6,
}
WEEKDAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def load_data(path: Path) -> dict:
    return json.loads(path.read_text())


def parse_time(value: str):
    text = str(value).strip().upper().replace(" ", "")
    meridian = None
    if text.endswith("AM") or text.endswith("PM"):
        meridian = text[-2:]
        text = text[:-2]
    parts = text.split(":")
    hour = int(parts[0])
    minute = int(parts[1]) if len(parts) > 1 else 0
    if meridian == "PM" and hour != 12:
        hour += 12
    if meridian == "AM" and hour == 12:
        hour = 0
    return hour, minute


def parse_iso_date(value: str) -> date:
    y, m, d = str(value).split("-")
    return date(int(y), int(m), int(d))


def weekday_index(value) -> int:
    if isinstance(value, int):
        return value
    key = str(value).strip().lower()
    if key not in WEEKDAYS:
        raise ValueError(f"Unknown weekday: {value!r}")
    return WEEKDAYS[key]


def first_on_or_after(start: date, weekday: int) -> date:
    delta = (weekday - start.weekday()) % 7
    return start + timedelta(days=delta)


def location_for(practices: dict, key: str | None) -> dict:
    locations = practices.get("locations") or {}
    if key and key in locations:
        return locations[key]
    return {"name": key or "", "shortName": key or "", "address": None}


def location_line(loc: dict) -> str:
    name = loc.get("name") or loc.get("shortName") or ""
    address = loc.get("address")
    if name and address:
        return f"{name}, {address}"
    return address or name


def short_name(loc: dict, fallback: str | None = None) -> str:
    return loc.get("shortName") or loc.get("name") or fallback or ""


def event_title(group: str, loc: dict, fallback: str | None = None) -> str:
    place = short_name(loc, fallback)
    label = f"Swim practice ({group})"
    return f"{label} · {place}" if place else label


def america_new_york_timezone() -> Timezone:
    tz = Timezone()
    tz.add("tzid", "America/New_York")
    tz.add("x-lic-location", "America/New_York")

    daylight = TimezoneDaylight()
    daylight.add("tzname", "EDT")
    daylight.add("tzoffsetfrom", timedelta(hours=-5))
    daylight.add("tzoffsetto", timedelta(hours=-4))
    daylight.add("dtstart", datetime(1970, 3, 8, 2, 0, 0))
    daylight.add("rrule", vRecur({"FREQ": ["YEARLY"], "BYMONTH": [3], "BYDAY": ["2SU"]}))
    tz.add_component(daylight)

    standard = TimezoneStandard()
    standard.add("tzname", "EST")
    standard.add("tzoffsetfrom", timedelta(hours=-4))
    standard.add("tzoffsetto", timedelta(hours=-5))
    standard.add("dtstart", datetime(1970, 11, 1, 2, 0, 0))
    standard.add("rrule", vRecur({"FREQ": ["YEARLY"], "BYMONTH": [11], "BYDAY": ["1SU"]}))
    tz.add_component(standard)
    return tz


def local_dt(day: date, hhmm: str) -> datetime:
    hour, minute = parse_time(hhmm)
    return datetime(day.year, day.month, day.day, hour, minute, 0, tzinfo=ET)


def add_local(component, name: str, instant: datetime) -> None:
    """Add a wall-clock datetime with TZID=America/New_York (not UTC)."""
    component.add(name, instant)
    component[name].params["TZID"] = "America/New_York"
    # icalendar may also emit a UTC form when tzinfo is present; force the
    # local naive value so iOS keeps 5:20 pm across DST changes.
    component[name].dt = instant.replace(tzinfo=None)
    component[name].params["TZID"] = "America/New_York"


def slot_key(weekday: int, start: str) -> tuple[int, tuple[int, int]]:
    return weekday, parse_time(start)


def changes_for_slot(changes: list, weekday: int, start: str) -> list[dict]:
    want = parse_time(start)
    matched = []
    for change in changes:
        if not change.get("date"):
            continue
        day = parse_iso_date(change["date"])
        if change.get("weekday") is not None:
            if weekday_index(change["weekday"]) != weekday:
                continue
        elif day.weekday() != weekday:
            continue
        if change.get("start") and parse_time(change["start"]) != want:
            continue
        matched.append(change)
    return matched



def replacement_times(change: dict, slot: dict) -> tuple[str, str]:
    """New wall-clock times for a one-off change.

    `start` / `end` on a change identify the weekly slot being replaced
    (and are used for EXDATE). The one-off uses `newStart` / `newEnd` when
    present, otherwise it keeps the slot's usual times.
    """
    start = change.get("newStart") or change.get("new_start") or slot["start"]
    end = change.get("newEnd") or change.get("new_end") or slot["end"]
    return start, end


def uid_for(group: str, weekday: int, suffix: str | None = None) -> str:
    slug = (group or "blue").strip().lower().replace(" ", "-")
    base = f"practice-{slug}-{WEEKDAY_NAMES[weekday]}"
    if suffix:
        base = f"{base}-{suffix}"
    return f"{base}@{UID_HOST}"


def make_weekly_event(
    practices: dict,
    slot: dict,
    series_start: date,
    generated_at: datetime,
) -> Event | None:
    group = practices.get("group") or "Blue"
    weekday = weekday_index(slot["weekday"])
    first = first_on_or_after(series_start, weekday)
    loc = location_for(practices, slot.get("location"))
    event = Event()
    event.add("uid", uid_for(group, weekday))
    event.add("dtstamp", generated_at)
    add_local(event, "dtstart", local_dt(first, slot["start"]))
    add_local(event, "dtend", local_dt(first, slot["end"]))
    event.add("rrule", vRecur({"FREQ": ["WEEKLY"]}))
    event.add("summary", event_title(group, loc, slot.get("location")))
    line = location_line(loc)
    if line:
        event.add("location", line)
    description_bits = [
        f"{group} Group practice" + (f", ages {practices['ages']}" if practices.get("ages") else "") + ".",
        "Dayton Raiders.",
    ]
    if loc.get("name") and loc.get("address"):
        description_bits.append(location_line(loc) + ".")
    event.add("description", " ".join(description_bits))
    event.add("url", CAL_URL)
    event.add("transp", "OPAQUE")
    event.add("status", "CONFIRMED")
    event.add("class", "PUBLIC")
    event.add("sequence", 0)
    event.add("categories", "Practice")

    in_range_cancels = []
    for change in changes_for_slot(practices.get("changes") or [], weekday, slot["start"]):
        if (change.get("type") or "cancellation").lower() not in {"cancellation", "canceled", "cancelled"}:
            continue
        day = parse_iso_date(change["date"])
        if day >= first:
            in_range_cancels.append(local_dt(day, slot["start"]))
    for instant in in_range_cancels:
        add_local(event, "exdate", instant)
    return event


def make_one_off_event(
    practices: dict,
    slot: dict,
    change: dict,
    generated_at: datetime,
) -> Event:
    group = practices.get("group") or "Blue"
    weekday = weekday_index(slot["weekday"])
    day = parse_iso_date(change["date"])
    loc_key = change.get("newLocation") or change.get("location") or slot.get("location")
    loc = location_for(practices, loc_key)
    start, end = replacement_times(change, slot)
    event = Event()
    event.add("uid", uid_for(group, weekday, day.strftime("%Y%m%d")))
    event.add("dtstamp", generated_at)
    add_local(event, "dtstart", local_dt(day, start))
    add_local(event, "dtend", local_dt(day, end))
    event.add("summary", event_title(group, loc, loc_key))
    line = location_line(loc)
    if line:
        event.add("location", line)
    note = change.get("note")
    desc = f"{group} Group practice (schedule change)."
    if note:
        desc += " " + note.rstrip(".") + "."
    event.add("description", desc)
    event.add("url", CAL_URL)
    event.add("transp", "OPAQUE")
    event.add("status", "CONFIRMED")
    event.add("class", "PUBLIC")
    event.add("sequence", 0)
    event.add("categories", "Practice")
    return event


def matching_slot(weekly: list, change: dict) -> dict | None:
    day = parse_iso_date(change["date"])
    weekday = weekday_index(change["weekday"]) if change.get("weekday") is not None else day.weekday()
    for slot in weekly:
        if weekday_index(slot["weekday"]) != weekday:
            continue
        if change.get("start") and parse_time(change["start"]) != parse_time(slot["start"]):
            continue
        return slot
    return None


def build_calendar(data: dict, generated_at: datetime | None = None) -> Calendar:
    practices = data.get("practices")
    if not practices or not practices.get("weekly"):
        raise SystemExit("data.json is missing practices.weekly")

    generated_at = (generated_at or datetime.now(UTC)).astimezone(UTC).replace(microsecond=0)
    series_start = parse_iso_date(practices.get("seriesStart") or "2026-11-16")
    cal_name = practices.get("calendarName") or "Poppy Swim Practice"
    group = practices.get("group") or "Blue"

    cal = Calendar()
    cal.add("prodid", "-//Poppy Swim//Practice Calendar//EN")
    cal.add("version", "2.0")
    cal.add("calscale", "GREGORIAN")
    cal.add("method", "PUBLISH")
    cal.add("name", cal_name)
    cal.add("x-wr-calname", cal_name)
    cal.add(
        "x-wr-caldesc",
        f"Poppy Gawelek-Gross, Dayton Raiders {group} Group practice schedule.",
    )
    cal.add("x-wr-timezone", "America/New_York")
    cal.add("url", CAL_URL)
    cal.add("refresh-interval", timedelta(hours=12), parameters={"VALUE": "DURATION"})
    cal.add("x-published-ttl", "PT12H")
    cal.add_component(america_new_york_timezone())

    weekly = practices["weekly"]
    for slot in weekly:
        event = make_weekly_event(practices, slot, series_start, generated_at)
        if event is not None:
            cal.add_component(event)

    # One-off replacements (time or location changes) sit alongside the
    # weekly series. The original occurrence is excluded above when the
    # change is a cancellation; for a "change", also exclude the regular slot.
    for change in practices.get("changes") or []:
        kind = (change.get("type") or "").lower()
        if kind not in {"change", "replacement", "one-off", "oneoff"}:
            continue
        slot = matching_slot(weekly, change)
        if not slot:
            continue
        day = parse_iso_date(change["date"])
        first = first_on_or_after(series_start, weekday_index(slot["weekday"]))
        if day < first:
            continue
        # Attach an EXDATE to the weekly event we already added.
        uid = uid_for(practices.get("group") or "Blue", weekday_index(slot["weekday"]))
        for component in cal.walk("VEVENT"):
            if str(component.get("uid")) == uid:
                add_local(component, "exdate", local_dt(day, slot["start"]))
                break
        cal.add_component(make_one_off_event(practices, slot, change, generated_at))

    return cal


def ics_bytes(cal: Calendar) -> bytes:
    payload = cal.to_ical()
    # to_ical already uses CRLF; make sure the file ends with a CRLF line.
    if not payload.endswith(b"\r\n"):
        payload += b"\r\n"
    return payload


def expand_events(cal: Calendar, start: date, end: date) -> list[dict]:
    """Expand weekly practices (with EXDATE) between start and end inclusive."""
    occurrences = []
    window_start = datetime(start.year, start.month, start.day, 0, 0, 0, tzinfo=ET)
    window_end = datetime(end.year, end.month, end.day, 23, 59, 59, tzinfo=ET)
    for component in cal.walk("VEVENT"):
        dtstart = component.decoded("dtstart")
        dtend = component.decoded("dtend")
        if isinstance(dtstart, datetime) and dtstart.tzinfo is None:
            dtstart = dtstart.replace(tzinfo=ET)
        if isinstance(dtend, datetime) and dtend.tzinfo is None:
            dtend = dtend.replace(tzinfo=ET)
        duration = dtend - dtstart
        summary = str(component.get("summary"))
        location = str(component.get("location") or "")
        exdates = set()
        exdate_field = component.get("exdate")
        if exdate_field:
            raw = exdate_field if isinstance(exdate_field, list) else [exdate_field]
            for item in raw:
                dts = item.dts if hasattr(item, "dts") else [item]
                for stamp in dts:
                    value = stamp.dt if hasattr(stamp, "dt") else stamp
                    if isinstance(value, datetime) and value.tzinfo is None:
                        value = value.replace(tzinfo=ET)
                    exdates.add(value)

        rrule = component.get("rrule")
        starts = []
        if rrule:
            day = dtstart
            # All practice rules are FREQ=WEEKLY with no end.
            while day.date() <= end:
                starts.append(day)
                day = day + timedelta(days=7)
        else:
            starts.append(dtstart)

        for instant in starts:
            if instant in exdates:
                continue
            if instant < window_start or instant > window_end:
                continue
            occurrences.append(
                {
                    "start": instant,
                    "end": instant + duration,
                    "summary": summary,
                    "location": location,
                }
            )
    occurrences.sort(key=lambda row: row["start"])
    return occurrences


def expected_from_data(data: dict, start: date, end: date) -> list[dict]:
    practices = data["practices"]
    series_start = parse_iso_date(practices.get("seriesStart") or "2026-11-16")
    expected = []
    day = start
    while day <= end:
        for slot in practices["weekly"]:
            if day.weekday() != weekday_index(slot["weekday"]):
                continue
            first = first_on_or_after(series_start, day.weekday())
            if day < first:
                continue
            skip = False
            replacement = None
            for change in changes_for_slot(practices.get("changes") or [], day.weekday(), slot["start"]):
                if parse_iso_date(change["date"]) != day:
                    continue
                kind = (change.get("type") or "cancellation").lower()
                if kind in {"cancellation", "canceled", "cancelled"}:
                    skip = True
                elif kind in {"change", "replacement", "one-off", "oneoff"}:
                    replacement = change
            if skip:
                continue
            if replacement:
                loc = location_for(
                    practices,
                    replacement.get("newLocation") or replacement.get("location") or slot.get("location"),
                )
                st, en = replacement_times(replacement, slot)
            else:
                loc = location_for(practices, slot.get("location"))
                st, en = slot["start"], slot["end"]
            expected.append(
                {
                    "start": local_dt(day, st),
                    "end": local_dt(day, en),
                    "summary": event_title(practices.get("group") or "Blue", loc, slot.get("location")),
                    "location": location_line(loc),
                }
            )
        day += timedelta(days=1)
    return expected


def fmt_when(instant: datetime) -> str:
    local = instant.astimezone(ET)
    return local.strftime("%a %b %-d %-I:%M %p").replace(" 0", " ")


def validate(cal: Calendar, data: dict, weeks: int = 2) -> int:
    text = cal.to_ical().decode("utf-8")
    problems = []
    required = [
        "BEGIN:VCALENDAR",
        "BEGIN:VTIMEZONE",
        "TZID:America/New_York",
        "X-WR-CALNAME:Poppy Swim Practice",
        "X-PUBLISHED-TTL:PT12H",
        "RRULE:FREQ=WEEKLY",
    ]
    for token in required:
        if token not in text:
            problems.append(f"missing {token}")
    if "REFRESH-INTERVAL" not in text or "PT12H" not in text:
        problems.append("missing REFRESH-INTERVAL PT12H")
    if "BEGIN:VALARM" in text:
        problems.append("unexpected VALARM (subscribers set their own alerts)")

    # Confirm TZID is used on DTSTART rather than UTC Z timestamps.
    for component in cal.walk("VEVENT"):
        dtstart = component.get("dtstart")
        tzid = dtstart.params.get("TZID") if dtstart is not None else None
        if tzid != "America/New_York":
            problems.append(f"DTSTART missing TZID America/New_York: {dtstart}")
        if "VALARM" in component:
            problems.append("VEVENT contains VALARM")

    today = datetime.now(ET).date()
    # Prefer a stable window around the published series start when it is
    # still current, so the check is deterministic in this snapshot.
    series_start = parse_iso_date(data["practices"].get("seriesStart") or "2026-11-16")
    window_start = max(today, series_start) if today > date(2020, 1, 1) else series_start
    # For this feed the published start is Nov 16, 2026; use that when
    # validating "the next 2 weeks" as of publish time.
    if today <= date(2026, 11, 16):
        window_start = series_start
    window_end = window_start + timedelta(days=weeks * 7 - 1)

    got = expand_events(cal, window_start, window_end)
    expected = expected_from_data(data, window_start, window_end)
    print(f"Expanded events {window_start.isoformat()} through {window_end.isoformat()}:")
    if not got:
        problems.append("expansion produced no events")
    for row in got:
        loc = short_name({"name": row["location"]}, "")
        # Prefer the short place from the summary after the dot.
        print(f"  {fmt_when(row['start'])}–{row['end'].astimezone(ET).strftime('%-I:%M %p').lstrip()}  {row['summary']}")

    def sig(row):
        return (
            row["start"].astimezone(ET).replace(tzinfo=None),
            row["end"].astimezone(ET).replace(tzinfo=None),
            row["summary"],
        )

    got_sig = [sig(r) for r in got]
    exp_sig = [sig(r) for r in expected]
    if got_sig != exp_sig:
        problems.append("expansion did not match the weekly schedule")
        print("Expected:")
        for row in expected:
            print(f"  {fmt_when(row['start'])}–{row['end'].astimezone(ET).strftime('%-I:%M %p').lstrip()}  {row['summary']}")

    # Friday Nov 13 cancellation should only appear if that date is in range.
    friday_cancel = date(2026, 11, 13)
    has_nov13 = any(row["start"].astimezone(ET).date() == friday_cancel for row in got)
    if window_start <= friday_cancel <= window_end:
        if has_nov13:
            problems.append("Nov 13 cancellation was not applied as EXDATE")
    else:
        if has_nov13:
            problems.append("Nov 13 appeared even though it is outside the series start")
        # And the generated ICS should not need that EXDATE.
        if "20261113" in text:
            problems.append("Nov 13 EXDATE was written even though it is before series start")

    if problems:
        print("Validation failed:", file=sys.stderr)
        for problem in problems:
            print("  -", problem, file=sys.stderr)
        return 1
    print("Validation passed.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate practices.ics from data.json")
    parser.add_argument("--data", type=Path, default=DATA_PATH, help="Path to data.json")
    parser.add_argument("--out", type=Path, default=OUT_PATH, help="Path to write practices.ics")
    parser.add_argument("--check-only", action="store_true", help="Validate without writing")
    args = parser.parse_args()

    data = load_data(args.data)
    cal = build_calendar(data)
    payload = ics_bytes(cal)
    # Round-trip through icalendar to confirm the bytes parse.
    parsed = Calendar.from_ical(payload)
    status = validate(parsed, data)
    if args.check_only:
        return status
    args.out.write_bytes(payload)
    print(f"Wrote {args.out} ({len(payload)} bytes, {len(list(parsed.walk('VEVENT')))} events)")
    return status


if __name__ == "__main__":
    sys.exit(main())
