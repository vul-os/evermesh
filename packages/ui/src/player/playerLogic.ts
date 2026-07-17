/**
 * Pure logic for the player's keyboard map and state transitions, kept
 * free of DOM/React so it can be unit-tested without mounting a
 * `<video>` element. `Player.tsx` wires these into `useReducer` +
 * effects that sync real `HTMLVideoElement` state.
 */

export type PlayerAction =
  | { type: "toggle-play" }
  | { type: "seek"; deltaSec: number }
  | { type: "seek-to"; time: number }
  | { type: "toggle-fullscreen" }
  | { type: "toggle-mute" }
  | { type: "toggle-captions" }
  | { type: "volume"; deltaPct: number }
  | { type: "set-volume"; volume: number }
  | { type: "sync-time"; time: number }
  | { type: "sync-duration"; duration: number }
  | { type: "sync-playing"; playing: boolean };

/** Maps a `KeyboardEvent.key` to a player action, or null if unhandled. */
export function keyToAction(key: string): PlayerAction | null {
  switch (key) {
    case " ":
    case "Spacebar":
    case "k":
    case "K":
      return { type: "toggle-play" };
    case "ArrowLeft":
      return { type: "seek", deltaSec: -5 };
    case "ArrowRight":
      return { type: "seek", deltaSec: 5 };
    case "ArrowUp":
      return { type: "volume", deltaPct: 0.1 };
    case "ArrowDown":
      return { type: "volume", deltaPct: -0.1 };
    case "f":
    case "F":
      return { type: "toggle-fullscreen" };
    case "m":
    case "M":
      return { type: "toggle-mute" };
    case "c":
    case "C":
      return { type: "toggle-captions" };
    default:
      return null;
  }
}

export interface PlayerState {
  playing: boolean;
  /** 0..1 */
  volume: number;
  muted: boolean;
  captionsOn: boolean;
  duration: number;
  currentTime: number;
}

export const INITIAL_PLAYER_STATE: PlayerState = {
  playing: false,
  volume: 1,
  muted: false,
  captionsOn: false,
  duration: 0,
  currentTime: 0,
};

export function clampVolume(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function clampTime(t: number, duration: number): number {
  const upper = Number.isFinite(duration) && duration > 0 ? duration : Number.POSITIVE_INFINITY;
  return Math.min(upper, Math.max(0, t));
}

/**
 * Reducer for the subset of player state that is plain data (volume,
 * mute, captions, scrub position). `toggle-play` flips the intent bit
 * that the component's effect uses to call `video.play()/.pause()`;
 * `toggle-fullscreen` is a pure no-op here because fullscreen state is
 * owned by the browser (`fullscreenchange` event), not this reducer.
 */
export function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case "toggle-play":
      return { ...state, playing: !state.playing };
    case "seek":
      return { ...state, currentTime: clampTime(state.currentTime + action.deltaSec, state.duration) };
    case "seek-to":
      return { ...state, currentTime: clampTime(action.time, state.duration) };
    case "toggle-mute":
      return { ...state, muted: !state.muted };
    case "toggle-captions":
      return { ...state, captionsOn: !state.captionsOn };
    case "volume": {
      const volume = clampVolume(state.volume + action.deltaPct);
      return { ...state, volume, muted: volume === 0 ? state.muted : false };
    }
    case "set-volume":
      return { ...state, volume: clampVolume(action.volume) };
    case "sync-time":
      return { ...state, currentTime: action.time };
    case "sync-duration":
      return { ...state, duration: action.duration };
    case "sync-playing":
      return { ...state, playing: action.playing };
    case "toggle-fullscreen":
      return state;
    default:
      return state;
  }
}

/** `TimeRanges` -> plain array, for rendering the buffered bar without touching the DOM API in tests. */
export function bufferedRanges(buffered: { length: number; start(i: number): number; end(i: number): number }): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < buffered.length; i++) {
    out.push([buffered.start(i), buffered.end(i)]);
  }
  return out;
}

export interface SponsorSegment {
  startMs: number;
  endMs: number;
  label: string;
}

/** Percentage (0-100) of the timeline a sponsor segment's start/width occupy. */
export function sponsorSegmentStyle(segment: SponsorSegment, durationSec: number): { leftPct: number; widthPct: number } {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return { leftPct: 0, widthPct: 0 };
  const startSec = segment.startMs / 1000;
  const endSec = segment.endMs / 1000;
  const leftPct = clampVolume(startSec / durationSec) * 100;
  const widthPct = clampVolume((endSec - startSec) / durationSec) * 100;
  return { leftPct, widthPct };
}

export function formatClockTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
