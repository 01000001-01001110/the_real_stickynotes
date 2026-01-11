/**
 * Whisper Installer IPC Handler Tests
 * Tests the IPC handlers for model installation, status, and management
 */

// Mock ipcMain before requiring handlers
const mockHandle = jest.fn();
const mockOn = jest.fn();
jest.mock('electron', () => ({
  ipcMain: {
    handle: mockHandle,
    on: mockOn,
  },
}));

// Mock sherpa-model-manager
jest.mock('../../../electron/whisper/sherpa-model-manager', () => ({
  getInstallStatus: jest.fn(),
  getVADStatus: jest.fn(),
  getModelStatus: jest.fn(),
  getAvailableModels: jest.fn(),
  downloadVAD: jest.fn(),
  downloadModel: jest.fn(),
  deleteModel: jest.fn(),
  verifyModel: jest.fn(),
  checkDiskSpace: jest.fn(),
  SHERPA_ONNX_MODELS: {
    vad: { name: 'silero_vad', sizeBytes: 2 * 1024 * 1024 },
    whisper: {
      'tiny.en': { displayName: 'Tiny (English)', sizeBytes: 117 * 1024 * 1024 },
      'base.en': { displayName: 'Base (English)', sizeBytes: 160 * 1024 * 1024 },
      'small.en': { displayName: 'Small (English)', sizeBytes: 400 * 1024 * 1024 },
    },
  },
}));

// Mock sherpa-service
jest.mock('../../../electron/whisper/sherpa-service', () => ({
  getLoadedModel: jest.fn(),
  unloadModel: jest.fn(),
  isLoaded: jest.fn(),
  getServiceStatus: jest.fn(),
  isSherpaAvailable: jest.fn(),
  loadModel: jest.fn(),
  transcribe: jest.fn(),
}));

// Mock settings
jest.mock('../../../shared/database/settings', () => ({
  getSetting: jest.fn(),
}));

const sherpaModelManager = require('../../../electron/whisper/sherpa-model-manager');
const sherpaService = require('../../../electron/whisper/sherpa-service');
const { getSetting } = require('../../../shared/database/settings');

describe('Whisper Installer IPC Handlers', () => {
  let handlers = {};

  beforeAll(() => {
    // Require the module to register handlers
    require('../../../electron/ipc/whisper').register({});

    // Extract registered handlers
    mockHandle.mock.calls.forEach(([channel, handler]) => {
      handlers[channel] = handler;
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('whisper:getInstallStatus', () => {
    it('should return combined install status', async () => {
      sherpaModelManager.getInstallStatus.mockResolvedValue({
        vadInstalled: true,
        whisperModels: {
          'tiny.en': { installed: true, verified: true },
          'base.en': { installed: false, verified: false },
          'small.en': { installed: false, verified: false },
        },
      });
      sherpaService.getLoadedModel.mockReturnValue('tiny.en');

      const result = await handlers['whisper:getInstallStatus']();

      expect(result.vadInstalled).toBe(true);
      expect(result.whisperModels['tiny.en'].installed).toBe(true);
      expect(result.activeModel).toBe('tiny.en');
    });

    it('should handle errors gracefully', async () => {
      sherpaModelManager.getInstallStatus.mockRejectedValue(new Error('Status check failed'));

      const result = await handlers['whisper:getInstallStatus']();

      expect(result.vadInstalled).toBe(false);
      expect(result.error).toBe('Status check failed');
    });
  });

  describe('whisper:getAvailableModels', () => {
    it('should return available models list', async () => {
      sherpaModelManager.getAvailableModels.mockReturnValue([
        { id: 'tiny.en', displayName: 'Tiny (English)', size: '117MB' },
        { id: 'base.en', displayName: 'Base (English)', size: '160MB' },
        { id: 'small.en', displayName: 'Small (English)', size: '400MB' },
      ]);

      const result = await handlers['whisper:getAvailableModels']();

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('tiny.en');
    });
  });

  describe('whisper:installModel', () => {
    const mockSender = {
      send: jest.fn(),
    };
    const mockEvent = { sender: mockSender };

    beforeEach(() => {
      sherpaModelManager.getVADStatus.mockResolvedValue({ installed: false });
      sherpaModelManager.checkDiskSpace.mockResolvedValue({
        sufficient: true,
        available: 10 * 1024 * 1024 * 1024,
        required: 500 * 1024 * 1024,
      });
      sherpaModelManager.downloadVAD.mockResolvedValue();
      sherpaModelManager.downloadModel.mockResolvedValue();
    });

    it('should return error for invalid model', async () => {
      const result = await handlers['whisper:installModel'](mockEvent, 'invalid-model');

      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_MODEL');
    });

    it('should check disk space before installation', async () => {
      sherpaModelManager.checkDiskSpace.mockResolvedValue({
        sufficient: false,
        available: 50 * 1024 * 1024,
        required: 500 * 1024 * 1024,
      });

      const result = await handlers['whisper:installModel'](mockEvent, 'base.en');

      expect(result.success).toBe(false);
      expect(result.error).toBe('INSUFFICIENT_SPACE');
    });

    it('should download VAD if not installed', async () => {
      sherpaModelManager.getVADStatus.mockResolvedValue({ installed: false });

      await handlers['whisper:installModel'](mockEvent, 'base.en');

      expect(sherpaModelManager.downloadVAD).toHaveBeenCalled();
    });

    it('should skip VAD download if already installed', async () => {
      sherpaModelManager.getVADStatus.mockResolvedValue({ installed: true });

      await handlers['whisper:installModel'](mockEvent, 'base.en');

      expect(sherpaModelManager.downloadVAD).not.toHaveBeenCalled();
    });

    it('should send progress events', async () => {
      sherpaModelManager.downloadModel.mockImplementation(async (model, onProgress) => {
        onProgress(50, 'download');
        onProgress(100, 'download');
        onProgress(50, 'extract');
        onProgress(100, 'extract');
        onProgress(100, 'verify');
      });

      await handlers['whisper:installModel'](mockEvent, 'base.en');

      expect(mockSender.send).toHaveBeenCalledWith(
        'whisper:installProgress',
        expect.objectContaining({ stage: expect.any(String) })
      );
    });

    it('should return success on completion', async () => {
      const result = await handlers['whisper:installModel'](mockEvent, 'base.en');

      expect(result.success).toBe(true);
    });

    it('should handle installation errors', async () => {
      sherpaModelManager.downloadModel.mockRejectedValue(new Error('Download failed'));

      const result = await handlers['whisper:installModel'](mockEvent, 'base.en');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Download failed');
      expect(mockSender.send).toHaveBeenCalledWith('whisper:installError', 'Download failed');
    });
  });

  describe('whisper:uninstallModel', () => {
    it('should unload model if currently loaded', async () => {
      sherpaService.getLoadedModel.mockReturnValue('base.en');
      sherpaModelManager.deleteModel.mockResolvedValue(true);

      await handlers['whisper:uninstallModel']({}, 'base.en');

      expect(sherpaService.unloadModel).toHaveBeenCalled();
      expect(sherpaModelManager.deleteModel).toHaveBeenCalledWith('base.en');
    });

    it('should not unload if different model loaded', async () => {
      sherpaService.getLoadedModel.mockReturnValue('tiny.en');
      sherpaModelManager.deleteModel.mockResolvedValue(true);

      await handlers['whisper:uninstallModel']({}, 'base.en');

      expect(sherpaService.unloadModel).not.toHaveBeenCalled();
    });

    it('should return success when model deleted', async () => {
      sherpaService.getLoadedModel.mockReturnValue(null);
      sherpaModelManager.deleteModel.mockResolvedValue(true);

      const result = await handlers['whisper:uninstallModel']({}, 'base.en');

      expect(result.success).toBe(true);
    });

    it('should handle deletion errors', async () => {
      sherpaService.getLoadedModel.mockReturnValue(null);
      sherpaModelManager.deleteModel.mockRejectedValue(new Error('Delete failed'));

      const result = await handlers['whisper:uninstallModel']({}, 'base.en');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Delete failed');
    });
  });

  describe('whisper:verifyModel', () => {
    it('should return verification result', async () => {
      sherpaModelManager.verifyModel.mockResolvedValue({
        valid: true,
        missing: [],
        corrupted: [],
      });

      const result = await handlers['whisper:verifyModel']({}, 'base.en');

      expect(result.valid).toBe(true);
    });

    it('should return invalid for corrupted model', async () => {
      sherpaModelManager.verifyModel.mockResolvedValue({
        valid: false,
        missing: [],
        corrupted: ['encoder'],
      });

      const result = await handlers['whisper:verifyModel']({}, 'base.en');

      expect(result.valid).toBe(false);
      expect(result.corrupted).toContain('encoder');
    });
  });

  describe('whisper:getModelStatus (legacy)', () => {
    it('should return legacy format status', async () => {
      getSetting.mockReturnValue('base.en');
      sherpaModelManager.getModelStatus.mockResolvedValue({
        installed: true,
        verified: true,
        size: 160 * 1024 * 1024,
        path: '/path/to/model',
      });
      sherpaModelManager.getVADStatus.mockResolvedValue({
        installed: true,
        verified: true,
      });
      sherpaService.getServiceStatus.mockReturnValue({
        loaded: true,
        loading: false,
      });

      const result = await handlers['whisper:getModelStatus']();

      expect(result.downloaded).toBe(true);
      expect(result.isValid).toBe(true);
      expect(result.size).toBe('base.en');
      expect(result.loaded).toBe(true);
    });

    it('should return not downloaded when VAD missing', async () => {
      getSetting.mockReturnValue('base.en');
      sherpaModelManager.getModelStatus.mockResolvedValue({
        installed: true,
        verified: true,
      });
      sherpaModelManager.getVADStatus.mockResolvedValue({
        installed: false,
        verified: false,
      });
      sherpaService.getServiceStatus.mockReturnValue({
        loaded: false,
        loading: false,
      });

      const result = await handlers['whisper:getModelStatus']();

      expect(result.downloaded).toBe(false);
    });
  });

  describe('whisper:isAvailable', () => {
    it('should return availability status', async () => {
      getSetting.mockImplementation((key) => {
        if (key === 'whisper.enabled') return true;
        if (key === 'whisper.modelSize') return 'base.en';
        return null;
      });
      sherpaModelManager.getModelStatus.mockResolvedValue({ installed: true });
      sherpaModelManager.getVADStatus.mockResolvedValue({ installed: true });
      sherpaService.isLoaded.mockReturnValue(true);
      sherpaService.isSherpaAvailable.mockReturnValue(true);

      const result = await handlers['whisper:isAvailable']();

      expect(result.enabled).toBe(true);
      expect(result.modelDownloaded).toBe(true);
      expect(result.modelLoaded).toBe(true);
      expect(result.sherpaAvailable).toBe(true);
    });

    it('should return not available when disabled', async () => {
      getSetting.mockImplementation((key) => {
        if (key === 'whisper.enabled') return false;
        if (key === 'whisper.modelSize') return 'base.en';
        return null;
      });
      sherpaModelManager.getModelStatus.mockResolvedValue({ installed: false });
      sherpaModelManager.getVADStatus.mockResolvedValue({ installed: false });
      sherpaService.isLoaded.mockReturnValue(false);
      sherpaService.isSherpaAvailable.mockReturnValue(true);

      const result = await handlers['whisper:isAvailable']();

      expect(result.enabled).toBe(false);
      expect(result.modelDownloaded).toBe(false);
    });
  });

  describe('whisper:listModels', () => {
    it('should return list of installed models', async () => {
      sherpaModelManager.getModelStatus
        .mockResolvedValueOnce({ installed: true, verified: true })
        .mockResolvedValueOnce({ installed: false })
        .mockResolvedValueOnce({ installed: true, verified: true });

      const result = await handlers['whisper:listModels']();

      expect(result).toHaveLength(2);
    });

    it('should return empty array when no models installed', async () => {
      sherpaModelManager.getModelStatus.mockResolvedValue({ installed: false });

      const result = await handlers['whisper:listModels']();

      expect(result).toHaveLength(0);
    });
  });
});
