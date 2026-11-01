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

