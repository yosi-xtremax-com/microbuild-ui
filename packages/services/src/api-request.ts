/**
 * API Request Helper
 * 
 * Makes requests to local API routes (server-side proxy to DaaS backend)
 * or directly to DaaS when configured via DaaSProvider/setGlobalDaaSConfig.
 */

import { buildApiUrl, getApiHeaders, type DaaSConfig } from './daas-context';

export interface ApiRequestOptions extends RequestInit {
  /** Optional DaaS config override */
  daasConfig?: DaaSConfig | null;
}

/**
 * Make request to local API route or direct to DaaS
 */
export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { daasConfig, ...fetchOptions } = options;
  
  // Build URL (handles proxy vs direct mode)
  const url = buildApiUrl(path, daasConfig);
  
  // Get headers (includes auth token in direct mode)
  const headers = getApiHeaders(daasConfig);
  
  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      ...headers,
      ...fetchOptions.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${response.status} - ${error}`);
  }

  // Handle 204 No Content (e.g. DELETE responses)
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text);
}
