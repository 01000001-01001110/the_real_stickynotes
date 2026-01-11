/**
 * Whisper Transcription Service
 * Handles loading the Whisper model and transcribing audio
 * Uses pre-built whisper.cpp binary on Windows, whisper-node on other platforms
 */
const { AUDIO_CONFIG } = require('../../shared/constants/whisper');
const modelManager = require('./model-manager');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const os = require('os');

// Whisper instance (null = not loaded, 'native' = using whisper.cpp binary)
let whisper = null;
let loadedModel = null;
let isLoading = false;
let whisperBinaryPath = null;

// URL for pre-built whisper.cpp Windows binary
const WHISPER_CPP_WINDOWS_URL = 'https://github.com/ggerganov/whisper.cpp/releases/download/v1.5.4/whisper-bin-x64.zip';
const WHISPER_BINARY_NAME = process.platform === 'win32' ? 'main.exe' : 'main';

/**
 * Check if the Whisper model is loaded
 * @returns {boolean}
 */
function isLoaded() {
  return whisper !== null && loadedModel !== null;
}

/**
 * Get the currently loaded model size
 * @returns {string|null}
 */
function getLoadedModel() {
  return loadedModel;
}

/**
 * Get path to whisper.cpp binary
 * @returns {string}
 */
function getWhisperBinaryPath() {
  const { getModelsPath } = require('../../shared/utils/paths');
  return path.join(getModelsPath(), 'bin', WHISPER_BINARY_NAME);
}

/**
 * Check if whisper.cpp binary exists
 * @returns {boolean}
 */
function whisperBinaryExists() {
  const binPath = getWhisperBinaryPath();
  return fs.existsSync(binPath);
}

/**
 * Download and extract whisper.cpp binary for Windows
 * @param {function} onProgress - Progress callback
 * @returns {Promise<string>} Path to binary
 */
async function downloadWhisperBinary(onProgress = () => {}) {
  if (process.platform !== 'win32') {
    throw new Error('Pre-built binary download only supported on Windows');
  }
  
  const { getModelsPath, ensureDir } = require('../../shared/utils/paths');
  const https = require('https');
  const { createWriteStream, promises: fsp } = require('fs');
  
  const binDir = path.join(getModelsPath(), 'bin');
  ensureDir(binDir);
  
  const zipPath = path.join(binDir, 'whisper-bin.zip');
  const binPath = getWhisperBinaryPath();
  
  // Download zip file
  console.log('Downloading whisper.cpp binary...');
  
  await new Promise((resolve, reject) => {
    const downloadUrl = (url) => {
      https.get(url, { headers: { 'User-Agent': 'StickyNotes/2.0' } }, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          downloadUrl(response.headers.location);
          return;
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
          return;
        }
        
        const totalSize = parseInt(response.headers['content-length'], 10) || 0;
        let downloadedSize = 0;
        
        const file = createWriteStream(zipPath);
        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          if (totalSize > 0) {
            onProgress(Math.round((downloadedSize / totalSize) * 50)); // 0-50% for download
          }
        });
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
        file.on('error', reject);
      }).on('error', reject);
    };
    downloadUrl(WHISPER_CPP_WINDOWS_URL);
  });
  
  // Extract zip file
  console.log('Extracting whisper.cpp binary...');
  onProgress(60);
  
  const AdmZip = require('adm-zip');
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(binDir, true);
  onProgress(90);
  
  // Clean up zip
  await fsp.unlink(zipPath);
  
  // Find and verify the binary
  const possibleBinaries = ['main.exe', 'whisper.exe'];
  let foundBinary = null;
  
  for (const name of possibleBinaries) {
    const fullPath = path.join(binDir, name);
    if (fs.existsSync(fullPath)) {
      foundBinary = fullPath;
      // Rename to our expected name if different
      if (name !== WHISPER_BINARY_NAME) {
        await fsp.rename(fullPath, binPath);
        foundBinary = binPath;
      }
      break;
    }
  }
  
  if (!foundBinary || !fs.existsSync(binPath)) {
    throw new Error('Failed to extract whisper.cpp binary');
  }
  
  onProgress(100);
  console.log('Whisper.cpp binary ready:', binPath);
  whisperBinaryPath = binPath;
  
  return binPath;
}

/**
 * Load a Whisper model
 * @param {string} modelSize - Model size to load (tiny, base, small)
 * @returns {Promise<boolean>}
 */
async function loadModel(modelSize) {
  if (isLoading) {
    throw new Error('Model is already loading');
  }
  
  // Check if already loaded
  if (loadedModel === modelSize && whisper) {
    return true;
  }
  
  // Unload current model if different
  if (whisper && loadedModel !== modelSize) {
    unloadModel();
  }
  
  isLoading = true;
  
  try {
    // Check if model exists
    const status = await modelManager.getStatus(modelSize);
    if (!status.exists) {
      throw new Error(`Model not downloaded. Please download the ${modelSize} model first.`);
    }
    
    const modelPath = modelManager.getModelPath(modelSize);
    
    // On Windows, use pre-built binary approach
    if (process.platform === 'win32') {
      // Check if binary exists, download if not
      if (!whisperBinaryExists()) {
        console.log('Whisper.cpp binary not found, downloading...');
        await downloadWhisperBinary();
      }
      
      whisperBinaryPath = getWhisperBinaryPath();
      whisper = 'native'; // Mark as using native binary
      loadedModel = modelSize;
      isLoading = false;
      
      console.log(`Whisper model ready (native): ${modelSize}`);
      return true;
    }
    
    // On other platforms, try whisper-node
    try {
      const whisperNode = require('whisper-node');
      
      // Initialize whisper with the model
      whisper = await whisperNode.whisper(modelPath, {
        language: 'auto',
        gen_file_txt: false,
        gen_file_subtitle: false,
        gen_file_vtt: false,
        word_timestamps: false,
      });
      
      loadedModel = modelSize;
      isLoading = false;
      
      console.log(`Whisper model loaded: ${modelSize}`);
      return true;
    } catch (nodeErr) {
      console.warn('whisper-node failed, this platform may not be supported:', nodeErr.message);
      throw new Error('Transcription not available on this platform. whisper-node failed to initialize.');
    }
  } catch (error) {
    isLoading = false;
    console.error('Failed to load Whisper model:', error);
    throw error;
  }
}

/**
 * Unload the current model
 */
function unloadModel() {
  whisper = null;
  loadedModel = null;
  console.log('Whisper model unloaded');
}

/**
 * Transcribe audio using native whisper.cpp binary
 * @param {string} audioPath - Path to WAV file
 * @param {object} options - Transcription options
 * @returns {Promise<object>} Transcription result
 */
async function transcribeNative(audioPath, options = {}) {
  const modelPath = modelManager.getModelPath(loadedModel);
  const language = options.language || 'en';
  
  return new Promise((resolve, reject) => {
    const args = [
      '-m', modelPath,
      '-f', audioPath,
      '-l', language === 'auto' ? 'auto' : language,
      '--output-txt',
      '-nt', // no timestamps
    ];
    
    console.log('Running whisper.cpp:', whisperBinaryPath, args.join(' '));
    
    const proc = spawn(whisperBinaryPath, args, {
      cwd: path.dirname(whisperBinaryPath),
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('close', (code) => {
      if (code !== 0) {
        console.error('Whisper.cpp stderr:', stderr);
        reject(new Error(`Whisper.cpp failed with code ${code}: ${stderr}`));
        return;
      }
      
      // Parse output - whisper.cpp outputs the transcribed text
      const text = stdout.trim();
      
      resolve({
        text,
        confidence: 1.0,
        language: language === 'auto' ? 'unknown' : language,
      });
    });
    
    proc.on('error', (err) => {
      reject(new Error(`Failed to run whisper.cpp: ${err.message}`));
    });
  });
}

/**
 * Save audio data to a temporary WAV file
 * @param {Buffer|Int16Array} audioData - PCM audio data
 * @returns {Promise<string>} Path to temp WAV file
 */
async function saveToTempWav(audioData) {
  const { promises: fsp } = require('fs');
  const tempDir = os.tmpdir();
  const tempPath = path.join(tempDir, `whisper_${Date.now()}.wav`);
  
  // Convert to Buffer if needed
  let pcmBuffer;
  if (audioData instanceof Int16Array) {
    pcmBuffer = Buffer.from(audioData.buffer);
  } else if (Buffer.isBuffer(audioData)) {
    pcmBuffer = audioData;
  } else {
    throw new Error('Unsupported audio format for WAV export');
  }
  
  // Create WAV header
  const sampleRate = AUDIO_CONFIG.sampleRate;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;
  
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  
  const wavBuffer = Buffer.concat([header, pcmBuffer]);
  await fsp.writeFile(tempPath, wavBuffer);
  
  return tempPath;
}

/**
 * Transcribe audio data
 * @param {Buffer|ArrayBuffer|Float32Array} audioData - Audio data (16kHz mono PCM)
 * @param {object} options - Transcription options
 * @param {string} options.language - Language code or null for auto-detect
 * @returns {Promise<object>} Transcription result
 */
async function transcribe(audioData, options = {}) {
  if (!whisper) {
    throw new Error('Whisper model not loaded. Call loadModel() first.');
  }
  
  const language = options.language || 'auto';
  
  try {
    // Convert audio data to Int16 PCM
    let pcmData;
    
    if (audioData instanceof Float32Array) {
      pcmData = float32ToInt16(audioData);
    } else if (audioData instanceof ArrayBuffer) {
      pcmData = new Int16Array(audioData);
    } else if (Buffer.isBuffer(audioData)) {
      pcmData = new Int16Array(audioData.buffer, audioData.byteOffset, audioData.length / 2);
    } else {
      throw new Error('Unsupported audio data format');
    }
    
    // Use native binary on Windows
    if (whisper === 'native') {
      const tempWavPath = await saveToTempWav(pcmData);
      try {
        const result = await transcribeNative(tempWavPath, { language });
        // Clean up temp file
        fs.promises.unlink(tempWavPath).catch(() => {});
        return result;
      } catch (err) {
        fs.promises.unlink(tempWavPath).catch(() => {});
        throw err;
      }
    }
    
    // Use whisper-node on other platforms
    const result = await whisper.transcribe(pcmData, {
      language: language === 'auto' ? undefined : language,
    });
    
    // Extract text from result
    let text = '';
    let confidence = 1.0;
    
    if (typeof result === 'string') {
      text = result;
    } else if (Array.isArray(result)) {
      text = result.map(segment => segment.text || segment).join(' ');
    } else if (result && result.text) {
      text = result.text;
      confidence = result.confidence || 1.0;
    }
    
    return {
      text: text.trim(),
      confidence,
      language: language === 'auto' ? (result.language || 'unknown') : language,
    };
  } catch (error) {
    console.error('Transcription failed:', error);
    throw error;
  }
}

/**
 * Convert Float32Array audio samples to Int16Array
 * @param {Float32Array} float32Data
 * @returns {Int16Array}
 */
function float32ToInt16(float32Data) {
  const int16Data = new Int16Array(float32Data.length);
  for (let i = 0; i < float32Data.length; i++) {
    // Clamp to [-1, 1] and scale to Int16 range
    const s = Math.max(-1, Math.min(1, float32Data[i]));
    int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return int16Data;
}

/**
 * Convert Int16Array audio samples to Float32Array
 * @param {Int16Array} int16Data
 * @returns {Float32Array}
 */
function int16ToFloat32(int16Data) {
  const float32Data = new Float32Array(int16Data.length);
  for (let i = 0; i < int16Data.length; i++) {
    float32Data[i] = int16Data[i] / (int16Data[i] < 0 ? 0x8000 : 0x7FFF);
  }
  return float32Data;
}

/**
 * Get service status
 * @returns {object}
 */
function getServiceStatus() {
  return {
    loaded: isLoaded(),
    loading: isLoading,
    modelSize: loadedModel,
    sampleRate: AUDIO_CONFIG.sampleRate,
  };
}

module.exports = {
  isLoaded,
  getLoadedModel,
  loadModel,
  unloadModel,
  transcribe,
  getServiceStatus,
  float32ToInt16,
  int16ToFloat32,
  whisperBinaryExists,
  downloadWhisperBinary,
};
