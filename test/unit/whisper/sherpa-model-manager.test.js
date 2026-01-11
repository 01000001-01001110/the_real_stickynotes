/**
 * Sherpa-ONNX Model Manager Tests
 */
const path = require('path');

// Mock dependencies
jest.mock('../../../shared/utils/paths', () => ({
  getAppDataPath: jest.fn(() => '/mock/appdata'),
  ensureDir: jest.fn(),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  createWriteStream: jest.fn(() => ({
    close: jest.fn((cb) => cb && cb()),
    on: jest.fn(function (event, cb) {
      if (event === 'finish') setTimeout(cb, 0);
      return this;
    }),
  })),
  promises: {
    stat: jest.fn(),
    unlink: jest.fn(),
    mkdir: jest.fn(),
    rm: jest.fn(),
    rename: jest.fn(),
  },
  statfs: jest.fn((p, cb) =>
    cb(null, {
      bavail: 10 * 1024 * 1024 * 1024, // 10GB
      bsize: 1,
    })
  ),
}));

jest.mock('https', () => ({
  get: jest.fn(),
}));

jest.mock('http', () => ({
  get: jest.fn(),
}));

const fs = require('fs');
const sherpaModelManager = require('../../../electron/whisper/sherpa-model-manager');

describe('Sherpa-ONNX Model Manager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Path Utilities', () => {
    describe('getSherpaBasePath', () => {
      it('should return correct base path', () => {
        const result = sherpaModelManager.getSherpaBasePath();
        expect(result).toBe(path.join('/mock/appdata', 'sherpa-onnx'));
      });
    });

    describe('getVADPath', () => {
      it('should return correct VAD model path', () => {
        const result = sherpaModelManager.getVADPath();
        expect(result).toBe(path.join('/mock/appdata', 'sherpa-onnx', 'vad', 'silero_vad.onnx'));
      });
    });

    describe('getWhisperModelPath', () => {
      it('should return correct path for tiny.en model', () => {
        const result = sherpaModelManager.getWhisperModelPath('tiny.en');
        expect(result).toBe(path.join('/mock/appdata', 'sherpa-onnx', 'whisper', 'tiny.en'));
      });

      it('should return correct path for base.en model', () => {
        const result = sherpaModelManager.getWhisperModelPath('base.en');
        expect(result).toBe(path.join('/mock/appdata', 'sherpa-onnx', 'whisper', 'base.en'));
      });

      it('should return correct path for small.en model', () => {
        const result = sherpaModelManager.getWhisperModelPath('small.en');
        expect(result).toBe(path.join('/mock/appdata', 'sherpa-onnx', 'whisper', 'small.en'));
      });

      it('should throw for unknown model', () => {
        expect(() => sherpaModelManager.getWhisperModelPath('invalid')).toThrow(
          'Unknown model size: invalid'
        );
      });
    });
  });

  describe('Status Checking', () => {
    describe('getVADStatus', () => {
      it('should return installed=true when VAD exists', async () => {
        fs.promises.stat.mockResolvedValue({ size: 2 * 1024 * 1024 }); // 2MB

        const result = await sherpaModelManager.getVADStatus();

        expect(result.installed).toBe(true);
        expect(result.verified).toBe(true);
      });

      it('should return installed=false when VAD does not exist', async () => {
        fs.promises.stat.mockRejectedValue(new Error('ENOENT'));

        const result = await sherpaModelManager.getVADStatus();

        expect(result.installed).toBe(false);
        expect(result.verified).toBe(false);
      });

      it('should mark VAD as unverified if too small', async () => {
        fs.promises.stat.mockResolvedValue({ size: 100 }); // Too small

        const result = await sherpaModelManager.getVADStatus();

        expect(result.installed).toBe(true);
        expect(result.verified).toBe(false);
      });
    });

    describe('getModelStatus', () => {
      it('should return installed=true when all files exist', async () => {
        fs.promises.stat.mockResolvedValue({ size: 10 * 1024 * 1024 }); // 10MB

        const result = await sherpaModelManager.getModelStatus('tiny.en');

        expect(result.installed).toBe(true);
        expect(result.files.encoder).toBe(true);
        expect(result.files.decoder).toBe(true);
        expect(result.files.tokens).toBe(true);
      });

      it('should return installed=false when files are missing', async () => {
        fs.promises.stat.mockRejectedValue(new Error('ENOENT'));

        const result = await sherpaModelManager.getModelStatus('base.en');

        expect(result.installed).toBe(false);
        expect(result.files.encoder).toBe(false);
        expect(result.files.decoder).toBe(false);
        expect(result.files.tokens).toBe(false);
      });

      it('should throw for unknown model', async () => {
        await expect(sherpaModelManager.getModelStatus('invalid')).rejects.toThrow(
          'Unknown model: invalid'
        );
      });

      it('should include expected size in status', async () => {
        fs.promises.stat.mockRejectedValue(new Error('ENOENT'));

        const result = await sherpaModelManager.getModelStatus('base.en');

        expect(result.expectedSize).toBe(160 * 1024 * 1024);
      });
    });

    describe('verifyModel', () => {
      it('should return valid=true when all files exist with proper size', async () => {
        fs.promises.stat.mockResolvedValue({ size: 10 * 1024 * 1024 });

        const result = await sherpaModelManager.verifyModel('tiny.en');

        expect(result.valid).toBe(true);
        expect(result.missing.length).toBe(0);
        expect(result.corrupted.length).toBe(0);
      });

      it('should report missing files', async () => {
        fs.promises.stat.mockRejectedValue({ code: 'ENOENT' });

        const result = await sherpaModelManager.verifyModel('tiny.en');

        expect(result.valid).toBe(false);
        expect(result.missing).toContain('encoder');
        expect(result.missing).toContain('decoder');
        expect(result.missing).toContain('tokens');
      });

      it('should report corrupted files (empty)', async () => {
        fs.promises.stat.mockResolvedValue({ size: 0 });

        const result = await sherpaModelManager.verifyModel('tiny.en');

        expect(result.valid).toBe(false);
        expect(result.corrupted.length).toBeGreaterThan(0);
      });
    });

    describe('getInstallStatus', () => {
      it('should return combined status', async () => {
        fs.promises.stat.mockResolvedValue({ size: 10 * 1024 * 1024 });

        const result = await sherpaModelManager.getInstallStatus();

        expect(result).toHaveProperty('vadInstalled');
        expect(result).toHaveProperty('whisperModels');
        // Use bracket notation to avoid dot being treated as path separator
        expect(result.whisperModels['tiny.en']).toBeDefined();
        expect(result.whisperModels['base.en']).toBeDefined();
        expect(result.whisperModels['small.en']).toBeDefined();
      });
    });
  });

  describe('Disk Space', () => {
    describe('checkDiskSpace', () => {
      it('should return sufficient=true when enough space', async () => {
        // Mock has 10GB available
        const result = await sherpaModelManager.checkDiskSpace(500 * 1024 * 1024); // 500MB

        expect(result.sufficient).toBe(true);
      });
    });
  });

  describe('Model Operations', () => {
    describe('getAvailableModels', () => {
      it('should return list of available models', () => {
        const models = sherpaModelManager.getAvailableModels();

        expect(Array.isArray(models)).toBe(true);
        expect(models.length).toBe(3);
        expect(models.find((m) => m.id === 'tiny.en')).toBeDefined();
        expect(models.find((m) => m.id === 'base.en')).toBeDefined();
        expect(models.find((m) => m.id === 'small.en')).toBeDefined();
      });

      it('should include model metadata', () => {
        const models = sherpaModelManager.getAvailableModels();
        const baseModel = models.find((m) => m.id === 'base.en');

        expect(baseModel.displayName).toBe('Base (English)');
        expect(baseModel.size).toBe('160MB');
        expect(baseModel.description).toContain('Balanced');
      });
    });

    describe('deleteModel', () => {
      it('should return true when model is deleted', async () => {
        fs.promises.rm.mockResolvedValue();

        const result = await sherpaModelManager.deleteModel('tiny.en');

        expect(result).toBe(true);
        expect(fs.promises.rm).toHaveBeenCalled();
      });

      it('should return false when model does not exist', async () => {
        fs.promises.rm.mockRejectedValue(new Error('ENOENT'));

        const result = await sherpaModelManager.deleteModel('tiny.en');

        expect(result).toBe(false);
      });
    });

    describe('deleteVAD', () => {
      it('should return true when VAD is deleted', async () => {
        fs.promises.unlink.mockResolvedValue();

        const result = await sherpaModelManager.deleteVAD();

        expect(result).toBe(true);
      });

      it('should return false when VAD does not exist', async () => {
        fs.promises.unlink.mockRejectedValue(new Error('ENOENT'));

        const result = await sherpaModelManager.deleteVAD();

        expect(result).toBe(false);
      });
    });
  });

  describe('Utilities', () => {
    describe('formatBytes', () => {
      it('should format 0 bytes', () => {
        expect(sherpaModelManager.formatBytes(0)).toBe('0 Bytes');
      });

      it('should format bytes', () => {
        expect(sherpaModelManager.formatBytes(500)).toBe('500 Bytes');
      });

      it('should format kilobytes', () => {
        expect(sherpaModelManager.formatBytes(1024)).toBe('1 KB');
      });

      it('should format megabytes', () => {
        expect(sherpaModelManager.formatBytes(1024 * 1024)).toBe('1 MB');
      });

      it('should format gigabytes', () => {
        expect(sherpaModelManager.formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
      });

      it('should format with decimal places', () => {
        expect(sherpaModelManager.formatBytes(1536 * 1024)).toBe('1.5 MB');
      });
    });
  });

  describe('Custom Errors', () => {
    it('should export InstallerError', () => {
      expect(sherpaModelManager.InstallerError).toBeDefined();
    });

    it('should export NetworkError', () => {
      expect(sherpaModelManager.NetworkError).toBeDefined();
    });

    it('should export DiskSpaceError', () => {
      expect(sherpaModelManager.DiskSpaceError).toBeDefined();
    });

    it('should export ExtractionError', () => {
      expect(sherpaModelManager.ExtractionError).toBeDefined();
    });

    it('should export VerificationError', () => {
      expect(sherpaModelManager.VerificationError).toBeDefined();
    });

    describe('InstallerError', () => {
      it('should have correct properties', () => {
        const error = new sherpaModelManager.InstallerError('Test error', 'TEST_CODE', true);

        expect(error.message).toBe('Test error');
        expect(error.code).toBe('TEST_CODE');
        expect(error.recoverable).toBe(true);
        expect(error.name).toBe('InstallerError');
      });
    });

    describe('DiskSpaceError', () => {
      it('should include space information', () => {
        const error = new sherpaModelManager.DiskSpaceError(500, 100);

        expect(error.required).toBe(500);
        expect(error.available).toBe(100);
        expect(error.code).toBe('INSUFFICIENT_SPACE');
        expect(error.recoverable).toBe(false);
      });
    });

    describe('VerificationError', () => {
      it('should include missing and corrupted files', () => {
        const error = new sherpaModelManager.VerificationError(['encoder'], ['tokens']);

        expect(error.missing).toEqual(['encoder']);
        expect(error.corrupted).toEqual(['tokens']);
        expect(error.code).toBe('VERIFICATION_FAILED');
      });
    });
  });

  describe('Constants', () => {
    it('should export SHERPA_ONNX_MODELS', () => {
      expect(sherpaModelManager.SHERPA_ONNX_MODELS).toBeDefined();
      expect(sherpaModelManager.SHERPA_ONNX_MODELS.vad).toBeDefined();
      expect(sherpaModelManager.SHERPA_ONNX_MODELS.whisper).toBeDefined();
    });

    it('should have VAD model config', () => {
      const vad = sherpaModelManager.SHERPA_ONNX_MODELS.vad;
      expect(vad.name).toBe('silero_vad');
      expect(vad.url).toContain('github.com');
    });

    it('should have Whisper model configs', () => {
      const whisper = sherpaModelManager.SHERPA_ONNX_MODELS.whisper;
      expect(whisper['tiny.en']).toBeDefined();
      expect(whisper['base.en']).toBeDefined();
      expect(whisper['small.en']).toBeDefined();
    });

    it('should have correct file definitions for models', () => {
      const tinyModel = sherpaModelManager.SHERPA_ONNX_MODELS.whisper['tiny.en'];
      expect(tinyModel.files.encoder).toBe('tiny.en-encoder.int8.onnx');
      expect(tinyModel.files.decoder).toBe('tiny.en-decoder.int8.onnx');
      expect(tinyModel.files.tokens).toBe('tiny.en-tokens.txt');
    });
  });
});
