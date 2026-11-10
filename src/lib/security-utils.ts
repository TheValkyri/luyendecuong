/**
 * Section 6.5: Security & Privacy Utilities
 * - Strict HTML / Word Content Sanitizer (Blocks XSS from imported Word files or editor inputs)
 * - CSV Injection Prevention (Sanitizes cells starting with =, +, -, @, \t, \r)
 * - Input Validation Helpers
 */

const DANGEROUS_TAGS_REGEX =
  /<\s*\/?\s*(script|iframe|object|embed|applet|meta|link|style|form|input|button|textarea|base|svg\s+onload)[^>]*>/gi;

const EVENT_HANDLER_ATTR_REGEX = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

const JAVASCRIPT_PROTOCOL_REGEX =
  /(href|src|xlink:href|action|formaction)\s*=\s*(?:"\s*(?:javascript|vbscript|data:text\/html)[^"]*"|'\s*(?:javascript|vbscript|data:text\/html)[^']*')/gi;

/**
 * Sanitizes HTML / rich text imported from Word documents or user editors.
 * Strips executable tags (<script>, <iframe>, <object>, etc.), inline event handlers (onerror, onload),
 * and dangerous URI schemes (javascript:, data:text/html).
 */
export function sanitizeWordHtml(dirtyHtml: string): string {
  if (!dirtyHtml || typeof dirtyHtml !== 'string') return '';

  let cleaned = dirtyHtml;
  // Remove script/style/iframe block contents completely
  cleaned = cleaned.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '');
  cleaned = cleaned.replace(/<\s*style[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, '');
  cleaned = cleaned.replace(/<\s*iframe[^>]*>[\s\S]*?<\s*\/\s*iframe\s*>/gi, '');
  cleaned = cleaned.replace(/<\s*object[^>]*>[\s\S]*?<\s*\/\s*object\s*>/gi, '');

  // Strip remaining dangerous tags
  cleaned = cleaned.replace(DANGEROUS_TAGS_REGEX, '');
  // Strip inline on* attributes
  cleaned = cleaned.replace(EVENT_HANDLER_ATTR_REGEX, '');
  // Strip javascript:/data:text/html protocols
  cleaned = cleaned.replace(JAVASCRIPT_PROTOCOL_REGEX, '$1="#"');
  // Strip raw javascript: strings if unquoted
  cleaned = cleaned.replace(/javascript\s*:/gi, 'blocked:');

  return cleaned.trim();
}

/**
 * Escapes a single CSV cell to prevent both CSV syntax breakage and Spreadsheet Formula Injection (CWE-1236).
 * Any value starting with =, +, -, @, Tab (\t), or Carriage Return (\r) is prefixed with a single quote (')
 * unless it is a pure finite negative number (e.g. -12.5).
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let str = String(value);

  const trimmed = str.trimStart();
  const startsWithFormulaTrigger =
    trimmed.startsWith('=') ||
    trimmed.startsWith('+') ||
    trimmed.startsWith('@') ||
    trimmed.startsWith('\t') ||
    trimmed.startsWith('\r') ||
    (trimmed.startsWith('-') && !/^-\d+(\.\d+)?$/.test(trimmed));

  if (startsWithFormulaTrigger || /^[\t\r]/.test(str)) {
    str = `'${str}`;
  }

  const escapedQuotes = str.replace(/"/g, '""');
  return `"${escapedQuotes}"`;
}

/**
 * Generates a complete, RFC-4180 compliant, formula-injection-safe CSV string.
 */
export function generateSafeCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const headerLine = headers.map((h) => escapeCsvCell(h)).join(',');
  const dataLines = rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(','));
  return [headerLine, ...dataLines].join('\r\n');
}
