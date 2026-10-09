import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/engine/random.js';
import { createPerson } from '../src/engine/person.js';
import { createRelationship } from '../src/systems/relationship.js';
import { addChild, childrenOf } from '../src/systems/birth.js';
import { applyEffects } from '../src/engine/effects.js';
import { evaluateConditions } from '../src/engine/conditions.js';

function family() {
  const player = createPerson({ id: 'p_0001', sex: 'F', birth: 0, countryId: 'BR' });
  const mother = createPerson({ id: 'p_0002', sex: 'F', birth: -360, countryId: 'BR' });
  const father = createPerson({ id: 'p_0003', sex: 'M', birth: -380, countryId: 'BR' });
  const r = (id, roles, type = 'family', state = null) =>
    createRelationship({ id, roles, type, state, affinity: Object.fromEntries(Object.keys(roles).map((k) => [k, 70])), since: 0 });
  const relationshipsById = {
    r_0001: r('r_0001', { p_0002: 'mother', p_0001: 'daughter' }),
    r_0002: r('r_0002', { p_0003: 'father', p_0001: 'daughter' }),
    r_0003: r('r_0003', { p_0002: 'wife', p_0003: 'husband' }, 'romantic', 'married'),
  };
  return { peopleById: { p_0001: player, p_0002: mother, p_0003: father }, relationshipsById };
}

test('childrenOf lists the children of a parent', () => {
  const { relationshipsById } = family();
  assert.deepEqual(childrenOf('p_0002', relationshipsById), ['p_0001']);
  assert.deepEqual(childrenOf('p_0001', relationshipsById), []);
});

test('addChild creates a newborn with the next ids, linked to both parents and to the existing child', () => {
  const { peopleById, relationshipsById } = family();
  const result = addChild(createRng(5), { parentIds: ['p_0002', 'p_0003'], peopleById, relationshipsById, monthIndex: 30 });

  assert.equal(result.childId, 'p_0004');
  const child = result.peopleById.p_0004;
  assert.equal(child.birth, 30);
  assert.equal(child.countryId, 'BR');
  assert.ok(child.aptitudes);

  const added = Object.values(result.relationshipsById).filter((r) => 'p_0004' in r.roles);
  assert.deepEqual(added.map((r) => r.id), ['r_0004', 'r_0005', 'r_0006']);
  assert.equal(added[0].roles.p_0002, 'mother');
  assert.equal(added[1].roles.p_0003, 'father');
  assert.equal(added[2].roles.p_0001, 'sister');
  assert.ok(['brother', 'sister'].includes(added[2].roles.p_0004));
  assert.deepEqual(childrenOf('p_0002', result.relationshipsById).sort(), ['p_0001', 'p_0004']);
});

test('addChild is deterministic for a fixed seed', () => {
  const run = () => addChild(createRng(9), { parentIds: ['p_0002', 'p_0003'], ...family(), monthIndex: 30 });
  assert.deepEqual(run(), run());
});

test('haveChild effect adds a child to the firing couple', () => {
  const { peopleById, relationshipsById } = family();
  const result = applyEffects([{ op: 'haveChild' }], {
    relationship: relationshipsById.r_0003,
    relationshipsById,
    peopleById,
    playerId: 'p_0001',
    rng: createRng(1),
    currentMonthIndex: 30,
  });
  assert.ok(result.peopleById.p_0004);
});

test('affinity with a targetRole list picks the newest matching relationship', () => {
  const { peopleById, relationshipsById } = family();
  let state = addChild(createRng(1), { parentIds: ['p_0002', 'p_0003'], peopleById, relationshipsById, monthIndex: 30 });
  state = addChild(createRng(2), { parentIds: ['p_0002', 'p_0003'], peopleById: state.peopleById, relationshipsById: state.relationshipsById, monthIndex: 60 });

  const result = applyEffects([{ op: 'affinity', side: 'target', delta: 10, targetRole: ['brother', 'sister'] }], {
    relationship: state.relationshipsById.r_0003,
    relationshipsById: state.relationshipsById,
    peopleById: state.peopleById,
    playerId: 'p_0001',
  });
  const withNewest = Object.values(result.relationshipsById).find((r) => 'p_0001' in r.roles && 'p_0005' in r.roles);
  const withOlder = Object.values(result.relationshipsById).find((r) => 'p_0001' in r.roles && 'p_0004' in r.roles);
  assert.equal(withNewest.affinity.p_0005, 60);
  assert.equal(withOlder.affinity.p_0004, 50);
});

test('maxChildren and roleMaxAge gate a couple having another child', () => {
  const { peopleById, relationshipsById } = family();
  const marriage = relationshipsById.r_0003;
  const context = { peopleById, relationshipsById, currentMonthIndex: 0 }; // mother 30, father 31

  assert.equal(evaluateConditions({ maxChildren: 2 }, marriage, context), true);
  assert.equal(evaluateConditions({ maxChildren: 1 }, marriage, context), false);
  assert.equal(evaluateConditions({ roleMaxAge: { wife: 30 } }, marriage, context), true);
  assert.equal(evaluateConditions({ roleMaxAge: { wife: 29 } }, marriage, context), false);
});

test('targetMinAge looks at the other person of an interaction', () => {
  const context = { target: { birth: 0 }, currentMonthIndex: 36 };
  assert.equal(evaluateConditions({ targetMinAge: 3 }, {}, context), true);
  assert.equal(evaluateConditions({ targetMinAge: 4 }, {}, context), false);
});
