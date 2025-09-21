/**
 * Configuration file for Aircache
 * Simple configuration with environment variables
 */

export interface Config {
  // Server settings
  port: number;

  // Airtable settings
  airtableToken: string;
  airtableBaseId: string;

  // API settings
  bearerToken: string;

  // Cache settings
  refreshInterval: number;

  // Storage settings
  storagePath: string;
}

export function loadConfig(): Config {
  // Required environment variables
  const airtableToken = process.env.AIRTABLE_PERSONAL_TOKEN;
  const airtableBaseId = process.env.AIRTABLE_BASE_ID;
  const bearerToken = process.env.BEARER_TOKEN;

  if (!airtableToken || !airtableBaseId || !bearerToken) {
    throw new Error(
      'Missing required environment variables. Please set:\n' +
      '- AIRTABLE_PERSONAL_TOKEN\n' +
      '- AIRTABLE_BASE_ID\n' +
      '- BEARER_TOKEN'
    );
  }

  return {
    port: parseInt(process.env.PORT || '3000'),
    airtableToken,
    airtableBaseId,
    bearerToken,
    refreshInterval: parseInt(process.env.REFRESH_INTERVAL || '86400'), // 24 hours default
    storagePath: process.env.STORAGE_PATH || './data/attachments'
  };
}

// Export the config for use in other files
export const config = loadConfig();
