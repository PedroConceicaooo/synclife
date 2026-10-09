// The 5-band affinity color scale from design.md's "Interações e barra de
// relação" section (80-100, 60-79, 40-59, 20-39, 0-19).

export function affinityBand(value) {
  if (value >= 80) return 'very_high';
  if (value >= 60) return 'high';
  if (value >= 40) return 'neutral';
  if (value >= 20) return 'low';
  return 'very_low';
}
