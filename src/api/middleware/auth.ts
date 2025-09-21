/**
 * Middleware d'authentification unifié
 */

export function validateBearerToken(request: Request): boolean {
  const authHeader = request.headers.get("Authorization");
  const expectedToken = process.env.BEARER_TOKEN;

  if (!expectedToken) {
    return true; // Pas d'auth configurée
  }

  if (!authHeader) {
    return false;
  }

  const token = authHeader.replace("Bearer ", "");
  return token === expectedToken;
}

export function createUnauthorizedResponse(): Response {
  return new Response(JSON.stringify({
    error: "Unauthorized",
    message: "Valid Bearer token required"
  }), {
    status: 401,
    headers: { "Content-Type": "application/json" }
  });
}

export function createOptionsResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400"
    }
  });
}

export function addCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}