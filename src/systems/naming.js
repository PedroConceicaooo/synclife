// Names from the country's name list (data/names), applied with the
// country's naming rules — never by checking which country it is (rule 10).
//
// naming.childLastName: "father" (the father's family name, in the child's
//   form) or "motherAndFather" (both, mother's first).
// naming.spouseLastName: "takesHusbands" or "keeps".
// naming.familyNameFirst: display order of the full name.
// A family name entry is a string, or { M, F } where it changes with sex.

export function surnameForm(entry, sex) {
  return typeof entry === 'string' ? entry : entry[sex];
}

export function pickFirstName(rng, nameList, sex, exclude = []) {
  const pool = nameList.first[sex].filter((name) => !exclude.includes(name));
  const options = pool.length > 0 ? pool : nameList.first[sex];
  return options[rng.nextInt(0, options.length)];
}

function pickFamilyEntry(rng, nameList) {
  return nameList.last[rng.nextInt(0, nameList.last.length)];
}

function familyEntryOf(person, nameList) {
  return nameList.last.find((entry) => surnameForm(entry, person.sex) === person.lastName) ?? person.lastName;
}

export function nameParents(rng, { mother, father, country }) {
  const { nameList, naming } = country;
  const fatherEntry = pickFamilyEntry(rng, nameList);
  const motherEntry = naming.spouseLastName === 'keeps' ? pickFamilyEntry(rng, nameList) : fatherEntry;
  return {
    father: { ...father, firstName: pickFirstName(rng, nameList, 'M'), lastName: surnameForm(fatherEntry, 'M') },
    mother: { ...mother, firstName: pickFirstName(rng, nameList, 'F'), lastName: surnameForm(motherEntry, 'F') },
  };
}

export function childLastName({ mother, father, sex, country }) {
  if (country.naming.childLastName === 'motherAndFather') return `${mother.lastName} ${father.lastName}`;
  return surnameForm(familyEntryOf(father, country.nameList), sex);
}

export function nameChild(rng, child, { mother, father, country, siblingFirstNames = [] }) {
  return {
    ...child,
    firstName: pickFirstName(rng, country.nameList, child.sex, siblingFirstNames),
    lastName: childLastName({ mother, father, sex: child.sex, country }),
  };
}

export function fullName(person, country) {
  return country.naming.familyNameFirst ? `${person.lastName} ${person.firstName}` : `${person.firstName} ${person.lastName}`;
}
