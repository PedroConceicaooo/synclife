import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  monthlyFee,
  isEnrolled,
  payerOptions,
  parentToAsk,
  requestEnrollment,
  leaveEnrollment,
  chargeEnrollments,
  askParentPermission,
  ENROLLMENT_GRACE_MONTHS,
} from '../src/systems/enrollment.js';
import { activityBlocker } from '../src/systems/activities.js';
import { resolveChance } from '../src/systems/interactions.js';
import { loadActivities } from '../src/systems/activitiesLoader.js';
import { createLocale } from '../src/i18n/locale.js';
import { enrollmentLine } from '../src/ui/diary.js';

const ACTIVITIES_DIR = fileURLToPath(new URL('../data/activities/', import.meta.url));
const LOCALE = JSON.parse(readFileSync(new URL('../locales/pt-BR/ui.json', import.meta.url), 'utf8'));
const COUNTRY = { currency: { scale: { small: 10, medium: 50, large: 100 } } };
const STATS = { happiness: 50, health: 50, intelligence: 50, looks: 50 };

const ACTIVITY = {
  id: 'bjj',
  category: 'physical',
  conditions: { minAge: 4 },
  enrollment: {
    monthlyFee: 'small',
    selfPayMinAge: 12,
    permissionUnder: 18,
    permission: { base: 0.6, modifiers: [{ factor: 'parentPays', adjust: -0.2 }] },
    success: [{ op: 'stat', target: 'player', stat: 'happiness', delta: 3 }],
    failure: [{ op: 'affinity', side: 'player', delta: -2 }],
  },
};

function family({ ageYears = 8, playerMoney = 0, motherMoney = 6000, fatherMoney = 6000, motherLikes = 70, fatherLikes = 60 } = {}) {
  const person = (id, money, birth) => ({ id, birth, money, traits: [], stats: { ...STATS }, stress: 50 });
  const peopleById = {
    p_kid: person('p_kid', playerMoney, 0),
    p_mom: person('p_mom', motherMoney, -360),
    p_dad: person('p_dad', fatherMoney, -360),
  };
  const relationship = (id, parentId, role, likes) => ({
    id,
    roles: { [parentId]: role, p_kid: 'son' },
    affinity: { [parentId]: likes, p_kid: 60 },
    interactionsThisPeriod: 0,
  });
  const relationshipsById = {
    r_1: relationship('r_1', 'p_mom', 'mother', motherLikes),
    r_2: relationship('r_2', 'p_dad', 'father', fatherLikes),
  };
  return { playerId: 'p_kid', peopleById, relationshipsById, country: COUNTRY, currentMonthIndex: ageYears * 12 };
}

const always = { chance: () => true };
const never = { chance: () => false };

test('payerOptions: only the parents pay before selfPayMinAge, then the player may too', () => {
  assert.deepEqual(payerOptions(ACTIVITY, { birth: 0 }, 11 * 12 + 11), ['parents']);
  assert.deepEqual(payerOptions(ACTIVITY, { birth: 0 }, 12 * 12), ['parents', 'self']);
});

test('parentToAsk picks the parent who likes the player most', () => {
  assert.equal(parentToAsk('p_kid', family().relationshipsById).parentId, 'p_mom');
  assert.equal(parentToAsk('p_kid', family({ fatherLikes: 90 }).relationshipsById).parentId, 'p_dad');
  assert.equal(parentToAsk('p_kid', {}), null);
});

test('a parent who agrees to pay becomes the payer', () => {
  const result = requestEnrollment(ACTIVITY, { ...family(), payer: 'parents', rng: always });
  assert.equal(result.enrolled, true);
  assert.equal(result.askedParentId, 'p_mom');
  assert.deepEqual(result.peopleById.p_kid.enrollments.bjj, { since: 96, payerId: 'p_mom' });
  assert.equal(result.peopleById.p_kid.stats.happiness, 53);
  assert.equal(isEnrolled(result.peopleById.p_kid, 'bjj'), true);
});

test('a refusal enrolls nobody and applies the failure effects', () => {
  const result = requestEnrollment(ACTIVITY, { ...family(), payer: 'parents', rng: never });
  assert.equal(result.enrolled, false);
  assert.equal(result.reason, 'refused');
  assert.equal(result.peopleById.p_kid.enrollments, undefined);
  assert.equal(result.relationshipsById.r_1.affinity.p_kid, 58);
});

test('paying alone still needs the parents to agree while under permissionUnder', () => {
  const teen = family({ ageYears: 14, playerMoney: 50 });
  const result = requestEnrollment(ACTIVITY, { ...teen, payer: 'self', rng: always });
  assert.equal(result.askedParentId, 'p_mom');
  assert.equal(result.peopleById.p_kid.enrollments.bjj.payerId, 'p_kid');

  const adult = requestEnrollment(ACTIVITY, { ...family({ ageYears: 18, playerMoney: 50 }), payer: 'self', rng: never });
  assert.equal(adult.enrolled, true);
  assert.equal(adult.askedParentId, null);
});

test('nobody is asked when the payer cannot afford the first month', () => {
  const broke = requestEnrollment(ACTIVITY, { ...family({ ageYears: 14, playerMoney: 9 }), payer: 'self', rng: always });
  assert.equal(broke.reason, 'money');
  assert.equal(broke.askedParentId, null);
  const poorParent = requestEnrollment(ACTIVITY, { ...family({ motherMoney: 5 }), payer: 'parents', rng: always });
  assert.equal(poorParent.reason, 'money');
  assert.equal(poorParent.enrolled, false);
});

test('the parentPays and targetWealth factors move the chance', () => {
  const { peopleById, relationshipsById } = family();
  const context = { relationship: relationshipsById.r_1, targetPersonId: 'p_mom', target: peopleById.p_mom, country: COUNTRY };
  const pays = { base: 0.5, modifiers: [{ factor: 'parentPays', adjust: -0.2 }] };
  assert.equal(resolveChance(pays, { ...context, parentPays: true }), 0.3);
  assert.equal(resolveChance(pays, context), 0.5);

  // 6000 = 60 × "large" is the average family: no change. Double it: +weight.
  const wealth = { base: 0.5, modifiers: [{ factor: 'targetWealth', weight: 0.2 }] };
  assert.equal(resolveChance(wealth, context), 0.5);
  assert.ok(Math.abs(resolveChance(wealth, { ...context, target: { money: 12000 } }) - 0.7) < 1e-9);
  assert.ok(Math.abs(resolveChance(wealth, { ...context, target: { money: 0 } }) - 0.3) < 1e-9);
});

test('training needs the enrollment', () => {
  const player = { id: 'p_kid', birth: 0, money: 0, stats: { ...STATS } };
  const args = { player, country: COUNTRY, currentMonthIndex: 96 };
  assert.equal(activityBlocker(ACTIVITY, args), 'notEnrolled');
  assert.equal(activityBlocker(ACTIVITY, { ...args, player: { ...player, enrollments: { bjj: { since: 0, payerId: 'p_mom' } } } }), null);
});

test('chargeEnrollments takes fee × months from the payer; one who cannot pay owes the months', () => {
  const { peopleById } = family({ motherMoney: 100, fatherMoney: 30 });
  const kid = { ...peopleById.p_kid, enrollments: { bjj: { since: 0, payerId: 'p_mom' }, gym: { since: 0, payerId: 'p_dad' } } };
  const activitiesById = { bjj: ACTIVITY, gym: { ...ACTIVITY, id: 'gym' } };
  const result = chargeEnrollments({ ...peopleById, p_kid: kid }, activitiesById, { country: COUNTRY, months: 6 });

  assert.equal(result.peopleById.p_mom.money, 40);
  assert.equal(result.peopleById.p_dad.money, 30, 'nothing taken from a payer short of money');
  assert.deepEqual(result.paid, [{ personId: 'p_kid', activityId: 'bjj', payerId: 'p_mom', amount: 60 }]);
  assert.deepEqual(result.late, [{ personId: 'p_kid', activityId: 'gym', payerId: 'p_dad', owedMonths: 6 }]);
  assert.deepEqual(result.ended, []);
  assert.deepEqual(result.peopleById.p_kid.enrollments.gym, { since: 0, payerId: 'p_dad', owedMonths: 6 });
});

test('past ENROLLMENT_GRACE_MONTHS owed the enrollment ends; paying settles the owed months too', () => {
  const activitiesById = { gym: { ...ACTIVITY, id: 'gym' } };
  const { peopleById } = family({ fatherMoney: 30 });
  const late = { ...peopleById, p_kid: { ...peopleById.p_kid, enrollments: { gym: { since: 0, payerId: 'p_dad', owedMonths: ENROLLMENT_GRACE_MONTHS } } } };

  const ended = chargeEnrollments(late, activitiesById, { country: COUNTRY, months: 6 });
  assert.deepEqual(ended.ended, [{ personId: 'p_kid', activityId: 'gym', payerId: 'p_dad' }]);
  assert.deepEqual(ended.peopleById.p_kid.enrollments, {});

  const rich = { ...late, p_dad: { ...late.p_dad, money: 200 } };
  const settled = chargeEnrollments(rich, activitiesById, { country: COUNTRY, months: 6 });
  assert.deepEqual(settled.paid, [{ personId: 'p_kid', activityId: 'gym', payerId: 'p_dad', amount: 10 * (ENROLLMENT_GRACE_MONTHS + 6) }]);
  assert.deepEqual(settled.peopleById.p_kid.enrollments.gym, { since: 0, payerId: 'p_dad' });
});

test('leaveEnrollment ends one enrollment', () => {
  const people = { p_kid: { id: 'p_kid', enrollments: { bjj: { since: 0, payerId: 'p_mom' } } } };
  assert.equal(isEnrolled(leaveEnrollment(people, 'p_kid', 'bjj').p_kid, 'bjj'), false);
});

test('enrollment data: fee scale, ages, chance factors and texts', () => {
  const withEnrollment = Object.values(loadActivities(ACTIVITIES_DIR)).filter((a) => a.enrollment);
  assert.ok(withEnrollment.some((a) => a.id === 'bjj'));
  for (const activity of withEnrollment) {
    const { enrollment } = activity;
    assert.ok(['small', 'medium', 'large'].includes(enrollment.monthlyFee), activity.id);
    assert.equal(monthlyFee(activity, COUNTRY) > 0, true);
    assert.equal(activity.cost, undefined, `${activity.id}: an enrolled activity is paid monthly, not per session`);
    assert.ok(enrollment.selfPayMinAge <= enrollment.permissionUnder, activity.id);
    assert.equal(typeof enrollment.permission.base, 'number', activity.id);
  }
  for (const key of [
    'ui.activity_notEnrolled',
    'ui.enroll_fee',
    'ui.enroll_ask_parents',
    'ui.enroll_self',
    'ui.enroll_leave',
    'ui.enrolled_parents',
    'ui.enrolled_self',
    'ui.enroll_asked',
    'ui.enroll_no_money',
    'ui.enroll_parents_no_money',
    'ui.enroll_no_parent',
    'diary.enrolled.parents',
    'diary.enrolled.self',
    'diary.enrolled.alone',
    'diary.enrollment_refused',
    'diary.enrollment_left',
    'diary.enrollment_ended',
  ]) {
    assert.ok(LOCALE[key], key);
  }
});

test('askParentPermission: minors ask the parent who likes them most; adults need nobody', () => {
  const yes = askParentPermission(ACTIVITY, { ...family(), rng: always });
  assert.deepEqual([yes.allowed, yes.parentId], [true, 'p_mom']);
  const no = askParentPermission(ACTIVITY, { ...family(), rng: never });
  assert.deepEqual([no.allowed, no.parentId], [false, 'p_mom']);
  assert.equal(no.relationshipsById.r_1.affinity.p_kid, 58, 'the failure effects apply');
  const adult = askParentPermission(ACTIVITY, { ...family({ ageYears: 18 }), rng: never });
  assert.deepEqual([adult.allowed, adult.parentId], [true, null]);
});

test('the diary warns about a late fee', () => {
  const locale = createLocale(LOCALE);
  assert.equal(
    enrollmentLine({}, locale, { type: 'enrollmentLate', activityId: 'bjj', owedMonths: 6 }),
    'Jiu-jitsu: a mensalidade está atrasada há 6 meses. Se continuar sem pagar, a matrícula será cancelada.',
  );
});
