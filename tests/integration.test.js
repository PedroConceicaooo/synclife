import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRng } from '../src/engine/random.js';
import { toMonthIndex, advance, ageAt } from '../src/engine/time.js';
import { createPerson } from '../src/engine/person.js';
import { createIdGenerator } from '../src/engine/id.js';
import { generateParents, createFamilyRelationships } from '../src/systems/family.js';
import { decayAll, resetInteractionsThisPeriod } from '../src/systems/relationship.js';
import { loadInteractions, attemptInteraction } from '../src/systems/interactions.js';
import { loadActivities, attemptActivity } from '../src/systems/activities.js';
import { payAllowance, transferMoney } from '../src/systems/money.js';

const INTERACTIONS_DIR = fileURLToPath(new URL('../data/interactions/', import.meta.url));
const ACTIVITIES_DIR = fileURLToPath(new URL('../data/activities/', import.meta.url));
const COUNTRY = { id: 'BR', currency: { scale: { small: 25, medium: 125, large: 500 } } };

function runShortLife(seed) {
  const rng = createRng(seed);
  const nextPersonId = createIdGenerator('p');
  const nextRelationshipId = createIdGenerator('r');
  const askMoney = loadInteractions(INTERACTIONS_DIR).ask_money;
  const mowLawn = loadActivities(ACTIVITIES_DIR).mow_lawn;

  const birth = toMonthIndex({ year: 2000, month: 1 });
  const person = createPerson({ id: nextPersonId(), sex: 'M', birth, countryId: COUNTRY.id });
  const { mother, father } = generateParents(rng, person, nextPersonId, COUNTRY);
  const [motherChild, fatherChild, marriage] = createFamilyRelationships(
    rng,
    { child: person, mother, father },
    nextRelationshipId,
    person.birth,
  );

  let people = { [person.id]: person, [mother.id]: mother, [father.id]: father };
  let relationships = { [motherChild.id]: motherChild, [fatherChild.id]: fatherChild, [marriage.id]: marriage };
  let currentMonth = person.birth;

  for (let i = 0; i < 20; i++) {
    const step = rng.chance(0.5) ? 6 : 12;
    const { nextMonthIndex } = advance(currentMonth, step, person.birth);
    currentMonth = nextMonthIndex;
    relationships = decayAll(relationships, step);
    relationships = resetInteractionsThisPeriod(relationships);

    for (const [parent, relationshipId] of [
      [mother, motherChild.id],
      [father, fatherChild.id],
    ]) {
      const result = attemptInteraction(askMoney, {
        relationship: relationships[relationshipId],
        player: person,
        target: parent,
        peopleById: people,
        relationshipsById: relationships,
        country: COUNTRY,
        currentMonthIndex: currentMonth,
        rng,
      });
      relationships = result.relationshipsById;
      people = result.peopleById;
    }

    const activityResult = attemptActivity(mowLawn, {
      player: person,
      peopleById: people,
      country: COUNTRY,
      currentMonthIndex: currentMonth,
    });
    people = activityResult.peopleById;

    const age = ageAt(person.birth, currentMonth);
    if (age >= 3) {
      for (const [parent, relationshipId] of [
        [mother, motherChild.id],
        [father, fatherChild.id],
      ]) {
        const amount = payAllowance({ parent: people[parent.id], relationship: relationships[relationshipId], country: COUNTRY, step });
        people = transferMoney(people, parent.id, person.id, amount);
      }
    }
  }

  return {
    money: Object.fromEntries(Object.values(people).map((p) => [p.id, p.money])),
    affinity: Object.fromEntries(Object.values(relationships).map((r) => [r.id, r.affinity])),
    traits: Object.fromEntries(Object.values(people).map((p) => [p.id, p.traits])),
  };
}

test('a short multi-period life produces identical money, affinity and traits for the same seed', () => {
  assert.deepEqual(runShortLife(2024), runShortLife(2024));
});

test('different seeds produce different outcomes', () => {
  assert.notDeepEqual(runShortLife(1), runShortLife(2));
});
