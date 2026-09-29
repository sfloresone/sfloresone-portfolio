import { announceSpread } from "./state";

/** Height share of the pane where the next block takes over the gallery. */
const readingLine = 0.4;

interface Watch {
  layer: HTMLElement;
  blocks: HTMLElement[];
  onScroll: () => void;
  frame: number;
}

let watch: Watch | null = null;

function pick({ layer, blocks }: Watch): string | null {
  const last = blocks.at(-1);

  if (!last) return null;

  const scrollable = layer.scrollHeight > layer.clientHeight + 1;

  if (!scrollable || layer.scrollTop <= 0) return blocks[0].dataset.spread ?? null;

  if (layer.scrollTop + layer.clientHeight >= layer.scrollHeight - 1) {
    return last.dataset.spread ?? null;
  }

  const box = layer.getBoundingClientRect();
  const line = box.top + box.height * readingLine;
  let active = blocks[0];

  for (const block of blocks) if (block.getBoundingClientRect().top <= line) active = block;

  return active.dataset.spread ?? null;
}

/** Announces the spread of the `[data-spread]` block being read in `layer`, following its scroll. */
export function watchSpreads(layer: HTMLElement | null): void {
  if (watch?.layer === layer) return;

  if (watch) {
    watch.layer.removeEventListener("scroll", watch.onScroll);
    cancelAnimationFrame(watch.frame);
    watch = null;
  }

  const blocks = layer ? [...layer.querySelectorAll<HTMLElement>("[data-spread]")] : [];

  if (!layer || blocks.length === 0) {
    announceSpread(null);

    return;
  }

  const current: Watch = {
    layer,
    blocks,
    frame: 0,
    onScroll: () => {
      if (current.frame) return;

      current.frame = requestAnimationFrame(() => {
        current.frame = 0;
        announceSpread(pick(current));
      });
    },
  };

  watch = current;
  layer.addEventListener("scroll", current.onScroll, { passive: true });
  announceSpread(pick(current));
}
