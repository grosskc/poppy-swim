# Poppy Gawelek-Gross — Swim Dashboard

A self-contained, single-file dashboard for times and upcoming meets. Open `index.html` in a browser on a computer or phone, or use the hosted copy at [https://grosskc.github.io/poppy-swim/](https://grosskc.github.io/poppy-swim/). No Grok Bot account is required for the page to work.

`data.json` is the same snapshot embedded inside `index.html`. Grok Bot’s refresh should update both, then republish this repository so GitHub Pages stays current.

The page has two views:

- **Times** — best times, cuts, Mid-States window flags, last swim vs. best
- **Meets** — entry deadlines, a common-format card for every meet (dates, warm-up and start times, venue and map, host, eligibility, event limits, fees, Poppy’s status and events, and links to announcements, psych sheets, heat sheets, and results when they exist)

## What works without Grok Bot

- Best times, cuts, Mid-States window flags, and SCY/LCM toggle
- Last swim vs. best, and swim counts, from the embedded history
- The Meets view from the embedded meet list (deadlines, cards, and document links)
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

Ranks are shown only when the lifetime best still matches the Grok snapshot. If you add a faster official file on this device first, ranks for that event hide until the next snapshot.

Local additions stay on that phone or computer. They do not automatically appear on grandma’s laptop until the snapshot is updated and the new `index.html` is shared, or until she adds the same results file.

## Sharing

The family site is published at [https://grosskc.github.io/poppy-swim/](https://grosskc.github.io/poppy-swim/). The Meets view is also at [https://grosskc.github.io/poppy-swim/#meets](https://grosskc.github.io/poppy-swim/#meets). Opening the file directly (`file://`) works on many computers, but it is awkward on iPhone and local storage can be unreliable that way. The hosted HTTPS link is better for phones.

Her times are already on public meet results and MySwimApp. Still, prefer sharing the link with family rather than posting it widely.
