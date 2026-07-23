/**
 * Playback queue for audio (music/podcasts): ordered tracks, current
 * index, next/prev, shuffle, and repeat. Kept free of any particular
 * gateway's API shape — a `QueueTrack` is just enough to play and
 * display one item; callers map their own `VideoSummary`-like rows into
 * it.
 *
 * `QueueProvider`/`useQueuePlayback` exist because the queue has to
 * outlive the route that started it: an "add to queue" button on a
 * card in `/channel/:id` and the persistent `NowPlayingBar` mounted in
 * `Layout.tsx` (outside the router's `<Outlet>`) need to share one
 * queue instance across route changes, not each get their own. A
 * gateway that only ever plays one track at a time (no persistent bar)
 * can still call `useQueue` directly and skip the context entirely.
 */
import { createContext, createElement, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export interface QueueTrack {
  id: string;
  title: string;
  /** Display line under the title — typically the author/channel name. */
  subtitle?: string;
  /** Playable audio URL (a manifest's `playback.mp4Url` doubles as this —
   *  see API.md: it's a whole-file blob URL regardless of media kind). */
  src: string;
  coverArtUrl?: string;
}

export type RepeatMode = "off" | "all" | "one";

export interface QueueApi {
  tracks: QueueTrack[];
  currentIndex: number;
  current: QueueTrack | undefined;
  shuffle: boolean;
  repeat: RepeatMode;
  hasNext: boolean;
  hasPrev: boolean;
  /** Replace the queue and start playing at `startIndex` (default 0). */
  playNow: (tracks: QueueTrack[], startIndex?: number) => void;
  /** Append one track to the end without interrupting current playback;
   *  starts playing it immediately if the queue was empty. */
  enqueue: (track: QueueTrack) => void;
  playAt: (index: number) => void;
  next: () => void;
  prev: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  /**
   * Call from the audio element's native `ended` event. v1 auto-advance
   * is instant sequential — the next track's `src` swap happens on the
   * next render, same as any other `next()` call, so there is a decode
   * gap; true gapless (pre-buffering the next track into a second
   * element and crossfading the swap) is future work, not v1.
   *
   * Not responsible for `repeat: "one"` — that's handled by the
   * `<audio loop>` attribute in `AudioPlayer`, which repeats without
   * ever firing `ended`, so this only ever runs for an actual track
   * completion.
   */
  onEnded: () => void;
  clear: () => void;
}

function identityOrder(length: number): number[] {
  return Array.from({ length }, (_, i) => i);
}

/** Fisher–Yates, with `keep` (the currently-playing index, if any) moved
 *  to the front so shuffling on mid-playback doesn't jump the current
 *  track out from under the listener. */
function shuffledOrder(length: number, keep?: number): number[] {
  const indices = identityOrder(length);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  if (keep !== undefined) {
    const pos = indices.indexOf(keep);
    if (pos > 0) [indices[0], indices[pos]] = [indices[pos], indices[0]];
  }
  return indices;
}

export function useQueue(): QueueApi {
  const [tracks, setTracks] = useState<QueueTrack[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");

  const playNow = useCallback((next: QueueTrack[], startIndex = 0) => {
    setTracks(next);
    setOrder(shuffle ? shuffledOrder(next.length, startIndex) : identityOrder(next.length));
    setCurrentIndex(next.length > 0 ? Math.min(Math.max(startIndex, 0), next.length - 1) : -1);
  }, [shuffle]);

  const enqueue = useCallback((track: QueueTrack) => {
    setTracks((prev) => {
      const next = [...prev, track];
      setOrder((prevOrder) => (shuffle ? [...prevOrder, next.length - 1] : identityOrder(next.length)));
      setCurrentIndex((prevIndex) => (prevIndex === -1 ? next.length - 1 : prevIndex));
      return next;
    });
  }, [shuffle]);

  const playAt = useCallback((index: number) => {
    setCurrentIndex((prev) => (index >= 0 && index < tracks.length ? index : prev));
  }, [tracks.length]);

  const position = useMemo(() => order.indexOf(currentIndex), [order, currentIndex]);
  const hasNext = tracks.length > 0 && (repeat !== "off" || (position >= 0 && position < order.length - 1));
  const hasPrev = tracks.length > 0 && position > 0;

  const next = useCallback(() => {
    if (order.length === 0) return;
    const pos = order.indexOf(currentIndex);
    const atEnd = pos === -1 || pos >= order.length - 1;
    if (atEnd) {
      if (repeat === "all") setCurrentIndex(order[0] ?? -1);
      return; // repeat "off" at the end of the queue: stop, don't wrap
    }
    setCurrentIndex(order[pos + 1]);
  }, [order, currentIndex, repeat]);

  const prev = useCallback(() => {
    const pos = order.indexOf(currentIndex);
    if (pos <= 0) return;
    setCurrentIndex(order[pos - 1]);
  }, [order, currentIndex]);

  const toggleShuffle = useCallback(() => {
    setShuffle((was) => {
      const willShuffle = !was;
      setOrder(willShuffle ? shuffledOrder(tracks.length, currentIndex >= 0 ? currentIndex : undefined) : identityOrder(tracks.length));
      return willShuffle;
    });
  }, [tracks.length, currentIndex]);

  const cycleRepeat = useCallback(() => {
    setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off"));
  }, []);

  const clear = useCallback(() => {
    setTracks([]);
    setOrder([]);
    setCurrentIndex(-1);
  }, []);

  return {
    tracks,
    currentIndex,
    current: currentIndex >= 0 ? tracks[currentIndex] : undefined,
    shuffle,
    repeat,
    hasNext,
    hasPrev,
    playNow,
    enqueue,
    playAt,
    next,
    prev,
    toggleShuffle,
    cycleRepeat,
    onEnded: next,
    clear,
  };
}

/**
 * Default context value when no `QueueProvider` is mounted: an inert
 * queue (empty, every action a no-op) rather than `null` + a thrown
 * error. `MediaCard` calls `useQueuePlayback` unconditionally to offer
 * "add to queue" on audio items — it shouldn't have to know or care
 * whether the page it's rendered on (or a test harness rendering it in
 * isolation) bothered to wrap in a provider; it just silently can't
 * queue anything, the same way a share button with no clipboard API
 * available silently can't share.
 */
const INERT_QUEUE: QueueApi = {
  tracks: [],
  currentIndex: -1,
  current: undefined,
  shuffle: false,
  repeat: "off",
  hasNext: false,
  hasPrev: false,
  playNow: () => {},
  enqueue: () => {},
  playAt: () => {},
  next: () => {},
  prev: () => {},
  toggleShuffle: () => {},
  cycleRepeat: () => {},
  onEnded: () => {},
  clear: () => {},
};

const QueueContext = createContext<QueueApi>(INERT_QUEUE);

/**
 * Wrap the whole app (or at least everywhere a queue control can live) —
 * see `Layout.tsx`: it wraps the header/`<Outlet>`/`NowPlayingBar` so a
 * card several routes away and the persistent bar share one queue.
 *
 * Written with `createElement` rather than JSX so this file can stay
 * `.ts` (plain logic + one small provider) instead of `.tsx`, matching
 * `playerLogic.ts`'s "no JSX in the logic files" split; `TransportBar`/
 * `AudioPlayer`/`NowPlayingBar` are the `.tsx` consumers.
 */
export function QueueProvider({ children }: { children: ReactNode }): JSX.Element {
  const api = useQueue();
  return createElement(QueueContext.Provider, { value: api }, children);
}

/**
 * Consume the shared queue set up by a `QueueProvider` ancestor, or the
 * inert default if there isn't one (see `INERT_QUEUE`).
 */
export function useQueuePlayback(): QueueApi {
  return useContext(QueueContext);
}
