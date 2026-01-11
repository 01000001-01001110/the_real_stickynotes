/**
 * Whisper Constants Tests (v2 Sherpa-ONNX)
 */
const {
  WHISPER_MODELS,
  WHISPER_MODELS_LEGACY,
  SHERPA_ONNX_MODELS,
  MODEL_MIGRATION_MAP,
  AUDIO_CONFIG,
  AUDIO_SOURCES,
  INSERT_MODES,
  SUPPORTED_LANGUAGES,
  TRANSCRIPTION_STATUS,
} = require('../../../shared/constants/whisper');

describe('Whisper Constants', () => {
  describe('WHISPER_MODELS (v2 Sherpa-ONNX)', () => {
    it('should have tiny.en, base.en, and small.en models', () => {
      expect(WHISPER_MODELS['tiny.en']).toBeDefined();
      expect(WHISPER_MODELS['base.en']).toBeDefined();
      expect(WHISPER_MODELS['small.en']).toBeDefined();
    });

    it('should have correct structure for each model', () => {
      for (const [size, model] of Object.entries(WHISPER_MODELS)) {
        expect(model.name).toBe(size);
        expect(model.displayName).toBeDefined();
        expect(model.size).toBeDefined();
        expect(typeof model.size).toBe('string');
        expect(model.sizeBytes).toBeDefined();
        expect(typeof model.sizeBytes).toBe('number');
        expect(model.url).toBeDefined();
        expect(model.url).toMatch(/^https:\/\//);
        expect(model.description).toBeDefined();
        // ONNX models have encoder, decoder, tokens files
        expect(model.files).toBeDefined();
        expect(model.files.encoder).toMatch(/\.onnx$/);
        expect(model.files.decoder).toMatch(/\.onnx$/);
        expect(model.files.tokens).toMatch(/\.txt$/);
      }
    });

    it('should have correct model sizes in ascending order', () => {
      expect(WHISPER_MODELS['tiny.en'].sizeBytes).toBeLessThan(WHISPER_MODELS['base.en'].sizeBytes);
      expect(WHISPER_MODELS['base.en'].sizeBytes).toBeLessThan(
        WHISPER_MODELS['small.en'].sizeBytes
      );
    });

    it('should have valid GitHub sherpa-onnx URLs', () => {
      for (const model of Object.values(WHISPER_MODELS)) {
        expect(model.url).toContain('github.com');
        expect(model.url).toContain('sherpa-onnx');
        expect(model.url).toMatch(/\.tar\.bz2$/);
      }
    });

    it('should alias SHERPA_ONNX_MODELS.whisper', () => {
      expect(WHISPER_MODELS).toBe(SHERPA_ONNX_MODELS.whisper);
    });
  });

  describe('SHERPA_ONNX_MODELS', () => {
    it('should have VAD model', () => {
      expect(SHERPA_ONNX_MODELS.vad).toBeDefined();
      expect(SHERPA_ONNX_MODELS.vad.name).toBe('silero_vad');
      expect(SHERPA_ONNX_MODELS.vad.filename).toBe('silero_vad.onnx');
      expect(SHERPA_ONNX_MODELS.vad.url).toContain('github.com');
    });

    it('should have whisper models', () => {
      expect(SHERPA_ONNX_MODELS.whisper).toBeDefined();
      expect(Object.keys(SHERPA_ONNX_MODELS.whisper)).toEqual(['tiny.en', 'base.en', 'small.en']);
    });
  });

  describe('MODEL_MIGRATION_MAP', () => {
    it('should map old model names to new ones', () => {
      expect(MODEL_MIGRATION_MAP.tiny).toBe('tiny.en');
      expect(MODEL_MIGRATION_MAP.base).toBe('base.en');
      expect(MODEL_MIGRATION_MAP.small).toBe('small.en');
    });

    it('should have exactly 3 mappings', () => {
      expect(Object.keys(MODEL_MIGRATION_MAP).length).toBe(3);
    });

    it('should map to valid WHISPER_MODELS keys', () => {
      for (const newName of Object.values(MODEL_MIGRATION_MAP)) {
        expect(WHISPER_MODELS[newName]).toBeDefined();
      }
    });
  });

  describe('WHISPER_MODELS_LEGACY', () => {
    it('should have legacy tiny, base, small models', () => {
      expect(WHISPER_MODELS_LEGACY.tiny).toBeDefined();
      expect(WHISPER_MODELS_LEGACY.base).toBeDefined();
      expect(WHISPER_MODELS_LEGACY.small).toBeDefined();
    });

    it('should have .bin filenames (GGML format)', () => {
      for (const model of Object.values(WHISPER_MODELS_LEGACY)) {
        expect(model.filename).toMatch(/\.bin$/);
      }
    });

    it('should have HuggingFace URLs', () => {
      for (const model of Object.values(WHISPER_MODELS_LEGACY)) {
        expect(model.url).toContain('huggingface.co');
      }
    });
  });

  describe('AUDIO_CONFIG', () => {
    it('should have required properties', () => {
      expect(AUDIO_CONFIG.sampleRate).toBeDefined();
      expect(AUDIO_CONFIG.channels).toBeDefined();
      expect(AUDIO_CONFIG.bitDepth).toBeDefined();
      expect(AUDIO_CONFIG.chunkDuration).toBeDefined();
      expect(AUDIO_CONFIG.overlapDuration).toBeDefined();
      expect(AUDIO_CONFIG.silenceThreshold).toBeDefined();
      expect(AUDIO_CONFIG.silenceMinDuration).toBeDefined();
    });

    it('should have correct sample rate for Whisper', () => {
      expect(AUDIO_CONFIG.sampleRate).toBe(16000);
    });

    it('should have mono audio', () => {
      expect(AUDIO_CONFIG.channels).toBe(1);
    });

    it('should have 16-bit depth', () => {
      expect(AUDIO_CONFIG.bitDepth).toBe(16);
    });

    it('should have reasonable chunk and overlap durations', () => {
      expect(AUDIO_CONFIG.chunkDuration).toBeGreaterThan(0);
      expect(AUDIO_CONFIG.overlapDuration).toBeGreaterThan(0);
      expect(AUDIO_CONFIG.overlapDuration).toBeLessThan(AUDIO_CONFIG.chunkDuration);
    });
  });

  describe('AUDIO_SOURCES', () => {
    it('should have microphone source', () => {
      expect(AUDIO_SOURCES.MICROPHONE).toBe('microphone');
    });

    it('should have system source', () => {
      expect(AUDIO_SOURCES.SYSTEM).toBe('system');
    });

    it('should have both source', () => {
      expect(AUDIO_SOURCES.BOTH).toBe('both');
    });

    it('should have exactly 3 sources', () => {
      expect(Object.keys(AUDIO_SOURCES).length).toBe(3);
    });
  });

  describe('INSERT_MODES', () => {
    it('should have cursor mode', () => {
      expect(INSERT_MODES.CURSOR).toBe('cursor');
    });

    it('should have append mode', () => {
      expect(INSERT_MODES.APPEND).toBe('append');
    });

    it('should have replace mode', () => {
      expect(INSERT_MODES.REPLACE).toBe('replace');
    });

    it('should have exactly 3 modes', () => {
      expect(Object.keys(INSERT_MODES).length).toBe(3);
    });
  });

  describe('SUPPORTED_LANGUAGES', () => {
    it('should be an array', () => {
      expect(Array.isArray(SUPPORTED_LANGUAGES)).toBe(true);
    });

    it('should have auto-detect option', () => {
      const auto = SUPPORTED_LANGUAGES.find((l) => l.code === 'auto');
      expect(auto).toBeDefined();
      expect(auto.name).toBe('Auto-detect');
    });

    it('should include English', () => {
      const en = SUPPORTED_LANGUAGES.find((l) => l.code === 'en');
      expect(en).toBeDefined();
      expect(en.name).toBe('English');
    });

    it('should include expected language codes', () => {
      const expectedCodes = ['auto', 'en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko'];
      for (const code of expectedCodes) {
        expect(SUPPORTED_LANGUAGES.find((l) => l.code === code)).toBeDefined();
      }
    });

    it('should have code and name for each language', () => {
      for (const lang of SUPPORTED_LANGUAGES) {
        expect(lang.code).toBeDefined();
        expect(typeof lang.code).toBe('string');
        expect(lang.name).toBeDefined();
        expect(typeof lang.name).toBe('string');
      }
    });

    it('should have unique language codes', () => {
      const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
      const uniqueCodes = [...new Set(codes)];
      expect(codes.length).toBe(uniqueCodes.length);
    });
  });

  describe('TRANSCRIPTION_STATUS', () => {
    it('should have idle status', () => {
      expect(TRANSCRIPTION_STATUS.IDLE).toBe('idle');
    });

    it('should have loading_model status', () => {
      expect(TRANSCRIPTION_STATUS.LOADING_MODEL).toBe('loading_model');
    });

    it('should have recording status', () => {
      expect(TRANSCRIPTION_STATUS.RECORDING).toBe('recording');
    });

    it('should have processing status', () => {
      expect(TRANSCRIPTION_STATUS.PROCESSING).toBe('processing');
    });

    it('should have error status', () => {
      expect(TRANSCRIPTION_STATUS.ERROR).toBe('error');
    });

    it('should have exactly 5 statuses', () => {
      expect(Object.keys(TRANSCRIPTION_STATUS).length).toBe(5);
    });
  });
});
