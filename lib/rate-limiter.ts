import { NextRequest } from 'next/server';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// In-memory sliding window store
const rateLimitStore = new Map<string, RateLimitRecord>();

// Periodically clean up expired entries every 3 minutes
if (typeof setInterval !== 'undefined') {
  const timer = setInterval(() => {
    const now = Date.now();
    rateLimitStore.forEach((record, key) => {
      if (now > record.resetAt) {
        rateLimitStore.delete(key);
      }
    });
  }, 3 * 60 * 1000);
  timer.unref?.();
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

export const RATE_LIMIT_CONFIG = {
  get tutorLimitPerMinute(): number {
    const val = parseInt(process.env.TUTOR_RATE_LIMIT_PER_MINUTE || '15', 10);
    return isNaN(val) || val <= 0 ? 15 : val;
  },
  get tutorMaxFiles(): number {
    const val = parseInt(process.env.TUTOR_MAX_FILES || '20', 10);
    return isNaN(val) || val <= 0 ? 20 : val;
  },
  get tutorMaxFileBytes(): number {
    const val = parseInt(process.env.TUTOR_MAX_FILE_BYTES || '32768', 10);
    return isNaN(val) || val <= 0 ? 32768 : val;
  },
  get tutorMaxQuestionLength(): number {
    const val = parseInt(process.env.TUTOR_MAX_QUESTION_LENGTH || '2000', 10);
    return isNaN(val) || val <= 0 ? 2000 : val;
  },
  get studioLimitPerMinute(): number {
    const val = parseInt(process.env.STUDIO_RATE_LIMIT_PER_MINUTE || '10', 10);
    return isNaN(val) || val <= 0 ? 10 : val;
  },
};

/**
 * Checks in-memory sliding window rate limit for an identifier (e.g. IP + studentId).
 * Zero external dependencies (no Redis required, 100% free).
 */
export function checkRateLimit(
  identifier: string,
  limit: number,
  windowSeconds = 60
): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const existing = rateLimitStore.get(identifier);

  if (!existing || now > existing.resetAt) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      success: true,
      limit,
      remaining: Math.max(0, limit - 1),
      resetSeconds: windowSeconds,
    };
  }

  if (existing.count >= limit) {
    const resetSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return {
      success: false,
      limit,
      remaining: 0,
      resetSeconds,
    };
  }

  existing.count += 1;
  const resetSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  return {
    success: true,
    limit,
    remaining: Math.max(0, limit - existing.count),
    resetSeconds,
  };
}

/**
 * Extracts client IP safely from request headers.
 */
export function getClientIp(req: NextRequest | Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}

/**
 * Builds standard RateLimit HTTP response headers.
 */
export function buildRateLimitHeaders(res: RateLimitResult): Record<string, string> {
  return {
    'Retry-After': String(res.resetSeconds),
    'X-RateLimit-Limit': String(res.limit),
    'X-RateLimit-Remaining': String(res.remaining),
    'X-RateLimit-Reset': String(res.resetSeconds),
  };
}
