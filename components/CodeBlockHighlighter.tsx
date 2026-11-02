'use client';

import React from 'react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

SyntaxHighlighter.registerLanguage('java', java);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('json', json);

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
  const normalizedLang = language.toLowerCase().replace(/^\./, '');
  const safeLang = ['java', 'javascript', 'typescript', 'python', 'json'].includes(normalizedLang)
    ? normalizedLang
    : 'java';

  return (
    <SyntaxHighlighter
      language={safeLang}
      style={vscDarkPlus}
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

export { SyntaxHighlighter, vscDarkPlus };
export default CodeBlockHighlighter;
