'use client';

import React, { useEffect, useMemo, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import { java } from '@codemirror/lang-java';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { cpp } from '@codemirror/lang-cpp';

export interface WorkspaceCodeEditorProps {
  value: string;
  language?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  className?: string;
}

function resolveLanguageExtension(language: string) {
  const normalized = language.toLowerCase().replace(/^\./, '');
  switch (normalized) {
    case 'java':
    case 'kotlin':
    case 'kt':
    case 'kts':
      // Kotlin falls back to Java highlighting (close enough for lab presets)
      return java();
    case 'javascript':
    case 'js':
    case 'jsx':
      return javascript({ jsx: true });
    case 'typescript':
    case 'ts':
    case 'tsx':
      return javascript({ jsx: true, typescript: true });
    case 'python':
    case 'py':
      return python();
    case 'html':
    case 'htm':
    case 'markup':
      return html();
    case 'css':
      return css();
    case 'json':
      return json();
    case 'markdown':
    case 'md':
      return markdown();
    case 'c':
    case 'h':
    case 'cpp':
    case 'hpp':
      return cpp();
    default:
      return [];
  }
}

const editorChrome = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '12px',
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    lineHeight: '1.55',
  },
  '.cm-content': {
    padding: '12px 0',
  },
  '.cm-gutters': {
    border: 'none',
  },
});

export function WorkspaceCodeEditor({
  value,
  language = 'java',
  readOnly = false,
  onChange,
  className = '',
}: WorkspaceCodeEditorProps) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkTheme();
    window.addEventListener('socratix-theme-change', checkTheme);
    return () => window.removeEventListener('socratix-theme-change', checkTheme);
  }, []);

  const extensions = useMemo(
    () => [
      resolveLanguageExtension(language),
      editorChrome,
      EditorView.lineWrapping,
      ...(readOnly ? [EditorView.editable.of(false)] : []),
    ],
    [language, readOnly]
  );

  return (
    <div className={`h-full min-h-0 w-full overflow-hidden ${className}`}>
      <CodeMirror
        value={value}
        height="100%"
        theme={isDark ? vscodeDark : vscodeLight}
        extensions={extensions}
        editable={!readOnly}
        readOnly={readOnly}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: !readOnly,
          highlightActiveLineGutter: !readOnly,
          foldGutter: true,
          bracketMatching: true,
          closeBrackets: !readOnly,
          autocompletion: false,
          searchKeymap: true,
        }}
        onChange={(next) => {
          if (!readOnly && onChange) onChange(next);
        }}
        className="h-full text-xs"
      />
    </div>
  );
}

export default WorkspaceCodeEditor;
