/**
 * Converts a string to lowercase and removes all spaces and special characters,
 * keeping only alphanumeric characters (a-z, 0-9).
 *
 * @param str - The input string to process
 * @returns A cleaned string with only lowercase letters and numbers
 *
 * @example
 * normalizeKey("Hello World! 123") // returns "helloworld123"
 * normalizeKey("Test@#$%") // returns "test"
 */
export const normalizeKey = (str: string) => {
	return str
		.toLowerCase()
		.replace(/ /g, "")
		.replace(/[^a-z0-9]/g, "");
};
