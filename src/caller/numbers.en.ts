const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** Britische Ansager-Zählweise: 121 → „one hundred and twenty-one“. */
export function numberToEnglish(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 9999) return String(n);
  if (n < 20) return ONES[n]!;
  if (n < 100) return TENS[Math.floor(n / 10)]! + (n % 10 ? `-${ONES[n % 10]}` : '');
  if (n < 1000) {
    const rest = n % 100;
    return `${ONES[Math.floor(n / 100)]} hundred${rest ? ` and ${numberToEnglish(rest)}` : ''}`;
  }
  const rest = n % 1000;
  return `${numberToEnglish(Math.floor(n / 1000))} thousand${rest ? ` ${rest < 100 ? 'and ' : ''}${numberToEnglish(rest)}` : ''}`;
}

const ORDINALS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
  'eleventh',
  'twelfth',
  'thirteenth',
];

export function ordinalEnglish(n: number): string {
  return ORDINALS[n - 1] ?? `${n}th`;
}
