'use client';

import React from 'react';
import { ExternalLink, X, FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string | null;
  title: string;
}

export default function PdfViewerModal({
  isOpen,
  onClose,
  pdfUrl,
  title,
}: PdfViewerModalProps) {
  if (!isOpen || !pdfUrl) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-cyan-50 dark:bg-cyan-500/10 rounded-xl text-cyan-600 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-500/20 shrink-0 shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div className="truncate">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">
                {title}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                Official PDF Document &bull; In-Situ Reader
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold gap-1.5 shadow-xs"
              onClick={() => window.open(pdfUrl, '_blank')}
              title="Open PDF in a new browser tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in New Tab</span>
            </Button>
            <a
              href={pdfUrl}
              download
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center h-8 px-3 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 gap-1.5 transition shadow-xs"
              title="Download PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </a>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-lg ml-1"
              onClick={onClose}
              title="Close PDF reader"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* PDF Viewer Body */}
        <div className="flex-1 w-full bg-slate-100 dark:bg-slate-950 p-2 overflow-hidden">
          <iframe
            src={`${pdfUrl}#view=FitH`}
            className="w-full h-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white shadow-inner"
            title={title}
          />
        </div>
      </div>
    </div>
  );
}

