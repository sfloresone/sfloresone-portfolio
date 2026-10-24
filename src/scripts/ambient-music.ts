const targetGain = 0.6;

const fadeSeconds = 0.45;

function renderState(button: HTMLButtonElement, mutedIcon: SVGGElement, playingIcon: SVGGElement, playing: boolean): void {
  button.setAttribute("aria-pressed", String(playing));
  button.setAttribute("aria-label", playing ? "Mute ambient music" : "Play ambient music");
  button.title = playing ? "Mute ambient music" : "Play ambient music";
  mutedIcon.setAttribute("display", playing ? "none" : "inline");
  playingIcon.setAttribute("display", playing ? "inline" : "none");
}

export function initAmbientMusic(): void {
  const button = document.querySelector<HTMLButtonElement>("[data-ambient-toggle]");
  const track = document.querySelector<HTMLAudioElement>("[data-ambient-track]");
  const mutedIcon = button?.querySelector<SVGGElement>("[data-ambient-muted]");
  const playingIcon = button?.querySelector<SVGGElement>("[data-ambient-playing]");

  if (!button || !track || !mutedIcon || !playingIcon || button.dataset.initialized === "true") return;

  button.dataset.initialized = "true";

  const context = new AudioContext();
  const source = context.createMediaElementSource(track);
  const gain = context.createGain();

  gain.gain.value = 0;
  source.connect(gain);
  gain.connect(context.destination);

  let requested = false;
  let requestId = 0;
  let pauseTimer = 0;

  function setGain(value: number, pauseAfter: boolean): void {
    window.clearTimeout(pauseTimer);

    const now = context.currentTime;
    const current = gain.gain.value;

    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(current, now);
    gain.gain.linearRampToValueAtTime(value, now + fadeSeconds);

    if (pauseAfter) {
      pauseTimer = window.setTimeout(() => track.pause(), fadeSeconds * 1000);
    }
  }

  function start(): void {
    const currentRequest = ++requestId;

    requested = true;
    window.clearTimeout(pauseTimer);

    const resume = context.resume();
    const playback = track.play();

    void Promise.all([resume, playback])
      .then(() => {
        window.removeEventListener("pointerdown", startOnGesture);
        window.removeEventListener("keydown", startOnGesture);

        if (currentRequest !== requestId || !requested) {
          track.pause();

          return;
        }

        setGain(targetGain, false);
      })
      .catch(() => {
        if (currentRequest !== requestId) return;

        track.autoplay = false;
        track.pause();
        requested = false;
        renderState(button, mutedIcon, playingIcon, false);
      });
  }

  function startOnGesture(event: Event): void {
    if (event.target instanceof Element && event.target.closest("[data-ambient-toggle]")) return;

    if (track.paused || context.state !== "running") start();
  }

  track.addEventListener("play", () => {
    requested = true;
    renderState(button, mutedIcon, playingIcon, true);
  });
  track.addEventListener("pause", () => {
    requested = false;
    renderState(button, mutedIcon, playingIcon, false);
  });
  track.addEventListener("ended", () => {
    requested = false;
    renderState(button, mutedIcon, playingIcon, false);
  });

  renderState(button, mutedIcon, playingIcon, !track.paused);

  button.addEventListener("click", () => {
    if (requested) {
      requestId++;

      requested = false;
      track.autoplay = false;
      renderState(button, mutedIcon, playingIcon, false);
      setGain(0, true);

      return;
    }

    start();
  });

  window.addEventListener("pointerdown", startOnGesture);
  window.addEventListener("keydown", startOnGesture);

  // Enable native autoplay only after the gain graph is connected.
  track.autoplay = true;
  start();
}
