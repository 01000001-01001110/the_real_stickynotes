/**
 * Whisper Service Tests
 */

// Mock the model manager
jest.mock('../../../electron/whisper/model-manager', () => ({
  getModelPath: jest.fn(() => '/mock/path/to/model.bin'),
  getStatus: jest.fn(),
}));

// Mock whisper-node - this module may not be installed
jest.mock('whisper-node', () => ({
  whisper: jest.fn(),
}), { virtual: true });

const whisperService = require('../../../electron/whisper/service');
const modelManager = require('../../../electron/whisper/model-manager');

describe('Whisper Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset service state between tests
    whisperService.unloadModel();
  });

  describe('isLoaded', () => {
    it('should return false initially', () => {
      expect(whisperService.isLoaded()).toBe(false);
    });

    it('should return false after unloadModel', () => {
      whisperService.unloadModel();
      expect(whisperService.isLoaded()).toBe(false);
    });
  });

  describe('getLoadedModel', () => {
    it('should return null initially', () => {
      expect(whisperService.getLoadedModel()).toBeNull();
    });

    it('should return null after unloadModel', () => {
      whisperService.unloadModel();
      expect(whisperService.getLoadedModel()).toBeNull();
    });
  });

  describe('getServiceStatus', () => {
    it('should return correct structure', () => {
      const status = whisperService.getServiceStatus();

      expect(status).toHaveProperty('loaded');
      expect(status).toHaveProperty('loading');
      expect(status).toHaveProperty('modelSize');
      expect(status).toHaveProperty('sampleRate');
    });

    it('should return loaded=false initially', () => {
      const status = whisperService.getServiceStatus();
      expect(status.loaded).toBe(false);
    });

    it('should return modelSize=null initially', () => {
      const status = whisperService.getServiceStatus();
      expect(status.modelSize).toBeNull();
    });

    it('should return sampleRate=16000', () => {
      const status = whisperService.getServiceStatus();
      expect(status.sampleRate).toBe(16000);
    });
  });

  describe('float32ToInt16', () => {
    it('should convert float32 samples to int16', () => {
      const float32Data = new Float32Array([0, 0.5, -0.5, 1, -1]);
      const result = whisperService.float32ToInt16(float32Data);

      expect(result instanceof Int16Array).toBe(true);
      expect(result.length).toBe(5);
    });

    it('should convert 0 to 0', () => {
      const float32Data = new Float32Array([0]);
      const result = whisperService.float32ToInt16(float32Data);
      expect(result[0]).toBe(0);
    });

    it('should convert 1.0 to max positive int16', () => {
      const float32Data = new Float32Array([1.0]);
      const result = whisperService.float32ToInt16(float32Data);
      expect(result[0]).toBe(32767); // 0x7FFF
    });

    it('should convert -1.0 to max negative int16', () => {
      const float32Data = new Float32Array([-1.0]);
      const result = whisperService.float32ToInt16(float32Data);
      expect(result[0]).toBe(-32768); // -0x8000
    });

    it('should clamp values above 1.0', () => {
      const float32Data = new Float32Array([1.5]);
      const result = whisperService.float32ToInt16(float32Data);
      expect(result[0]).toBe(32767);
    });

    it('should clamp values below -1.0', () => {
      const float32Data = new Float32Array([-1.5]);
      const result = whisperService.float32ToInt16(float32Data);
      expect(result[0]).toBe(-32768);
    });

    it('should handle empty array', () => {
      const float32Data = new Float32Array([]);
      const result = whisperService.float32ToInt16(float32Data);
      expect(result.length).toBe(0);
    });

    it('should preserve sample count', () => {
      const float32Data = new Float32Array(1000);
      const result = whisperService.float32ToInt16(float32Data);
      expect(result.length).toBe(1000);
    });
  });

  describe('int16ToFloat32', () => {
    it('should convert int16 samples to float32', () => {
      const int16Data = new Int16Array([0, 16384, -16384, 32767, -32768]);
      const result = whisperService.int16ToFloat32(int16Data);

      expect(result instanceof Float32Array).toBe(true);
      expect(result.length).toBe(5);
    });

    it('should convert 0 to 0', () => {
      const int16Data = new Int16Array([0]);
      const result = whisperService.int16ToFloat32(int16Data);
      expect(result[0]).toBe(0);
    });

    it('should convert max positive int16 to ~1.0', () => {
      const int16Data = new Int16Array([32767]);
      const result = whisperService.int16ToFloat32(int16Data);
      expect(result[0]).toBeCloseTo(1.0, 3);
    });

    it('should convert max negative int16 to ~-1.0', () => {
      const int16Data = new Int16Array([-32768]);
      const result = whisperService.int16ToFloat32(int16Data);
      expect(result[0]).toBeCloseTo(-1.0, 3);
    });

    it('should handle empty array', () => {
      const int16Data = new Int16Array([]);
      const result = whisperService.int16ToFloat32(int16Data);
      expect(result.length).toBe(0);
    });

    it('should preserve sample count', () => {
      const int16Data = new Int16Array(1000);
      const result = whisperService.int16ToFloat32(int16Data);
      expect(result.length).toBe(1000);
    });
  });

  describe('float32ToInt16 and int16ToFloat32 roundtrip', () => {
    it('should approximately preserve values in roundtrip', () => {
      const original = new Float32Array([0, 0.5, -0.5, 0.25, -0.75]);
      const int16 = whisperService.float32ToInt16(original);
      const result = whisperService.int16ToFloat32(int16);

      for (let i = 0; i < original.length; i++) {
        expect(result[i]).toBeCloseTo(original[i], 2);
      }
    });
  });

  describe('unloadModel', () => {
    it('should reset loaded state', () => {
      whisperService.unloadModel();
      expect(whisperService.isLoaded()).toBe(false);
      expect(whisperService.getLoadedModel()).toBeNull();
    });
  });

  describe('loadModel', () => {
    it('should throw if model is not downloaded', async () => {
      modelManager.getStatus.mockResolvedValue({ exists: false });

      await expect(whisperService.loadModel('small')).rejects.toThrow(
        /Model not downloaded/
      );
    });
  });

  describe('transcribe', () => {
    it('should throw if model is not loaded', async () => {
      const audioData = new Float32Array(1000);
      
      await expect(whisperService.transcribe(audioData)).rejects.toThrow(
        /Whisper model not loaded/
      );
    });
  });
});
