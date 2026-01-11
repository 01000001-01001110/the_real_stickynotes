/**
 * Sherpa-ONNX Transcription Service
 * Uses sherpa-onnx-node for local speech-to-text with VAD
 *
 * Architecture:
 * - Silero VAD: Detects speech segments in audio stream
 * - Whisper ONNX: Transcribes detected speech segments
 * - Non-streaming: VAD segments audio, then Whisper processes each segment
 */
const path = require('path');
const sherpaModelManager = require('./sherpa-model-manager');

// Service state
let vad = null;
let recognizer = null;
let loadedModel = null;
let isLoading = false;
let sherpaOnnx = null;

// Configuration
const DEFAULT_CONFIG = {
  vadThreshold: 0.5,
  vadMinSilenceDuration: 0.25,
  vadMinSpeechDuration: 0.25,
  vadMaxSpeechDuration: 5.0,
  numThreads: 4,
  language: 'en',
};

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Load sherpa-onnx-node module
 * Must be called after library path is configured
 * @returns {object} sherpa-onnx module
 */
function loadSherpaModule() {
  if (sherpaOnnx) {
    return sherpaOnnx;
  }

  try {
    sherpaOnnx = require('sherpa-onnx-node');
    return sherpaOnnx;
  } catch (error) {
    console.error('Failed to load sherpa-onnx-node:', error);
    throw new Error(
      `sherpa-onnx-node is not installed or failed to load. ` +
        `Error: ${error.message}. ` +
        `Please run: npm install sherpa-onnx-node`
    );
  }
}

/**
 * Configure library path for sherpa-onnx native modules
 * Must be called before loading sherpa-onnx-node
 */
function configureLibraryPath() {
  try {
    const config = sherpaModelManager.getPlatformConfig();

    if (config.libraryPath) {
      // Find the sherpa-onnx package in node_modules
      const possiblePaths = [
        path.join(__dirname, '../../node_modules', config.packageName),
        path.join(process.cwd(), 'node_modules', config.packageName),
      ];

      for (const packagePath of possiblePaths) {
        try {
          const fs = require('fs');
          if (fs.existsSync(packagePath)) {
            const currentPath = process.env[config.libraryPath] || '';
            const newPath = [packagePath, currentPath].filter(Boolean).join(config.pathSeparator);

            process.env[config.libraryPath] = newPath;
            console.log(`Set ${config.libraryPath} for sherpa-onnx`);
            return;
          }
        } catch {
          continue;
        }
      }
    }
  } catch (error) {
    console.warn('Could not configure library path:', error.message);
  }
}

// ============================================================================
// SERVICE STATUS
// ============================================================================

/**
 * Check if the service is loaded and ready
 * @returns {boolean}
 */
function isLoaded() {
  return recognizer !== null && vad !== null && loadedModel !== null;
}

/**
 * Check if the service is currently loading
 * @returns {boolean}
 */
function isServiceLoading() {
  return isLoading;
}

/**
 * Get the currently loaded model
 * @returns {string|null}
 */
function getLoadedModel() {
  return loadedModel;
}

/**
 * Get service status
 * @returns {object} Service status
 */
function getServiceStatus() {
  return {
    loaded: isLoaded(),
    loading: isLoading,
    modelSize: loadedModel,
    hasVAD: vad !== null,
    hasRecognizer: recognizer !== null,
  };
}

// ============================================================================
// MODEL LOADING
// ============================================================================

/**
 * Initialize VAD (Voice Activity Detector)
 * @param {object} config - VAD configuration
 * @returns {object} VAD instance
 */
function initializeVAD(config = {}) {
  const sherpa = loadSherpaModule();
  const vadPath = sherpaModelManager.getVADPath();

  const vadConfig = {
    sileroVad: {
      model: vadPath,
      threshold: config.vadThreshold || DEFAULT_CONFIG.vadThreshold,
      minSilenceDuration: config.vadMinSilenceDuration || DEFAULT_CONFIG.vadMinSilenceDuration,
      minSpeechDuration: config.vadMinSpeechDuration || DEFAULT_CONFIG.vadMinSpeechDuration,
      maxSpeechDuration: config.vadMaxSpeechDuration || DEFAULT_CONFIG.vadMaxSpeechDuration,
      windowSize: 512,
    },
    sampleRate: 16000,
    numThreads: 1,
    provider: 'cpu',
    debug: 0,
  };

  // Buffer size in seconds for VAD
  const bufferSizeSeconds = 30.0;

  return sherpa.createVoiceActivityDetector(vadConfig, bufferSizeSeconds);
}

/**
 * Initialize Whisper recognizer
 * @param {string} modelSize - Model size to load
 * @param {object} config - Recognizer configuration
 * @returns {object} Recognizer instance
 */
function initializeRecognizer(modelSize, config = {}) {
  const sherpa = loadSherpaModule();
  const modelPath = sherpaModelManager.getWhisperModelPath(modelSize);
  const model = sherpaModelManager.SHERPA_ONNX_MODELS.whisper[modelSize];

  if (!model) {
    throw new Error(`Unknown model size: ${modelSize}`);
  }

  const recognizerConfig = {
    featConfig: {
      sampleRate: 16000,
      featureDim: 80,
    },
    modelConfig: {
      whisper: {
        encoder: path.join(modelPath, model.files.encoder),
        decoder: path.join(modelPath, model.files.decoder),
        language: config.language || DEFAULT_CONFIG.language,
        task: 'transcribe',
        tailPaddings: -1,
      },
      tokens: path.join(modelPath, model.files.tokens),
      numThreads: config.numThreads || DEFAULT_CONFIG.numThreads,
      provider: 'cpu',
      debug: 0,
    },
    decodingMethod: 'greedy_search',
    maxActivePaths: 4,
  };

  return sherpa.createOfflineRecognizer(recognizerConfig);
}

/**
 * Load models and initialize service
 * @param {string} modelSize - Whisper model size to load
 * @param {object} config - Service configuration
 * @returns {Promise<boolean>} True if loaded successfully
 */
async function loadModel(modelSize, config = {}) {
  if (isLoading) {
    throw new Error('Service is already loading');
  }

  // Check if already loaded with same model
  if (loadedModel === modelSize && isLoaded()) {
    return true;
  }

  isLoading = true;

  try {
    // Unload existing if different model
    if (loadedModel && loadedModel !== modelSize) {
      unloadModel();
    }

    // Verify models are installed
    const vadStatus = await sherpaModelManager.getVADStatus();
    if (!vadStatus.installed || !vadStatus.verified) {
      throw new Error('VAD model not installed. Please install from Settings.');
    }

    const modelStatus = await sherpaModelManager.getModelStatus(modelSize);
    if (!modelStatus.installed || !modelStatus.verified) {
      throw new Error(`Whisper ${modelSize} model not installed. Please install from Settings.`);
    }

    // Configure library path before loading module
    configureLibraryPath();

    // Initialize VAD
    console.log('Initializing VAD...');
    vad = initializeVAD(config);

    // Initialize recognizer
    console.log(`Initializing Whisper recognizer (${modelSize})...`);
    recognizer = initializeRecognizer(modelSize, config);

    loadedModel = modelSize;
    isLoading = false;

    console.log(`Sherpa-ONNX service ready with model: ${modelSize}`);
    return true;
  } catch (error) {
    isLoading = false;
    vad = null;
    recognizer = null;
    loadedModel = null;
    console.error('Failed to load Sherpa-ONNX service:', error);
    throw error;
  }
}

/**
 * Unload models and cleanup
 */
function unloadModel() {
  vad = null;
  recognizer = null;
  loadedModel = null;
  console.log('Sherpa-ONNX service unloaded');
}

// ============================================================================
// TRANSCRIPTION
// ============================================================================

/**
 * Process audio through VAD and transcribe detected speech
 * @param {Float32Array} samples - Audio samples (16kHz, mono, Float32)
 * @returns {string[]} Array of transcribed text segments
 */
function processAudio(samples) {
  if (!isLoaded()) {
    throw new Error('Service not loaded. Call loadModel() first.');
  }

  const results = [];

  // Feed audio to VAD
  vad.acceptWaveform(samples);

  // Process detected speech segments
  while (!vad.isEmpty()) {
    const segment = vad.front();
    vad.pop();

    // Create stream for this segment
    const stream = recognizer.createStream();
    stream.acceptWaveform(16000, segment.samples);

    // Decode
    recognizer.decode(stream);

    // Get result
    const result = recognizer.getResult(stream);
    if (result.text && result.text.trim()) {
      results.push(result.text.trim());
    }
  }

  return results;
}

/**
 * Flush any remaining audio in VAD buffer and transcribe
 * Call this when recording stops to get final segments
 * @returns {string[]} Array of transcribed text segments
 */
function flush() {
  if (!isLoaded()) {
    return [];
  }

  vad.flush();
  return processAudio(new Float32Array(0));
}

/**
 * Transcribe a complete audio buffer
 * @param {Buffer|Float32Array|Int16Array} audioData - Audio data
 * @param {object} options - Transcription options
 * @returns {Promise<object>} Transcription result
 */
async function transcribe(audioData, options = {}) {
  if (!isLoaded()) {
    throw new Error('Service not loaded. Call loadModel() first.');
  }

  // Convert to Float32Array
  let samples;
  if (audioData instanceof Float32Array) {
    samples = audioData;
  } else if (audioData instanceof Int16Array) {
    samples = int16ToFloat32(audioData);
  } else if (Buffer.isBuffer(audioData)) {
    // Assume Int16 PCM
    const int16 = new Int16Array(audioData.buffer, audioData.byteOffset, audioData.length / 2);
    samples = int16ToFloat32(int16);
  } else if (Array.isArray(audioData)) {
    // Array of numbers, convert to Float32
    samples = new Float32Array(audioData);
    // If values are in Int16 range, normalize
    if (samples.some((s) => Math.abs(s) > 1)) {
      for (let i = 0; i < samples.length; i++) {
        samples[i] = samples[i] / 32768;
      }
    }
  } else {
    throw new Error('Unsupported audio data format');
  }

  // Process through VAD + Whisper
  const segments = processAudio(samples);

  // Flush to get any remaining audio
  const finalSegments = flush();

  const allSegments = [...segments, ...finalSegments];
  const text = allSegments.join(' ').trim();

  return {
    text,
    segments: allSegments,
    confidence: 1.0,
    language: options.language || loadedModel?.includes('.en') ? 'en' : 'unknown',
  };
}

/**
 * Transcribe a single audio segment directly (bypass VAD)
 * Useful for pre-segmented audio
 * @param {Float32Array} samples - Audio samples
 * @returns {string} Transcribed text
 */
function transcribeSegment(samples) {
  if (!recognizer) {
    throw new Error('Recognizer not loaded');
  }

  const stream = recognizer.createStream();
  stream.acceptWaveform(16000, samples);
  recognizer.decode(stream);

  const result = recognizer.getResult(stream);
  return result.text ? result.text.trim() : '';
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Convert Int16Array to Float32Array
 * @param {Int16Array} int16Data
 * @returns {Float32Array}
 */
function int16ToFloat32(int16Data) {
  const float32Data = new Float32Array(int16Data.length);
  for (let i = 0; i < int16Data.length; i++) {
    float32Data[i] = int16Data[i] / 32768.0;
  }
  return float32Data;
}

/**
 * Convert Float32Array to Int16Array
 * @param {Float32Array} float32Data
 * @returns {Int16Array}
 */
function float32ToInt16(float32Data) {
  const int16Data = new Int16Array(float32Data.length);
  for (let i = 0; i < float32Data.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Data[i]));
    int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16Data;
}

/**
 * Check if sherpa-onnx-node is available
 * @returns {boolean}
 */
function isSherpaAvailable() {
  try {
    require.resolve('sherpa-onnx-node');
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Status
  isLoaded,
  isServiceLoading,
  getLoadedModel,
  getServiceStatus,

  // Model loading
  loadModel,
  unloadModel,
  configureLibraryPath,

  // Transcription
  processAudio,
  flush,
  transcribe,
  transcribeSegment,

  // Utilities
  int16ToFloat32,
  float32ToInt16,
  isSherpaAvailable,

  // Config
  DEFAULT_CONFIG,
};
