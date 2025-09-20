/**
 * Types TypeScript pour l'API REST
 */

/**
 * Réponse standard de l'API
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
  meta?: {
    total?: number;
    namespace?: string;
    timestamp?: string;
  };
}

/**
 * Réponse d'erreur de l'API
 */
export interface ApiError {
  success: false;
  error: string;
  message: string;
  code: string;
  meta?: {
    timestamp: string;
  };
}

/**
 * Informations de santé du système
 */
export interface HealthInfo {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  services: {
    redis: boolean;
    worker: boolean;
  };
  version?: string;
}

/**
 * Statistiques du cache
 */
export interface CacheStats {
  activeNamespace: string;
  totalTables: number;
  totalRecords: number;
  lastRefresh?: string;
  nextRefresh?: string;
  tables: Array<{
    name: string;
    recordCount: number;
    lastUpdated?: string;
  }>;
}

/**
 * Informations sur une table
 */
export interface TableInfo {
  name: string;
  normalizedName: string;
  recordCount: number;
  namespace: string;
  sampleRecord?: Record<string, any>;
}

/**
 * Liste des tables disponibles
 */
export interface TablesListResponse {
  tables: string[];
  namespace: string;
  total: number;
}

/**
 * Records d'une table avec pagination basique
 */
export interface TableRecordsResponse {
  records: Record<string, any>[];
  table: string;
  namespace: string;
  total: number;
  limit?: number;
  offset?: number;
}

/**
 * Un record individuel
 */
export interface RecordResponse {
  record: Record<string, any>;
  table: string;
  recordId: string;
  namespace: string;
}

/**
 * Paramètres de requête pour les endpoints
 */
export interface QueryParams {
  limit?: string;
  offset?: string;
  fields?: string; // Comma-separated field names
}

/**
 * Headers personnalisés pour les réponses
 */
export interface ApiHeaders {
  "Content-Type": "application/json";
  "X-Cache-Namespace"?: string;
  "X-Cache-Timestamp"?: string;
  "X-RateLimit-Remaining"?: string;
  "Access-Control-Allow-Origin"?: string;
  "Access-Control-Allow-Methods"?: string;
  "Access-Control-Allow-Headers"?: string;
}