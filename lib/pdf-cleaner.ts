// ============================================================================
// SOCRATIX - PDF FREQUENCY-BASED BOILERPLATE CLEANER
// ============================================================================
// Automatically identifies and strips recurring headers, footers, pagination,
// university titles, and instructor names across pages using statistical
// perimeter frequency analysis (0 tokens, 0ms latency, 100% language-agnostic).
// ============================================================================

export interface CleanedPage {
  page: number;
  text: string;
}

export interface BoilerplateDetectionResult {
  cleanedPages: CleanedPage[];
  detectedHeaders: string[];
  detectedFooters: string[];
}

/**
 * Normalizes a line for fuzzy frequency comparison.
 */
function normalizeLine(line: string): string {
  return line
    .trim()
    .toLowerCase()
    .replace(/[ \t]+/g, ' ')
    // Replace variable page numbers and dates with placeholders so slightly varying headers match
    .replace(/\b\d{1,3}\s*\/\s*\d{1,3}\b/g, '#page#')
    .replace(/\bpage\s*\d+\b/gi, '#page#')
    .replace(/\b\d{2}[\/\-.]\d{2}[\/\-.]\d{2,4}\b/g, '#date#');
}

/**
 * Common pure pagination and date regex patterns.
 */
const PURE_PAGINATION_REGEX = /^(?:page\s*\d+|\d+\s*\/\s*\d+|\d+)$/i;
const PURE_DATE_REGEX = /^\d{2}[\/\-.]\d{2}[\/\-.]\d{2,4}$/;

/**
 * Analyzes pages and strips boilerplate lines that repeat in top/bottom perimeters across pages.
 *
 * @param pages Array of pages with page number and extracted text
 * @param frequencyThreshold Fraction of pages (0.0 to 1.0) on which a line must appear to be considered boilerplate
 */
export function cleanPdfPages(
  pages: Array<{ page: number; text: string }>,
  frequencyThreshold = 0.35
): BoilerplateDetectionResult {
  if (!pages || pages.length === 0) {
    return { cleanedPages: [], detectedHeaders: [], detectedFooters: [] };
  }

  // If document has only 1 page, we cannot do frequency analysis across pages
  if (pages.length === 1) {
    const lines = pages[0].text.split('\n').filter((l) => {
      const trimmed = l.trim();
      return !PURE_PAGINATION_REGEX.test(trimmed) && !PURE_DATE_REGEX.test(trimmed);
    });
    return {
      cleanedPages: [{ page: pages[0].page, text: lines.join('\n').trim() }],
      detectedHeaders: [],
      detectedFooters: [],
    };
  }

  const topLinesFrequency: Record<string, { count: number; sample: string }> = {};
  const bottomLinesFrequency: Record<string, { count: number; sample: string }> = {};

  // 1. Gather perimeter lines (top 3 and bottom 3 lines of each page)
  for (const p of pages) {
    const rawLines = p.text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const topSlice = rawLines.slice(0, 3);
    const bottomSlice = rawLines.slice(-3);

    for (const line of topSlice) {
      if (line.length < 3) continue;
      const norm = normalizeLine(line);
      if (!topLinesFrequency[norm]) {
        topLinesFrequency[norm] = { count: 0, sample: line };
      }
      topLinesFrequency[norm].count += 1;
    }

    for (const line of bottomSlice) {
      if (line.length < 3) continue;
      const norm = normalizeLine(line);
      if (!bottomLinesFrequency[norm]) {
        bottomLinesFrequency[norm] = { count: 0, sample: line };
      }
      bottomLinesFrequency[norm].count += 1;
    }
  }

  // 2. Identify repeating boilerplates exceeding the frequency threshold
  const minOccurrences = Math.max(2, Math.ceil(pages.length * frequencyThreshold));
  const detectedHeadersSet = new Set<string>();
  const detectedFootersSet = new Set<string>();

  const detectedHeaders: string[] = [];
  const detectedFooters: string[] = [];

  for (const [norm, data] of Object.entries(topLinesFrequency)) {
    if (data.count >= minOccurrences) {
      detectedHeadersSet.add(norm);
      detectedHeaders.push(data.sample);
    }
  }

  for (const [norm, data] of Object.entries(bottomLinesFrequency)) {
    if (data.count >= minOccurrences) {
      detectedFootersSet.add(norm);
      detectedFooters.push(data.sample);
    }
  }

  // 3. Filter pages removing boilerplate lines
  const cleanedPages: CleanedPage[] = pages.map((p) => {
    const rawLines = p.text.split('\n');
    const filteredLines = rawLines.filter((line, idx, arr) => {
      const trimmed = line.trim();
      if (!trimmed) return true; // keep blank separator lines

      // Always strip standalone pagination or dates on the first 2 or last 2 lines
      const isPerimeter = idx < 2 || idx >= arr.length - 2;
      if (isPerimeter) {
        if (PURE_PAGINATION_REGEX.test(trimmed) || PURE_DATE_REGEX.test(trimmed)) {
          return false;
        }
      }

      const norm = normalizeLine(trimmed);
      if (detectedHeadersSet.has(norm) || detectedFootersSet.has(norm)) {
        return false;
      }

      return true;
    });

    // Collapse 3+ consecutive newlines into 2
    const cleanedText = filteredLines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return {
      page: p.page,
      text: cleanedText,
    };
  });

  return {
    cleanedPages,
    detectedHeaders,
    detectedFooters,
  };
}

/**
 * Utility to strip redundant activity headers at the start of instructions_markdown.
 * e.g. "### Activity No. 2 (Red Thread Project)..."
 */
export function cleanInstructionsMarkdown(markdown: string): string {
  if (!markdown) return '';

  let cleaned = markdown.trim();

  // If starts with "### Activity ...\n" or "### Activité ...\n" or "### Activity ... Our Yalla POS..."
  const headerMatch = cleaned.match(/^###\s*(?:Activity|Activit[ée])\s*N?[°o]?\s*\d+[^:\n]*[:\-]?\s*([^\n]*)/i);
  if (headerMatch) {
    const afterHeader = cleaned.slice(headerMatch[0].length).trim();
    // If the header match captured trailing sentence text (like "Our Yalla POS cash register...")
    const trailingSentence = headerMatch[1]?.trim();
    if (trailingSentence && !trailingSentence.startsWith('#')) {
      cleaned = `${trailingSentence}\n\n${afterHeader}`;
    } else {
      cleaned = afterHeader;
    }
  }

  return cleaned.trim();
}

/**
 * Generates or retrieves clean markdown content for a slide reference.
 */
export function getSlideCleanMarkdown(
  reference: {
    label: string;
    chapter_code: string;
    page_number: number;
    en_note?: string;
    slide_markdown?: { en?: string; fr?: string };
  },
  lang: 'en' | 'fr'
): string {
  if (lang === 'en') {
    if (reference.slide_markdown?.en && reference.slide_markdown.en.trim().length > 0) {
      return reference.slide_markdown.en;
    }
    return `### ${reference.label || `Slide #${reference.page_number}`}\n\n` +
      `**Curriculum Reference:** Chapter \`${reference.chapter_code}\` (Slide ${reference.page_number})\n\n` +
      `#### Key Architectural Concept:\n` +
      `> ${reference.en_note || 'This slide presents the core concept and architectural invariant relevant to your current implementation hurdle.'}\n\n` +
      `*Tip: Run "⚡ Re-analyze All Chapters with Meta AI" in Course Studio to generate full verbatim slide-by-slide translations.*`;
  } else {
    if (reference.slide_markdown?.fr && reference.slide_markdown.fr.trim().length > 0) {
      return reference.slide_markdown.fr;
    }
    return `### ${reference.label || `Diapositive #${reference.page_number}`}\n\n` +
      `**Référence officielle du cours :** Chapitre \`${reference.chapter_code}\` (Diapositive ${reference.page_number})\n\n` +
      `Consultez l'original officiel en cliquant sur l'onglet **"📄 Official PDF Slide (French)"** ci-dessus.`;
  }
}

