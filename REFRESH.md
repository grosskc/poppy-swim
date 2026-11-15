# Refresh routine spec — Poppy times dashboard

This is what the twice-weekly official-results refresh should do. Update both the standalone app (`/workspace/poppy-dashboard/data.json` and the embedded `DATA` object in `index.html`) and the live Grok Page (`10d0e4e8-b495-4555-9e8b-56b0e61eae32`) so they stay in sync.

## Data file

Source of truth: `data.json` (schema `version: 1`). After editing it, regenerate or patch `index.html` so `const DATA = …` matches `data.json` exactly. Then apply the same official times, history, provisional times, honors, and meta to the Grok Page data blocks.

Do not invent times, ranks, meets, or splits.

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
   - `masonMeet.resultsPosted`: true only after official results for City of Mason November Invitational (OH-27SC-47) are actually posted. Then add those swims to history.  
   - `zonesReadiness`: only when MySwimApp republishes the Power Score; do not invent it.  
   - `midStatesWindowStart` stays `2026-09-01`.

6. **Standards / catalog**  
   Leave `standards` and `eventCatalog` alone unless USA Swimming publishes a new 10&U girls 2024–2028 table.

7. **Publish**  
   Write `data.json`, update the `DATA` object in `index.html`, and edit the live Grok Page in place (do not create a new Page). The Page still has no file picker; family use is the HTML app.  
   If a hosted family URL exists (Netlify / GitHub Pages / Cloudflare Pages), republish `index.html` there only when Kevin has already approved that host.

## Derived display rules (do not store separately)

- Lifetime best = fastest swim in merged history + provisional (official same event+course+date supersedes provisional).  
- Mid-States window time = fastest swim with `date >= 2026-09-01`. A pre-window lifetime best can remain the headline time while the window time is shown separately (see 50 Back).  
- Last vs. best uses the most recent swim in history for that event+course.  
- Ranks attach only when the displayed official lifetime best still matches the `officialTimes` snapshot row.

## Known gaps to watch

- CSC Fall Frenzy (Nov 8, 2026) was not on the Ohio results page under that name as of Nov 15, 2026. Those bests came from MySwimApp (no splits). If a zip appears later, parse it and add splits / other swims.  
- Mason Nov 13–15, 2026 results were not posted as of this snapshot.  
- MySwimApp history pages exist (`/swimmer/140062/meet/{id}`, `/event/{code}`) but `robots.txt` disallows them and the site rate-limits RSC requests. Do not scrape those as the primary source. Prefer Ohio zips for meet-by-meet official history.
