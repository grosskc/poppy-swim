# Refresh routine spec — Poppy times dashboard

This is what the official-results refresh should do. Update both the standalone app (`/workspace/poppy-dashboard/data.json` and the embedded `DATA` object in `index.html`) and the live Grok Page (`10d0e4e8-b495-4555-9e8b-56b0e61eae32`) so they stay in sync. The family site is https://grosskc.github.io/poppy-swim/.

A **separate meets-watch routine** (not this times refresh) updates the `meets` array from Captyn. Do not drop or invent meet cards in the times refresh unless you are also running the meets update described below.

## Data file

Source of truth: `data.json` (schema `version: 1`). After editing it, regenerate or patch `index.html` so `const DATA = …` matches `data.json` exactly. Then apply the same official times, history, provisional times, honors, meta, and meet list to the Grok Page data blocks.

- `seasonTargets` holds the championship date chips used on the Times view (`littleElves`, `midStates`, `ohioJcs`, `zones`). Do not replace this object with the meet list.
- `meets` is an array of meet cards for the Meets view. See “Maintaining the meets array” below.

Do not invent times, ranks, meets, venues, warm-up or start times, fees, or splits. If a field is unknown, set it to `null` or omit it so the UI can show TBA or hide the row.

## Steps, in order

1. **MySwimApp official bests and ranks**  
   Open `https://myswimapp.com/swimmer/140062` with a real browser-style fetch (not box `curl`; Vercel returns 403 with `x-vercel-mitigated: deny`).  
   Update `officialTimes[]`: event, course (`SCY`|`LCM`), time, date (`YYYY-MM-DD`), meet if known, `source: "MySwimApp"`, and `ranks: { ohio, centralZone, usa }` where each is `{ rank, of? }` or `null`.  
   Never invent a rank. If a published rank disappeared, set it to `null`.  
   If a new official best appears, add or replace the row. Keep lifetime-best semantics (fastest known official time per event+course).

2. **Ohio results files**  
   Open `https://www.gomotionapp.com/team/czohlsc/page/meets/25-26-sc-scheduleresults`.  
   For each new or previously unseen results zip under `…/2026-2027 SC Season/Results/`, download it (server-side; browsers cannot, because the site sends no `Access-Control-Allow-Origin`).  
   Parse `.hy3` preferably, `.cl2` as fallback.  
   Keep only Poppy Gawelek-Gross (last name contains `Gawelek`, first name `Poppy`), Dayton Raiders. Skip DQ / NS / SCR / DFS.  
   Append official swims to `swimHistory[]`:

   ```json
   {
     "event": "100 Free",
     "course": "SCY",
     "time": "1:11.87",
     "date": "2026-10-17",
     "meet": "Payson's Journey Memorial",
     "source": "Ohio results file",
     "splits": [{"at": 50, "time": "34.71"}, {"at": 100, "time": "1:11.87"}],
     "provisional": false
   }
   ```

   Dedupe by `event|course|date|time`. Prefer the Ohio file’s meet name and splits when a MySwimApp best already exists for that key.  
   If an Ohio swim is faster than the current official best, update `officialTimes` (ranks stay `null` until MySwimApp publishes them).  
   If Ohio posts a result that matches a provisional row (same event, course, and date), drop the provisional row — official supersedes unofficial.

3. **Provisional times from chat**  
   Add anything Kevin sent since the last refresh to `provisionalTimes[]` with `provisional: true`. Omit any that now have a matching official swim.

4. **Honors**  
   Update the 25 Free team record only if MySwimApp or an official file shows a change.

5. **Meta**  
   - `lastChecked` / `lastCheckedLabel`: when official data was checked (America/New_York).  
   - `bestTimesAsOf` / `bestTimesAsOfLabel`: date of the newest official swim in the snapshot.  
   - `snapshotUpdated` / `snapshotUpdatedLabel`: when this snapshot was written.  
   - `meetsAsOf` / `meetsAsOfLabel`: when the `meets` array was last checked (America/New_York).  
   - `masonMeet.resultsPosted`: true only after official results for City of Mason November Invitational (OH-27SC-47) are actually posted. Then add those swims to history.  
   - `zonesReadiness`: only when MySwimApp republishes the Power Score; do not invent it.  
   - `midStatesWindowStart` stays `2026-09-01`.

6. **Standards / catalog**  
   Leave `standards` and `eventCatalog` alone unless USA Swimming publishes a new 10&U girls 2024–2028 table.

7. **Publish**  
   Write `data.json`, update the `DATA` object in `index.html`, and edit the live Grok Page in place (do not create a new Page). The Page still has no file picker; family use is the HTML app.  
   Kevin has approved publishing to GitHub Pages at https://grosskc.github.io/poppy-swim/ (`grosskc/poppy-swim`, branch `main`). After updating `data.json` and `index.html`, commit and push so Pages rebuilds. Confirm the live site shows the change.

## Derived display rules (do not store separately)

- Lifetime best = fastest swim in merged history + provisional (official same event+course+date supersedes provisional).  
- Mid-States window time = fastest swim with `date >= 2026-09-01`. A pre-window lifetime best can remain the headline time while the window time is shown separately (see 50 Back).  
- Last vs. best uses the most recent swim in history for that event+course.  
- Ranks attach only when the displayed official lifetime best still matches the `officialTimes` snapshot row.

## Maintaining the meets array

A separate routine should check Captyn (and Ohio results / host pages in meet weeks) a couple of times a week, and more often during meet week. Alert Kevin only on new meets, deadlines 7 and 2 days out, posted heat sheets or results, and declaration-status changes. Never submit entries or tick event boxes.

For each Dayton Raiders meet, keep one object in `meets[]` with a common shape. Upcoming and in-progress meets (`endDate` on or after today in America/New_York) render first; past meets are listed under a collapsed section.

```json
{
  "id": "captyn-meet-id",
  "name": "Little Elves",
  "officialName": "2026 Little Elves' Holiday Spirit Classic",
  "datesLabel": "Sun, Dec 6, 2026",
  "startDate": "2026-12-06",
  "endDate": "2026-12-06",
  "sanction": "OH-27SC-65",
  "host": "Miami University Makos",
  "venue": {
    "name": "Corwin M. Nixon Aquatic Center, Miami University",
    "address": "750 S. Oak St., Oxford, OH 45056",
    "mapsUrl": "https://www.google.com/maps/search/?api=1&query=750+S.+Oak+St.%2C+Oxford%2C+OH+45056"
  },
  "sessions": [
    {
      "label": "9–10 session",
      "date": "2026-12-06",
      "deckOpens": "8:15 AM",
      "warmup": "8:30 AM",
      "start": null,
      "notes": "optional"
    }
  ],
  "eligibility": { "eligible": true, "label": "Eligible — 10 & Under invitational" },
  "entry": {
    "maxEventsLabel": "Maximum 4 individual events",
    "fee": "$7 per individual event, …",
    "deadline": "2026-11-27T23:59:00-05:00",
    "deadlineLabel": "Fri, Nov 27, 2026, 11:59 PM ET",
    "deadlineKind": "team",
    "hostDeadlineLabel": "Mon, Nov 30, 2026 (host receipt deadline)",
    "open": true
  },
  "offeredEvents": [{ "number": "105", "name": "50 Free", "seed": "31.47" }],
  "poppy": {
    "status": "opted_in_no_events",
    "statusLabel": "Opted in, no events picked",
    "events": [],
    "suggestedEvents": ["50 Free", "50 Breast", "50 Fly", "100 Breast"],
    "suggestedNote": "For Kevin and her coach to decide. This dashboard never signs her up."
  },
  "flags": ["optional conflict note"],
  "notes": "optional",
  "links": [
    { "label": "Meet announcement", "url": "https://api.captyn.com/s3/<docid>" },
    { "label": "Captyn meet page", "url": "https://daytonraiders.captyn.com/account/meets/<id>" }
  ]
}
```

`poppy.status` values in use: `opted_in_no_events`, `swam`, `not_eligible`, `info_only`. Use `poppy.events` as `{ "session", "items": [] }` groups when she is entered or has already swam. `deadlineKind` may be `team`, `host`, or `soft` (an approximate date with no ISO deadline).

### Documents and Captyn links

- Captyn meet page: `https://daytonraiders.captyn.com/account/meets/<id>` (family login required to change entries).
- Captyn PDFs are at `https://api.captyn.com/s3/<docid>`. As of Nov 15, 2026 these short URLs are public: they 302 to a time-limited S3 URL and do not need a Captyn login. Always link the `api.captyn.com/s3/<docid>` URL, never the signed S3 URL (those expire). If a future check returns 401/403, stop linking the file and point at the Captyn meet page instead.
- Typical link labels: Meet announcement / Meet info, Psych sheet, Timeline, Warm-ups, Heat sheet, Results, Entries report, Captyn meet page. Omit a link when the document is not posted yet (for example Mason results).
- Fill venue, times, fees, and host from a public announcement, warm-up, or timeline PDF when those fields are actually stated. If the announcement says TBA and a later warm-up or timeline PDF posts real times, update the session. Do not invent a street address, start time, or fee.

After editing `meets`, set `meta.meetsAsOf` / `meta.meetsAsOfLabel` (America/New_York), keep `const DATA` in `index.html` in sync, update the Grok Page meet list the same way, commit, and push.

## Known gaps to watch

- CSC Fall Frenzy (Nov 8, 2026) was not on the Ohio results page under that name as of Nov 15, 2026. Those bests came from MySwimApp (no splits). If a zip appears later, parse it and add splits / other swims.  
- Mason Nov 13–15, 2026 results were not posted as of this snapshot.  
- MySwimApp history pages exist (`/swimmer/140062/meet/{id}`, `/event/{code}`) but `robots.txt` disallows them and the site rate-limits RSC requests. Do not scrape those as the primary source. Prefer Ohio zips for meet-by-meet official history.
