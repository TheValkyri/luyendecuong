import React, { useMemo } from 'react';
import katex from 'katex';
import { sanitizeWordHtml } from '../lib/security-utils';

interface MathTextProps {
  text: string;
  className?: string;
}

/**
 * Renders mixed Vietnamese/English educational text and inline/display LaTeX ($...$ or $$...$$)
 * using KaTeX while sanitizing all HTML against XSS payloads (Section 6.5).
 */
export const MathText: React.FC<MathTextProps> = ({ text, className = '' }) => {
  const renderedHtml = useMemo(() => {
    if (!text) return '';
    const safeInput = sanitizeWordHtml(text);

    // Split by $$...$$ or $...$
    const tokenRegex = /(\$\$[\s\S]+?\$\$|\$[^$]+?\$)/g;
    const parts = safeInput.split(tokenRegex);

    return parts
      .map((part) => {
        if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
          const tex = part.slice(2, -2).trim();
          try {
            return katex.renderToString(tex, {
              displayMode: true,
              throwOnError: false,
              strict: false,
            });
          } catch {
            return `<code class="px-1.5 py-0.5 rounded bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] font-mono text-xs">${tex}</code>`;
          }
        }
        if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
          const tex = part.slice(1, -1).trim();
          try {
            return katex.renderToString(tex, {
              displayMode: false,
              throwOnError: false,
              strict: false,
            });
          } catch {
            return `<code class="px-1.5 py-0.5 rounded bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] font-mono text-xs">${tex}</code>`;
          }
        }
        return part
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br/>');
      })
      .join('');
  }, [text]);

  return (
    <span
      className={`leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
};
