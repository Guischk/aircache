/**
 * Utility functions for Hono routes
 */

import type { Context } from "hono";

/**
 * Convert a standard Response to a Hono JSON response
 */
export async function convertResponseToHono(response: Response, c: Context) {
	const body = await response.text();

	// Parse JSON if it's JSON content
	let data;
	try {
		data = JSON.parse(body);
	} catch {
		data = body;
	}

	return c.json(data, response.status as any);
}

/**
 * Convert a standard Response to a Hono Response preserving content type
 */
export function convertFileResponseToHono(response: Response) {
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: response.headers,
	});
}
