import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { toMonthIndex } from '../src/engine/time.js';
import { loadCountries } from '../src/engine/countriesLoader.js';
import { resolveCountry } from '../src/engine/countries.js';
import { schoolEntryMonth, schoolStageAt, stageStartsBetween, schoolYearStartsBetween, schoolYearEndsBetween } from '../src/systems/school.js';
import { calendarPoints } from '../src/systems/calendar.js';

const COUNTRIES_BY_ID = loadCountries(fileURLToPath(new URL('../data/countries/', import.meta.url)));
const education = (id) => resolveCountry(id, COUNTRIES_BY_ID).education;
const m = (year, month) => toMonthIndex({ year, month });

test('Japan: school starts in April once the child is 6 (cutoff in April)', () => {
  assert.equal(schoolEntryMonth(m(2000, 3), education('JP')), m(2006, 4)); // turns 6 in March 2006
  assert.equal(schoolEntryMonth(m(2000, 4), education('JP')), m(2006, 4)); // turns 6 that April
  assert.equal(schoolEntryMonth(m(2000, 5), education('JP')), m(2007, 4)); // turns 6 in May: next year
});

test('Brazil starts in February, Russia in September at 7', () => {
  assert.equal(schoolEntryMonth(m(2000, 1), education('BR')), m(2006, 2));
  assert.equal(schoolEntryMonth(m(2000, 3), education('BR')), m(2007, 2));
  assert.equal(schoolEntryMonth(m(2000, 6), education('RU')), m(2007, 9));
});

test('schoolStageAt walks stages and grades one school year at a time', () => {
  const birth = m(2000, 3); // JP entry April 2006
  const jp = education('JP');
  assert.equal(schoolStageAt(birth, m(2006, 3), jp), null);
  assert.deepEqual(schoolStageAt(birth, m(2006, 4), jp), { stageId: 'elementary', grade: 1 });
  assert.deepEqual(schoolStageAt(birth, m(2007, 3), jp), { stageId: 'elementary', grade: 1 });
  assert.deepEqual(schoolStageAt(birth, m(2007, 4), jp), { stageId: 'elementary', grade: 2 });
  assert.deepEqual(schoolStageAt(birth, m(2012, 4), jp), { stageId: 'middle', grade: 1 });
  assert.deepEqual(schoolStageAt(birth, m(2015, 4), jp), { stageId: 'high', grade: 1 });
  assert.equal(schoolStageAt(birth, m(2018, 4), jp), null);
});

test('stageStartsBetween finds a stage start inside an advance, with entrance exams', () => {
  const birth = m(2000, 3);
  const jp = education('JP');
  assert.deepEqual(stageStartsBetween(birth, m(2006, 1), m(2007, 1), jp), [{ month: m(2006, 4), stageId: 'elementary', entranceExam: false }]);
  assert.deepEqual(stageStartsBetween(birth, m(2015, 1), m(2015, 7), jp), [{ month: m(2015, 4), stageId: 'high', entranceExam: true }]);
  assert.deepEqual(stageStartsBetween(birth, m(2006, 4), m(2007, 1), jp), []);
});

test('schoolYearEndsBetween returns the last month of each school year in range', () => {
  const birth = m(2000, 1);
  const br = education('BR'); // entry Feb 2006, years end in December
  assert.deepEqual(schoolYearEndsBetween(birth, m(2006, 6), m(2007, 6), br), [{ month: m(2006, 12), stageId: 'elementary' }]);
  assert.deepEqual(schoolYearEndsBetween(birth, m(2005, 1), m(2006, 1), br), []);
});

test('every playable country keeps a child in school from entry until about 18', () => {
  for (const id of ['BR', 'US', 'JP', 'RU', 'GB']) {
    const edu = education(id);
    const birth = m(2000, 7);
    const entry = schoolEntryMonth(birth, edu);
    const years = edu.stages.reduce((sum, s) => sum + s.years, 0);
    assert.ok(schoolStageAt(birth, entry + years * 12 - 1, edu), id);
    assert.equal(schoolStageAt(birth, entry + years * 12, edu), null, id);
    const endAge = (entry + years * 12 - birth) / 12;
    assert.ok(endAge >= 18 && endAge < 19.5, `${id} ends at ${endAge}`);
  }
});

test('each country ends its school year in its own month', () => {
  const endMonth = { BR: 12, US: 6, JP: 3, RU: 5, GB: 7 };
  for (const [id, month] of Object.entries(endMonth)) {
    const ends = schoolYearEndsBetween(m(2000, 7), m(2000, 1), m(2020, 1), education(id));
    assert.ok(ends.length > 0, id);
    assert.ok(ends.every((e) => (e.month % 12) + 1 === month), id);
  }
});

test('without schoolYearEndMonth, the year ends the month before the next start', () => {
  const edu = { schoolYearStartMonth: 4, stages: [{ id: 'elementary', startAge: 6, years: 2 }] };
  const ends = schoolYearEndsBetween(m(2000, 3), m(2000, 1), m(2010, 1), edu);
  assert.deepEqual(ends.map((e) => e.month), [m(2007, 3), m(2008, 3)]);
});

test('schoolYearStartsBetween returns every school year start in range, with its stage', () => {
  const birth = m(2000, 1);
  const br = education('BR'); // entry Feb 2006, middle school from Feb 2011
  assert.deepEqual(schoolYearStartsBetween(birth, m(2006, 1), m(2007, 6), br), [
    { month: m(2006, 2), stageId: 'elementary' },
    { month: m(2007, 2), stageId: 'elementary' },
  ]);
  assert.deepEqual(schoolYearStartsBetween(birth, m(2011, 1), m(2011, 6), br), [{ month: m(2011, 2), stageId: 'middle' }]);
  assert.deepEqual(schoolYearStartsBetween(birth, m(2005, 1), m(2006, 1), br), []);
  assert.deepEqual(schoolYearStartsBetween(birth, m(2018, 1), m(2019, 6), br), [], 'school is over');
});

test('calendarPoints puts a stage start before the school year start of the same month', () => {
  const points = calendarPoints(m(2000, 1), m(2010, 11), m(2011, 3), education('BR'));
  assert.deepEqual(points.map((p) => p.on), ['schoolYearEnd', 'stageStart', 'schoolYearStart']);
});
