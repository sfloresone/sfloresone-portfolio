/** Share of a photo on screen before its dots start to grow. */
const revealThreshold = 0.35;

/** Ignores the bottom fifth of the screen, so the reveal waits for the reader to scroll toward the photo. */
const revealMargin = "0px 0px -20% 0px";

let initialized = false;

let observer: IntersectionObserver | null = null;

/** Registers the mask's custom properties so `transition` can interpolate them. */
function registerProperties(): void {
  if (!("registerProperty" in CSS)) return;

  try {
    CSS.registerProperty({ name: "--dot", syntax: "<length>", inherits: false, initialValue: "1px" });
    CSS.registerProperty({ name: "--sweep", syntax: "<percentage>", inherits: false, initialValue: "-15%" });
  } catch {
    // Already registered by an earlier load of this module; the transition works either way.
  }
}

function reveal(target: Element): void {
  target.setAttribute("data-revealed", "");
  observer?.unobserve(target);
}

function observePending(): void {
  const pending = document.querySelectorAll("[data-dot-reveal]:not([data-revealed])");

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !observer) {
    pending.forEach(reveal);

    return;
  }

  for (const target of pending) observer.observe(target);
}

/** Grows `[data-dot-reveal]` photos out of a dot mask the first time they come into view. */
export function initDotReveal(): void {
  if (initialized) return;

  initialized = true;
  registerProperties();

  if ("IntersectionObserver" in window) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) reveal(entry.target);
      },
      { threshold: revealThreshold, rootMargin: revealMargin },
    );
  }

  observePending();
  document.addEventListener("astro:page-load", observePending);
}
