export const IDLE_MS = 30_000;
export const TYPING_GAP_MS = 5_000;

export type TimingEvent = { t: number; key: string; kind: "attend" | "type" };
export interface Timing {
  activeMs: Record<string, number>;
  typingMs: Record<string, number>;
  current: string | null;
  lastT: number | null;
  firstT: number | null;
  lastTypeT: Record<string, number>;
}

export const emptyTiming = (): Timing => ({ activeMs: {}, typingMs: {}, current: null, lastT: null, firstT: null, lastTypeT: {} });

// Time belongs to the card the visitor last touched, focused or typed in, until
// they touch another. A gap longer than IDLE_MS is time away, not grading.
export function addEvent(s: Timing, e: TimingEvent): Timing {
  const activeMs = { ...s.activeMs };
  if (s.current && s.lastT !== null && e.t - s.lastT <= IDLE_MS) activeMs[s.current] = (activeMs[s.current] ?? 0) + (e.t - s.lastT);
  const typingMs = { ...s.typingMs };
  const lastTypeT = { ...s.lastTypeT };
  if (e.kind === "type") {
    const prev = lastTypeT[e.key];
    if (prev !== undefined) typingMs[e.key] = (typingMs[e.key] ?? 0) + Math.min(e.t - prev, TYPING_GAP_MS);
    lastTypeT[e.key] = e.t;
  }
  return { activeMs, typingMs, lastTypeT, current: e.key, lastT: e.t, firstT: s.firstT ?? e.t };
}

// Submitting closes the last card's interval.
export function finish(s: Timing, t: number): Timing {
  return { ...addEvent(s, { t, key: "", kind: "attend" }), current: null };
}
