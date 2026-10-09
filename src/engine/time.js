// Month-integer clock. Time is always `year * 12 + (month - 1)`.

export function toMonthIndex({ year, month }) {
  return year * 12 + (month - 1);
}

export function fromMonthIndex(monthIndex) {
  const year = Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1;
  return { year, month };
}

export function ageAt(birthMonthIndex, currentMonthIndex) {
  return Math.floor((currentMonthIndex - birthMonthIndex) / 12);
}

export function isBirthdayMonth(birthMonthIndex, monthIndex) {
  return (monthIndex - birthMonthIndex) % 12 === 0;
}

export function advance(currentMonthIndex, months, birthMonthIndex) {
  const birthdays = [];
  let monthIndex = currentMonthIndex;

  for (let i = 0; i < months; i++) {
    monthIndex += 1;
    if (isBirthdayMonth(birthMonthIndex, monthIndex)) {
      birthdays.push({ age: ageAt(birthMonthIndex, monthIndex), monthIndex });
    }
  }

  return { nextMonthIndex: monthIndex, birthdays };
}
