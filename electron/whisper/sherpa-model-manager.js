/**
 * Sherpa-ONNX Model Manager
 * Handles downloading, extracting, and verifying Sherpa-ONNX models
 * including Whisper ONNX and Silero VAD.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const os = require('os');
const { getAppDataPath, ensureDir } = require('../../shared/utils/paths');

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Sherpa-ONNX model configurations
 */
const SHERPA_ONNX_MODELS = {
  vad: {
    name: 'silero_vad',
    displayName: 'Voice Activity Detection',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx',
    filename: 'silero_vad.onnx',
    size: '2MB',
    sizeBytes: 2 * 1024 * 1024,
  },
  whisper: {
    'tiny.en': {
      name: 'tiny.en',
      displayName: 'Tiny (English)',
      url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-tiny.en.tar.bz2',
      size: '117MB',
      sizeBytes: 117 * 1024 * 1024,
      description: 'Fastest, good for quick notes',
      files: {
        encoder: 'tiny.en-encoder.int8.onnx',
        decoder: 'tiny.en-decoder.int8.onnx',
        tokens: 'tiny.en-tokens.txt',
      },
    },
    'base.en': {
      name: 'base.en',
      displayName: 'Base (English)',
      url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-base.en.tar.bz2',
      size: '160MB',
      sizeBytes: 160 * 1024 * 1024,
      description: 'Balanced speed and accuracy',
      files: {
        encoder: 'base.en-encoder.int8.onnx',
        decoder: 'base.en-decoder.int8.onnx',
        tokens: 'base.en-tokens.txt',
      },
    },
    'small.en': {
      name: 'small.en',
      displayName: 'Small (English)',
      url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-small.en.tar.bz2',
      size: '400MB',
      sizeBytes: 400 * 1024 * 1024,
      description: 'Best accuracy for important recordings',
      files: {
        encoder: 'small.en-encoder.int8.onnx',
        decoder: 'small.en-decoder.int8.onnx',
        tokens: 'small.en-tokens.txt',
      },
    },
  },
};

// ============================================================================
// CUSTOM ERRORS
// ============================================================================

class InstallerError extends Error {
  constructor(message, code, recoverable = true) {
    super(message);
    this.name = 'InstallerError';
    this.code = code;
    this.recoverable = recoverable;
  }
}

class NetworkError extends InstallerError {
  constructor(message) {
    super(message, 'NETWORK_ERROR', true);
    this.name = 'NetworkError';
  }
}

class DiskSpaceError extends InstallerError {
  constructor(required, available) {
    super(
      `Insufficient disk space: need ${formatBytes(required)}, have ${formatBytes(available)}`,
      'INSUFFICIENT_SPACE',
      false
    );
    this.name = 'DiskSpaceError';
    this.required = required;
    this.available = available;
  }
}

class ExtractionError extends InstallerError {
  constructor(message) {
    super(message, 'EXTRACTION_FAILED', true);
    this.name = 'ExtractionError';
  }
}

class VerificationError extends InstallerError {
  constructor(missing, corrupted) {
    const details = [];
    if (missing.length) details.push(`Missing: ${missing.join(', ')}`);
    if (corrupted.length) details.push(`Corrupted: ${corrupted.join(', ')}`);
    super(`Model verification failed: ${details.join('; ')}`, 'VERIFICATION_FAILED', true);
    this.name = 'VerificationError';
    this.missing = missing;
    this.corrupted = corrupted;
  }
}

// ============================================================================
// PATH UTILITIES
// ============================================================================

/**
 * Get the base path for sherpa-onnx models
 * @returns {string} Absolute path to sherpa-onnx directory
 */
function getSherpaBasePath() {
  return path.join(getAppDataPath(), 'sherpa-onnx');
}

/**
 * Get the path to the VAD model
 * @returns {string} Absolute path to silero_vad.onnx
 */
function getVADPath() {
  return path.join(getSherpaBasePath(), 'vad', SHERPA_ONNX_MODELS.vad.filename);
}

/**
 * Get the path to a Whisper model directory
 * @param {string} modelSize - Model identifier (e.g., 'tiny.en', 'base.en')
 * @returns {string} Absolute path to model directory
 */
function getWhisperModelPath(modelSize) {
  const model = SHERPA_ONNX_MODELS.whisper[modelSize];
  if (!model) {
    throw new Error(`Unknown model size: ${modelSize}`);
  }
  return path.join(getSherpaBasePath(), 'whisper', modelSize);
}

/**
 * Get platform-specific configuration
 * @returns {object} Platform configuration
 */
function getPlatformConfig() {
  const platform = process.platform;
  const arch = process.arch;

  const configs = {
    'win32-x64': {
      libraryPath: null,
      packageName: 'sherpa-onnx-win-x64',
      pathSeparator: ';',
    },
    'darwin-x64': {
      libraryPath: 'DYLD_LIBRARY_PATH',
      packageName: 'sherpa-onnx-darwin-x64',
      pathSeparator: ':',
    },
    'darwin-arm64': {
      libraryPath: 'DYLD_LIBRARY_PATH',
      packageName: 'sherpa-onnx-darwin-arm64',
      pathSeparator: ':',
    },
    'linux-x64': {
      libraryPath: 'LD_LIBRARY_PATH',
      packageName: 'sherpa-onnx-linux-x64',
      pathSeparator: ':',
    },
    'linux-arm64': {
      libraryPath: 'LD_LIBRARY_PATH',
      packageName: 'sherpa-onnx-linux-arm64',
      pathSeparator: ':',
    },
  };

  const key = `${platform}-${arch}`;
  const config = configs[key];

  if (!config) {
    throw new Error(`Unsupported platform: ${key}`);
  }

  return config;
}

// ============================================================================
// STATUS CHECKING
// ============================================================================

/**
 * Check installation status of all models
 * @returns {Promise<object>} Installation status
 */
async function getInstallStatus() {
  const vadStatus = await getVADStatus();
  const whisperModels = {};

  for (const modelSize of Object.keys(SHERPA_ONNX_MODELS.whisper)) {
    whisperModels[modelSize] = await getModelStatus(modelSize);
  }

  return {
    vadInstalled: vadStatus.installed,
    vadPath: vadStatus.path,
    whisperModels,
    activeModel: null, // Set by service when loaded
  };
}

/**
 * Get detailed status of VAD model
 * @returns {Promise<object>} VAD status
 */
async function getVADStatus() {
  const vadPath = getVADPath();

  try {
    const stats = await fs.promises.stat(vadPath);
    const minSize = 1000000; // 1MB minimum for valid VAD model

    return {
      installed: true,
      path: vadPath,
      size: stats.size,
      verified: stats.size > minSize,
    };
  } catch {
    return {
      installed: false,
      path: vadPath,
      size: null,
      verified: false,
    };
  }
}

/**
 * Get detailed status of a Whisper model
 * @param {string} modelSize - Model identifier
 * @returns {Promise<object>} Model status
 */
async function getModelStatus(modelSize) {
  const model = SHERPA_ONNX_MODELS.whisper[modelSize];
  if (!model) {
    throw new Error(`Unknown model: ${modelSize}`);
  }

  const modelPath = getWhisperModelPath(modelSize);
  const result = {
    installed: false,
    path: modelPath,
    size: null,
    expectedSize: model.sizeBytes,
    verified: false,
    files: {
      encoder: false,
      decoder: false,
      tokens: false,
    },
  };

  try {
    // Check each required file
    for (const [key, filename] of Object.entries(model.files)) {
      const filePath = path.join(modelPath, filename);
      try {
        const stats = await fs.promises.stat(filePath);
        result.files[key] = stats.size > 0;
        if (key === 'encoder') {
          result.size = stats.size;
        }
      } catch {
        result.files[key] = false;
      }
    }

    // Model is installed if all files exist
    result.installed = result.files.encoder && result.files.decoder && result.files.tokens;

    // Verify by checking encoder size (should be substantial)
    if (result.installed && result.size) {
      result.verified = result.size > 1000000; // At least 1MB
    }
  } catch {
    // Directory doesn't exist
  }

  return result;
}

/**
 * Verify model files integrity
 * @param {string} modelSize - Model identifier
 * @returns {Promise<object>} Verification result
 */
async function verifyModel(modelSize) {
  const model = SHERPA_ONNX_MODELS.whisper[modelSize];
  if (!model) {
    throw new Error(`Unknown model: ${modelSize}`);
  }

  const modelPath = getWhisperModelPath(modelSize);
  const missing = [];
  const corrupted = [];

  for (const [key, filename] of Object.entries(model.files)) {
    const filePath = path.join(modelPath, filename);

    try {
      const stats = await fs.promises.stat(filePath);

      // Check file is not empty
      if (stats.size === 0) {
        corrupted.push(key);
        continue;
      }

      // For ONNX files, verify minimum expected size
      if (filename.endsWith('.onnx') && stats.size < 1000) {
        corrupted.push(key);
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        missing.push(key);
      } else {
        corrupted.push(key);
      }
    }
  }

  return {
    valid: missing.length === 0 && corrupted.length === 0,
    missing,
    corrupted,
  };
}

// ============================================================================
// DISK SPACE
// ============================================================================

/**
 * Check available disk space
 * @param {number} requiredBytes - Required space in bytes
 * @returns {Promise<object>} Space check result
 */
async function checkDiskSpace(requiredBytes) {
  const basePath = getSherpaBasePath();

  // Ensure base directory exists for checking
  ensureDir(basePath);

  try {
    // Use Node.js fs.statfs if available (Node 18.15+)
    if (fs.statfs) {
      return new Promise((resolve, reject) => {
        fs.statfs(basePath, (err, stats) => {
          if (err) {
            // Fallback: assume sufficient space
            console.warn('Could not check disk space:', err.message);
            resolve({ sufficient: true, available: Infinity, required: requiredBytes });
            return;
          }

          const available = stats.bavail * stats.bsize;
          resolve({
            sufficient: available >= requiredBytes,
            available,
            required: requiredBytes,
          });
        });
      });
    }

    // Fallback for older Node versions: assume sufficient
    console.warn('fs.statfs not available, skipping disk space check');
    return { sufficient: true, available: Infinity, required: requiredBytes };
  } catch (error) {
    console.warn('Disk space check failed:', error.message);
    return { sufficient: true, available: Infinity, required: requiredBytes };
  }
}

// ============================================================================
// DOWNLOAD UTILITIES
// ============================================================================

/**
 * Verify download URL is from trusted source
 * @param {string} url - URL to verify
 * @returns {boolean}
 */
function isValidDownloadUrl(url) {
  const trustedHosts = [
    'github.com',
    'objects.githubusercontent.com',
    'github-releases.githubusercontent.com',
  ];

  try {
    const parsed = new URL(url);
    return trustedHosts.some((host) => parsed.hostname.endsWith(host));
  } catch {
    return false;
  }
}

/**
 * Download a file with progress tracking and redirect handling
 * @param {string} url - Download URL
 * @param {string} destPath - Destination path
 * @param {function} onProgress - Progress callback (0-100)
 * @returns {Promise<string>} Path to downloaded file
 */
async function downloadFile(url, destPath, onProgress = () => {}) {
  if (!isValidDownloadUrl(url)) {
    throw new NetworkError('Untrusted download URL');
  }

  const tempPath = `${destPath}.tmp`;

  // Ensure directory exists
  ensureDir(path.dirname(destPath));

  return new Promise((resolve, reject) => {
    const makeRequest = (targetUrl, redirectCount = 0) => {
      if (redirectCount > 5) {
        reject(new NetworkError('Too many redirects'));
        return;
      }

      const protocol = targetUrl.startsWith('https') ? https : http;

      const request = protocol.get(
        targetUrl,
        {
          headers: {
            'User-Agent': 'StickyNotes/2.0',
            Accept: '*/*',
          },
          timeout: 30000,
        },
        (response) => {
          // Handle redirects (GitHub releases use 302)
          if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
            const redirectUrl = response.headers.location;
            if (redirectUrl) {
              makeRequest(redirectUrl, redirectCount + 1);
              return;
            }
          }

          if (response.statusCode !== 200) {
            reject(new NetworkError(`HTTP ${response.statusCode}`));
            return;
          }

          const totalBytes = parseInt(response.headers['content-length'], 10) || 0;
          let downloadedBytes = 0;

          const file = fs.createWriteStream(tempPath);

          response.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            if (totalBytes > 0) {
              onProgress(Math.round((downloadedBytes / totalBytes) * 100));
            }
          });

          response.pipe(file);

          file.on('finish', async () => {
            file.close();
            try {
              await fs.promises.rename(tempPath, destPath);
              resolve(destPath);
            } catch (err) {
              reject(err);
            }
          });

          file.on('error', (err) => {
            fs.promises.unlink(tempPath).catch(() => {});
            reject(err);
          });
        }
      );

      request.on('error', (err) => {
        fs.promises.unlink(tempPath).catch(() => {});
        reject(new NetworkError(err.message));
      });

      request.on('timeout', () => {
        request.destroy();
        fs.promises.unlink(tempPath).catch(() => {});
        reject(new NetworkError('Download timeout'));
      });
    };

    makeRequest(url);
  });
}

// ============================================================================
// EXTRACTION
// ============================================================================

/**
 * Extract tar.bz2 archive
 * @param {string} archivePath - Path to archive
 * @param {string} destPath - Destination directory
 * @returns {Promise<string[]>} List of extracted files
 */
async function extractTarBz2(archivePath, destPath) {
  try {
    const decompress = require('decompress');
    const decompressTarbz2 = require('decompress-tarbz2');

    // Ensure destination exists
    await fs.promises.mkdir(destPath, { recursive: true });

    const files = await decompress(archivePath, destPath, {
      plugins: [decompressTarbz2()],
      strip: 1, // Remove top-level directory from archive
    });

    return files.map((f) => f.path);
  } catch (error) {
    throw new ExtractionError(`Failed to extract archive: ${error.message}`);
  }
}

// ============================================================================
// MODEL OPERATIONS
// ============================================================================

/**
 * Download and install the VAD model
 * @param {function} onProgress - Progress callback (0-100)
 * @returns {Promise<string>} Path to installed model
 */
async function downloadVAD(onProgress = () => {}) {
  const vadPath = getVADPath();
  const vadDir = path.dirname(vadPath);

  ensureDir(vadDir);

  await downloadFile(SHERPA_ONNX_MODELS.vad.url, vadPath, onProgress);

  // Verify download
  const stats = await fs.promises.stat(vadPath);
  if (stats.size < 1000000) {
    await fs.promises.unlink(vadPath);
    throw new VerificationError(['vad'], []);
  }

  return vadPath;
}

/**
 * Download and install a Whisper model
 * @param {string} modelSize - Model identifier
 * @param {function} onProgress - Progress callback (progress, stage)
 * @returns {Promise<string>} Path to installed model directory
 */
async function downloadModel(modelSize, onProgress = () => {}) {
  const model = SHERPA_ONNX_MODELS.whisper[modelSize];
  if (!model) {
    throw new Error(`Unknown model size: ${modelSize}`);
  }

  const modelDir = getWhisperModelPath(modelSize);
  const tempDir = path.join(os.tmpdir(), `stickynotes-sherpa-${Date.now()}`);
  const archivePath = path.join(tempDir, `${modelSize}.tar.bz2`);

  try {
    ensureDir(tempDir);
    ensureDir(modelDir);

    // Download archive
    await downloadFile(model.url, archivePath, (progress) => {
      onProgress(progress, 'download');
    });

    // Extract archive
    onProgress(0, 'extract');
    await extractTarBz2(archivePath, modelDir);
    onProgress(100, 'extract');

    // Verify installation
    onProgress(0, 'verify');
    const verification = await verifyModel(modelSize);

    if (!verification.valid) {
      throw new VerificationError(verification.missing, verification.corrupted);
    }

    onProgress(100, 'verify');

    return modelDir;
  } finally {
    // Cleanup temp directory
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Delete a Whisper model
 * @param {string} modelSize - Model identifier
 * @returns {Promise<boolean>} True if deleted
 */
async function deleteModel(modelSize) {
  const modelPath = getWhisperModelPath(modelSize);

  try {
    await fs.promises.rm(modelPath, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete the VAD model
 * @returns {Promise<boolean>} True if deleted
 */
async function deleteVAD() {
  const vadPath = getVADPath();

  try {
    await fs.promises.unlink(vadPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * List all available model configurations
 * @returns {object[]} Array of model info
 */
function getAvailableModels() {
  return Object.entries(SHERPA_ONNX_MODELS.whisper).map(([id, model]) => ({
    id,
    name: model.name,
    displayName: model.displayName,
    size: model.size,
    sizeBytes: model.sizeBytes,
    description: model.description,
  }));
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Format bytes to human readable string
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Calculate SHA256 checksum of file
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function calculateChecksum(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Constants
  SHERPA_ONNX_MODELS,

  // Path utilities
  getSherpaBasePath,
  getVADPath,
  getWhisperModelPath,
  getPlatformConfig,

  // Status checking
  getInstallStatus,
  getVADStatus,
  getModelStatus,
  verifyModel,

  // Disk operations
  checkDiskSpace,

  // Download/Install
  downloadVAD,
  downloadModel,
  deleteModel,
  deleteVAD,
  extractTarBz2,

  // Utilities
  getAvailableModels,
  formatBytes,
  calculateChecksum,

  // Errors
  InstallerError,
  NetworkError,
  DiskSpaceError,
  ExtractionError,
  VerificationError,
};
