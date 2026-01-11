/**
 * Whisper Model Manager Tests (Legacy GGML)
 * Tests the deprecated legacy model manager that uses GGML format
 */
const path = require('path');
const { WHISPER_MODELS_LEGACY: WHISPER_MODELS } = require('../../../shared/constants/whisper');

// Mock dependencies
jest.mock('../../../shared/utils/paths', () => ({
  getModelsPath: jest.fn(() => '/mock/models/path'),
  ensureDir: jest.fn(),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  createWriteStream: jest.fn(() => ({
    close: jest.fn((cb) => cb && cb()),
    on: jest.fn((event, cb) => {
      if (event === 'finish') setTimeout(cb, 0);
      return this;
    }),
  })),
  unlinkSync: jest.fn(),
  renameSync: jest.fn(),
  promises: {
    stat: jest.fn(),
    unlink: jest.fn(),
  },
}));

jest.mock('https', () => ({
  get: jest.fn(),
}));

const fs = require('fs');
const { getModelsPath } = require('../../../shared/utils/paths');
const modelManager = require('../../../electron/whisper/model-manager');

describe('Whisper Model Manager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getModelPath', () => {
    it('should return correct path for tiny model (legacy GGML)', () => {
      const result = modelManager.getModelPath('tiny');
      expect(result).toBe(path.join('/mock/models/path', WHISPER_MODELS.tiny.filename));
    });

    it('should return correct path for base model (legacy GGML)', () => {
      const result = modelManager.getModelPath('base');
      expect(result).toBe(path.join('/mock/models/path', WHISPER_MODELS.base.filename));
    });

    it('should return correct path for small model (legacy GGML)', () => {
      const result = modelManager.getModelPath('small');
      expect(result).toBe(path.join('/mock/models/path', WHISPER_MODELS.small.filename));
    });

    it('should throw for unknown model size', () => {
      expect(() => modelManager.getModelPath('invalid')).toThrow('Unknown model size: invalid');
    });

    it('should throw for undefined model size', () => {
      expect(() => modelManager.getModelPath(undefined)).toThrow('Unknown model size: undefined');
    });
  });

  describe('getStatus', () => {
    it('should return status with exists=true when model file exists', async () => {
      fs.promises.stat.mockResolvedValue({
        size: 500 * 1024 * 1024, // 500MB
      });

      const result = await modelManager.getStatus('small');

      expect(result.exists).toBe(true);
      expect(result.path).toBeDefined();
      expect(result.fileSize).toBeDefined();
      expect(result.isValid).toBe(true);
    });

    it('should return status with exists=false when model file does not exist', async () => {
      fs.promises.stat.mockRejectedValue(new Error('ENOENT'));

      const result = await modelManager.getStatus('small');

      expect(result.exists).toBe(false);
      expect(result.path).toBeDefined();
      expect(result.fileSize).toBeNull();
      expect(result.isValid).toBe(false);
    });

    it('should include expected size in status', async () => {
      fs.promises.stat.mockRejectedValue(new Error('ENOENT'));

      const result = await modelManager.getStatus('small');

      expect(result.expectedSize).toBe(WHISPER_MODELS.small.size);
    });

    it('should mark model as invalid if file size is too small', async () => {
      fs.promises.stat.mockResolvedValue({
        size: 100 * 1024 * 1024, // 100MB (too small for small model)
      });

      const result = await modelManager.getStatus('small');

      expect(result.exists).toBe(true);
      expect(result.isValid).toBe(false);
    });

    it('should return correct structure', async () => {
      fs.promises.stat.mockResolvedValue({
        size: 75 * 1024 * 1024, // legacy tiny is 75MB
      });

      const result = await modelManager.getStatus('tiny');

      expect(result).toHaveProperty('exists');
      expect(result).toHaveProperty('path');
      expect(result).toHaveProperty('fileSize');
      expect(result).toHaveProperty('fileSizeBytes');
      expect(result).toHaveProperty('expectedSize');
      expect(result).toHaveProperty('isValid');
    });
  });

  describe('formatBytes', () => {
    it('should format 0 bytes', () => {
      expect(modelManager.formatBytes(0)).toBe('0 Bytes');
    });

    it('should format bytes', () => {
      expect(modelManager.formatBytes(500)).toBe('500 Bytes');
    });

    it('should format kilobytes', () => {
      expect(modelManager.formatBytes(1024)).toBe('1 KB');
    });

    it('should format megabytes', () => {
      expect(modelManager.formatBytes(1024 * 1024)).toBe('1 MB');
    });

    it('should format gigabytes', () => {
      expect(modelManager.formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('should format with decimal places', () => {
      expect(modelManager.formatBytes(1536 * 1024)).toBe('1.5 MB');
    });

    it('should format large megabyte values', () => {
      const result = modelManager.formatBytes(500 * 1024 * 1024);
      expect(result).toBe('500 MB');
    });
  });

  describe('deleteModel', () => {
    it('should return true when model is deleted', async () => {
      fs.promises.unlink.mockResolvedValue();

      const result = await modelManager.deleteModel('small');

      expect(result).toBe(true);
      expect(fs.promises.unlink).toHaveBeenCalled();
    });

    it('should return false when model does not exist', async () => {
      fs.promises.unlink.mockRejectedValue(new Error('ENOENT'));

      const result = await modelManager.deleteModel('small');

      expect(result).toBe(false);
    });
  });

  describe('listDownloaded', () => {
    it('should return empty array when no models are downloaded', async () => {
      fs.promises.stat.mockRejectedValue(new Error('ENOENT'));

      const result = await modelManager.listDownloaded();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should return downloaded models (legacy GGML format)', async () => {
      // All models exist
      fs.promises.stat.mockResolvedValue({ size: 500 * 1024 * 1024 });

      const result = await modelManager.listDownloaded();

      expect(Array.isArray(result)).toBe(true);
      // Should return all 3 legacy models: tiny, base, small
      expect(result.length).toBe(3);
    });

    it('should include model metadata for downloaded models', async () => {
      fs.promises.stat.mockResolvedValue({ size: 150 * 1024 * 1024 }); // base size

      const result = await modelManager.listDownloaded();

      for (const model of result) {
        expect(model.size).toBeDefined();
        expect(model.name).toBeDefined();
        expect(model.exists).toBe(true);
      }
    });
  });
});
