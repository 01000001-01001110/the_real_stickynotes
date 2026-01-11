/**
 * Input validation utilities
 */
const { colorList, isValidColor } = require('../constants/colors');

// Maximum content sizes
const MAX_TITLE_LENGTH = 500;
const MAX_CONTENT_LENGTH = 1024 * 1024; // 1MB
const MAX_TAG_NAME_LENGTH = 50;
const MAX_FOLDER_NAME_LENGTH = 100;
const MAX_SEARCH_QUERY_LENGTH = 500;
const MIN_PASSWORD_LENGTH = 4;
const MAX_PASSWORD_LENGTH = 128;

/**
 * Validate note input data
 * @param {object} data - Note data to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateNote(data) {
  const errors = [];

  if (data.title !== undefined && typeof data.title !== 'string') {
    errors.push('Title must be a string');
  }

  if (data.title && data.title.length > MAX_TITLE_LENGTH) {
    errors.push(`Title must be ${MAX_TITLE_LENGTH} characters or less`);
  }

  if (data.content !== undefined && typeof data.content !== 'string') {
    errors.push('Content must be a string');
  }

  if (data.content && data.content.length > MAX_CONTENT_LENGTH) {
    errors.push(`Content must be ${MAX_CONTENT_LENGTH} bytes or less`);
  }

  if (data.color !== undefined && !isValidColor(data.color)) {
    errors.push(`Color must be one of: ${colorList.join(', ')}`);
  }

  if (data.width !== undefined && (typeof data.width !== 'number' || data.width < 150 || data.width > 5000)) {
    errors.push('Width must be a number between 150 and 5000');
  }

  if (data.height !== undefined && (typeof data.height !== 'number' || data.height < 150 || data.height > 5000)) {
    errors.push('Height must be a number between 150 and 5000');
  }

  if (data.opacity !== undefined && (typeof data.opacity !== 'number' || data.opacity < 50 || data.opacity > 100)) {
    errors.push('Opacity must be a number between 50 and 100');
  }

  if (data.reminder_at !== undefined && data.reminder_at !== null) {
    const date = new Date(data.reminder_at);
    if (isNaN(date.getTime())) {
      errors.push('reminder_at must be a valid ISO date string');
    }
  }
  
  // Validate position values
  if (data.position_x !== undefined && (typeof data.position_x !== 'number' || !Number.isFinite(data.position_x))) {
    errors.push('position_x must be a finite number');
  }
  
  if (data.position_y !== undefined && (typeof data.position_y !== 'number' || !Number.isFinite(data.position_y))) {
    errors.push('position_y must be a finite number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate folder input data
 * @param {object} data - Folder data to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateFolder(data) {
  const errors = [];

  if (data.name === undefined || data.name === null || data.name === '') {
    errors.push('Name is required');
  }

  if (data.name && typeof data.name !== 'string') {
    errors.push('Name must be a string');
  }

  if (data.name && data.name.length > 100) {
    errors.push('Name must be 100 characters or less');
  }

  if (data.color !== undefined && data.color !== null && !isValidColor(data.color)) {
    errors.push(`Color must be one of: ${colorList.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate tag input data
 * @param {object} data - Tag data to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateTag(data) {
  const errors = [];

  if (data.name === undefined || data.name === null || data.name === '') {
    errors.push('Name is required');
  }

  if (data.name && typeof data.name !== 'string') {
    errors.push('Name must be a string');
  }

  // Only perform string operations if it's actually a string
  if (data.name && typeof data.name === 'string') {
    if (data.name.length > 50) {
      errors.push('Name must be 50 characters or less');
    }

    // Allow unicode letters, numbers, spaces, underscores, hyphens
    // Disallow dangerous chars like < > / \ : * ? " | and control characters
    // eslint-disable-next-line no-control-regex
    if (/[<>\\/:*?"|\u0000-\u001f]/.test(data.name)) {
      errors.push('Name contains invalid characters');
    }
    
    // Trim check - name shouldn't be only whitespace
    if (data.name.trim().length === 0) {
      errors.push('Name cannot be empty or whitespace only');
    }
  }

  if (data.color !== undefined && data.color !== null && !isValidColor(data.color)) {
    errors.push(`Color must be one of: ${colorList.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitize a string for safe display
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.trim();
}

/**
 * Validate search query input
 * @param {string} query - Search query to validate
 * @returns {{ valid: boolean, errors: string[], sanitized: string }}
 */
function validateSearchQuery(query) {
  const errors = [];
  
  if (typeof query !== 'string') {
    return { valid: false, errors: ['Query must be a string'], sanitized: '' };
  }
  
  const trimmed = query.trim();
  
  if (trimmed.length > MAX_SEARCH_QUERY_LENGTH) {
    errors.push(`Query must be ${MAX_SEARCH_QUERY_LENGTH} characters or less`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    sanitized: trimmed,
  };
}

/**
 * Sanitize a search query for FTS5
 * Removes dangerous characters and formats safely
 * @param {string} query - Raw search query
 * @returns {string} Safe FTS5 query or empty string
 */
function sanitizeFtsQuery(query) {
  if (typeof query !== 'string') return '';
  
  const trimmed = query.trim();
  if (!trimmed || trimmed.length > MAX_SEARCH_QUERY_LENGTH) return '';
  
  // Split into terms, filter empty, and wrap each safely
  // Only allow alphanumeric, spaces, and basic punctuation
  const safeTerms = trimmed
    .split(/\s+/)
    .filter(term => term.length > 0 && term.length <= 100)
    .map(term => {
      // Remove all FTS5 special characters: " ' * - + ( ) { } [ ] ^ ~ : \ /
      const safeTerm = term.replace(/['"*+\-(){}[\]^~:\\/]/g, '');
      // Only keep alphanumeric and unicode letters
      return safeTerm.replace(/[^\p{L}\p{N}_]/gu, '');
    })
    .filter(term => term.length > 0);
  
  if (safeTerms.length === 0) return '';
  
  // Build safe FTS5 query with proper quoting
  // Use prefix matching for better UX
  return safeTerms.map(term => `"${term}"*`).join(' OR ');
}

/**
 * Validate a limit parameter
 * @param {any} value - Value to validate
 * @param {number} maxLimit - Maximum allowed limit
 * @returns {number|null} Validated limit or null
 */
function validateLimit(value, maxLimit = 1000) {
  if (value === undefined || value === null) return null;
  
  const num = parseInt(value, 10);
  if (isNaN(num) || num < 1) return null;
  
  return Math.min(num, maxLimit);
}

/**
 * Validate a days parameter (for purge, etc.)
 * @param {any} value - Value to validate
 * @returns {number} Validated days (defaults to 0 if invalid)
 */
function validateDays(value) {
  if (value === undefined || value === null) return 0;
  
  const num = parseInt(value, 10);
  if (isNaN(num) || num < 0) return 0;
  
  return num;
}

/**
 * Validate an ID string
 * @param {any} id - ID to validate
 * @returns {boolean} True if valid
 */
function isValidNoteId(id) {
  return typeof id === 'string' && 
         id.length >= 10 && 
         id.length <= 50 && 
         /^[A-Za-z0-9_-]+$/.test(id);
}

/**
 * Validate a password for note encryption
 * @param {string} password - Password to validate
 * @returns {{ valid: boolean, errors: string[], strength: string }}
 */
function validatePassword(password) {
  const errors = [];
  
  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Password is required'], strength: 'none' };
  }
  
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  
  if (password.length > MAX_PASSWORD_LENGTH) {
    errors.push(`Password must be less than ${MAX_PASSWORD_LENGTH} characters`);
  }
  
  // Calculate strength
  let strength = 'weak';
  let score = 0;
  
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  
  if (score >= 4) strength = 'strong';
  else if (score >= 2) strength = 'medium';
  
  // Warn about weak passwords but don't block
  if (errors.length === 0 && strength === 'weak') {
    // Add a warning but still allow
  }
  
  return {
    valid: errors.length === 0,
    errors,
    strength,
  };
}

/**
 * Extract plain text from rich content (strip markdown/html)
 * @param {string} content - Content to process
 * @returns {string} Plain text content
 */
function extractPlainText(content) {
  if (!content) return '';
  
  // Remove HTML tags
  let text = content.replace(/<[^>]*>/g, '');
  
  // Remove markdown formatting
  text = text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1') // Images (process before links)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Links
    .replace(/\*\*(.+?)\*\*/g, '$1')  // Bold
    .replace(/\*(.+?)\*/g, '$1')       // Italic
    .replace(/__(.+?)__/g, '$1')       // Bold
    .replace(/_(.+?)_/g, '$1')         // Italic
    .replace(/~~(.+?)~~/g, '$1')       // Strikethrough
    .replace(/`(.+?)`/g, '$1')         // Inline code
    .replace(/^#+\s*/gm, '')           // Headers
    .replace(/^\s*[-*+]\s+/gm, '')     // Unordered lists
    .replace(/^\s*\d+\.\s+/gm, '')     // Ordered lists
    .replace(/^>\s*/gm, '');           // Blockquotes
  
  return text.trim();
}

module.exports = {
  validateNote,
  validateFolder,
  validateTag,
  validatePassword,
  sanitizeString,
  extractPlainText,
  validateSearchQuery,
  sanitizeFtsQuery,
  validateLimit,
  validateDays,
  isValidNoteId,
  MAX_TITLE_LENGTH,
  MAX_CONTENT_LENGTH,
  MAX_TAG_NAME_LENGTH,
  MAX_FOLDER_NAME_LENGTH,
  MAX_SEARCH_QUERY_LENGTH,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
};
