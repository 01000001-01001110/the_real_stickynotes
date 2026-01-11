/**
 * Sherpa-ONNX Service Tests
 */

// Mock the sherpa model manager
jest.mock('../../../electron/whisper/sherpa-model-manager', () => ({
  getVADPath: jest.fn(() => '/mock/vad/silero_vad.onnx'),
  getWhisperModelPath: jest.fn(() => '/mock/whisper/base.en'),
  getVADStatus: jest.fn(),
  getModelStatus: jest.fn(),
  getPlatformConfig: jest.fn(() => ({
    libraryPath: null,
    packageName: 'sherpa-onnx-win-x64',
    pathSeparator: ';',
  })),
  SHERPA_ONNX_MODELS: {
    vad: { name: 'silero_vad' },
    whisper: {
      'tiny.en': {
        name: 'tiny.en',
        files: {
          encoder: 'tiny.en-encoder.int8.onnx',
          decoder: 'tiny.en-decoder.int8.onnx',
          tokens: 'tiny.en-tokens.txt',
        },
      },
      'base.en': {
        name: 'base.en',
        files: {
          encoder: 'base.en-encoder.int8.onnx',
          decoder: 'base.en-decoder.int8.onnx',
          tokens: 'base.en-tokens.txt',
        },
      },
      'small.en': {
        name: 'small.en',
        files: {
          encoder: 'small.en-encoder.int8.onnx',
          decoder: 'small.en-decoder.int8.onnx',
          tokens: 'small.en-tokens.txt',
        },
      },
    },
  },
}));

// Mock sherpa-onnx-node - may not be installed
jest.mock(
  'sherpa-onnx-node',
  () => ({
    createVoiceActivityDetector: jest.fn(() => ({
      acceptWaveform: jest.fn(),
      isEmpty: jest.fn(() => true),
      front: jest.fn(),
      pop: jest.fn(),
      flush: jest.fn(),
    })),
    createOfflineRecognizer: jest.fn(() => ({
      createStream: jest.fn(() => ({
        acceptWaveform: jest.fn(),
      })),
      decode: jest.fn(),
      getResult: jest.fn(() => ({ text: '' })),
    })),
  }),
  { virtual: true }
);

const sherpaService = require('../../../electron/whisper/sherpa-service');
const sherpaModelManager = require('../../../electron/whisper/sherpa-model-manager');

describe('Sherpa-ONNX Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sherpaService.unloadModel();
  });

  describe('Service Status', () => {
    describe('isLoaded', () => {
      it('should return false initially', () => {
        expect(sherpaService.isLoaded()).toBe(false);
      });

      it('should return false after unloadModel', () => {
        sherpaService.unloadModel();
        expect(sherpaService.isLoaded()).toBe(false);
      });
    });

    describe('isServiceLoading', () => {
      it('should return false initially', () => {
        expect(sherpaService.isServiceLoading()).toBe(false);
      });
    });

    describe('getLoadedModel', () => {
      it('should return null initially', () => {
        expect(sherpaService.getLoadedModel()).toBeNull();
      });

      it('should return null after unloadModel', () => {
        sherpaService.unloadModel();
        expect(sherpaService.getLoadedModel()).toBeNull();
      });
    });

    describe('getServiceStatus', () => {
      it('should return correct structure', () => {
        const status = sherpaService.getServiceStatus();

        expect(status).toHaveProperty('loaded');
        expect(status).toHaveProperty('loading');
        expect(status).toHaveProperty('modelSize');
        expect(status).toHaveProperty('hasVAD');
        expect(status).toHaveProperty('hasRecognizer');
      });

      it('should return loaded=false initially', () => {
        const status = sherpaService.getServiceStatus();
        expect(status.loaded).toBe(false);
      });

      it('should return modelSize=null initially', () => {
        const status = sherpaService.getServiceStatus();
        expect(status.modelSize).toBeNull();
      });

      it('should return hasVAD=false initially', () => {
        const status = sherpaService.getServiceStatus();
        expect(status.hasVAD).toBe(false);
      });

      it('should return hasRecognizer=false initially', () => {
        const status = sherpaService.getServiceStatus();
        expect(status.hasRecognizer).toBe(false);
      });
    });
  });

  describe('Audio Conversion', () => {
    describe('int16ToFloat32', () => {
      it('should convert int16 samples to float32', () => {
        const int16Data = new Int16Array([0, 16384, -16384, 32767, -32768]);
        const result = sherpaService.int16ToFloat32(int16Data);

        expect(result instanceof Float32Array).toBe(true);
        expect(result.length).toBe(5);
      });

      it('should convert 0 to 0', () => {
        const int16Data = new Int16Array([0]);
        const result = sherpaService.int16ToFloat32(int16Data);
        expect(result[0]).toBe(0);
      });

      it('should normalize max positive int16', () => {
        const int16Data = new Int16Array([32767]);
        const result = sherpaService.int16ToFloat32(int16Data);
        expect(result[0]).toBeCloseTo(1.0, 3);
      });

      it('should normalize max negative int16', () => {
        const int16Data = new Int16Array([-32768]);
        const result = sherpaService.int16ToFloat32(int16Data);
        expect(result[0]).toBeCloseTo(-1.0, 3);
      });

      it('should handle empty array', () => {
        const int16Data = new Int16Array([]);
        const result = sherpaService.int16ToFloat32(int16Data);
        expect(result.length).toBe(0);
      });

      it('should preserve sample count', () => {
        const int16Data = new Int16Array(1000);
        const result = sherpaService.int16ToFloat32(int16Data);
        expect(result.length).toBe(1000);
      });
    });

    describe('float32ToInt16', () => {
      it('should convert float32 samples to int16', () => {
        const float32Data = new Float32Array([0, 0.5, -0.5, 1, -1]);
        const result = sherpaService.float32ToInt16(float32Data);

        expect(result instanceof Int16Array).toBe(true);
        expect(result.length).toBe(5);
      });

      it('should convert 0 to 0', () => {
        const float32Data = new Float32Array([0]);
        const result = sherpaService.float32ToInt16(float32Data);
        expect(result[0]).toBe(0);
      });

      it('should convert 1.0 to max positive int16', () => {
        const float32Data = new Float32Array([1.0]);
        const result = sherpaService.float32ToInt16(float32Data);
        expect(result[0]).toBe(32767);
      });

      it('should convert -1.0 to max negative int16', () => {
        const float32Data = new Float32Array([-1.0]);
        const result = sherpaService.float32ToInt16(float32Data);
        expect(result[0]).toBe(-32768);
      });

      it('should clamp values above 1.0', () => {
        const float32Data = new Float32Array([1.5]);
        const result = sherpaService.float32ToInt16(float32Data);
        expect(result[0]).toBe(32767);
      });

      it('should clamp values below -1.0', () => {
        const float32Data = new Float32Array([-1.5]);
        const result = sherpaService.float32ToInt16(float32Data);
        expect(result[0]).toBe(-32768);
      });

      it('should handle empty array', () => {
        const float32Data = new Float32Array([]);
        const result = sherpaService.float32ToInt16(float32Data);
        expect(result.length).toBe(0);
      });
    });

    describe('Roundtrip conversion', () => {
      it('should approximately preserve values', () => {
        const original = new Float32Array([0, 0.5, -0.5, 0.25, -0.75]);
        const int16 = sherpaService.float32ToInt16(original);
        const result = sherpaService.int16ToFloat32(int16);

        for (let i = 0; i < original.length; i++) {
          expect(result[i]).toBeCloseTo(original[i], 2);
        }
      });
    });
  });

  describe('Model Loading', () => {
    describe('loadModel', () => {
      it('should throw if VAD is not installed', async () => {
        sherpaModelManager.getVADStatus.mockResolvedValue({
          installed: false,
          verified: false,
        });

        await expect(sherpaService.loadModel('base.en')).rejects.toThrow(/VAD model not installed/);
      });

      it('should throw if Whisper model is not installed', async () => {
        sherpaModelManager.getVADStatus.mockResolvedValue({
          installed: true,
          verified: true,
        });
        sherpaModelManager.getModelStatus.mockResolvedValue({
          installed: false,
          verified: false,
        });

        await expect(sherpaService.loadModel('base.en')).rejects.toThrow(/not installed/);
      });

      it('should throw if VAD is installed but not verified', async () => {
        sherpaModelManager.getVADStatus.mockResolvedValue({
          installed: true,
          verified: false,
        });

        await expect(sherpaService.loadModel('base.en')).rejects.toThrow(/VAD model not installed/);
      });
    });

    describe('unloadModel', () => {
      it('should reset all state', () => {
        sherpaService.unloadModel();

        expect(sherpaService.isLoaded()).toBe(false);
        expect(sherpaService.getLoadedModel()).toBeNull();
        expect(sherpaService.getServiceStatus().hasVAD).toBe(false);
        expect(sherpaService.getServiceStatus().hasRecognizer).toBe(false);
      });
    });
  });

  describe('Transcription', () => {
    describe('transcribe', () => {
      it('should throw if model is not loaded', async () => {
        const audioData = new Float32Array(1000);

        await expect(sherpaService.transcribe(audioData)).rejects.toThrow(/Service not loaded/);
      });
    });

    describe('processAudio', () => {
      it('should throw if service is not loaded', () => {
        const samples = new Float32Array(1000);

        expect(() => sherpaService.processAudio(samples)).toThrow(/Service not loaded/);
      });
    });

    describe('flush', () => {
      it('should return empty array if not loaded', () => {
        const result = sherpaService.flush();
        expect(result).toEqual([]);
      });
    });
  });

  describe('Utility Functions', () => {
    describe('isSherpaAvailable', () => {
      it('should return boolean', () => {
        const result = sherpaService.isSherpaAvailable();
        expect(typeof result).toBe('boolean');
      });
    });
  });

  describe('Default Configuration', () => {
    it('should export DEFAULT_CONFIG', () => {
      expect(sherpaService.DEFAULT_CONFIG).toBeDefined();
      expect(sherpaService.DEFAULT_CONFIG.vadThreshold).toBe(0.5);
      expect(sherpaService.DEFAULT_CONFIG.vadMinSilenceDuration).toBe(0.25);
      expect(sherpaService.DEFAULT_CONFIG.vadMinSpeechDuration).toBe(0.25);
      expect(sherpaService.DEFAULT_CONFIG.vadMaxSpeechDuration).toBe(5.0);
      expect(sherpaService.DEFAULT_CONFIG.numThreads).toBe(4);
      expect(sherpaService.DEFAULT_CONFIG.language).toBe('en');
    });
  });
});
