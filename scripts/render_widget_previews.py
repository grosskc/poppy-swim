#!/usr/bin/env python3
"""Render widget preview PNGs at true iOS point sizes, @3x."""

from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "mockups" / "widget-preview.html"
OUT = ROOT / "mockups"
CHROME = "/usr/bin/google-chrome-stable"

# Isolated capture: screenshot the widget face itself (not the stage padding).
CAPTURES = {
    "widget-small-light.png": "#c-small-light",
    "widget-small-dark.png": "#c-small-dark",
    "widget-medium-light.png": "#c-medium-light",
    "widget-medium-dark.png": "#c-medium-dark",
    "widget-large-light.png": "#c-large-light",
    "widget-large-dark.png": "#c-large-dark",
    "widget-lock-rectangular-light.png": "#c-lock-rectangular-light",
    "widget-lock-rectangular-dark.png": "#c-lock-rectangular-dark",
    "widget-lock-inline-light.png": "#c-lock-inline-light",
    "widget-lock-inline-dark.png": "#c-lock-inline-dark",
}

SHEETS = {
    "widget-sheet-light.png": "#sheet-light",
    "widget-sheet-dark.png": "#sheet-dark",
}


def main():
    url = HTML.resolve().as_uri()
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=CHROME,
            args=["--disable-gpu", "--no-sandbox", "--font-render-hinting=none"],
        )
        page = browser.new_page(device_scale_factor=3, viewport={"width": 1200, "height": 2000})
        page.goto(url, wait_until="networkidle")
        page.evaluate("document.fonts && document.fonts.ready")
        # Make sure faces have painted
        page.wait_for_selector("#c-small-light .ehl")
        for name, sel in CAPTURES.items():
            el = page.locator(sel)
            el.screenshot(path=str(OUT / name), omit_background=False)
            print("wrote", name, el.bounding_box())
        for name, sel in SHEETS.items():
            el = page.locator(sel)
            el.screenshot(path=str(OUT / name))
            print("wrote", name, el.bounding_box())
        browser.close()


if __name__ == "__main__":
    main()
