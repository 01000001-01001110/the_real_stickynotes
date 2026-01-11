/**
 * Jest Test Setup
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

// Create a temporary directory for test databases
const TEST_DIR = path.join(os.tmpdir(), 'stickynotes-test-' + Date.now());

beforeAll(() => {
  // Create test directory
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
  
  // Set environment variables for testing
  process.env.STICKYNOTES_TEST = 'true';
  process.env.STICKYNOTES_TEST_DIR = TEST_DIR;
});

afterAll(async () => {
  // Small delay to allow database connections to close
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Clean up test directory with retry logic for Windows file locking
  const maxRetries = 3;
  for (let i = 0; i < maxRetries; i++) {
    try {
      if (fs.existsSync(TEST_DIR)) {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      }
      break;
    } catch (err) {
      if (i === maxRetries - 1) {
        // On final retry, just log the error and continue
        console.warn(`Warning: Could not clean up test directory: ${err.message}`);
      } else {
        // Wait and retry
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  }
});

// Global test utilities
global.testDir = TEST_DIR;
global.getTestDbPath = () => path.join(TEST_DIR, `test-${Date.now()}.db`);
