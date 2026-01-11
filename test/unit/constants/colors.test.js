/**
 * Colors Constants Tests
 */
const {
  colors,
  colorList,
  getColor,
  isValidColor,
} = require('../../../shared/constants/colors');

describe('Colors Constants', () => {
  describe('colors object', () => {
    it('should contain 8 color themes', () => {
      expect(Object.keys(colors)).toHaveLength(8);
    });

    it('should have all required color names', () => {
      const expectedColors = ['yellow', 'pink', 'blue', 'green', 'purple', 'orange', 'gray', 'charcoal'];
      for (const colorName of expectedColors) {
        expect(colors[colorName]).toBeDefined();
      }
    });

    it('should have required properties for each color', () => {
      for (const [name, color] of Object.entries(colors)) {
        expect(color.id).toBe(name);
        expect(color.name).toBeDefined();
        expect(color.bg).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(color.title).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(color.hover).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(color.text).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(color.border).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });

    it('should have user-friendly names', () => {
      expect(colors.yellow.name).toBe('Sunny');
      expect(colors.pink.name).toBe('Rose');
      expect(colors.blue.name).toBe('Sky');
      expect(colors.green.name).toBe('Mint');
      expect(colors.purple.name).toBe('Lavender');
      expect(colors.orange.name).toBe('Sunset');
      expect(colors.gray.name).toBe('Slate');
      expect(colors.charcoal.name).toBe('Night');
    });
  });

  describe('colorList', () => {
    it('should be an array of color names', () => {
      expect(Array.isArray(colorList)).toBe(true);
      expect(colorList).toHaveLength(8);
    });

    it('should contain all color names', () => {
      expect(colorList).toContain('yellow');
      expect(colorList).toContain('pink');
      expect(colorList).toContain('blue');
      expect(colorList).toContain('green');
      expect(colorList).toContain('purple');
      expect(colorList).toContain('orange');
      expect(colorList).toContain('gray');
      expect(colorList).toContain('charcoal');
    });
  });

  describe('getColor', () => {
    it('should return color object for valid color', () => {
      const yellow = getColor('yellow');
      expect(yellow).toBe(colors.yellow);
    });

    it('should return yellow as default for invalid color', () => {
      const result = getColor('invalid');
      expect(result).toBe(colors.yellow);
    });

    it('should return yellow for undefined', () => {
      const result = getColor(undefined);
      expect(result).toBe(colors.yellow);
    });

    it('should return yellow for null', () => {
      const result = getColor(null);
      expect(result).toBe(colors.yellow);
    });
  });

  describe('isValidColor', () => {
    it('should return true for valid colors', () => {
      for (const colorName of colorList) {
        expect(isValidColor(colorName)).toBe(true);
      }
    });

    it('should return false for invalid colors', () => {
      expect(isValidColor('red')).toBe(false);
      expect(isValidColor('invalid')).toBe(false);
      expect(isValidColor('')).toBe(false);
      expect(isValidColor(null)).toBe(false);
      expect(isValidColor(undefined)).toBe(false);
    });

    it('should be case-sensitive', () => {
      expect(isValidColor('Yellow')).toBe(false);
      expect(isValidColor('YELLOW')).toBe(false);
    });
  });
});
