/**
 * Meta Model API Client & KV Cache Utilities
 * Implements Meta Model API (muse-spark-1.3) Prefix KV Caching Specification.
 *
 * Requirements:
 * 1. Force dynamic / no-store to isolate Next.js HTTP cache from Meta KV Cache.
 * 2. Deterministic prefix order (tools -> system -> history -> user).
 * 3. Body parameters: prompt_cache_key & prompt_cache_retention ('24h' | 'in_memory').
 */

export const META_DEFAULT_MODEL = 'muse-spark-1.3';
export const META_BASE_URL = process.env.META_BASE_URL || 'https://api.meta.ai/v1';

export interface MetaCacheConfig {
  /** Clé partagée par contexte statique (ex: course-${courseId}-lab-${labId}). JAMAIS d'ID utilisateur ou de requête. */
  cacheKey: string;
  /** Durée de rétention du KV cache côté Meta ('in_memory' = ~5min, '24h' = jusqu'à 24h) */
  retention?: 'in_memory' | '24h';
  /** Niveau d'effort de raisonnement du modèle ('none' | 'low' | 'medium' | 'high' | 'xhigh') */
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high' | 'xhigh';
}

export interface MetaRawUsage {
  prompt_tokens?: number;
  input_tokens?: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
  };
  input_tokens_details?: {
    cached_tokens?: number;
  };
  completion_tokens?: number;
  output_tokens?: number;
  completion_tokens_details?: {
    reasoning_tokens?: number;
  };
  output_tokens_details?: {
    reasoning_tokens?: number;
  };
  total_tokens?: number;
}

export interface MetaUsageMetrics {
  promptTokens: number;
  cachedTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  cacheHitRatePercent: number;
}

/**
 * Extrait et normalise les métriques de tokens et de KV cache depuis la réponse Meta
 */
export function extractMetaUsage(usage?: MetaRawUsage | null): MetaUsageMetrics {
  const promptTokens = usage?.prompt_tokens ?? usage?.input_tokens ?? 0;
  const cachedTokens =
    usage?.prompt_tokens_details?.cached_tokens ??
    usage?.input_tokens_details?.cached_tokens ??
    0;
  const completionTokens = usage?.completion_tokens ?? usage?.output_tokens ?? 0;
  const reasoningTokens =
    usage?.completion_tokens_details?.reasoning_tokens ??
    usage?.output_tokens_details?.reasoning_tokens ??
    0;

  const cacheHitRatePercent =
    promptTokens > 0 ? Math.round((cachedTokens / promptTokens) * 100) : 0;

  return {
    promptTokens,
    cachedTokens,
    completionTokens,
    reasoningTokens,
    cacheHitRatePercent,
  };
}
