/**
 * Converts a string to lowercase and removes all spaces and special characters,
 * keeping only alphanumeric characters (a-z, 0-9).
 *
 * @param str - The input string to process
 * @returns A cleaned string with only lowercase letters and numbers
 *
 * @example
 * normalizeForRedis("Hello World! 123") // returns "helloworld123"
 * normalizeForRedis("Test@#$%") // returns "test"
 */
export const normalizeForRedis = (str: string) => {
  return str
    .toLowerCase()
    .replace(/ /g, "")
    .replace(/[^a-z0-9]/g, "");
};
