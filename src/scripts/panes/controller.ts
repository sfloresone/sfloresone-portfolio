import { navigate, swapFunctions } from "astro:transitions/client";
import type { TransitionBeforePreparationEvent, TransitionBeforeSwapEvent } from "astro:transitions/client";
import { shellPaths, type SectionId } from "../../data/site";
import { watchSpreads } from "./spreads";
import { RevealGrid } from "./reveal-grid";
import { announceIntent, announceLost, announceSection, isSectionId, paneState, routeKey } from "./state";

/** How long a leaving gallery spread keeps fading before it is dropped. */
const galleryFadeMs = 700;

let grid: RevealGrid | null = null;

let initialized = false;

function shellRoot(doc: Document = document): HTMLElement | null {
  return doc.querySelector<HTMLElement>("[data-shell]");
}

function activeOf(shell: HTMLElement): SectionId | null {
  const value = shell.dataset.active;

  return isSectionId(value) ? value : null;
}

function isLost(shell: HTMLElement): boolean {
  return shell.hasAttribute("data-lost");
}

function isKnownPath(pathname: string): boolean {
  return shellPaths.includes(routeKey(pathname));
}

function newestLayer(): HTMLElement | null {
  const layers = document.querySelectorAll<HTMLElement>("[data-pane-slot] > [data-pane-layer]");

  return layers[layers.length - 1] ?? null;
}

function gallerySpreads(doc: Document): HTMLElement[] {
  return [...doc.querySelectorAll<HTMLElement>("[data-gallery] [data-gallery-spread]:not([data-leaving])")];
}

function spreadKeys(spreads: HTMLElement[]): string {
  return spreads.map((spread) => spread.dataset.gallerySpread).join("\n");
}

/** Fades out the gallery spreads on screen and adopts the next page's. */
function swapGallery(newDocument: Document): void {
  const gallery = document.querySelector<HTMLElement>("[data-gallery]");

  if (!gallery) return;

  const incoming = gallerySpreads(newDocument);
  const outgoing = gallerySpreads(document);

  if (spreadKeys(incoming) === spreadKeys(outgoing)) return;

  for (const spread of outgoing) {
    spread.setAttribute("data-leaving", "");
    spread.removeAttribute("data-developed");
    setTimeout(() => spread.remove(), galleryFadeMs);
  }

  gallery.append(...incoming.map((spread) => document.adoptNode(spread)));
}

function syncDeck(active: SectionId | null): void {
  for (const link of document.querySelectorAll<HTMLAnchorElement>("[data-deck-link]")) {
    if (link.dataset.deckLink === active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
}

/** The grid for the current document's pane slot, rebuilt when the shell itself was replaced. */
function currentGrid(): RevealGrid | null {
  const slot = document.querySelector<HTMLElement>("[data-pane-slot]");

  if (grid && grid.slot !== slot) {
    grid.dispose();
    grid = null;
  }

  if (!grid && slot) grid = new RevealGrid(slot);

  return grid;
}

/** Closes the live veil from its current front back to empty. */
export function closeRevealToEmpty(): Promise<void> {
  return currentGrid()?.closeToEmpty() ?? Promise.resolve();
}

/** True while a section veil still covers any of the pane. */
export function isRevealOpen(): boolean {
  return currentGrid()?.isOpen() ?? false;
}

/** Mean open column of the live veil, in pane/field cells from the left. */
export function revealFrontCol(): number {
  return currentGrid()?.frontCol() ?? 0;
}

function enterLost(shell: HTMLElement): void {
  shell.setAttribute("data-lost", "");
  shell.classList.remove("is-lost-ready");
  shell.dataset.active = "";
  syncDeck(null);
  document.title = "404 — Sergio Flores";
  watchSpreads(null);
  announceLost(true);
}

function leaveLost(shell: HTMLElement): void {
  shell.removeAttribute("data-lost");
  shell.classList.remove("is-lost-ready");
  announceLost(false);
}

function swapPane(newDocument: Document): void {
  const shell = shellRoot();
  const nextShell = shellRoot(newDocument);
  const reveal = currentGrid();

  if (!shell || !nextShell || !reveal) return;

  if (isLost(nextShell) || !isKnownPath(location.pathname)) {
    enterLost(shell);

    return;
  }

  if (isLost(shell)) leaveLost(shell);

  const to = activeOf(nextShell);
  const nextLayer = newDocument.querySelector<HTMLElement>("[data-pane-layer]");

  shell.dataset.active = to ?? "";
  syncDeck(to);
  swapGallery(newDocument);
  announceSection(to);
  reveal.show(to, routeKey(nextLayer?.dataset.paneLayer ?? ""), nextLayer ? document.adoptNode(nextLayer) : null);
  watchSpreads(to ? newestLayer() : null);
}

/**
 * Unknown paths stay on the live shell: no fetch of 404.html.
 * Astro still updates the URL after prep; before-swap only runs enterLost.
 */
function onBeforePreparation(event: TransitionBeforePreparationEvent): void {
  if (!shellRoot() || isKnownPath(event.to.pathname)) return;

  event.loader = async () => {
    const doc = document.implementation.createHTMLDocument("404");
    const meta = doc.createElement("meta");

    meta.setAttribute("name", "astro-view-transitions-enabled");
    meta.setAttribute("content", "true");
    doc.head.append(meta);

    const shell = doc.createElement("div");

    shell.setAttribute("data-shell", "");
    shell.setAttribute("data-lost", "");
    doc.body.append(shell);
    event.newDocument = doc;
  };
}

function onBeforeSwap(event: TransitionBeforeSwapEvent): void {
  const live = shellRoot();
  const next = shellRoot(event.newDocument);

  if (!live || !next) {
    grid?.dispose();
    grid = null;

    return;
  }

  event.viewTransition.ready.catch(() => {});
  event.viewTransition.finished.catch(() => {});
  event.viewTransition.skipTransition();

  if (isLost(next) || !isKnownPath(event.to.pathname)) {
    event.swap = () => {
      enterLost(live);
    };

    return;
  }

  event.swap = () => {
    swapFunctions.deselectScripts(event.newDocument);
    swapFunctions.swapRootAttributes(event.newDocument);
    swapFunctions.swapHeadElements(event.newDocument);
    swapPane(event.newDocument);
  };
}

function onDeckClick(event: MouseEvent): void {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;

  if (!(event.target instanceof Element)) return;

  const link = event.target.closest<HTMLAnchorElement>("[data-deck-link]");

  if (!link || link.getAttribute("aria-current") !== "page") return;

  if (routeKey(link.pathname) !== routeKey(location.pathname)) return;

  event.preventDefault();
  void navigate("/");
}

function onDeckIntent(event: Event): void {
  if (!(event.target instanceof Element)) return;

  const id = event.target.closest<HTMLElement>("[data-deck-link]")?.dataset.deckLink;

  if (isSectionId(id)) announceIntent(id);
}

function syncFromDocument(): void {
  const shell = shellRoot();

  if (!shell) return;

  if (isLost(shell) || !isKnownPath(location.pathname)) {
    if (!paneState.lost) enterLost(shell);

    return;
  }

  if (paneState.lost) leaveLost(shell);

  const active = activeOf(shell);

  currentGrid();
  syncDeck(active);
  announceSection(active);
  watchSpreads(newestLayer());
}

export function initPanes(): void {
  if (initialized) return;

  initialized = true;
  syncFromDocument();

  document.addEventListener("astro:before-preparation", onBeforePreparation);
  document.addEventListener("astro:before-swap", onBeforeSwap);
  document.addEventListener("astro:page-load", syncFromDocument);
  document.addEventListener("click", onDeckClick, { capture: true });
  document.addEventListener("pointerover", onDeckIntent, { passive: true });
  document.addEventListener("focusin", onDeckIntent);
}
