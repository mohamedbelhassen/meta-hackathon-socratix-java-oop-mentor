import { getBrowserSupabase } from './supabase';

export interface ExtractedPage {
  page: number;
  text: string;
}

export interface InferredFileInfo {
  type: 'chapter' | 'lab';
  number: number;
  code: string;
  suggestedTitle: string;
}

/**
 * Normalizes accents (NFD), removes special characters, and replaces spaces
 * with underscores to comply with Supabase Storage object key requirements.
 */
export function slugifyStorageKey(
  filename: string,
  courseCode: string,
  folder: 'chapters' | 'labs'
): string {
  const cleanName = filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents (e.g., à -> a, é -> e)
    .replace(/[^a-zA-Z0-9._-]/g, '_') // replace spaces and other symbols with _
    .replace(/_+/g, '_')
    .toLowerCase();

  return `${courseCode.toLowerCase()}/${folder}/${cleanName}`;
}

/**
 * Automatically infers chapter/lab number and human-readable title from file names.
 * Supports:
 * - Prefix + Sub-chapter: '1_ch1_html.pdf', '3_ch1_css.pdf', '7_ch5_css.pdf'
 * - Standard chapters: 'ch1_introduction à java.pdf', 'chapitre 3.pdf', 'chapter_4_classes.pdf'
 * - Leading numbers: '01_html_basics.pdf', '2 - css_layout.pdf'
 * - Labs & TPs: 'TP1.pdf', 'TP_1_mohamed_belhassen.pdf', 'TP_4_bis_...pdf', 'Lab_3.pdf'
 */
export function inferNumberAndTitle(filename: string, fallbackIndex = 1): InferredFileInfo {
  const base = filename.replace(/\.pdf$/i, '').trim();

  // 1. Check for Lab pattern: TP1, TP10, TP_1_name, Lab_3, TP_4_bis, etc.
  const labMatch = base.match(/^(?:tp|lab|td|activit[ée])[_\s-]*(\d+)[_\s-]*(.*)$/i);
  if (labMatch) {
    const num = parseInt(labMatch[1], 10);
    const rawTitle = labMatch[2] ? labMatch[2].replace(/[_\-]+/g, ' ').trim() : `TP ${num}`;
    const cleanTitle = rawTitle.length > 1 ? rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1) : `TP ${num}`;
    const isBis = base.toLowerCase().includes('bis');
    return {
      type: 'lab',
      number: num,
      code: `TP${num}${isBis ? '_BIS' : ''}`,
      suggestedTitle: cleanTitle.startsWith('TP') ? cleanTitle : `TP ${num} — ${cleanTitle}`,
    };
  }

  // 2. Check for Prefix number followed by Chapter (e.g. '1_ch1_html', '3_ch1_css', '7_ch5_css')
  const prefixChMatch = base.match(/^(\d+)[_\s.-]+(?:ch(?:ap(?:itre|ter)?)?)[_\s.-]*(\d*)[_\s.-]*(.*)$/i);
  if (prefixChMatch) {
    const globalNum = parseInt(prefixChMatch[1], 10);
    const subNum = prefixChMatch[2] ? parseInt(prefixChMatch[2], 10) : null;
    const remainder = prefixChMatch[3] ? prefixChMatch[3].replace(/[_\-]+/g, ' ').trim() : '';
    const cleanRemainder = remainder ? remainder.charAt(0).toUpperCase() + remainder.slice(1) : '';
    const subTag = subNum ? `CH${subNum}_` : '';
    const codeTag = cleanRemainder
      ? cleanRemainder.toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 16)
      : `PART${subNum || globalNum}`;

    return {
      type: 'chapter',
      number: globalNum,
      code: `CH${globalNum}_${subTag}${codeTag}`,
      suggestedTitle: cleanRemainder ? `Chapter ${globalNum} — ${cleanRemainder}` : `Chapter ${globalNum}`,
    };
  }

  // 3. Check for Standard Chapter pattern: ch3_les classes, chapter_1, etc.
  const chapterMatch = base.match(/^(?:ch|chap|chapitre|chapter)[_\s.-]*(\d+)[_\s.-]*(.*)$/i);
  if (chapterMatch) {
    const num = parseInt(chapterMatch[1], 10);
    const rawTitle = chapterMatch[2] ? chapterMatch[2].replace(/[_\-]+/g, ' ').trim() : `Chapitre ${num}`;
    const cleanTitle = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
    const codeTag = cleanTitle.length > 2
      ? cleanTitle.toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 16)
      : 'PART';

    return {
      type: 'chapter',
      number: num,
      code: `CH${num}_${codeTag}`,
      suggestedTitle: cleanTitle.length > 2 ? cleanTitle : `Chapitre ${num}`,
    };
  }

  // 4. Check for Simple leading number: 01_intro, 2-variables, 3. flexbox
  const leadingNumMatch = base.match(/^(\d+)[_\s.-]+(.*)$/);
  if (leadingNumMatch) {
    const num = parseInt(leadingNumMatch[1], 10);
    const rawTitle = leadingNumMatch[2] ? leadingNumMatch[2].replace(/[_\-]+/g, ' ').trim() : `Chapitre ${num}`;
    const cleanTitle = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
    const codeTag = cleanTitle.length > 2
      ? cleanTitle.toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 16)
      : 'PART';

    return {
      type: 'chapter',
      number: num,
      code: `CH${num}_${codeTag}`,
      suggestedTitle: cleanTitle.length > 2 ? cleanTitle : `Chapitre ${num}`,
    };
  }

  // 5. Fallback using fallbackIndex to guarantee strict uniqueness
  const num = fallbackIndex || 1;
  const slug = base.toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 16) || 'PART';
  return {
    type: 'chapter',
    number: num,
    code: `CH${num}_${slug}`,
    suggestedTitle: base.length > 1 ? base.charAt(0).toUpperCase() + base.slice(1) : `Chapter ${num}`,
  };
}

/**
 * Formats extracted text items from pdfjs-dist by preserving newlines (hasEOL)
 * and normalizing spacing without destroying document structure.
 */
export function formatExtractedTextContent(items: unknown[]): string {
  let result = '';
  for (const rawItem of items) {
    if (!rawItem || typeof rawItem !== 'object') continue;
    const item = rawItem as { str?: unknown; hasEOL?: unknown };
    const str = typeof item.str === 'string' ? item.str : '';
    const hasEOL = Boolean(item.hasEOL);

    if (str) {
      if (result.length > 0 && !result.endsWith('\n') && !result.endsWith(' ') && !str.startsWith(' ')) {
        result += ' ';
      }
      result += str;
    }

    if (hasEOL) {
      result += '\n';
    }
  }

  return result
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extracts text page by page client-side using pdfjs-dist.
 * Zero Node.js SSR conflicts or native dependencies.
 */
export async function extractPdfPagesInBrowser(file: File): Promise<ExtractedPage[]> {
  const pdfjsLib = await import('pdfjs-dist');

  // Configure local worker from public directory (PERF-12)
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  }

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;

  const pages: ExtractedPage[] = [];

  try {
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = formatExtractedTextContent(textContent.items);

      pages.push({
        page: pageNum,
        text: pageText,
      });
      page.cleanup();
    }
  } finally {
    await pdfDoc.cleanup();
    await loadingTask.destroy();
  }

  return pages;
}

/**
 * Ultra-fast client-side extraction of just the first slide/page (< 50ms)
 * for AI curriculum pre-flight analysis and optimal chapter ordering.
 */
export async function extractFirstPageInBrowser(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');

  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  }

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;

  try {
    if (pdfDoc.numPages === 0) return '';
    const page = await pdfDoc.getPage(1);
    const textContent = await page.getTextContent();
    const pageText = formatExtractedTextContent(textContent.items);
    page.cleanup();
    return pageText;
  } catch (err) {
    console.warn('[extractFirstPageInBrowser] Failed to extract page 1:', err);
    return '';
  } finally {
    await pdfDoc.cleanup();
    await loadingTask.destroy();
  }
}

/**
 * Extracts text page by page client-side directly from a Supabase Storage public PDF URL.
 * Enables 1-click re-analysis without requiring local files from judges.
 */
export async function extractPdfPagesFromUrl(pdfUrl: string): Promise<ExtractedPage[]> {
  const res = await fetch(pdfUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch PDF from URL: ${res.statusText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const pdfjsLib = await import('pdfjs-dist');

  // Configure local worker from public directory (PERF-12)
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  }

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;

  const pages: ExtractedPage[] = [];

  try {
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = formatExtractedTextContent(textContent.items);

      pages.push({
        page: pageNum,
        text: pageText,
      });
      page.cleanup();
    }
  } finally {
    await pdfDoc.cleanup();
    await loadingTask.destroy();
  }

  return pages;
}

/**
 * Uploads a course PDF to the public 'course-pdfs' Supabase Storage bucket
 * and returns its public URL for the SmartSlideViewerModal iframe.
 */
export async function uploadCoursePdf(file: File, storagePath: string): Promise<string> {
  const supabase = getBrowserSupabase();
  const bucket = supabase.storage.from('course-pdfs');

  const { error: uploadError } = await bucket.upload(storagePath, file, {
    upsert: true,
    contentType: 'application/pdf',
  });

  if (uploadError) {
    throw new Error(`Failed to upload PDF to Supabase Storage: ${uploadError.message}`);
  }

  const { data } = bucket.getPublicUrl(storagePath);
  return data.publicUrl;
}
