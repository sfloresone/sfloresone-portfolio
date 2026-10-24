# sflores.one

Personal portfolio. Astro 6 + Tailwind v4, built with Bun, deployed as a static site to Cloudflare Pages. The ambient background is a WebGPU halftone field in `src/graphics/field`.

- `bun run dev` · `bun run build` · `bun run lint`
- Content lives typed in `src/data/site.ts`. Routes and section metadata live in `src/data/routes.ts` and field drawings in `src/data/drawings.ts`: client scripts import only those two, never `site.ts` (it pulls in images).
- Blog drafts and brand sources stay local in `drafts/` (gitignored) until the blog has a published post.

## Assets

- Raster images live in `src/assets` and render through `astro:assets` (`<Image>` or `getImage`, WebP, explicit width). `public/` only holds what needs a fixed URL: the favicon, the audio and the SVGs the field loads.
- Media that only plays on demand (the ambient audio) uses `preload="none"`.

## Code

oxlint with the vendored `anti-slop` plugin (`oxlint.config.ts`) must pass. The rules that bite most often:

- A blank line between statements (`require-readable-spacing`).
- `flatMap` instead of `.filter().map()`; no copying the accumulator in `reduce`.
- No object parameters, no `unknown` parameters/returns/aliases, no runtime `typeof`.
- Every type assertion carries a safety comment; never chain them.

Hooks into the DOM go through `data-*` attributes (`data-pane`, `data-deck-link`, `data-field-canvas`…), not classes.

## Styling

- Style with Tailwind utilities in the markup. `src/styles/global.css` is closed: it only holds the theme tokens, the shell geometry (read by the reveal grid and the WebGPU field) and the mobile stage. Touch it only when a utility cannot do the job.
- Use only the existing tokens: `canvas`, `surface`, `ink`, `muted`, `link`, `chip`, `underline`, `line`. No new colors. The UI is monochrome; section color lives only in the field's crests (`src/graphics/field/themes.ts`).
- 20px grid: `p-unit`, `--unit`, `--spacing-unit`. Pane content is capped at `max-w-[68ch]`.
- Vertical rhythm: `mb-7.5` after the pane header, `gap-7.5` between items of a text list, `mt-12.5` between sections of a pane, `my-6.25` around a separator between siblings.

## Typography

- Space Grotesk (`font-heading`) only for the wordmark, the pane title (`Pane`), project titles and section labels. Everything else is Neue Montreal.
- Body text is the default size with `leading-[1.6]` (set by `Pane`). Don't restyle prose.
- Item titles: `font-medium text-ink` in text lists (blog); `font-semibold`, 0.95–1rem, in structured items (companies, roles, projects).
- Meta is `text-muted`: at body size with `·` separators in text lists; 0.78rem with `|` separators inside timelines.
- Section labels go through `SectionLabel` (uppercase, `tracking-[0.06em]`, muted).

## Components

Reuse before creating: `Pane`, `SectionLabel`, `Separator`, `Tag`, `TimelineItem`, `Disclosure`, `IconTile`, and the `pane-link` / `rail-line` utilities.

- Tech icons live in `src/components/icons` (one `.astro` per SVG, registered by tag name in `TechIcon.astro`). Brand logos come from [svgl.app](https://svgl.app) (`https://api.svgl.app?search=<name>`), or the project's official repo when svgl lacks it. Concepts with no brand (Payment APIs, Webhooks…) use [Lucide](https://lucide.dev) glyphs with their children wrapped in `<g fill="none">`. Strip any `<style>` from imported SVGs: `.tech-icon-svg` tints everything with `currentColor`. Every `Tag` chip should have an icon.
- `Separator` (line) separates siblings inside one section, e.g. two companies in Work or two schools in Education.
- `Separator` followed by `Separator variant="diagonal"` separates distinct sections only, e.g. the experience list from Projects.

## Section patterns

Each section has its own register; don't carry one into another.

- **About, Work:** structured. Timelines with rails, icon tiles, tech chips, disclosures.
- **Blog, Story:** editorial. Plain text lists and paragraphs: no icons, tiles, chips or full-bleed rules.

## Motion and interaction

- Color transitions: 300ms linear. Pane motion: `--pane-motion-duration` / `--pane-motion-ease`. Always honor `motion-reduce`.
- Links lighten from `muted` (or `link`) to `ink` on hover and focus.
- Round buttons are `bg-chip` and invert to `bg-ink text-[#121212]` on hover and focus.
- Focus is always visible.
- Leaving a page marks its pane layer `data-leaving` as soon as navigation starts (`controller.ts`), then the reveal grid wipes it row by row. Large or bright blocks inside a pane (photos, cards) add `transition-opacity in-data-leaving:opacity-0` so they fade out instead of being cut into steps.
- The dot field follows the reading: a block with `data-spread` + `data-spread-drawing` (set from `drawing` in `site.ts`) makes the field redraw that image while it crosses the reading line (`spreads.ts`). The switch always goes through the engine's own morph; drawings are silhouettes taken from the image's alpha, tinted with the section crest unless `themes.ts` gives the drawing its brand theme. Holes are transparent; in two-tone drawings white takes the theme's `crest` and opaque black its `accent` (e.g. `public/mark-field.svg`, the Ambar drop and its leaf).

- Story photos declare their subject as `focus` in `src/data/story.ts`; the diagonal spread zooms just enough to put that point on the centroid of its half, in the DOM and in the field's halftone alike (`coverPlacement`).

- On mobile there is no field behind story photos: their in-pane copy grows out of its own dot mask with `data-dot-reveal` (`src/scripts/dot-reveal.ts`) the first time it scrolls into view.

- Compact windows (≥900px wide and at most 4:3, e.g. snapped to half a screen; `compactQuery` / the `compact:` variant) widen the deck and the pane and leave the field as an ambient strip: the engine skips drawings there (sections show their own scene) and story photos move inline as on mobile.

- The 404 is the home shell with "404" drawn in the field: no buttons or overlays, the deck is the way out. On mobile it keeps the home stage (deck column + runway) and the camera.

## Content

- Work experience text is copied verbatim from LinkedIn, as paragraphs, not bullets.
- The copy is in English.

## Before calling something done

`bun run lint` and `bun run build`, then look at the page on desktop and on mobile (<900px).
