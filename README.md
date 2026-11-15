# Poppy Gawelek-Gross — Times Dashboard

A self-contained, single-file times dashboard. Open `index.html` in a browser on a computer or phone. No Grok Bot account is required for the page to work.

`data.json` is the same snapshot embedded inside `index.html`. Grok Bot’s twice-weekly refresh should update both, then the family copy can be republished.

## What works without Grok Bot

- Best times, cuts, Mid-States window flags, and SCY/LCM toggle
- Last swim vs. best, and swim counts, from the embedded history
- **Add official results**: choose an Ohio Swimming results `.zip`, `.hy3`, or `.cl2`. Parsing happens on the device. New swims are saved in this browser’s local storage and merged with the snapshot.
- **Add unofficial time**: stored on this device only, with a dotted Unofficial badge, until an official result for the same event, course, and date supersedes it.

The site cannot download Ohio results by itself. Ohio Swimming’s website does not allow other websites to read those files (no CORS access). After a meet, download the zip from the [Ohio 2026–27 SC schedule/results page](https://www.gomotionapp.com/team/czohlsc/page/meets/25-26-sc-scheduleresults) and add it here.

## What Grok Bot adds

- Ohio / Central Zone / USA ranks from MySwimApp
- A refreshed official snapshot (new bests, meet names, history, Power Score)
- Provisional times Kevin sends in chat, baked into the next snapshot so every device sees them
- Checking whether Mason or later meet results have been posted

Ranks are shown only when the lifetime best still matches the Grok snapshot. If you add a faster official file on this device first, ranks for that event hide until the next snapshot.

Local additions stay on that phone or computer. They do not automatically appear on grandma’s laptop until the snapshot is updated and the new `index.html` is shared, or until she adds the same results file.

## Sharing a stable link

This folder is not published yet. Good free options:

1. **Netlify Drop** — go to [app.netlify.com/drop](https://app.netlify.com/drop), drag this folder (or just `index.html`), and get a URL. A free Netlify account keeps the address stable.
2. **GitHub Pages** — put `index.html` in a GitHub repository and enable Pages. A public repo is free; a private repo needs a paid GitHub plan for Pages. Her times are already on public meet results and MySwimApp, but you may still prefer a less guessable URL.
3. **Cloudflare Pages** — similar to Netlify, free account, drag-and-drop or Git.

Opening the file directly (`file://`) works on many computers, but it is awkward on iPhone and local storage can be unreliable that way. A hosted HTTPS link is better for phones.

Do not post the file to a public site until Kevin decides how it should be shared.
