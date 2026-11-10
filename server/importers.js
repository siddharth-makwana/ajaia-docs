import path from 'node:path';
import mammoth from 'mammoth';
import { marked } from 'marked';
import { sanitizeContent } from './sanitize.js';

export const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.markdown', '.docx'];
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export class ImportError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function textToHtml(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Convert an uploaded file into { title, content } ready to store as a document. */
export async function fileToDocument(originalName, buffer) {
  const ext = path.extname(originalName || '').toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new ImportError(`Unsupported file type "${ext || 'unknown'}". Supported: .txt, .md, .docx`, 415);
  }
  if (!buffer?.length) throw new ImportError('The uploaded file is empty');

  let html;
  if (ext === '.docx') {
    try {
      html = (await mammoth.convertToHtml({ buffer })).value;
    } catch {
      throw new ImportError('Could not read this .docx file. Is it a valid Word document?');
    }
  } else {
    const text = buffer.toString('utf8');
    if (text.includes('\u0000')) throw new ImportError('This file does not look like plain text');
    html = ext === '.txt' ? textToHtml(text) : await marked.parse(text);
  }

  const title = path.basename(originalName, path.extname(originalName)).trim().slice(0, 200) || 'Imported document';
  return { title, content: sanitizeContent(html) };
}
