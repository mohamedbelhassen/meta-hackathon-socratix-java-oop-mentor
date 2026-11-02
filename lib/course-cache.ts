import { getServiceSupabase } from '@/lib/supabase-admin';
import { Course, CourseChapter, Lab } from '@/types/socratix';

export interface CachedCourseBundle {
  course: Course;
  chapters: CourseChapter[];
  lab: Lab;
  cachedAt: number;
}

const MAX_CACHE_ENTRIES = 50;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

// In-memory bounded LRU map
const courseCache = new Map<string, CachedCourseBundle>();

/**
 * Retrieves the compiled course bundle (Course, Chapters, Lab) with memory caching.
 * Excludes heavy raw pages_json TOAST blobs (PERF-01/PERF-07).
 */
export async function getCachedCourseBundle(
  courseId: string,
  labId: string
): Promise<{ course: Course; chapters: CourseChapter[]; lab: Lab } | null> {
  const cacheKey = `${courseId}_${labId}`;
  const now = Date.now();
  const cached = courseCache.get(cacheKey);

  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    // Refresh position for LRU
    courseCache.delete(cacheKey);
    courseCache.set(cacheKey, cached);
    return cached;
  }

  const supabase = getServiceSupabase();

  const [courseRes, chaptersRes, labRes] = await Promise.all([
    supabase
      .from('courses')
      .select('id, code, title, description, content_language, tutor_language, file_extensions, stuck_threshold_turns, competency_matrix, compiled_knowledge_base, compiled_tutor_prompt, is_published, teacher_id')
      .eq('id', courseId)
      .single(),
    supabase
      .from('course_chapters')
      .select('id, course_id, chapter_number, code, title, title_i18n, pdf_url, markdown_content, pages_json, key_analogies')
      .eq('course_id', courseId)
      .order('chapter_number', { ascending: true }),
    supabase
      .from('labs')
      .select('id, course_id, lab_number, code, title, title_i18n, description, description_i18n, pdf_url, is_active, covered_micro_concepts, activities, demo_presets')
      .eq('id', labId)
      .single(),
  ]);

  if (courseRes.error || !courseRes.data || labRes.error || !labRes.data) {
    if (courseRes.error || labRes.error || chaptersRes.error) {
      console.error('[getCachedCourseBundle] Database query error:', {
        courseError: courseRes.error?.message,
        chaptersError: chaptersRes.error?.message,
        labError: labRes.error?.message,
      });
    }
    return null;
  }

  const bundle: CachedCourseBundle = {
    course: courseRes.data as unknown as Course,
    chapters: (chaptersRes.data || []) as unknown as CourseChapter[],
    lab: labRes.data as unknown as Lab,
    cachedAt: now,
  };

  // Enforce bounded cache size (LRU: delete oldest key)
  if (courseCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = courseCache.keys().next().value;
    if (oldestKey) {
      courseCache.delete(oldestKey);
    }
  }

  courseCache.set(cacheKey, bundle);
  return bundle;
}

/**
 * Invalidates cached course bundles.
 * If courseId is provided, removes all keys starting with that courseId.
 * If labId is provided, removes keys matching that labId.
 * If neither is provided, clears the entire cache.
 */
export function invalidateCourseCache(courseId?: string, labId?: string) {
  if (!courseId && !labId) {
    courseCache.clear();
    return;
  }

  courseCache.forEach((_, key) => {
    if (courseId && key.startsWith(`${courseId}_`)) {
      courseCache.delete(key);
    } else if (labId && key.endsWith(`_${labId}`)) {
      courseCache.delete(key);
    }
  });
}
