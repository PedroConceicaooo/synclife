// Navigation of the Activities tab in levels (design doc, "Navegação da aba
// Atividades"). Pure, no DOM: it turns the activities the player can see
// (availableActivities) and a path into the page to draw.
//
// A path is the list of ids from the tab's start:
//   []                                   level 1: category cards
//   ['physical']                         level 2: subcategory cards, or the list
//   ['physical', 'martial_arts']         level 3: the list of the subcategory
//   ['physical', 'martial_arts', 'judo'] level 4: the modality page
//   [..., 'football', 'clubs']           the clubs and tryouts of a team sport
//   ['body_care', 'barbershop']          a makeover (cut, color) page

// Level 1 order, as in the design doc.
export const HOME_CATEGORIES = ['odd_jobs', 'leisure', 'physical', 'body_care', 'crime'];
const GROUP_ORDER = ['sports', 'martial_arts', 'dance'];

export const CLUBS_PAGE = 'clubs';

// Done this period: dimmed and at the end of a list.
const DONE_BLOCKERS = ['limit', 'competed'];

export function isDone(item) {
  return DONE_BLOCKERS.includes(item.blocker);
}

// Only modalities with training, a team, an enrollment or competitions get
// a page of their own; the rest (an odd job) is done from its row.
export function hasModalityPage(item) {
  return Boolean(item.levelId || item.enrollment || item.teamSport || item.competition);
}

// What a row shows on its right: done, needs enrollment, enrolled, another
// reason it can't be done now ("blocked", with the blocker), or nothing.
export function itemStatus(item) {
  if (isDone(item)) return 'done';
  if (item.blocker === 'notEnrolled') return 'needsEnrollment';
  if (item.enrollment?.enrolled) return 'enrolled';
  if (item.blocker) return 'blocked';
  return 'available';
}

// Done items go last; the rest keep their order (by age, then id).
export function sortItems(items) {
  return [...items.filter((i) => !isDone(i)), ...items.filter(isDone)];
}

function byOrder(order) {
  return (a, b) => (order.indexOf(a) === -1 ? order.length : order.indexOf(a)) - (order.indexOf(b) === -1 ? order.length : order.indexOf(b)) || a.localeCompare(b);
}

function categoryItems(groups, category) {
  return groups.find((g) => g.category === category)?.activities ?? [];
}

// Cards of a category page: one per subcategory (group). Items without a
// group sit in the list under the cards.
function groupCards(items) {
  const groups = [...new Set(items.filter((i) => i.group).map((i) => i.group))].sort(byOrder(GROUP_ORDER));
  return groups.map((id) => {
    const members = items.filter((i) => i.group === id);
    return { kind: 'group', id, count: members.length, enrolled: members.filter((i) => i.enrollment?.enrolled).length };
  });
}

function homePage(groups) {
  const cards = HOME_CATEGORIES.map((id) => ({ kind: 'category', id, count: categoryItems(groups, id).length })).filter((c) => c.count > 0);
  return { kind: 'home', level: 1, path: [], cards, items: [] };
}

// The page for a path. A path that no longer fits (the player outgrew or
// can no longer see an item) falls back to its deepest valid part.
export function activityPage(groups, path = []) {
  const [category, ...rest] = path;
  const items = categoryItems(groups, category);
  if (items.length === 0) return homePage(groups);

  let page = { kind: 'category', level: 2, path: [category], category, cards: groupCards(items), items: sortItems(items.filter((i) => !i.group)) };
  let pool = items;
  let next = rest;

  const group = next[0];
  if (group && page.cards.some((c) => c.id === group)) {
    pool = items.filter((i) => i.group === group);
    page = { kind: 'group', level: 3, path: [category, group], category, group, cards: [], items: sortItems(pool) };
    next = next.slice(1);
  }

  const item = pool.find((i) => i.id === next[0] && (i.group ?? null) === (page.group ?? null));
  if (!item) return page;
  if (item.makeover) return { kind: 'makeover', level: page.level + 1, path: [...page.path, item.id], category, group: page.group ?? null, item, cards: [], items: [] };
  if (!hasModalityPage(item)) return page;

  const modality = { kind: 'activity', level: page.level + 1, path: [...page.path, item.id], category, group: page.group ?? null, item, cards: [], items: [] };
  if (next[1] === CLUBS_PAGE && item.teamSport) return { ...modality, kind: 'clubs', level: modality.level + 1, path: [...modality.path, CLUBS_PAGE] };
  return modality;
}

// One level up (the back arrow and the phone's back button).
export function parentPath(path) {
  return path.slice(0, -1);
}

// The short trail under the title ("Atividades › Atividades físicas"): the
// parts above the page, as { kind, id } for the texts.
export function breadcrumb(page) {
  const crumbs = [{ kind: 'home' }];
  if (page.level > 2) crumbs.push({ kind: 'category', id: page.category });
  if (page.group && page.kind !== 'group') crumbs.push({ kind: 'group', id: page.group });
  if (page.kind === 'clubs') crumbs.push({ kind: 'activity', id: page.item.id });
  return page.kind === 'home' ? [] : crumbs;
}
