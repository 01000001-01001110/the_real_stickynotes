/**
 * Whisper transcription constants and configuration
 * Updated for Sherpa-ONNX integration (v2)
 */

/**
 * Legacy GGML models (deprecated - kept for migration reference)
 * @deprecated Use SHERPA_ONNX_MODELS instead
 */
const WHISPER_MODELS_LEGACY = {
  tiny: {
    name: 'tiny',
    size: '75MB',
    sizeBytes: 75 * 1024 * 1024,
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
    filename: 'ggml-tiny.bin',
    description: 'Fastest, lowest accuracy',
  },
  base: {
    name: 'base',
    size: '150MB',
    sizeBytes: 150 * 1024 * 1024,
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
    filename: 'ggml-base.bin',
    description: 'Good balance of speed and accuracy',
  },
  small: {
    name: 'small',
    size: '500MB',
    sizeBytes: 500 * 1024 * 1024,
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
    filename: 'ggml-small.bin',
    description: 'Best accuracy for most use cases',
  },
};

/**
 * Sherpa-ONNX Whisper models (current)
 * These models use ONNX runtime for cross-platform support
 */
const SHERPA_ONNX_MODELS = {
  vad: {
    name: 'silero_vad',
    displayName: 'Voice Activity Detection',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx',
    filename: 'silero_vad.onnx',
    size: '2MB',
    sizeBytes: 2 * 1024 * 1024,
    description: 'Silero VAD for speech detection',
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
      description: 'Balanced speed and accuracy (recommended)',
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

/**
 * Map old model names to new Sherpa-ONNX model names
 * Used during settings migration
 */
const MODEL_MIGRATION_MAP = {
  tiny: 'tiny.en',
  base: 'base.en',
  small: 'small.en',
};

/**
 * Available Whisper models - alias to SHERPA_ONNX_MODELS.whisper for compatibility
 */
const WHISPER_MODELS = SHERPA_ONNX_MODELS.whisper;

/**
 * Audio capture and processing configuration
 */
const AUDIO_CONFIG = {
  sampleRate: 16000, // Whisper expects 16kHz audio
  channels: 1, // Mono
  bitDepth: 16,
  chunkDuration: 5000, // 5 second chunks for real-time processing
  overlapDuration: 500, // 0.5 second overlap between chunks
  silenceThreshold: 0.01, // RMS threshold for silence detection
  silenceMinDuration: 1000, // Minimum silence duration before considering speech ended
};

/**
 * Audio source types
 */
const AUDIO_SOURCES = {
  MICROPHONE: 'microphone',
  SYSTEM: 'system',
  BOTH: 'both',
};

/**
 * Text insertion modes
 */
const INSERT_MODES = {
  CURSOR: 'cursor', // Insert at current cursor position
  APPEND: 'append', // Always append to end of note
  REPLACE: 'replace', // Replace selected text (or append if nothing selected)
};

/**
 * Supported languages for transcription
 */
const SUPPORTED_LANGUAGES = [
  { code: 'auto', name: 'Auto-detect' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'ru', name: 'Russian' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
];

/**
 * Transcription status states
 */
const TRANSCRIPTION_STATUS = {
  IDLE: 'idle',
  LOADING_MODEL: 'loading_model',
  RECORDING: 'recording',
  PROCESSING: 'processing',
  ERROR: 'error',
};

module.exports = {
  WHISPER_MODELS,
  WHISPER_MODELS_LEGACY,
  SHERPA_ONNX_MODELS,
  MODEL_MIGRATION_MAP,
  AUDIO_CONFIG,
  AUDIO_SOURCES,
  INSERT_MODES,
  SUPPORTED_LANGUAGES,
  TRANSCRIPTION_STATUS,
};
