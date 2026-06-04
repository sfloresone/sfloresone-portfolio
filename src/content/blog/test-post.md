---
title: "Building a portfolio with Astro and Tailwind v4"
date: 2026-06-04
category: Dev
author: Sergio Flores
description: "Un recorrido por las decisiones técnicas detrás de este portfolio — Astro, Tailwind v4, fuentes autohosteades y scroll-snap."
tags: [astro, tailwind, web, design]
---

When I set out to build this portfolio, I had three requirements: it had to be fast, it had to feel intentional, and it had to load almost nothing unnecessary.

After experimenting with a few frameworks, I landed on **Astro** for the static generation, **Tailwind v4** for styling, and **Bun** as the package manager. Here's why.

## Why Astro over the alternatives

Astro ships **zero JavaScript by default**. For a content-focused site like this, that's a killer feature. The page you're reading right now has about 10 KB of HTML and less than 1 KB of CSS — everything else is fonts.

> "The best code is the code you don't ship." — some smart person

I considered Next.js and SvelteKit, but both would have required more client-side JavaScript than I wanted. Astro's island architecture lets me add interactivity only where I need it, like the copy-to-clipboard button for the email address.

### What about Svelte?

I'm planning to add Svelte for some interactive elements later (think animated counters or interactive diagrams). Astro makes that trivial — just drop a `.svelte` file in the components folder and use it alongside your Astro components.

## Setting up Tailwind v4

Tailwind v4 introduced a completely rewritten engine. The most notable change is the `@theme` directive:

```css
@import "tailwindcss";

@theme {
  --font-body: var(--font-manrope);
  --font-heading: var(--font-libre-baskerville);
  --color-bg: #ffffff;
  --color-fg: #000000;
}
```

This replaces the old `tailwind.config.js` approach. Everything lives in CSS now — no config file, no content paths. The engine scans your templates at build time and tree-shakes unused classes automatically.

### A gotcha to watch for

If you use JavaScript to toggle a class that Tailwind didn't see during build, it won't exist at runtime. I hit this with the `.invert` class on the back-to-top button. The fix is to define any dynamic classes explicitly in your CSS:

```css
.invert {
  filter: invert(1);
}
```

Or reference them somewhere visible to the scanner, like a hidden element.

## Fonts: self-hosted with Astro Fonts API

I'm using two font families:

| Font | Role | Weight |
|------|------|--------|
| **Libre Baskerville** | Body text (serif) | 400, 700 |
| **Manrope** | Headings (sans) | 400, 500, 600, 700 |

The Astro Fonts API fetches the woff2 files at build time and hosts them locally. No external requests, no Google Fonts cookie notice. The bundle ends up being ~219 KB for 11 font files, which is acceptable for a first load.

```javascript
// astro.config.mjs
fonts: [
  {
    name: "Libre Baskerville",
    cssVariable: "--font-libre-baskerville",
    provider: fontProviders.fontsource(),
    weights: [400, 700],
    styles: ["normal", "italic"],
  },
  // ...
]
```

## The scroll-snap layout

The portfolio uses vertical `scroll-snap` sections. Here's the approach:

- `html` has `snap-y snap-proximity` — less aggressive than `mandatory`
- The home section has **no** snap (so you don't fight it to scroll past)
- Projects, Brainwaves, and About sections have `snap-start`

```css
html {
  scroll-snap-type: y proximity;
  scroll-behavior: smooth;
}
```

I removed `snap-start` from the hero section after noticing it made the header feel sticky and unpleasant. The `proximity` strictness lets the browser decide when to snap, which feels natural.

## Dark section detection

Each section alternates between white and black backgrounds. The back-to-top button and the browser `theme-color` meta tag need to adapt:

```javascript
const sectionObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      const isDark = entry.target.classList.contains("bg-black");
      topBtn.classList.toggle("invert", isDark);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", isDark ? "#000000" : "#ffffff");
    }
  }
}, { threshold: 0.4 });
```

This toggles the button color and the browser chrome color as you scroll through sections.

## Things I'd do differently

1. **Start with Tailwind earlier** — I initially wrote custom CSS to avoid the dependency, but ended up switching anyway.
2. **Use Content Collections from day one** — The blog section was an afterthought. I should have set up `src/content/blog/` from the start.
3. **Add the back-to-top button before the sticky header** — The sticky header was a distraction. The button is more useful and less intrusive.

```python
# Just to have a code block in another language
def calculate_lighthouse_score(metrics):
    performance = (
        metrics["fcp"] * 0.10 +
        metrics["lcp"] * 0.25 +
        metrics["cls"] * 0.15 +
        metrics["tbt"] * 0.30 +
        metrics["si"] * 0.10 +
        metrics["tti"] * 0.10
    )
    return min(max(performance, 0), 100)
```

## Final thoughts

Building a portfolio is an exercise in **restraint**. Every color, every font, every animation should justify its existence. If it doesn't serve the content, cut it.

> "Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away." — Antoine de Saint-Exupéry

---

*This post was written as a visual test for the blog layout. All code snippets are real.*
