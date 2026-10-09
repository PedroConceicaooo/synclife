// Stable, prefixed ids (rule: `p_` people, `r_` relationships). Deterministic
// given call order — no randomness involved, so this never touches the rng.

export function createIdGenerator(prefix) {
  let counter = 0;

  return function next() {
    counter += 1;
    return `${prefix}_${String(counter).padStart(4, '0')}`;
  };
}
