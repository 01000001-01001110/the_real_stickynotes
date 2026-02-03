/**
 * HTML Utility Tests
 */

const { escapeHtml } = require('../../../shared/utils/html');

describe('HTML Utilities', () => {
  describe('escapeHtml', () => {
    it('should escape ampersand', () => {
      expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
    });

    it('should escape less than', () => {
      expect(escapeHtml('foo < bar')).toBe('foo &lt; bar');
    });

    it('should escape greater than', () => {
      expect(escapeHtml('foo > bar')).toBe('foo &gt; bar');
    });

    it('should escape double quotes', () => {
      expect(escapeHtml('foo "bar"')).toBe('foo &quot;bar&quot;');
    });

    it('should escape single quotes', () => {
      expect(escapeHtml("foo 'bar'")).toBe('foo &#039;bar&#039;');
    });

    it('should escape all special characters together', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      );
    });

    it('should return empty string for null input', () => {
      expect(escapeHtml(null)).toBe('');
    });

    it('should return empty string for undefined input', () => {
      expect(escapeHtml(undefined)).toBe('');
    });

    it('should return empty string for empty string input', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should return unchanged string with no special characters', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World');
    });

    it('should handle HTML attributes safely', () => {
      expect(escapeHtml('onclick="evil()"')).toBe('onclick=&quot;evil()&quot;');
    });
  });
});
