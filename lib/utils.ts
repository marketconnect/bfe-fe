/**
 * Returns the correct plural form of a word for a given number, based on Russian grammar rules.
 * @param number The number to determine the plural form for.
 * @param one The form for a single item (e.g., "пользователь").
 * @param few The form for 2-4 items (e.g., "пользователя").
 * @param many The form for 5+ items and numbers ending in 11-19 (e.g., "пользователей").
 * @returns The correctly pluralized string.
 */
export const getPluralForm = (number: number, one: string, few: string, many: string): string => {
  let n = Math.abs(number);
  n %= 100;
  if (n >= 5 && n <= 20) {
    return many;
  }
  n %= 10;
  if (n === 1) {
    return one;
  }
  if (n >= 2 && n <= 4) {
    return few;
  }
  return many;
};