// Stable, prefixed ids (rule: `p_` people, `r_` relationships). Deterministic
// given call order — no randomness involved, so this never touches the rng.

export function createIdGenerator(prefix) {
  let counter = 0;

  return function next() {
    counter += 1;
    return `${prefix}_${String(counter).padStart(4, '0')}`;
  };
}

// Next id after the highest one already in use. Pure and derived from the
// state itself, so ids created mid-life stay deterministic across saves.
export function nextIdAfter(prefix, existingIds) {
  let max = 0;
  for (const id of existingIds) {
    if (!id.startsWith(`${prefix}_`)) continue;
    max = Math.max(max, Number(id.slice(prefix.length + 1)));
  }
  return `${prefix}_${String(max + 1).padStart(4, '0')}`;
}
