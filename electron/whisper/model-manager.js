/**
 * Whisper Model Manager (Legacy GGML)
 * @deprecated Use sherpa-model-manager.js for Sherpa-ONNX models
 *
 * Handles downloading, verifying, and managing legacy Whisper GGML models
 * Kept for backward compatibility with existing installations
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { getModelsPath, ensureDir } = require('../../shared/utils/paths');
const { WHISPER_MODELS_LEGACY: WHISPER_MODELS } = require('../../shared/constants/whisper');

/**
 * Get the path to a specific model file
 * @param {string} modelSize - Model size (tiny, base, small)
 * @returns {string} Full path to model file
 */
function getModelPath(modelSize) {
  const model = WHISPER_MODELS[modelSize];
  if (!model) {
    throw new Error(`Unknown model size: ${modelSize}`);
  }
  return path.join(getModelsPath(), model.filename);
}

/**
 * Check if a model exists and get its status
 * @param {string} modelSize - Model size to check
 * @returns {Promise<object>} Model status
 */
async function getStatus(modelSize) {
  const modelPath = getModelPath(modelSize);
  const model = WHISPER_MODELS[modelSize];

  try {
    const stats = await fs.promises.stat(modelPath);
    return {
      exists: true,
      path: modelPath,
      fileSize: formatBytes(stats.size),
      fileSizeBytes: stats.size,
      expectedSize: model.size,
      isValid: stats.size > model.sizeBytes * 0.9, // Allow 10% tolerance
    };
  } catch {
    return {
      exists: false,
      path: modelPath,
      fileSize: null,
      expectedSize: model.size,
      isValid: false,
    };
  }
}

/**
 * Download a Whisper model with progress reporting
 * @param {string} modelSize - Model size to download
 * @param {function} onProgress - Progress callback (0-100)
 * @returns {Promise<string>} Path to downloaded model
 */
async function download(modelSize, onProgress = () => {}) {
  const model = WHISPER_MODELS[modelSize];
  if (!model) {
    throw new Error(`Unknown model size: ${modelSize}`);
  }

  const modelsDir = getModelsPath();
  ensureDir(modelsDir);

  const destPath = path.join(modelsDir, model.filename);
  const tempPath = destPath + '.tmp';

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(tempPath);
    let downloadedBytes = 0;
    let totalBytes = model.sizeBytes;

    const request = https.get(
      model.url,
      {
        headers: {
          'User-Agent': 'StickyNotes/2.0',
        },
      },
      (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          file.close();
          fs.unlinkSync(tempPath);

          const redirectUrl = response.headers.location;
          downloadFromUrl(redirectUrl, tempPath, destPath, onProgress).then(resolve).catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(tempPath);
          reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
          return;
        }

        // Get actual content length if available
        if (response.headers['content-length']) {
          totalBytes = parseInt(response.headers['content-length'], 10);
        }

        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          const progress = Math.round((downloadedBytes / totalBytes) * 100);
          onProgress(Math.min(progress, 99)); // Cap at 99 until fully complete
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close(() => {
            // Rename temp file to final destination
            fs.renameSync(tempPath, destPath);
            onProgress(100);
            resolve(destPath);
          });
        });
      }
    );

    request.on('error', (err) => {
      file.close();
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      reject(err);
    });

    file.on('error', (err) => {
      file.close();
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      reject(err);
    });
  });
}

/**
 * Helper to download from a specific URL (for handling redirects)
 */
function downloadFromUrl(url, tempPath, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(tempPath);
    let downloadedBytes = 0;
    let totalBytes = 0;

    const request = https.get(
      url,
      {
        headers: {
          'User-Agent': 'StickyNotes/2.0',
        },
      },
      (response) => {
        if (response.statusCode !== 200) {
          file.close();
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
          reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
          return;
        }

        if (response.headers['content-length']) {
          totalBytes = parseInt(response.headers['content-length'], 10);
        }

        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (totalBytes > 0) {
            const progress = Math.round((downloadedBytes / totalBytes) * 100);
            onProgress(Math.min(progress, 99));
          }
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close(() => {
            fs.renameSync(tempPath, destPath);
            onProgress(100);
            resolve(destPath);
          });
        });
      }
    );

    request.on('error', (err) => {
      file.close();
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      reject(err);
    });
  });
}

/**
 * Delete a downloaded model
 * @param {string} modelSize - Model size to delete
 * @returns {Promise<boolean>} True if deleted
 */
async function deleteModel(modelSize) {
  const modelPath = getModelPath(modelSize);

  try {
    await fs.promises.unlink(modelPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * List all downloaded models
 * @returns {Promise<object[]>} Array of model statuses
 */
async function listDownloaded() {
  const results = [];

  for (const [size, model] of Object.entries(WHISPER_MODELS)) {
    const status = await getStatus(size);
    if (status.exists) {
      results.push({
        size,
        ...model,
        ...status,
      });
    }
  }

  return results;
}

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

module.exports = {
  getModelPath,
  getStatus,
  download,
  deleteModel,
  listDownloaded,
  formatBytes,
};
