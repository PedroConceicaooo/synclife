// Turns the engine's history (ids and numbers) into diary text. Pure — no
// DOM — so it is tested in Node; render.js only puts the result on screen.

import { fullName } from '../systems/naming.js';
import { ageAt } from '../engine/time.js';

const STAT_ORDER = ['happiness', 'health', 'intelligence', 'looks'];

function relationTo(state, personId) {
  const relationship = Object.values(state.relationships).find((r) => personId in r.roles && state.player.id in r.roles);
  return relationship ? relationship.roles[personId] : null;
}

// "minha mãe", "meu irmão Theo", "a professora Sato"
function who(state, locale, personId) {
  const person = state.people[personId];
  const key = person.species ? `diary.who.pet.${person.species}` : `diary.who.${relationTo(state, personId)}`;
  return locale.format(key, { name: person.firstName, lastName: person.lastName }, { self: person.sex });
}

function newClassLine(state, locale, entry) {
  const classmates = locale.list(entry.classmateIds.map((id) => state.people[id].firstName));
  const teachers = locale.list(
    entry.teacherIds.map((id) => {
      const teacher = state.people[id];
      return locale.format('diary.teacher_name', { lastName: teacher.lastName }, { self: teacher.sex });
    }),
  );
  return [locale.format('diary.new_class', { names: classmates }), locale.format('diary.new_teachers', { names: teachers })].join(' ');
}

function introLines(state, locale) {
  const { player, country } = state;
  const lines = [
    locale.format(
      'diary.intro.born',
      { city: locale.t(`city.${player.cityId}`), country: locale.t(`country.${country.id}`), month: locale.monthName(player.birth), name: fullName(player, country) },
      { player: player.sex },
    ),
  ];
  return [...lines, ...parentLines(state, locale, player.birth)];
}

// Parents with their age at `month`.
function parentLines(state, locale, month) {
  return [state.people[state.mother.id], state.people[state.father.id]].map((parent) =>
    locale.format(`diary.intro.${relationTo(state, parent.id)}`, {
      name: fullName(parent, state.country),
      occupation: locale.format(`occupation.${parent.occupation.title}`, {}, { self: parent.sex }),
      age: locale.plural('age.years', ageAt(parent.birth, month)),
    }),
  );
}

// First block of a life carried on by a sibling at 18.
function continueLines(state, locale, entry, month) {
  const player = state.people[state.player.id];
  const previous = state.people[entry.previousId];
  return [
    locale.format('diary.continue.me', {
      name: fullName(player, state.country),
      age: locale.plural('age.years', ageAt(player.birth, month)),
    }),
    locale.format('diary.continue.previous', { name: previous.firstName }, { previous: previous.sex }),
    ...parentLines(state, locale, month),
  ];
}

function babyBornLine(state, locale, month) {
  const baby = Object.values(state.people).find((p) => p.birth === month && p.id !== state.player.id);
  if (!baby) return locale.t('event.new_baby.text');
  return locale.format('diary.new_baby', { name: baby.firstName }, { baby: baby.sex });
}

function moneyLine(entry, state, locale) {
  const amount = locale.money(Math.abs(entry.amount), state.country.currency.code, state.country.currency.display);
  if (entry.amount > 0) return locale.format('diary.money.gain', { amount });
  const spent = entry.source === 'activity' || entry.source === 'asset' || entry.source === 'enrollment';
  return locale.format(spent ? 'diary.money.spent' : 'diary.money.lost', { amount });
}

// Shared with the Activities screen, which shows the same line right after
// a session.
export function trainingLine(locale, activityId, { gain, technique }) {
  const activity = locale.t(`activity.${activityId}.title`);
  if (!technique) return locale.format(gain > 0 ? 'diary.training' : 'diary.training_max', { activity, gain });
  // An activity may word it its own way (running: "completei 10 km").
  const own = `activity.${activityId}.training_technique`;
  return locale.format(locale.has(own) ? own : 'diary.training_technique', { activity, gain, technique: locale.t(`technique.${activityId}.${technique}`) });
}

// Level up, failed exam, stripe and injury: the other lines a session can
// write. `entry` has the diary entry's shape ({ type, activityId, ... }).
export function trainingEventLine(locale, entry, sex) {
  const activity = locale.t(`activity.${entry.activityId}.title`);
  const sexes = { player: sex };
  switch (entry.type) {
    case 'levelUp': {
      // A level may have its own line (capoeira's first cord comes at the batizado).
      const own = `activity.${entry.activityId}.level_up.${entry.levelId}`;
      return locale.format(locale.has(own) ? own : 'diary.level_up', { activity, level: locale.t(`level.${entry.activityId}.${entry.levelId}`) }, sexes);
    }
    case 'examFailed':
      return locale.format('diary.exam_failed', { activity, level: locale.t(`level.${entry.activityId}.${entry.levelId}`) }, sexes);
    case 'stripe':
      return locale.format('diary.stripe', { activity, count: entry.stripe, level: locale.t(`level.${entry.activityId}.${entry.levelId}`) });
    case 'injury':
      return locale.format('diary.injury', { activity }, sexes);
    case 'competition':
      return locale.format(`diary.competition.${entry.place}`, { activity, tier: locale.t(`competitionTier.${entry.tier}`) }, sexes);
    default:
      return null;
  }
}

// Enrollment entries (enrollment.js); the Activities screen shows the same
// line right after asking.
export function enrollmentLine(state, locale, entry) {
  const activity = locale.t(`activity.${entry.activityId}.title`);
  switch (entry.type) {
    case 'enrolled':
      if (!entry.parentId) return locale.format('diary.enrolled.alone', { activity });
      return locale.format(`diary.enrolled.${entry.payer}`, { activity, parent: who(state, locale, entry.parentId) });
    case 'enrollmentRefused':
      return locale.format('diary.enrollment_refused', { activity, parent: who(state, locale, entry.parentId) });
    case 'enrollmentLeft':
      return locale.format('diary.enrollment_left', { activity });
    // Asking the parents to pay (parentPayment.js).
    case 'parentsPaid':
      return locale.format('diary.parents_paid', { activity, parent: who(state, locale, entry.parentId) });
    case 'parentsDidNotPay': {
      if (!entry.parentId) return null;
      const key = entry.reason === 'parentNoMoney' ? 'diary.parents_no_money' : 'diary.parents_refused';
      return locale.format(key, { activity, parent: who(state, locale, entry.parentId) });
    }
    case 'enrollmentLate':
      return locale.format('diary.enrollment_late', { activity, months: locale.plural('age.months', entry.owedMonths) });
    case 'enrollmentEnded':
      return locale.format('diary.enrollment_ended', { activity });
    default:
      return null;
  }
}

// A club's name: its pattern with the city in it, in the city's
// international form when the locale has one ("London Lanterns").
export function clubName(locale, club) {
  const cityKey = locale.has(`clubCity.${club.cityId}`) ? `clubCity.${club.cityId}` : `city.${club.cityId}`;
  return locale.format(`clubPattern.${club.namePattern}`, { city: locale.t(cityKey) });
}

// "time da escola" or "sub-15 do Tucanos de Recife"; club is null for the
// school team.
export function teamName(locale, teamLevelId, club) {
  return club
    ? locale.format('tryout.team.club', { level: locale.t(`teamLevel.${teamLevelId}`), club: clubName(locale, club) })
    : locale.t('tryout.team.school');
}

// The coach's words after a tryout (tryouts.js); the score is never shown.
export function tryoutLine(locale, entry, club) {
  return locale.format(`diary.tryout.${entry.passed ? 'passed' : 'failed'}`, {
    activity: locale.t(`activity.${entry.activityId}.title`),
    team: teamName(locale, entry.teamLevelId, club),
    praise: locale.t(`tryout.praise.${entry.praise}`),
    critique: entry.critique ? locale.t(`tryout.critique.${entry.critique}`) : '',
  });
}

// A club tryout signed up for ahead of its window; parent is who allowed
// it ("minha mãe"), when a minor had to ask.
export function tryoutSignupLine(locale, entry, club, parent = null) {
  return locale.format(parent ? 'diary.tryout_signup.allowed' : 'diary.tryout_signup', {
    activity: locale.t(`activity.${entry.activityId}.title`),
    team: teamName(locale, entry.teamLevelId, club),
    month: locale.monthName(entry.month),
    parent,
  });
}

// The end-of-year review of a team (teams.js): kept, promoted, released
// or left with school.
export function teamSeasonLine(locale, entry, club, sex) {
  return locale.format(
    `diary.team.${entry.outcome}`,
    { activity: locale.t(`activity.${entry.activityId}.title`), team: teamName(locale, entry.teamLevelId, club) },
    { player: sex },
  );
}

// A barber, a hairdresser: the "done" text with the new look in it.
export function makeoverLine(locale, activityId, look, sex) {
  return locale.format(
    `activity.${activityId}.done`,
    { style: locale.t(`hairStyle.${look.hairStyle}`), color: locale.t(`hairColor.${look.hairColor}`) },
    { player: sex },
  );
}

// Lines about teams and tryouts (teams.js, scout.js); the Activities screen
// shows the same ones right after acting.
export function teamEntryLine(state, locale, entry) {
  switch (entry.type) {
    case 'tryout':
      return tryoutLine(locale, entry, entry.clubId ? state.clubsById[entry.clubId] : null);
    case 'tryoutSignup':
      return tryoutSignupLine(locale, entry, state.clubsById[entry.clubId], entry.parentId ? who(state, locale, entry.parentId) : null);
    case 'teamJoined':
      return locale.format(entry.parentId ? 'diary.team_joined.allowed' : 'diary.team_joined', {
        activity: locale.t(`activity.${entry.activityId}.title`),
        team: teamName(locale, entry.teamLevelId, state.clubsById[entry.clubId]),
        parent: entry.parentId ? who(state, locale, entry.parentId) : '',
      });
    case 'scoutRefused':
      return locale.format('diary.scout_refused', {
        activity: locale.t(`activity.${entry.activityId}.title`),
        club: clubName(locale, state.clubsById[entry.clubId]),
        parent: who(state, locale, entry.parentId),
      });
    case 'tryoutRefused':
      return locale.format('diary.tryout_refused', {
        activity: locale.t(`activity.${entry.activityId}.title`),
        club: clubName(locale, state.clubsById[entry.clubId]),
        parent: who(state, locale, entry.parentId),
      });
    case 'teamSeason':
      return teamSeasonLine(locale, entry, entry.clubId ? state.clubsById[entry.clubId] : null, state.player.sex);
    // League games of one advance (games.js).
    case 'teamGames': {
      const activity = locale.t(`activity.${entry.activityId}.title`);
      const draws = state.activitiesById?.[entry.activityId]?.teamGames?.draws ?? entry.drawn > 0;
      return locale.format(draws ? 'diary.team_games.draws' : 'diary.team_games.no_draws', {
        activity,
        played: locale.plural('diary.games', entry.played),
        team: teamName(locale, entry.teamLevelId, entry.clubId ? state.clubsById[entry.clubId] : null),
        won: locale.plural('diary.wins', entry.won),
        drawn: locale.plural('diary.draws', entry.drawn),
        lost: locale.plural('diary.losses', entry.lost),
        role: locale.t(`diary.role.${entry.role}`),
      });
    }
    // A season of a club the player plays for (clubSeasons.js).
    case 'clubSeason':
      return locale.format('diary.club_season', {
        club: clubName(locale, state.clubsById[entry.clubId]),
        season: entry.season,
        position: entry.position,
        league: locale.t(`league.${entry.leagueId}`),
      });
    // A school tryout chosen in an event that its rules didn't allow.
    case 'tryoutBlocked': {
      const key = `diary.tryout_blocked.${entry.reason}`;
      return locale.has(key) ? locale.format(key, { activity: locale.t(`activity.${entry.activityId}.title`) }) : null;
    }
    default:
      return null;
  }
}

function entryLine(entry, state, locale, block, index) {
  // Event, activity and interaction texts may use {player|o|a}, and may
  // have variants: the block and line pick one, always the same.
  const text = (key) => locale.format(key, {}, { player: state.player.sex }, `${block.month}:${index}`);
  switch (entry.type) {
    case 'birthday':
      return locale.format('diary.birthday', { age: locale.plural('age.years', entry.age) });
    case 'assetBought': {
      const item = text(`asset.${entry.assetId}.title`);
      const free = !state.assetsById?.[entry.assetId]?.price;
      return locale.format(free ? 'diary.account_created' : 'diary.asset_bought', { item });
    }
    case 'assetSold':
      return locale.format('diary.asset_sold', { item: text(`asset.${entry.assetId}.title`) });
    case 'traitFormed': {
      const trait = locale.format(`trait.${entry.trait}`, {}, { self: state.player.sex });
      return locale.format('diary.trait_formed', { trait });
    }
    case 'emotion': {
      const emotion = locale.format(`mood.${entry.emotion}`, {}, { self: state.player.sex }).toLocaleLowerCase(locale.language);
      return locale.format('diary.emotion', { emotion });
    }
    case 'newClass':
      return newClassLine(state, locale, entry);
    case 'newFriend': {
      const friend = state.people[entry.personId];
      return locale.format('diary.new_friend', { name: friend.firstName }, { self: friend.sex });
    }
    case 'schoolStage': {
      const localKey = `school.${state.country.id}.${entry.stageId}`;
      const stage = locale.t(locale.has(localKey) ? localKey : `school.${entry.stageId}`);
      return locale.format('diary.school_stage', { stage });
    }
    case 'event':
      if (entry.succeeded !== undefined) return text(`event.${entry.eventId}.${entry.succeeded ? 'success' : 'failure'}`);
      if (!entry.optionId) return text(`event.${entry.eventId}.text`);
      return locale.format('diary.choice', {
        // A scout's invitation names its club.
        prompt: entry.clubId
          ? locale.format(`event.${entry.eventId}.prompt`, { club: clubName(locale, state.clubsById[entry.clubId]) }, { player: state.player.sex })
          : text(`event.${entry.eventId}.prompt`),
        option: text(`event.${entry.eventId}.option.${entry.optionId}`),
      });
    case 'worldEvent':
      return entry.eventId === 'new_baby' ? babyBornLine(state, locale, block.month) : text(`event.${entry.eventId}.text`);
    case 'activity':
      if (entry.look) return makeoverLine(locale, entry.activityId, entry.look, state.player.sex);
      return text(`activity.${entry.activityId}.${entry.succeeded === false ? 'failed' : 'done'}`);
    case 'training':
      return trainingLine(locale, entry.activityId, entry);
    case 'enrolled':
    case 'enrollmentRefused':
    case 'enrollmentLeft':
    case 'enrollmentLate':
    case 'enrollmentEnded':
    case 'parentsPaid':
    case 'parentsDidNotPay':
      return enrollmentLine(state, locale, entry);
    case 'levelUp':
    case 'examFailed':
    case 'stripe':
    case 'injury':
    case 'competition':
      return trainingEventLine(locale, entry, state.player.sex);
    case 'tryout':
    case 'tryoutSignup':
    case 'teamJoined':
    case 'scoutRefused':
    case 'tryoutRefused':
    case 'teamSeason':
    case 'tryoutBlocked':
    case 'teamGames':
    case 'clubSeason':
      return teamEntryLine(state, locale, entry);
    case 'interaction':
      return locale.format('diary.interaction', {
        label: text(`interaction.${entry.interactionId}.label`),
        who: who(state, locale, entry.targetId),
        result: text(`interaction.${entry.interactionId}.${entry.succeeded ? 'success' : 'failure'}`),
      });
    case 'money':
      // 'stipend' is the athlete allowance in saves made before it got its name.
      if (entry.source === 'athleteAllowance' || entry.source === 'stipend') {
        const amount = locale.money(entry.amount, state.country.currency.code, state.country.currency.display);
        return locale.format('diary.athlete_allowance', { club: clubName(locale, state.clubsById[entry.clubId]), amount });
      }
      return entry.source === 'allowance' ? null : moneyLine(entry, state, locale);
    default:
      return null; // birth (intro), stat and allowance are summarized per block
  }
}

function allowanceLine(entries, state, locale) {
  const total = entries.filter((e) => e.type === 'money' && e.source === 'allowance').reduce((sum, e) => sum + e.amount, 0);
  return total > 0 ? locale.format('diary.allowance', { amount: locale.money(total, state.country.currency.code, state.country.currency.display) }) : null;
}

function statsLine(entries, locale) {
  const totals = {};
  for (const e of entries.filter((e) => e.type === 'stat')) totals[e.stat] = (totals[e.stat] ?? 0) + e.delta;
  const parts = STAT_ORDER.filter((stat) => Math.round(totals[stat] ?? 0) !== 0).map((stat) => {
    const delta = Math.round(totals[stat]);
    return `${locale.t(`ui.stat_${stat}`)} ${delta > 0 ? '+' : '−'}${Math.abs(delta)}`;
  });
  return parts.length > 0 ? parts.join(' · ') : null;
}

// kind lets the screen style a line: choice, money, stats or plain text.
function entryKind(entry) {
  if (entry.type === 'event' && entry.optionId) return 'choice';
  if (entry.type === 'money') return 'money';
  if (entry.type === 'levelUp') return 'choice';
  if (entry.type === 'competition' && entry.place !== 'out') return 'choice';
  return 'text';
}

export function describeBlock(block, state, locale) {
  const header = locale.format('diary.header', { age: locale.age(block.month - state.player.birth) });
  const isIntro = block.entries.some((e) => e.type === 'birth');
  const continued = block.entries.find((e) => e.type === 'continue');
  const opening = isIntro ? introLines(state, locale) : continued ? continueLines(state, locale, continued, block.month) : [];
  const lines = [
    ...opening.map((text) => ({ kind: 'text', text })),
    ...block.entries.map((e, index) => ({ kind: entryKind(e), text: entryLine(e, state, locale, block, index) })),
    { kind: 'money', text: allowanceLine(block.entries, state, locale) },
    { kind: 'stats', text: statsLine(block.entries, locale) },
  ].filter((line) => line.text);
  return { header, lines };
}

export function describeHistory(state, locale) {
  return state.history.map((block) => describeBlock(block, state, locale));
}
