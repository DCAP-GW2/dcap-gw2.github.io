# DCAP Community Hub

This repository hosts the public homepage for the DCAP Guild Wars 2 community. The production site is available at **[https://dcap-gw2.github.io/](https://dcap-gw2.github.io/)**.

The site is a static, dependency-free GitHub Pages project. It does not contain or deploy the separate DCAP Points application.

## File structure

```text
.
├── index.html              # Page content, navigation and metadata
├── css/style.css           # Layout, visual design and responsive styles
├── js/main.js              # Mobile navigation and small visual enhancements
└── assets/
    ├── brand/              # Original DCAP emblem and horizontal logo
    ├── images/             # Original DCAP hero artwork
    └── icons/              # Reserved for future standalone icons
```

## Making content updates

- **Homepage wording:** edit the relevant headings, paragraphs or event entries in `index.html`.
- **Navigation and buttons:** update `href` values in `index.html`. Items marked “Coming soon” are intentionally plain text rather than links. Replace them with links only when a confirmed destination is available.
- **DCAP Points:** the production Points URL is `https://dcap-points-community.to-nepherez.chatgpt.site/`. Keep the homepage decoupled from the Points API.
- **Brand artwork:** original supplied assets live in `assets/brand/` and `assets/images/`. Preserve these source files rather than recreating or overwriting them.
- **Visual styling:** colours, spacing, breakpoints and component styles are maintained in `css/style.css`.

## GitHub Pages deployment

GitHub Pages serves the static files from this repository. Changes merged into the configured publishing branch (normally `main`) are deployed by GitHub automatically; no build command or package installation is required. Allow a few minutes after merging for the live site to update.

Before publishing, preview `index.html` through a local web server and check the page at mobile and desktop widths. Also confirm that the DCAP Points links still use the production URL and that no placeholder has been turned into a broken link.

## Community notice

DCAP is a player-run Guild Wars 2 community and is not affiliated with ArenaNet or NCSOFT.
