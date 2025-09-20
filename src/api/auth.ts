/**
 * Middleware d'authentification Bearer Token simple pour l'API
 */

/**
 * Vérifie l'authentification Bearer Token
 * @param request - Request object de Bun
 * @returns true si authentifié, false sinon
 */
export function isAuthenticated(request: Request): boolean {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    return false;
  }

  // Vérifier le format "Bearer <token>"
  const match = authHeader.match(/^Bearer\s+(.+)$/);
  if (!match) {
    return false;
  }

  const token = match[1];
  const expectedToken = process.env.BEARER_TOKEN;

  if (!expectedToken) {
    console.error("❌ BEARER_TOKEN non configuré dans les variables d'environnement");
    return false;
  }

  return token === expectedToken;
}

/**
 * Middleware wrapper qui retourne une réponse 401 si non authentifié
 * @param request - Request object de Bun
 * @returns Response 401 ou null si authentifié
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

  return null; // Pas d'erreur, authentifié
}

/**
 * Log les tentatives d'authentification pour debug
 * @param request - Request object de Bun
 * @param authenticated - Résultat de l'authentification
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