# Poppy Gawelek-Gross — Swim Dashboard

A self-contained, single-file dashboard for times and upcoming meets. Open `index.html` in a browser on a computer or phone, or use the hosted copy at [https://grosskc.github.io/poppy-swim/](https://grosskc.github.io/poppy-swim/). No Grok Bot account is required for the page to work.

`data.json` is the same snapshot embedded inside `index.html`. Grok Bot’s refresh should update both, then republish this repository so GitHub Pages stays current.

The page has two views:

- **Times** — best times, cuts, Mid-States window flags, last swim vs. best
- **Meets** — entry deadlines, a common-format card for every meet (dates, warm-up and start times, venue and map, host, eligibility, event limits, fees, Poppy’s status and events, and links to announcements, psych sheets, heat sheets, and results when they exist), plus her Blue Group practice schedule and a calendar subscribe link

## What works without Grok Bot

- Best times, cuts, Mid-States window flags, and SCY/LCM toggle
- Last swim vs. best, and swim counts, from the embedded history
- The Meets view from the embedded meet list (deadlines, cards, and document links)
- The Blue Group practice schedule on the Meets view, and a subscribed iPhone calendar at [https://grosskc.github.io/poppy-swim/calendar/](https://grosskc.github.io/poppy-swim/calendar/)
- **Add official results**: choose an Ohio Swimming results `.zip`, `.hy3`, or `.cl2`. Parsing happens on the device. New swims are saved in this browser’s local storage and merged with the snapshot.
- **Add unofficial time**: stored on this device only, with a dotted Unofficial badge, until an official result for the same event, course, and date supersedes it.

The site cannot download Ohio results by itself. Ohio Swimming’s website does not allow other websites to read those files (no CORS access). After a meet, download the zip from the [Ohio 2026–27 SC schedule/results page](https://www.gomotionapp.com/team/czohlsc/page/meets/25-26-sc-scheduleresults) and add it here.

This page never submits meet entries. Declarations are made on the [Dayton Raiders Captyn site](https://daytonraiders.captyn.com), which needs a family login.

## What Grok Bot adds

- Ohio / Central Zone / USA ranks from MySwimApp
- A refreshed official snapshot (new bests, meet names, history, Power Score)
- Provisional times Kevin sends in chat, baked into the next snapshot so every device sees them
- Checking whether Mason or later meet results have been posted
- A separate meets refresh from Captyn (new meets, deadline and declaration status, newly posted documents)
- Practice-schedule changes from Captyn club emails, written into the subscribed calendar

Ranks are shown only when the lifetime best still matches the Grok snapshot. If you add a faster official file on this device first, ranks for that event hide until the next snapshot.

Local additions stay on that phone or computer. They do not automatically appear on grandma’s laptop until the snapshot is updated and the new `index.html` is shared, or until she adds the same results file.

## Sharing

The family site is published at [https://grosskc.github.io/poppy-swim/](https://grosskc.github.io/poppy-swim/). The Meets view is also at [https://grosskc.github.io/poppy-swim/#meets](https://grosskc.github.io/poppy-swim/#meets). The practice calendar is at [https://grosskc.github.io/poppy-swim/calendar/](https://grosskc.github.io/poppy-swim/calendar/). Opening the file directly (`file://`) works on many computers, but it is awkward on iPhone and local storage can be unreliable that way. The hosted HTTPS link is better for phones.

Her times are already on public meet results and MySwimApp. Still, prefer sharing the link with family rather than posting it widely.

## iOS widget

A Scriptable widget shows one day of the current meet — event, heat, lane, stroke, and Poppy’s best time. It reads the same snapshot as this site (`widget.json` on GitHub Pages). Set the widget Parameter to `auto` (the current day), `sat` / `sun`, or `day1` / `day2`, and stack two large widgets to swipe between days.

On an iPhone, open [the install page](https://grosskc.github.io/poppy-swim/widget/), copy the short installer into a new Scriptable script, run it once, then add a Scriptable widget and choose Poppy Swim. After that first install of this version, the script checks for updates about once a day and overwrites itself. Scriptable is free; there is no App Store listing to publish. The widget never submits meet entries.


## Practice calendar

A subscribed calendar lists her weekly Blue Group practices (no default alert; set one in the Calendar app if you want one). On an iPhone, open [the calendar page](https://grosskc.github.io/poppy-swim/calendar/) and tap **Add to iPhone Calendar**, then **Subscribe**. Or use Settings > Calendar > Accounts > Add Subscribed Calendar and paste `https://grosskc.github.io/poppy-swim/practices.ics`.

The feed is generated from the `practices` section of `data.json` by `scripts/build_calendar.py`. After a schedule change, run that script and publish the new `practices.ics` so subscribed phones pick it up. Posted cancellations are omitted from the calendar. Meets are not included in this feed.
