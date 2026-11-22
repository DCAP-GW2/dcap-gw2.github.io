# DCAP Community Hub

This repository hosts the public homepage for the DCAP Guild Wars 2 community. The production site is available at **[https://dcap-gw2.github.io/](https://dcap-gw2.github.io/)**.

The site is a static, dependency-free GitHub Pages project. It includes the DCAP Events schedule at `events/` and the separate DCAP Points application at `points/`.

## File structure

```text
.
├── index.html              # Homepage, navigation and community previews
├── events/index.html       # Weekly events, local-time/UTC day picker
├── css/style.css           # Shared theme and homepage layout
├── css/events.css          # Events-specific responsive layout
├── js/main.js              # Mobile navigation and visual enhancements
├── js/events/schedule.mjs  # UTC recurring events and date helpers
├── js/events/page.mjs      # Events page rendering
├── js/events/home.mjs      # Homepage event preview
└── assets/
    ├── brand/              # Original DCAP emblem and horizontal logo
    ├── images/             # Original DCAP hero artwork
    └── icons/              # Reserved for future standalone icons
```

## Making content updates

- **Homepage wording:** edit the relevant headings, paragraphs or event entries in `index.html`.
- **Navigation and buttons:** update `href` values in `index.html`. Items marked “Coming soon” are intentionally plain text rather than links. Replace them with links only when a confirmed destination is available.
- **Events:** update the recurring UTC weekdays and clock times in `js/events/schedule.mjs`. They are fixed to UTC: a visitor's local date/time may change when daylight saving begins or ends. "Or" choices are alternatives; arrows are sequential events. The Events page and homepage preview share this file, so do not maintain separate timestamps.
- **DCAP Points:** the public entry point is `points/` on this site. The previous standalone site is retained only in Points recovery links; it has not been retired or redirected. Keep the homepage decoupled from the Points API.
- **Brand artwork:** original supplied assets live in `assets/brand/` and `assets/images/`. Preserve these source files rather than recreating or overwriting them.
- **Visual styling:** colours, spacing, breakpoints and component styles are maintained in `css/style.css`.

## GitHub Pages deployment

GitHub Pages serves the static files from this repository. Changes merged into the configured publishing branch (normally `main`) are deployed by GitHub automatically; no build command or package installation is required. Allow a few minutes after merging for the live site to update.

Before publishing, run `npm test`, preview `index.html` and `events/` through a local web server, and check the pages at mobile and desktop widths. Verify local-time and UTC selection, date rollover, and accessibility. Also confirm that the DCAP Points links still use the production URL and that no placeholder has been turned into a broken link.

## Community notice

DCAP is a player-run Guild Wars 2 community and is not affiliated with ArenaNet or NCSOFT.
