// School by country calendar (design doc: "Calendário por país"). A child
// starts school at the first school-year start on or after the month they
// reach the first stage's startAge, then moves through the stages one
// school year at a time. Pure month arithmetic, no rng.

// The school-year start at or before `month`.
function yearStartAtOrBefore(month, startMonth) {
  const offset = (((month % 12) - (startMonth - 1)) % 12 + 12) % 12;
  return month - offset;
}

export function schoolEntryMonth(birth, education) {
  const first = education.stages[0];
  if (!first) return null;
  const reachesAge = birth + first.startAge * 12;
  const start = yearStartAtOrBefore(reachesAge, education.schoolYearStartMonth);
  return start >= reachesAge ? start : start + 12;
}

// Stage starts, in school years counted from entry.
function stageOffsets(education) {
  let years = 0;
  return education.stages.map((stage) => {
    const offset = years;
    years += stage.years;
    return { stage, offset };
  });
}

const totalYears = (education) => education.stages.reduce((sum, s) => sum + s.years, 0);

// { stageId, grade } during school, or null before entry and after the end.
export function schoolStageAt(birth, month, education) {
  const entry = schoolEntryMonth(birth, education);
  if (entry === null || month < entry) return null;
  const year = Math.floor((month - entry) / 12);
  for (const { stage, offset } of stageOffsets(education)) {
    if (year < offset + stage.years) return { stageId: stage.id, grade: year - offset + 1 };
  }
  return null;
}

// Stage starts in (fromMonth, toMonth].
export function stageStartsBetween(birth, fromMonth, toMonth, education) {
  const entry = schoolEntryMonth(birth, education);
  if (entry === null) return [];
  return stageOffsets(education)
    .map(({ stage, offset }) => ({ month: entry + offset * 12, stageId: stage.id, entranceExam: Boolean(stage.entranceExam) }))
    .filter(({ month }) => month > fromMonth && month <= toMonth);
}

// Last months of school years in (fromMonth, toMonth], with the stage of the
// year that is ending.
export function schoolYearEndsBetween(birth, fromMonth, toMonth, education) {
  const entry = schoolEntryMonth(birth, education);
  if (entry === null) return [];
  const ends = [];
  for (let year = 0; year < totalYears(education); year++) {
    const month = entry + (year + 1) * 12 - 1;
    if (month > fromMonth && month <= toMonth) ends.push({ month, stageId: schoolStageAt(birth, month, education).stageId });
  }
  return ends;
}
