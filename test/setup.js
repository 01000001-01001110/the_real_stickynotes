/**
 * Jest Test Setup
 *
 * Provides isolated test directories for each Jest worker to prevent
 * race conditions when running tests in parallel.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

// Each Jest worker gets a unique test directory using worker ID
// This prevents race conditions when tests run in parallel
const workerId = process.env.JEST_WORKER_ID || '1';
const TEST_DIR = path.join(os.tmpdir(), `stickynotes-test-worker-${workerId}-${Date.now()}`);

/**
 * Ensure a directory exists, creating it if necessary
 * @param {string} dir - Directory path
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

beforeAll(() => {
  // Create test directory
  ensureDir(TEST_DIR);

  // Set environment variables for testing
  process.env.STICKYNOTES_TEST = 'true';
  process.env.STICKYNOTES_TEST_DIR = TEST_DIR;
});

afterAll(async () => {
  // Small delay to allow database connections to close
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Clean up test directory with retry logic for Windows file locking
  const maxRetries = 5;
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
        // Wait and retry with exponential backoff
        await new Promise((resolve) => setTimeout(resolve, 100 * (i + 1)));
      }
    }
  }
});

// Global test utilities
global.testDir = TEST_DIR;

/**
 * Get a unique test database path and ensure directory exists
 * @returns {string} Path to test database
 */
global.getTestDbPath = () => {
  ensureDir(TEST_DIR);
  return path.join(TEST_DIR, `test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
};

/**
 * Ensure the test directory exists (call in beforeEach if needed)
 */
global.ensureTestDir = () => {
  ensureDir(TEST_DIR);
};
