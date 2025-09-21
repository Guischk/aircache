/**
 * Simple Bearer Token authentication middleware for the API
 */

/**
 * Verifies Bearer Token authentication
 * @param request - Bun Request object
 * @returns true if authenticated, false otherwise
 */
export function isAuthenticated(request: Request): boolean {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    return false;
  }

  // Check "Bearer <token>" format
  const match = authHeader.match(/^Bearer\s+(.+)$/);
  if (!match) {
    return false;
  }

  const token = match[1];
  const expectedToken = process.env.BEARER_TOKEN;

  if (!expectedToken) {
    console.error("❌ BEARER_TOKEN not configured in environment variables");
    return false;
  }

  return token === expectedToken;
}

/**
 * Middleware wrapper that returns a 401 response if not authenticated
 * @param request - Bun Request object
 * @returns 401 Response or null if authenticated
 */
export function requireAuth(request: Request): Response | null {
  if (!isAuthenticated(request)) {
    return new Response(
      JSON.stringify({
        error: "Unauthorized",
        message: "Bearer token required",
        code: "AUTH_REQUIRED"
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": "Bearer"
        }
      }
    );
  }

  return null; // No error, authenticated
}

/**
 * Logs authentication attempts for debugging
 * @param request - Bun Request object
 * @param authenticated - Authentication result
 */
export function logAuthAttempt(request: Request, authenticated: boolean): void {
  const authHeader = request.headers.get("Authorization");
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";

  if (authenticated) {
    console.log(`✅ Auth success - ${request.method} ${request.url} - IP: ${ip}`);
  } else {
    console.log(`❌ Auth failed - ${request.method} ${request.url} - IP: ${ip} - Auth: ${authHeader ? "present" : "missing"}`);
  }
}