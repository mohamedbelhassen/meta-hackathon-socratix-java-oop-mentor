'use client';

import React, { useEffect, useState } from 'react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import kotlin from 'react-syntax-highlighter/dist/esm/languages/prism/kotlin';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import c from 'react-syntax-highlighter/dist/esm/languages/prism/c';
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp';
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

SyntaxHighlighter.registerLanguage('java', java);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('html', markup);
SyntaxHighlighter.registerLanguage('markup', markup);
SyntaxHighlighter.registerLanguage('kotlin', kotlin);
SyntaxHighlighter.registerLanguage('tsx', tsx);
SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('c', c);
SyntaxHighlighter.registerLanguage('cpp', cpp);

export interface CodeBlockHighlighterProps {
  language?: string;
  code: string;
  showLineNumbers?: boolean;
  fontSize?: string;
  className?: string;
  customStyle?: React.CSSProperties;
}

export function CodeBlockHighlighter({
  language = 'java',
  code,
  showLineNumbers = true,
  fontSize = '12px',
  customStyle,
}: CodeBlockHighlighterProps) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkTheme();

    window.addEventListener('socratix-theme-change', checkTheme);
    return () => window.removeEventListener('socratix-theme-change', checkTheme);
  }, []);

  const normalizedLang = language.toLowerCase().replace(/^\./, '');
  const langMap: Record<string, string> = {
    js: 'javascript',
    javascript: 'javascript',
    ts: 'typescript',
    typescript: 'typescript',
    tsx: 'tsx',
    jsx: 'jsx',
    py: 'python',
    python: 'python',
    java: 'java',
    json: 'json',
    css: 'css',
    html: 'html',
    htm: 'html',
    markup: 'html',
    kt: 'kotlin',
    kts: 'kotlin',
    kotlin: 'kotlin',
    c: 'c',
    h: 'c',
    cpp: 'cpp',
    hpp: 'cpp',
  };
  const safeLang = langMap[normalizedLang] || 'java';

  return (
    <SyntaxHighlighter
      language={safeLang}
      style={isDark ? vscDarkPlus : oneLight}
      showLineNumbers={showLineNumbers}
      customStyle={{
        background: 'transparent',
        margin: 0,
        padding: '1rem',
        fontSize,
        lineHeight: '1.5',
        ...customStyle,
      }}
    >
      {code}
    </SyntaxHighlighter>
  );
}

export { SyntaxHighlighter, vscDarkPlus, oneLight };
export default CodeBlockHighlighter;
