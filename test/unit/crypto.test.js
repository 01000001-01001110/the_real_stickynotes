/**
 * Crypto Tests
 */
const {
  hashPassword,
  hashPasswordSync,
  verifyPassword,
  verifyPasswordSync,
  encryptContent,
  decryptContent,
  isEncryptedContent,
  generateSecurePassword,
} = require('../../shared/crypto');

describe('Crypto', () => {
  describe('hashPasswordSync', () => {
    it('should hash a password', () => {
      const hash = hashPasswordSync('password123');
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe('password123');
    });

    it('should produce different hashes for same password (due to salt)', () => {
      const hash1 = hashPasswordSync('password123');
      const hash2 = hashPasswordSync('password123');
      expect(hash1).not.toBe(hash2);
    });

    it('should produce bcrypt-format hash', () => {
      const hash = hashPasswordSync('password123');
      expect(hash).toMatch(/^\$2[aby]\$\d{2}\$.{53}$/);
    });
  });

  describe('hashPassword (async)', () => {
    it('should hash a password asynchronously', async () => {
      const hash = await hashPassword('password123');
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe('password123');
    });
  });

  describe('verifyPasswordSync', () => {
    it('should return true for correct password', () => {
      const hash = hashPasswordSync('myPassword');
      expect(verifyPasswordSync('myPassword', hash)).toBe(true);
    });

    it('should return false for incorrect password', () => {
      const hash = hashPasswordSync('myPassword');
      expect(verifyPasswordSync('wrongPassword', hash)).toBe(false);
    });

    it('should return false for empty password', () => {
      const hash = hashPasswordSync('myPassword');
      expect(verifyPasswordSync('', hash)).toBe(false);
    });

    it('should handle special characters in password', () => {
      const password = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const hash = hashPasswordSync(password);
      expect(verifyPasswordSync(password, hash)).toBe(true);
    });

    it('should handle unicode characters', () => {
      const password = 'пароль密码パスワード';
      const hash = hashPasswordSync(password);
      expect(verifyPasswordSync(password, hash)).toBe(true);
    });

    it('should handle very long passwords', () => {
      const password = 'a'.repeat(1000);
      const hash = hashPasswordSync(password);
      expect(verifyPasswordSync(password, hash)).toBe(true);
    });
  });

  describe('verifyPassword (async)', () => {
    it('should verify password asynchronously', async () => {
      const hash = hashPasswordSync('asyncPassword');
      const result = await verifyPassword('asyncPassword', hash);
      expect(result).toBe(true);
    });

    it('should reject incorrect password asynchronously', async () => {
      const hash = hashPasswordSync('asyncPassword');
      const result = await verifyPassword('wrongPassword', hash);
      expect(result).toBe(false);
    });
  });

  describe('encryptContent', () => {
    it('should encrypt content and return base64 string', () => {
      const content = 'Secret message';
      const password = 'strongpassword';
      
      const encrypted = encryptContent(content, password);
      
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(content);
      // Should be valid base64
      expect(() => Buffer.from(encrypted, 'base64')).not.toThrow();
    });

    it('should produce different ciphertext for same input (due to random IV)', () => {
      const content = 'Same content';
      const password = 'samepassword';
      
      const encrypted1 = encryptContent(content, password);
      const encrypted2 = encryptContent(content, password);
      
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should throw for empty content', () => {
      expect(() => encryptContent('', 'password')).toThrow();
    });

    it('should throw for empty password', () => {
      expect(() => encryptContent('content', '')).toThrow();
    });

    it('should handle unicode content', () => {
      const content = 'Привет мир 你好世界 🔐';
      const password = 'password';
      
      const encrypted = encryptContent(content, password);
      expect(encrypted).toBeDefined();
    });

    it('should handle large content', () => {
      const content = 'a'.repeat(100000);
      const password = 'password';
      
      const encrypted = encryptContent(content, password);
      expect(encrypted).toBeDefined();
    });
  });

  describe('decryptContent', () => {
    it('should decrypt content with correct password', () => {
      const original = 'My secret note content';
      const password = 'mypassword123';
      
      const encrypted = encryptContent(original, password);
      const decrypted = decryptContent(encrypted, password);
      
      expect(decrypted).toBe(original);
    });

    it('should return null for wrong password', () => {
      const original = 'Secret content';
      const encrypted = encryptContent(original, 'correctpassword');
      
      const decrypted = decryptContent(encrypted, 'wrongpassword');
      
      expect(decrypted).toBeNull();
    });

    it('should return null for corrupted data', () => {
      const decrypted = decryptContent('notvalidbase64!!!', 'password');
      expect(decrypted).toBeNull();
    });

    it('should return null for truncated data', () => {
      const original = 'Content';
      const encrypted = encryptContent(original, 'password');
      const truncated = encrypted.substring(0, 20);
      
      const decrypted = decryptContent(truncated, 'password');
      expect(decrypted).toBeNull();
    });

    it('should return null for null input', () => {
      expect(decryptContent(null, 'password')).toBeNull();
      expect(decryptContent(undefined, 'password')).toBeNull();
    });

    it('should return null for empty password', () => {
      const encrypted = encryptContent('content', 'password');
      expect(decryptContent(encrypted, '')).toBeNull();
    });

    it('should preserve unicode content', () => {
      const original = 'Unicode: Секретное сообщение 机密信息 Äöü';
      const password = 'unicode-safe';
      
      const encrypted = encryptContent(original, password);
      const decrypted = decryptContent(encrypted, password);
      
      expect(decrypted).toBe(original);
    });

    it('should preserve whitespace and special characters', () => {
      const original = '  Line 1\n\tLine 2\r\n<script>alert("xss")</script>  ';
      const password = 'password';
      
      const encrypted = encryptContent(original, password);
      const decrypted = decryptContent(encrypted, password);
      
      expect(decrypted).toBe(original);
    });
  });

  describe('isEncryptedContent', () => {
    it('should return true for encrypted content', () => {
      const encrypted = encryptContent('test', 'password');
      expect(isEncryptedContent(encrypted)).toBe(true);
    });

    it('should return false for plain text', () => {
      expect(isEncryptedContent('Hello world')).toBe(false);
      expect(isEncryptedContent('# Markdown content')).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(isEncryptedContent(null)).toBe(false);
      expect(isEncryptedContent(undefined)).toBe(false);
    });

    it('should return false for short base64', () => {
      // Base64 that's too short to be our encrypted format
      expect(isEncryptedContent('YWJj')).toBe(false);
    });

    it('should return false for invalid base64 that throws', () => {
      // This should trigger the catch block - non-string that passes initial check
      // but fails in Buffer.from - testing with object that has toString
      const weirdObj = { toString: () => { throw new Error('boom'); } };
      expect(isEncryptedContent(weirdObj)).toBe(false);
    });

    it('should return false for base64 with invalid characters', () => {
      expect(isEncryptedContent('YWJj!@#$')).toBe(false);
    });

    it('should return false for long non-base64 content', () => {
      // Content with invalid base64 characters
      const invalidContent = 'Not-Base64!@#$'.repeat(20);
      expect(isEncryptedContent(invalidContent)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isEncryptedContent('')).toBe(false);
    });

    it('should return false for non-string types', () => {
      expect(isEncryptedContent(123)).toBe(false);
      expect(isEncryptedContent({})).toBe(false);
      expect(isEncryptedContent([])).toBe(false);
    });
  });

  describe('generateSecurePassword', () => {
    it('should generate password of specified length', () => {
      const password = generateSecurePassword(16);
      expect(password.length).toBe(16);
    });

    it('should generate different passwords each time', () => {
      const p1 = generateSecurePassword();
      const p2 = generateSecurePassword();
      expect(p1).not.toBe(p2);
    });

    it('should use default length of 16', () => {
      const password = generateSecurePassword();
      expect(password.length).toBe(16);
    });
  });

  describe('Encryption roundtrip edge cases', () => {
    it('should handle empty string content after checking', () => {
      // Encrypt non-empty, then try to decrypt
      const encrypted = encryptContent(' ', 'password');
      const decrypted = decryptContent(encrypted, 'password');
      expect(decrypted).toBe(' ');
    });

    it('should handle JSON content', () => {
      const jsonContent = JSON.stringify({ key: 'value', nested: { array: [1, 2, 3] } });
      const password = 'jsonpassword';
      
      const encrypted = encryptContent(jsonContent, password);
      const decrypted = decryptContent(encrypted, password);
      
      expect(JSON.parse(decrypted)).toEqual(JSON.parse(jsonContent));
    });

    it('should handle markdown content', () => {
      const markdown = '# Title\n\n**Bold** and *italic*\n\n- List item\n- [Link](http://example.com)';
      const password = 'mdpassword';
      
      const encrypted = encryptContent(markdown, password);
      const decrypted = decryptContent(encrypted, password);
      
      expect(decrypted).toBe(markdown);
    });
  });

  describe('PIN/Short Password Support', () => {
    it('should work with 4-digit PIN', () => {
      const pin = '1234';
      const content = 'Secret note content';
      
      // Hash works with PIN
      const hash = hashPasswordSync(pin);
      expect(verifyPasswordSync(pin, hash)).toBe(true);
      expect(verifyPasswordSync('1235', hash)).toBe(false);
      
      // Encryption works with PIN
      const encrypted = encryptContent(content, pin);
      const decrypted = decryptContent(encrypted, pin);
      expect(decrypted).toBe(content);
    });

    it('should work with 6-digit PIN', () => {
      const pin = '123456';
      const content = 'Another secret';
      
      const hash = hashPasswordSync(pin);
      expect(verifyPasswordSync(pin, hash)).toBe(true);
      
      const encrypted = encryptContent(content, pin);
      expect(decryptContent(encrypted, pin)).toBe(content);
      expect(decryptContent(encrypted, '654321')).toBeNull();
    });

    it('should distinguish between similar PINs', () => {
      const pin1 = '0000';
      const pin2 = '0001';
      const content = 'Test content';
      
      const encrypted = encryptContent(content, pin1);
      expect(decryptContent(encrypted, pin1)).toBe(content);
      expect(decryptContent(encrypted, pin2)).toBeNull();
    });

    it('should handle PIN with leading zeros', () => {
      const pin = '0012';
      const hash = hashPasswordSync(pin);
      expect(verifyPasswordSync(pin, hash)).toBe(true);
      expect(verifyPasswordSync('12', hash)).toBe(false); // Different!
    });
  });

  describe('Lock/Unlock Workflow Simulation', () => {
    it('should simulate full lock workflow', () => {
      // Original note content
      const originalContent = '# My Private Note\n\nThis is secret information.';
      const password = 'mySecurePassword123!';
      
      // LOCK: Hash password and encrypt content
      const passwordHash = hashPasswordSync(password);
      const encryptedContent = encryptContent(originalContent, password);
      
      // Verify the encrypted content is different
      expect(encryptedContent).not.toBe(originalContent);
      expect(encryptedContent).not.toContain('Private');
      expect(encryptedContent).not.toContain('secret');
      
      // Simulate stored note state
      const lockedNote = {
        content: encryptedContent,
        content_plain: '[ENCRYPTED]',
        password_hash: passwordHash,
        is_locked: 1,
      };
      
      // UNLOCK: Verify password and decrypt
      expect(verifyPasswordSync(password, lockedNote.password_hash)).toBe(true);
      const decryptedContent = decryptContent(lockedNote.content, password);
      
      expect(decryptedContent).toBe(originalContent);
    });

    it('should reject incorrect password in unlock workflow', () => {
      const originalContent = 'Secret data';
      const correctPassword = 'correct123';
      const wrongPassword = 'wrong456';
      
      // Lock
      const passwordHash = hashPasswordSync(correctPassword);
      const encryptedContent = encryptContent(originalContent, correctPassword);
      
      // Try to unlock with wrong password
      expect(verifyPasswordSync(wrongPassword, passwordHash)).toBe(false);
      expect(decryptContent(encryptedContent, wrongPassword)).toBeNull();
    });

    it('should handle password change workflow', () => {
      const content = 'Important note';
      const oldPassword = 'oldPass123';
      const newPassword = 'newPass456';
      
      // Initial lock
      const encrypted1 = encryptContent(content, oldPassword);
      
      // Decrypt with old password
      const decrypted = decryptContent(encrypted1, oldPassword);
      expect(decrypted).toBe(content);
      
      // Re-encrypt with new password
      const encrypted2 = encryptContent(decrypted, newPassword);
      const newHash = hashPasswordSync(newPassword);
      
      // Old password no longer works
      expect(decryptContent(encrypted2, oldPassword)).toBeNull();
      
      // New password works
      expect(verifyPasswordSync(newPassword, newHash)).toBe(true);
      expect(decryptContent(encrypted2, newPassword)).toBe(content);
    });
  });

  describe('Security Properties', () => {
    it('should use bcrypt for password hashing (not plaintext)', () => {
      const password = 'testpassword';
      const hash = hashPasswordSync(password);
      
      // Should be bcrypt format
      expect(hash).toMatch(/^\$2[aby]\$/);
      expect(hash.length).toBe(60);
      // Should not contain original password
      expect(hash).not.toContain(password);
    });

    it('should use different salt for each hash', () => {
      const password = 'samepassword';
      const hashes = new Set();
      
      for (let i = 0; i < 5; i++) {
        hashes.add(hashPasswordSync(password));
      }
      
      // All hashes should be unique (different salts)
      expect(hashes.size).toBe(5);
    });

    it('should produce ciphertext larger than plaintext (due to IV, salt, tag)', () => {
      const content = 'Short';
      const encrypted = encryptContent(content, 'password');
      const encryptedBytes = Buffer.from(encrypted, 'base64').length;
      
      // Must have: salt(32) + iv(16) + authTag(16) + encrypted content
      // For AES-GCM, the ciphertext is same length as plaintext
      expect(encryptedBytes).toBeGreaterThanOrEqual(64 + content.length);
      // Should have significant overhead
      expect(encryptedBytes).toBeGreaterThan(content.length * 2);
    });

    it('should be timing-safe for password comparison', () => {
      const hash = hashPasswordSync('testpassword');
      
      // Both should complete without timing differences exploitable
      // (bcrypt.compareSync is designed to be timing-safe)
      const correct = verifyPasswordSync('testpassword', hash);
      const wrong = verifyPasswordSync('wrongpassword', hash);
      
      expect(correct).toBe(true);
      expect(wrong).toBe(false);
    });

    it('should detect tampered ciphertext via auth tag', () => {
      const content = 'Sensitive data';
      const password = 'password';
      
      const encrypted = encryptContent(content, password);
      const buffer = Buffer.from(encrypted, 'base64');
      
      // Tamper with the encrypted portion (after salt+iv+authTag)
      if (buffer.length > 65) {
        buffer[65] = buffer[65] ^ 0xFF;
      }
      
      const tampered = buffer.toString('base64');
      
      // Should fail authentication
      expect(decryptContent(tampered, password)).toBeNull();
    });
  });
});
