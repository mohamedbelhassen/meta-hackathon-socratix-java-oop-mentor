import { BilingualText, Lab, CourseChapter, LabActivity, LabMilestone } from '@/types/socratix';

/**
 * Helper to parse bilingual descriptions { en: string, fr: string }.
 * Provides backward compatibility with legacy plain-text descriptions.
 */
export interface BilingualDescription {
  en: string;
  fr: string;
}

export function parseBilingualDescription(rawDesc?: string | null): BilingualDescription {
  if (!rawDesc) {
    return {
      en: 'University programming lab assignment with structured milestones and validation criteria.',
      fr: 'Travaux pratiques universitaires avec jalons séquentiels et critères de validation.',
    };
  }

  const trimmed = rawDesc.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'object' && parsed !== null) {
        return {
          en: parsed.en || parsed.fr || trimmed,
          fr: parsed.fr || parsed.en || trimmed,
        };
      }
    } catch {
      // fallback to plain string
    }
  }

  return {
    en: trimmed,
    fr: trimmed,
  };
}

/**
 * Resolves a bilingual text object based on preferred language.
 * Falls back to other language, then to provided fallback string.
 */
export function resolveBilingualText(
  i18nObj: BilingualText | null | undefined,
  fallbackPlain: string,
  lang: 'en' | 'fr' = 'en'
): string {
  if (!i18nObj) return fallbackPlain;
  if (lang === 'fr') {
    return i18nObj.fr || i18nObj.en || fallbackPlain;
  }
  return i18nObj.en || i18nObj.fr || fallbackPlain;
}

/**
 * Localized title for Lab
 */
export function getLocalizedLabTitle(lab: Lab | null | undefined, lang: 'en' | 'fr' = 'en'): string {
  if (!lab) return '';
  return resolveBilingualText(lab.title_i18n, lab.title, lang);
}

/**
 * Localized title for CourseChapter
 */
export function getLocalizedChapterTitle(chapter: CourseChapter | null | undefined, lang: 'en' | 'fr' = 'en'): string {
  if (!chapter) return '';
  return resolveBilingualText(chapter.title_i18n, chapter.title, lang);
}

/**
 * Localized activity (title + instructions)
 */
export function getLocalizedActivity(activity: LabActivity, lang: 'en' | 'fr' = 'en'): {
  title: string;
  instructions: string;
} {
  return {
    title: resolveBilingualText(activity.title_i18n, activity.title, lang),
    instructions: resolveBilingualText(activity.instructions_i18n, activity.instructions_markdown, lang),
  };
}

/**
 * Localized milestone (title + validation criteria)
 */
export function getLocalizedMilestone(milestone: LabMilestone, lang: 'en' | 'fr' = 'en'): {
  title: string;
  validationCriteria: string;
} {
  return {
    title: resolveBilingualText(milestone.title_i18n, milestone.title, lang),
    validationCriteria: resolveBilingualText(milestone.validation_criteria_i18n, milestone.validation_criteria, lang),
  };
}


