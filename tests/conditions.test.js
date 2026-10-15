import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateConditions } from '../src/engine/conditions.js';
import { toMonthIndex } from '../src/engine/time.js';

test('type and state must match exactly', () => {
  const relationship = { type: 'romantic', state: 'married', affinity: {} };
  assert.equal(evaluateConditions({ type: 'romantic' }, relationship), true);
  assert.equal(evaluateConditions({ type: 'family' }, relationship), false);
  assert.equal(evaluateConditions({ state: 'married' }, relationship), true);
  assert.equal(evaluateConditions({ state: 'divorced' }, relationship), false);
});

test('maxAffinity passes when the lower side is at or below the threshold', () => {
  const relationship = { affinity: { p_0001: 90, p_0002: 20 } };
  assert.equal(evaluateConditions({ maxAffinity: 25 }, relationship), true);
});

test('maxAffinity fails when both sides are above the threshold', () => {
  const relationship = { affinity: { p_0001: 90, p_0002: 30 } };
  assert.equal(evaluateConditions({ maxAffinity: 25 }, relationship), false);
});

test('minAge and maxAge compare against the current age', () => {
  const birth = toMonthIndex({ year: 2000, month: 1 });
  const person = { birth };
  const tenYearsLater = birth + 120;

  assert.equal(evaluateConditions({ minAge: 10 }, person, { currentMonthIndex: tenYearsLater }), true);
  assert.equal(evaluateConditions({ minAge: 11 }, person, { currentMonthIndex: tenYearsLater }), false);
  assert.equal(evaluateConditions({ maxAge: 10 }, person, { currentMonthIndex: tenYearsLater }), true);
  assert.equal(evaluateConditions({ maxAge: 9 }, person, { currentMonthIndex: tenYearsLater }), false);
});

test('multiple conditions are combined with AND', () => {
  const relationship = { type: 'romantic', state: 'married', affinity: { a: 10, b: 90 } };
  assert.equal(evaluateConditions({ type: 'romantic', state: 'married', maxAffinity: 25 }, relationship), true);
  assert.equal(evaluateConditions({ type: 'romantic', state: 'divorced', maxAffinity: 25 }, relationship), false);
});

test('unknown condition keys throw', () => {
  assert.throws(() => evaluateConditions({ notARealCondition: 1 }, {}));
});

test('targetRole passes when the target person holds one of the expected roles', () => {
  const relationship = { roles: { p_mother: 'mother', p_player: 'son' } };
  const context = { relationship, targetPersonId: 'p_mother' };

  assert.equal(evaluateConditions({ targetRole: ['mother', 'father'] }, {}, context), true);
  assert.equal(evaluateConditions({ targetRole: ['father'] }, {}, context), false);
});

test('minMoney compares the target money against the country scale', () => {
  const country = { currency: { scale: { small: 10, medium: 50, large: 200 } } };
  assert.equal(evaluateConditions({ minMoney: 'small' }, { money: 10 }, { country }), true);
  assert.equal(evaluateConditions({ minMoney: 'medium' }, { money: 49 }, { country }), false);
});

test('inSchool follows the country school calendar', () => {
  const country = { education: { schoolYearStartMonth: 4, stages: [{ id: 'elementary', startAge: 6, years: 6 }] } };
  const child = { birth: toMonthIndex({ year: 2000, month: 5 }) }; // enters April 2007
  const at = (year, month) => ({ country, currentMonthIndex: toMonthIndex({ year, month }) });
  assert.equal(evaluateConditions({ inSchool: true }, child, at(2007, 3)), false);
  assert.equal(evaluateConditions({ inSchool: true }, child, at(2007, 4)), true);
  assert.equal(evaluateConditions({ inSchool: false }, child, at(2007, 3)), true);
});

test('trainsActivity and notOnTeam look at the person\'s skills and teams', () => {
  const person = { skills: { football: { skill: 10 } }, teams: [{ activityId: 'football', teamKey: 'school' }] };
  assert.equal(evaluateConditions({ trainsActivity: 'football' }, person), true);
  assert.equal(evaluateConditions({ trainsActivity: 'basketball' }, person), false);
  assert.equal(evaluateConditions({ trainsActivity: 'football' }, {}), false);
  assert.equal(evaluateConditions({ notOnTeam: { activity: 'football', team: 'school' } }, person), false);
  assert.equal(evaluateConditions({ notOnTeam: { activity: 'basketball', team: 'school' } }, person), true);
  assert.equal(evaluateConditions({ notOnTeam: { activity: 'football', team: 'school' } }, {}), true);
});

test('notOnTeam takes a list: on none of those teams', () => {
  const both = [{ activity: 'football', team: 'school' }, { activity: 'basketball', team: 'school' }];
  assert.equal(evaluateConditions({ notOnTeam: both }, {}), true);
  const onOne = { teams: [{ activityId: 'basketball', teamKey: 'school' }] };
  assert.equal(evaluateConditions({ notOnTeam: both }, onOne), false);
});

test('awaitsAllowanceOffer: no allowance yet, and not before a refusal lets the offer come back', () => {
  const ctx = { currentMonthIndex: 100 };
  const awaits = (allowance) => evaluateConditions({ awaitsAllowanceOffer: true }, { allowance }, ctx);
  assert.equal(awaits(undefined), true);
  assert.equal(awaits({ since: 90, factor: 1 }), false);
  assert.equal(awaits({ offerAgainFrom: 144 }), false);
  assert.equal(awaits({ offerAgainFrom: 100 }), true);
  assert.equal(evaluateConditions({ awaitsAllowanceOffer: false }, { allowance: { since: 90 } }, ctx), true);
});

test('receivesAllowance: started and not cut now; askedAllowanceRaiseThisPeriod: an ask dated this month', () => {
  const ctx = { currentMonthIndex: 100 };
  const receives = (allowance) => evaluateConditions({ receivesAllowance: true }, { allowance }, ctx);
  assert.equal(receives(undefined), false);
  assert.equal(receives({ offerAgainFrom: 144 }), false);
  assert.equal(receives({ since: 80 }), true);
  assert.equal(receives({ since: 80, cut: { from: 98, until: 104 } }), false);
  assert.equal(receives({ since: 80, cut: { from: 94, until: 100 } }), true, 'the cut is over');

  const asked = (raiseAsks) => evaluateConditions({ askedAllowanceRaiseThisPeriod: false }, { allowance: { since: 80, raiseAsks } }, ctx);
  assert.equal(asked(undefined), true);
  assert.equal(asked([94]), true);
  assert.equal(asked([94, 100]), false);
});
