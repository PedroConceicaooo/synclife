// Locale lookup and formatting. Pure (no DOM), so it runs in Node too.
//
// Text syntax (design doc, "Idiomas"):
//   {name}            replaced by params.name
//   {player|o|a}      gendered form chosen by the sex of the person called
//                     "player" in `sexes` (male form first, female second)
// Numbers, money and dates go through Intl. A text missing in the chosen
// language falls back to Portuguese (design doc: "Idioma reserva").

const TOKEN = /\{([a-zA-Z_]+)(?:\|([^|}]*)\|([^|}]*))?\}/g;

export const FALLBACK_LANGUAGE = 'pt-BR';

export function createLocale(entries, language = FALLBACK_LANGUAGE, fallbackEntries = {}) {
  const has = (key) => key in entries || key in fallbackEntries;
  const t = (key) => entries[key] ?? fallbackEntries[key] ?? key;

  function format(key, params = {}, sexes = {}) {
    return t(key).replace(TOKEN, (token, name, male, female) => {
      if (male !== undefined) {
        const sex = sexes[name];
        return sex === undefined ? token : sex === 'F' ? female : male;
      }
      return name in params ? String(params[name]) : token;
    });
  }

  // Keys ending in .one / .other, picked by Intl.PluralRules; an optional
  // .zero wins for 0 (CLDR puts 0 under "one" in Portuguese: "0 ano").
  const pluralRules = new Intl.PluralRules(language);
  function plural(key, count, params = {}, sexes = {}) {
    const form = count === 0 && has(`${key}.zero`) ? 'zero' : pluralRules.select(count);
    const formKey = has(`${key}.${form}`) ? `${key}.${form}` : `${key}.other`;
    return format(formKey, { count, ...params }, sexes);
  }

  // Whole units, like the design doc's "US$ 1.250". display comes from the
  // country data ("symbol" or "narrowSymbol" for "₽ 450" instead of "RUB 450").
  function money(amount, currencyCode, display = 'symbol') {
    return new Intl.NumberFormat(language, { style: 'currency', currency: currencyCode, currencyDisplay: display, maximumFractionDigits: 0 }).format(amount);
  }

  // Month index (rule 5) -> month name; the game has no day of the month.
  function monthName(monthIndex) {
    const month = ((monthIndex % 12) + 12) % 12;
    return new Intl.DateTimeFormat(language, { month: 'long', timeZone: 'UTC' }).format(Date.UTC(2000, month, 1));
  }

  // "3 anos", "3 anos e 6 meses", "6 meses".
  function age(totalMonths) {
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    const parts = [];
    if (years > 0 || months === 0) parts.push(plural('age.years', years));
    if (months > 0) parts.push(plural('age.months', months));
    return parts.join(t('age.join'));
  }

  // "Ana, Pedro e Bia"
  function list(items) {
    return new Intl.ListFormat(language, { style: 'long', type: 'conjunction' }).format(items);
  }

  return { t, has, format, plural, money, monthName, age, list, language };
}
