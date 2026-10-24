/** Narrow screens: the shell turns into the horizontal mobile stage. */
export const mobileQuery = "(max-width: 899px)";

/**
 * Portrait or near-square desktop windows (e.g. snapped to half a screen): the pane widens,
 * the field shrinks to an ambient strip without drawings and story photos move inline.
 * Keep in sync with the `compact` variant in `global.css`.
 */
export const compactQuery = "(min-width: 900px) and (max-aspect-ratio: 4/3)";
