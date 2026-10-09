// Minimal locale lookup. No fallback chain or gender-grammar interpolation —
// those only matter once a second language is actually in play (M7).

export function createLocale(entries) {
  return { t: (key) => entries[key] ?? key };
}
