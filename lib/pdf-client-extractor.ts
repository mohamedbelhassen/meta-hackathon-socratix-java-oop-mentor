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
 * Supports: 'ch1_introduction à java.pdf', 'ch3_les classes.pdf', 'TP1.pdf', 'TP10.pdf'
 */
export function inferNumberAndTitle(filename: string): InferredFileInfo {
  const base = filename.replace(/\.pdf$/i, '').trim();

  // 1. Check for Chapter pattern: ch3_les classes, ch1_intro, etc.
  const chapterMatch = base.match(/^ch(\d+)[_\s-]*(.*)$/i);
  if (chapterMatch) {
    const num = parseInt(chapterMatch[1], 10);
    const rawTitle = chapterMatch[2] ? chapterMatch[2].replace(/[_\-]+/g, ' ').trim() : `Chapitre ${num}`;
    const cleanTitle = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
    return {
      type: 'chapter',
      number: num,
      code: `CH${num}_${cleanTitle.toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 16)}`,
      suggestedTitle: cleanTitle.length > 2 ? cleanTitle : `Chapitre ${num}`,
    };
  }

  // 2. Check for Lab pattern: TP1, TP10, TP_5, Lab_3, etc.
  const labMatch = base.match(/^(?:tp|lab)[_\s-]*(\d+)[_\s-]*(.*)$/i);
  if (labMatch) {
    const num = parseInt(labMatch[1], 10);
    const rawTitle = labMatch[2] ? labMatch[2].replace(/[_\-]+/g, ' ').trim() : `TP ${num}`;
    const cleanTitle = rawTitle.length > 1 ? rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1) : `TP ${num}`;
    return {
      type: 'lab',
      number: num,
      code: `TP${num}`,
      suggestedTitle: cleanTitle.startsWith('TP') ? cleanTitle : `TP ${num} — ${cleanTitle}`,
    };
  }

  // Fallback
  return {
    type: 'chapter',
    number: 1,
    code: 'CH1_MATERIAL',
    suggestedTitle: base,
  };
}

/**
 * Extracts text page by page client-side using pdfjs-dist.
 * Zero Node.js SSR conflicts or native dependencies.
 */
export async function extractPdfPagesInBrowser(file: File): Promise<ExtractedPage[]> {
  const pdfjsLib = await import('pdfjs-dist');

  // Configure worker
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;

  const pages: ExtractedPage[] = [];

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ('str' in item && typeof (item as { str: unknown }).str === 'string' ? (item as { str: string }).str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    pages.push({
      page: pageNum,
      text: pageText,
    });
  }

  return pages;
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

  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;

  const pages: ExtractedPage[] = [];

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ('str' in item && typeof (item as { str: unknown }).str === 'string' ? (item as { str: string }).str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    pages.push({
      page: pageNum,
      text: pageText,
    });
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
