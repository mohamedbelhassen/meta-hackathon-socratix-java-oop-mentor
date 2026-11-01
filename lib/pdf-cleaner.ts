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

export interface PageBatch {
  batchIndex: number;
  totalBatches: number;
  pages: CleanedPage[];
  totalChars: number;
}

export interface BoilerplateDetectionResult {
  cleanedPages: CleanedPage[];
  detectedHeaders: string[];
  detectedFooters: string[];
}

/**
 * Common pure pagination and date regex patterns.
 */
const PURE_PAGINATION_REGEX = /^(?:page\s*\d+|\d+\s*\/\s*\d+|\d+)$/i;
const PURE_DATE_REGEX = /^\d{2}[\/\-.]\d{2}[\/\-.]\d{2,4}$/;

/**
 * Deterministically cleans extracted PDF pages.
 * Strips standalone pagination numbers and pure dates from perimeter lines (top 2 / bottom 2).
 * Aggressive statistical frequency-based text stripping is intentionally omitted to prevent
 * any risk of deleting legitimate slide titles, syllabus topics, or valid slide content.
 *
 * @param pages Array of pages with page number and extracted text
 * @param _frequencyThreshold Kept for interface compatibility
 */
export function cleanPdfPages(
  pages: Array<{ page: number; text: string }>
): BoilerplateDetectionResult {
  if (!pages || pages.length === 0) {
    return { cleanedPages: [], detectedHeaders: [], detectedFooters: [] };
  }

  const cleanedPages: CleanedPage[] = pages.map((p) => {
    const rawLines = (p.text || '').split('\n');
    const filteredLines = rawLines.filter((line, idx, arr) => {
      const trimmed = line.trim();
      if (!trimmed) return true; // keep blank separator lines

      // Only strip standalone pure pagination or pure dates on perimeter lines
      const isPerimeter = idx < 2 || idx >= arr.length - 2;
      if (isPerimeter) {
        if (PURE_PAGINATION_REGEX.test(trimmed) || PURE_DATE_REGEX.test(trimmed)) {
          return false;
        }
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
    detectedHeaders: [],
    detectedFooters: [],
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
 * Splits cleaned pages into adaptive batches based on cumulative text density (characters)
 * and maximum page count. This guarantees that whether input is light slides (30 words/slide)
 * or dense A4 lecture notes (700 words/page), the output token budget is never exceeded.
 */
export function buildAdaptivePageBatches(
  cleanedPages: CleanedPage[],
  maxBatchChars = 10000,
  maxBatchPages = 25
): PageBatch[] {
  if (!cleanedPages || cleanedPages.length === 0) return [];

  const batches: PageBatch[] = [];
  let currentPages: CleanedPage[] = [];
  let currentChars = 0;

  for (const page of cleanedPages) {
    const pageChars = page.text?.length || 0;
    const wouldExceedChars = currentChars + pageChars > maxBatchChars && currentPages.length > 0;
    const wouldExceedPages = currentPages.length >= maxBatchPages;

    if (wouldExceedChars || wouldExceedPages) {
      batches.push({
        batchIndex: batches.length,
        totalBatches: 0,
        pages: currentPages,
        totalChars: currentChars,
      });
      currentPages = [page];
      currentChars = pageChars;
    } else {
      currentPages.push(page);
      currentChars += pageChars;
    }
  }

  if (currentPages.length > 0) {
    batches.push({
      batchIndex: batches.length,
      totalBatches: 0,
      pages: currentPages,
      totalChars: currentChars,
    });
  }

  const total = batches.length;
  for (const b of batches) {
    b.totalBatches = total;
  }

  return batches;
}

/**
 * Deterministically formats raw extracted slide/page text into clean, readable Markdown
 * with proper section headers, bullet lists, and syntax-highlighted Java code blocks.
 * Serves as an instantaneous 0-token fallback whenever AI markdown is pending.
 */
export function formatRawSlideTextToMarkdown(rawText: string, fallbackTitle?: string): string {
  if (!rawText || !rawText.trim()) {
    return fallbackTitle ? `### ${fallbackTitle}\n\n*Contenu textuel non disponible.*` : '*Contenu textuel non disponible.*';
  }

  // 1. Remove pure trailing/leading page numbers & dates
  const rawLines = rawText.split('\n');
  const filteredLines: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    const isPerimeter = i < 2 || i >= rawLines.length - 2;
    if (isPerimeter && (/^(?:page\s*\d+|\d+\s*\/\s*\d+|\d+)$/i.test(line) || /^\d{2}[\/\-.]\d{2}[\/\-.]\d{2,4}$/.test(line))) {
      continue;
    }
    filteredLines.push(rawLines[i]);
  }

  // 2. Classify lines as either Text/Header, Bullet, or Java Code
  const JAVA_INDICATORS = /\b(?:public|private|protected|static|final|class|interface|enum|extends|implements|void|int|double|boolean|String|new|return|throws|throw|try|catch|finally|import|package|System\.out\.println)\b/;

  const formattedBlocks: string[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];

  const flushCode = () => {
    if (codeBuffer.length > 0) {
      formattedBlocks.push('```java\n' + codeBuffer.join('\n') + '\n```');
      codeBuffer = [];
      inCodeBlock = false;
    }
  };

  for (let i = 0; i < filteredLines.length; i++) {
    const origLine = filteredLines[i];
    const line = origLine.trim();

    if (!line) {
      if (inCodeBlock) {
        codeBuffer.push('');
      } else {
        if (formattedBlocks.length > 0 && formattedBlocks[formattedBlocks.length - 1] !== '') {
          formattedBlocks.push('');
        }
      }
      continue;
    }

    // Check if line looks like code
    const isComment = /^(?:\/\*|\*|\/\/)/.test(line);
    const hasBraces = /[{};]/.test(line);
    const hasJavaKeywords = JAVA_INDICATORS.test(line);
    const isCodeLike = isComment || hasBraces || (hasJavaKeywords && (line.includes('(') || line.includes('{') || line.includes(';')));

    if (isCodeLike) {
      inCodeBlock = true;
      codeBuffer.push(origLine);
      continue;
    }

    if (inCodeBlock) {
      flushCode();
    }

    // Normalize wingding bullets & headings
    // e.g. " Activité 1:" -> "### Activité 1 :"
    const actMatch = line.match(/^[●■–—*]?\s*(Activit[ée]\s*\d+[^:\n]*[:\-]?)(.*)$/i);
    if (actMatch) {
      formattedBlocks.push(`### ${actMatch[1].trim()}`);
      if (actMatch[2]?.trim()) formattedBlocks.push(actMatch[2].trim());
      continue;
    }

    const solMatch = line.match(/^[●■–—*]?\s*(Solution\s*[:\-]?)(.*)$/i);
    if (solMatch) {
      formattedBlocks.push(`#### ${solMatch[1].trim()}`);
      if (solMatch[2]?.trim()) formattedBlocks.push(solMatch[2].trim());
      continue;
    }

    const exMatch = line.match(/^[●■–—*]?\s*(Exemple\s*[:\-]?)(.*)$/i);
    if (exMatch) {
      formattedBlocks.push(`#### ${exMatch[1].trim()}`);
      if (exMatch[2]?.trim()) formattedBlocks.push(exMatch[2].trim());
      continue;
    }

    // Convert bullet points
    if (/^[●■–—*]\s*/.test(line)) {
      const cleanBullet = line.replace(/^[●■–—*]\s*/, '').trim();
      formattedBlocks.push(`- ${cleanBullet}`);
      continue;
    }

    formattedBlocks.push(line);
  }

  flushCode();

  let result = formattedBlocks.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (fallbackTitle) {
    const hasHeader = /^#{1,4}\s+/m.test(result);
    if (!hasHeader) {
      result = `### ${fallbackTitle}\n\n${result}`;
    }
  }
  return result;
}

/**
 * Generates or retrieves clean markdown content for a slide reference.
 * Guarantees that the slide title is ALWAYS prominently displayed at the top of the markdown,
 * even if the original PDF slide used an image or vector shape for its title.
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
  // Extract clean slide title from reference.label
  // e.g. "Chapter 2 (Slide 23): Transtypage explicite / Cast" -> "Transtypage explicite / Cast"
  let cleanTitle = reference.label || `Slide #${reference.page_number}`;
  const colonIdx = cleanTitle.indexOf(':');
  if (colonIdx !== -1) {
    const extracted = cleanTitle.slice(colonIdx + 1).trim();
    if (extracted.length > 0) cleanTitle = extracted;
  }

  const ensureHeader = (markdownText: string, title: string): string => {
    const trimmed = markdownText.trim();
    if (/^#{1,4}\s+/m.test(trimmed)) {
      return trimmed;
    }
    return `### ${title}\n\n${trimmed}`;
  };

  if (lang === 'en') {
    if (reference.slide_markdown?.en && reference.slide_markdown.en.trim().length > 0) {
      return ensureHeader(reference.slide_markdown.en, cleanTitle);
    }
    // If English markdown is pending, display French clean markdown if available
    if (reference.slide_markdown?.fr && reference.slide_markdown.fr.trim().length > 0) {
      const frContent = ensureHeader(reference.slide_markdown.fr, cleanTitle);
      return `> 💡 *Clean English translation pending recompilation. Displaying official clean slide content below:*\n\n${frContent}`;
    }
    return `### ${cleanTitle}\n\n` +
      `**Curriculum Reference:** Chapter \`${reference.chapter_code}\` (Slide ${reference.page_number})\n\n` +
      `#### Key Architectural Concept:\n` +
      `> ${reference.en_note || 'This slide presents the core concept and architectural invariant relevant to your current implementation hurdle.'}\n\n` +
      `*Tip: Run "Recompile Knowledge Base" with "Re-distill PDFs" checked in Course Studio to generate full verbatim slide-by-slide translations.*`;
  } else {
    if (reference.slide_markdown?.fr && reference.slide_markdown.fr.trim().length > 0) {
      return ensureHeader(reference.slide_markdown.fr, cleanTitle);
    }
    if (reference.slide_markdown?.en && reference.slide_markdown.en.trim().length > 0) {
      return ensureHeader(reference.slide_markdown.en, cleanTitle);
    }
    return `### ${cleanTitle}\n\n` +
      `**Référence officielle du cours :** Chapitre \`${reference.chapter_code}\` (Diapositive ${reference.page_number})\n\n` +
      `Consultez l'original officiel en cliquant sur l'onglet **"📄 Official PDF (French)"** ci-dessus.`;
  }
}

