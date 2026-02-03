/**
 * Paste Handling and Link Tests
 * Tests for URL detection, HTML sanitization, and link handling in the note editor
 */

describe('Paste Handling', () => {
  // Helper function that mirrors the one in note.js
  function escapeHtml(text) {
    const div = { textContent: '', innerHTML: '' };
    div.textContent = text;
    // Simulate DOM behavior
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  describe('URL Pattern Detection', () => {
    const urlPattern = /^(https?:\/\/|www\.)[^\s]+$/i;

    it('should match https URLs', () => {
      expect(urlPattern.test('https://example.com')).toBe(true);
      expect(urlPattern.test('https://www.example.com')).toBe(true);
      expect(urlPattern.test('https://example.com/path')).toBe(true);
      expect(urlPattern.test('https://example.com/path?query=1')).toBe(true);
    });

    it('should match http URLs', () => {
      expect(urlPattern.test('http://example.com')).toBe(true);
      expect(urlPattern.test('http://localhost:3000')).toBe(true);
    });

    it('should match www URLs', () => {
      expect(urlPattern.test('www.example.com')).toBe(true);
      expect(urlPattern.test('www.example.com/path')).toBe(true);
    });

    it('should match URLs with special characters', () => {
      // This is the actual URL from user testing
      const complexUrl = 'https://a.storyblok.com/f/178900/960x540/5963690076/solo-leveling-episode-25.jpg/m/filters:quality(95)format(webp)';
      expect(urlPattern.test(complexUrl)).toBe(true);
    });

    it('should match URLs with parentheses', () => {
      expect(urlPattern.test('https://example.com/path(1)')).toBe(true);
      expect(urlPattern.test('https://en.wikipedia.org/wiki/Test_(disambiguation)')).toBe(true);
    });

    it('should not match plain text', () => {
      expect(urlPattern.test('hello world')).toBe(false);
      expect(urlPattern.test('not a url')).toBe(false);
      expect(urlPattern.test('example.com')).toBe(false); // No protocol or www
    });

    it('should not match partial URLs with spaces', () => {
      expect(urlPattern.test('https://example.com with spaces')).toBe(false);
      expect(urlPattern.test('https://example .com')).toBe(false);
    });

    it('should not match empty strings', () => {
      expect(urlPattern.test('')).toBe(false);
    });
  });

  describe('URL Prefix Handling', () => {
    function addHttpsPrefix(url) {
      return url.startsWith('www.') ? 'https://' + url : url;
    }

    it('should add https:// to www URLs', () => {
      expect(addHttpsPrefix('www.example.com')).toBe('https://www.example.com');
    });

    it('should not modify URLs that already have protocol', () => {
      expect(addHttpsPrefix('https://example.com')).toBe('https://example.com');
      expect(addHttpsPrefix('http://example.com')).toBe('http://example.com');
    });
  });

  describe('HTML Escaping', () => {
    it('should escape HTML special characters', () => {
      expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
      expect(escapeHtml('a & b')).toBe('a &amp; b');
      expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
    });

    it('should handle URLs with special characters safely', () => {
      const url = 'https://example.com?a=1&b=2';
      const escaped = escapeHtml(url);
      expect(escaped).toBe('https://example.com?a=1&amp;b=2');
    });

    it('should handle empty strings', () => {
      expect(escapeHtml('')).toBe('');
    });
  });

  describe('Link HTML Generation', () => {
    function generateLinkHtml(url) {
      const href = url.startsWith('www.') ? 'https://' + url : url;
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`;
    }

    it('should generate valid link HTML', () => {
      const html = generateLinkHtml('https://example.com');
      expect(html).toContain('href="https://example.com"');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener noreferrer"');
    });

    it('should add https to www URLs in href', () => {
      const html = generateLinkHtml('www.example.com');
      expect(html).toContain('href="https://www.example.com"');
      expect(html).toContain('>www.example.com</a>'); // Display text should not have https
    });

    it('should escape display text but not href', () => {
      const url = 'https://example.com?a=1&b=2';
      const html = generateLinkHtml(url);
      expect(html).toContain('href="https://example.com?a=1&b=2"');
      expect(html).toContain('&amp;'); // Escaped in display text
    });
  });
});

describe('HTML Sanitization', () => {
  // Simplified sanitization logic for testing
  function isValidExternalUrl(href) {
    return href && (href.startsWith('http://') || href.startsWith('https://'));
  }

  describe('URL Validation', () => {
    it('should accept http URLs', () => {
      expect(isValidExternalUrl('http://example.com')).toBe(true);
    });

    it('should accept https URLs', () => {
      expect(isValidExternalUrl('https://example.com')).toBe(true);
    });

    it('should reject javascript URLs', () => {
      expect(isValidExternalUrl('javascript:alert(1)')).toBe(false);
    });

    it('should reject data URLs', () => {
      expect(isValidExternalUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    });

    it('should reject relative URLs', () => {
      expect(isValidExternalUrl('/path/to/page')).toBe(false);
      expect(isValidExternalUrl('../page')).toBe(false);
    });

    it('should reject empty/null values', () => {
      expect(isValidExternalUrl('')).toBeFalsy();
      expect(isValidExternalUrl(null)).toBeFalsy();
      expect(isValidExternalUrl(undefined)).toBeFalsy();
    });
  });

  describe('Dangerous Element Detection', () => {
    const dangerousTags = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'meta', 'link'];

    it('should identify dangerous tags', () => {
      dangerousTags.forEach(tag => {
        expect(dangerousTags.includes(tag)).toBe(true);
      });
    });

    it('should not include safe tags', () => {
      const safeTags = ['a', 'p', 'div', 'span', 'ul', 'li', 'b', 'i'];
      safeTags.forEach(tag => {
        expect(dangerousTags.includes(tag)).toBe(false);
      });
    });
  });

  describe('Event Handler Detection', () => {
    function isEventHandler(attrName) {
      return attrName.startsWith('on');
    }

    it('should detect onclick', () => {
      expect(isEventHandler('onclick')).toBe(true);
    });

    it('should detect onmouseover', () => {
      expect(isEventHandler('onmouseover')).toBe(true);
    });

    it('should detect onerror', () => {
      expect(isEventHandler('onerror')).toBe(true);
    });

    it('should not flag regular attributes', () => {
      expect(isEventHandler('href')).toBe(false);
      expect(isEventHandler('class')).toBe(false);
      expect(isEventHandler('id')).toBe(false);
      expect(isEventHandler('data-note-id')).toBe(false);
    });
  });
});

describe('Link Click Handling', () => {
  describe('Modifier Key Detection', () => {
    function shouldOpenLink(event) {
      return event.ctrlKey || event.metaKey;
    }

    it('should open link on Ctrl+click', () => {
      expect(shouldOpenLink({ ctrlKey: true, metaKey: false })).toBe(true);
    });

    it('should open link on Cmd+click (Mac)', () => {
      expect(shouldOpenLink({ ctrlKey: false, metaKey: true })).toBe(true);
    });

    it('should not open link on plain click', () => {
      expect(shouldOpenLink({ ctrlKey: false, metaKey: false })).toBe(false);
    });

    it('should open link when both modifiers pressed', () => {
      expect(shouldOpenLink({ ctrlKey: true, metaKey: true })).toBe(true);
    });
  });

  describe('External Link Detection', () => {
    function isExternalLink(href) {
      return href && href.startsWith('http');
    }

    it('should detect https links as external', () => {
      expect(isExternalLink('https://example.com')).toBe(true);
    });

    it('should detect http links as external', () => {
      expect(isExternalLink('http://example.com')).toBe(true);
    });

    it('should not detect hash links as external', () => {
      expect(isExternalLink('#section')).toBe(false);
    });

    it('should not detect wiki links as external', () => {
      expect(isExternalLink('#')).toBe(false); // Wiki links use href="#"
    });
  });
});

describe('Markdown Auto-formatting', () => {
  describe('Space Detection', () => {
    function isSpaceChar(char) {
      return char === ' ' || char === '\u00A0';
    }

    it('should detect regular space', () => {
      expect(isSpaceChar(' ')).toBe(true);
    });

    it('should detect non-breaking space', () => {
      expect(isSpaceChar('\u00A0')).toBe(true);
    });

    it('should not detect other characters', () => {
      expect(isSpaceChar('a')).toBe(false);
      expect(isSpaceChar('\t')).toBe(false);
      expect(isSpaceChar('\n')).toBe(false);
    });
  });

  describe('Space Normalization', () => {
    function normalizeSpaces(text) {
      return text.replace(/\u00A0/g, ' ');
    }

    it('should convert non-breaking spaces to regular spaces', () => {
      expect(normalizeSpaces('hello\u00A0world')).toBe('hello world');
    });

    it('should handle multiple non-breaking spaces', () => {
      expect(normalizeSpaces('#\u00A0\u00A0')).toBe('#  ');
    });

    it('should not modify text without non-breaking spaces', () => {
      expect(normalizeSpaces('hello world')).toBe('hello world');
    });
  });

  describe('Markdown Pattern Detection', () => {
    const patterns = {
      h1: /^#\s$/,
      h2: /^##\s$/,
      h3: /^###\s$/,
      bullet: /^[-*]\s$/,
      ordered: /^\d+\.\s$/,
      blockquote: /^>\s$/,
      checkbox: /^\[\]\s$/,
      code: /^`\s$/
    };

    it('should detect heading 1 pattern', () => {
      expect(patterns.h1.test('# ')).toBe(true);
      expect(patterns.h1.test('## ')).toBe(false);
    });

    it('should detect heading 2 pattern', () => {
      expect(patterns.h2.test('## ')).toBe(true);
      expect(patterns.h2.test('# ')).toBe(false);
    });

    it('should detect heading 3 pattern', () => {
      expect(patterns.h3.test('### ')).toBe(true);
    });

    it('should detect bullet list patterns', () => {
      expect(patterns.bullet.test('- ')).toBe(true);
      expect(patterns.bullet.test('* ')).toBe(true);
    });

    it('should detect ordered list pattern', () => {
      expect(patterns.ordered.test('1. ')).toBe(true);
      expect(patterns.ordered.test('2. ')).toBe(true);
      expect(patterns.ordered.test('99. ')).toBe(true);
    });

    it('should detect blockquote pattern', () => {
      expect(patterns.blockquote.test('> ')).toBe(true);
    });

    it('should detect checkbox pattern', () => {
      expect(patterns.checkbox.test('[] ')).toBe(true);
    });

    it('should detect code block pattern', () => {
      expect(patterns.code.test('` ')).toBe(true);
    });
  });
});
