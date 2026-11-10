import sanitizeHtml from 'sanitize-html';

/**
 * The editor only produces a small set of tags. Anything else (scripts, styles,
 * event handlers, iframes) is stripped server-side before it is persisted, so a
 * shared document can never carry XSS to another user.
 */
const OPTIONS = {
  allowedTags: [
    'p', 'br', 'h1', 'h2', 'h3', 'strong', 'b', 'em', 'i', 'u', 's',
    'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'hr', 'a',
  ],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    b: 'strong',
    i: 'em',
    h4: 'h3', h5: 'h3', h6: 'h3',
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
  },
};

export function sanitizeContent(html) {
  return sanitizeHtml(String(html ?? ''), OPTIONS);
}
