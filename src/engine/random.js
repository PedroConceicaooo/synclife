// Deterministic PRNG (mulberry32). All randomness in the engine must go through here.

// savedState (from getState) resumes a generator exactly where it was, so a
// loaded game keeps drawing the same numbers it would have drawn.
export function createRng(seed, savedState) {
  let state = savedState === undefined ? seed >>> 0 : savedState | 0;

  function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function nextInt(min, maxExclusive) {
    return min + Math.floor(next() * (maxExclusive - min));
  }

  function chance(p) {
    return next() < p;
  }

  return { next, nextInt, chance, getState: () => state | 0 };
}

export function yearlyChanceToPeriod(yearlyChance, months) {
  return 1 - (1 - yearlyChance) ** (months / 12);
}
