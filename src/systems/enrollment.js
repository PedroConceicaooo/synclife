// Enrollment (docs/atividades.md, "Quem paga e quem autoriza"): activities
// with an `enrollment` block need one before the first session, and cost a
// monthly fee instead of a price per session.
//
//   under selfPayMinAge   the parents must agree, and they pay
//   up to permissionUnder the parents must agree; the player may pay
//   from then on          the player decides and pays
//
// The state lives on the person who trains:
//   person.enrollments[activityId] = { since, payerId }

import { ageAt } from '../engine/time.js';
import { applyEffects } from '../engine/effects.js';
import { resolveAmount } from './money.js';
import { resolveChance } from './interactions.js';

export function monthlyFee(activity, country) {
  return resolveAmount(activity.enrollment.monthlyFee, country);
}

export function isEnrolled(person, activityId) {
  return Boolean(person.enrollments?.[activityId]);
}

// Who can pay, as the screen offers it: 'parents', 'self' or both.
export function payerOptions(activity, person, monthIndex) {
  const age = ageAt(person.birth, monthIndex);
  return age < activity.enrollment.selfPayMinAge ? ['parents'] : ['parents', 'self'];
}

function needsPermission(activity, person, monthIndex) {
  return ageAt(person.birth, monthIndex) < activity.enrollment.permissionUnder;
}

// The parent who is asked: the one who likes the player most (each side of
// a relationship has its own affinity, rule 9).
export function parentToAsk(playerId, relationshipsById) {
  const parents = Object.values(relationshipsById)
    .filter((r) => playerId in r.roles && ['son', 'daughter'].includes(r.roles[playerId]))
    .map((r) => ({ relationship: r, parentId: Object.keys(r.roles).find((id) => id !== playerId) }));
  if (parents.length === 0) return null;
  return parents.reduce((best, p) => (p.relationship.affinity[p.parentId] > best.relationship.affinity[best.parentId] ? p : best));
}

function enroll(peopleById, playerId, activityId, payerId, monthIndex) {
  const player = peopleById[playerId];
  return { ...peopleById, [playerId]: { ...player, enrollments: { ...player.enrollments, [activityId]: { since: monthIndex, payerId } } } };
}

// payer: 'parents' or 'self'. Returns { enrolled, reason, askedParentId,
// peopleById, relationshipsById }; reason is 'money' (the payer can't
// afford the first month), 'refused' (the parent said no) or 'noParent'.
export function requestEnrollment(activity, { payer, playerId, peopleById, relationshipsById, country, currentMonthIndex, rng }) {
  const player = peopleById[playerId];
  const fee = monthlyFee(activity, country);
  const unchanged = { peopleById, relationshipsById, askedParentId: null };
  if (payer === 'self' && player.money < fee) return { enrolled: false, reason: 'money', ...unchanged };

  if (payer === 'self' && !needsPermission(activity, player, currentMonthIndex)) {
    return { enrolled: true, ...unchanged, peopleById: enroll(peopleById, playerId, activity.id, playerId, currentMonthIndex) };
  }

  const asked = parentToAsk(playerId, relationshipsById);
  if (!asked) return { enrolled: false, reason: 'noParent', ...unchanged };
  const parent = peopleById[asked.parentId];
  if (payer === 'parents' && parent.money < fee) return { enrolled: false, reason: 'money', ...unchanged, askedParentId: parent.id };

  const accepted = rng.chance(
    resolveChance(activity.enrollment.permission, {
      relationship: asked.relationship,
      targetPersonId: parent.id,
      target: parent,
      player,
      relationshipsById,
      peopleById,
      playerId,
      country,
      parentPays: payer === 'parents',
    }),
  );
  const effects = (accepted ? activity.enrollment.success : activity.enrollment.failure) ?? [];
  const result = applyEffects(effects, {
    relationship: asked.relationship,
    relationshipsById,
    peopleById,
    playerId,
    country,
    rng,
    currentMonthIndex,
  });
  const payerId = payer === 'parents' ? parent.id : playerId;
  return {
    enrolled: accepted,
    reason: accepted ? null : 'refused',
    askedParentId: parent.id,
    relationshipsById: result.relationshipsById,
    peopleById: accepted ? enroll(result.peopleById, playerId, activity.id, payerId, currentMonthIndex) : result.peopleById,
  };
}

export function leaveEnrollment(peopleById, personId, activityId) {
  const person = peopleById[personId];
  const { [activityId]: _left, ...enrollments } = person.enrollments ?? {};
  return { ...peopleById, [personId]: { ...person, enrollments } };
}

// Every advance: each enrollment costs fee × months to whoever pays it. One
// the payer can no longer afford ends. Returns the payments and the ends
// for the diary.
export function chargeEnrollments(peopleById, activitiesById, { country, months }) {
  let people = peopleById;
  const paid = [];
  const ended = [];
  for (const person of Object.values(peopleById)) {
    for (const [activityId, { payerId }] of Object.entries(person.enrollments ?? {})) {
      const activity = activitiesById[activityId];
      const amount = activity?.enrollment ? monthlyFee(activity, country) * months : 0;
      const payer = people[payerId];
      if (!payer || payer.money < amount) {
        people = leaveEnrollment(people, person.id, activityId);
        ended.push({ personId: person.id, activityId, payerId });
        continue;
      }
      people = { ...people, [payerId]: { ...payer, money: payer.money - amount } };
      paid.push({ personId: person.id, activityId, payerId, amount });
    }
  }
  return { peopleById: people, paid, ended };
}
