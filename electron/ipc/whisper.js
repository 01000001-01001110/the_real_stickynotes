/**
 * Whisper IPC handlers
 * Handles transcription-related IPC communication
 * Updated for Sherpa-ONNX integration (v2)
 */
const { ipcMain } = require('electron');
const sherpaService = require('../whisper/sherpa-service');
const sherpaModelManager = require('../whisper/sherpa-model-manager');
const { getSetting } = require('../../shared/database/settings');

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

/**
 * Register Whisper IPC handlers
 * @param {object} _wm - Window manager instance (unused, reserved for future)
 */
function register(_wm) {
  // =========================================================================
  // INSTALLATION HANDLERS
  // =========================================================================

  /**
   * Install a Whisper model (includes VAD if needed)
   * Emits progress events to sender
   */
  ipcMain.handle('whisper:installModel', async (event, modelSize) => {
    const sender = event.sender;

    try {
      // Check disk space
      const vadStatus = await sherpaModelManager.getVADStatus();
      const modelConfig = sherpaModelManager.SHERPA_ONNX_MODELS.whisper[modelSize];

      if (!modelConfig) {
        return {
          success: false,
          error: 'INVALID_MODEL',
          message: `Unknown model: ${modelSize}`,
        };
      }

      let requiredSpace = modelConfig.sizeBytes * 2.5; // Archive + extracted + buffer
      if (!vadStatus.installed) {
        requiredSpace += 3 * 1024 * 1024; // VAD with buffer
      }

      const spaceCheck = await sherpaModelManager.checkDiskSpace(requiredSpace);
      if (!spaceCheck.sufficient) {
        return {
          success: false,
          error: 'INSUFFICIENT_SPACE',
          message: `Need ${formatBytes(spaceCheck.required)}, only ${formatBytes(spaceCheck.available)} available`,
        };
      }

      // Download VAD if needed
      if (!vadStatus.installed) {
        sender.send('whisper:installProgress', {
          stage: 'vad',
          progress: 0,
          message: 'Downloading voice detection model...',
        });

        await sherpaModelManager.downloadVAD((progress) => {
          sender.send('whisper:installProgress', {
            stage: 'vad',
            progress: 2 + progress * 0.08, // 2-10%
            message: 'Downloading voice detection model...',
          });
        });
      }

      // Download Whisper model
      sender.send('whisper:installProgress', {
        stage: 'model',
        progress: 10,
        message: `Downloading ${modelConfig.displayName}...`,
      });

      await sherpaModelManager.downloadModel(modelSize, (progress, stage) => {
        let overallProgress;
        let message;

        if (stage === 'download') {
          overallProgress = 10 + progress * 0.7; // 10-80%
          message = `Downloading ${modelConfig.displayName}... ${progress}%`;
        } else if (stage === 'extract') {
          overallProgress = 80 + progress * 0.15; // 80-95%
          message = 'Extracting model files...';
        } else if (stage === 'verify') {
          overallProgress = 95 + progress * 0.05; // 95-100%
          message = 'Verifying installation...';
        }

        sender.send('whisper:installProgress', {
          stage,
          progress: overallProgress,
          message,
        });
      });

      sender.send('whisper:installProgress', {
        stage: 'complete',
        progress: 100,
        message: 'Installation complete!',
      });

      return { success: true };
    } catch (error) {
      console.error('Model installation failed:', error);
      sender.send('whisper:installError', error.message);

      return {
        success: false,
        error: error.code || 'INSTALL_FAILED',
        message: error.message,
      };
    }
  });

  /**
   * Uninstall a Whisper model
   */
  ipcMain.handle('whisper:uninstallModel', async (event, modelSize) => {
    try {
      // Unload if currently loaded
      if (sherpaService.getLoadedModel() === modelSize) {
        sherpaService.unloadModel();
      }

      await sherpaModelManager.deleteModel(modelSize);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Get installation status
   */
  ipcMain.handle('whisper:getInstallStatus', async () => {
    try {
      const status = await sherpaModelManager.getInstallStatus();
      status.activeModel = sherpaService.getLoadedModel();
      return status;
    } catch (error) {
      return {
        vadInstalled: false,
        whisperModels: {},
        error: error.message,
      };
    }
  });

  /**
   * Get available models list
   */
  ipcMain.handle('whisper:getAvailableModels', () => {
    return sherpaModelManager.getAvailableModels();
  });

  /**
   * Verify model installation
   */
  ipcMain.handle('whisper:verifyModel', async (event, modelSize) => {
    return await sherpaModelManager.verifyModel(modelSize);
  });

  // =========================================================================
  // LEGACY HANDLERS (for compatibility during migration)
  // =========================================================================

  /**
   * Get model status for settings UI (legacy format)
   */
  ipcMain.handle('whisper:getModelStatus', async () => {
    try {
      const modelSize = getSetting('whisper.modelSize');
      const status = await sherpaModelManager.getModelStatus(modelSize);
      const vadStatus = await sherpaModelManager.getVADStatus();
      const serviceStatus = sherpaService.getServiceStatus();

      return {
        downloaded: status.installed && vadStatus.installed,
        isValid: status.verified && vadStatus.verified,
        size: modelSize,
        fileSize: status.size ? formatBytes(status.size) : null,
        path: status.path,
        loaded: serviceStatus.loaded,
        loading: serviceStatus.loading,
        vadInstalled: vadStatus.installed,
      };
    } catch (error) {
      console.error('Failed to get model status:', error);
      return {
        downloaded: false,
        isValid: false,
        error: error.message,
      };
    }
  });

  /**
   * Download model with progress (legacy format)
   */
  ipcMain.handle('whisper:downloadModel', async (event, size) => {
    const sender = event.sender;

    try {
      // Use new installModel handler internally
      const vadStatus = await sherpaModelManager.getVADStatus();

      // Download VAD if needed (0-10%)
      if (!vadStatus.installed) {
        await sherpaModelManager.downloadVAD((progress) => {
          sender.send('whisper:downloadProgress', Math.round(progress * 0.1));
        });
      }

      // Download model (10-100%)
      await sherpaModelManager.downloadModel(size, (progress, stage) => {
        let overallProgress;
        if (stage === 'download') {
          overallProgress = 10 + Math.round(progress * 0.7);
        } else if (stage === 'extract') {
          overallProgress = 80 + Math.round(progress * 0.15);
        } else {
          overallProgress = 95 + Math.round(progress * 0.05);
        }
        sender.send('whisper:downloadProgress', overallProgress);
      });

      sender.send('whisper:downloadProgress', 100);
      return { success: true };
    } catch (error) {
      console.error('Failed to download model:', error);
      sender.send('whisper:error', error.message);
      return { success: false, error: error.message };
    }
  });

  /**
   * Delete model (legacy)
   */
  ipcMain.handle('whisper:deleteModel', async () => {
    try {
      const modelSize = getSetting('whisper.modelSize');
      sherpaService.unloadModel();
      await sherpaModelManager.deleteModel(modelSize);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete model:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Load model
   */
  ipcMain.handle('whisper:loadModel', async (event, size) => {
    try {
      const modelSize = size || getSetting('whisper.modelSize');
      const config = {
        vadThreshold: getSetting('whisper.vadThreshold'),
        vadMinSilenceDuration: getSetting('whisper.vadMinSilence'),
        vadMaxSpeechDuration: getSetting('whisper.vadMaxSpeech'),
        numThreads: getSetting('whisper.numThreads'),
        language: getSetting('whisper.language'),
      };

      await sherpaService.loadModel(modelSize, config);
      return { success: true };
    } catch (error) {
      console.error('Failed to load model:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Transcribe audio chunk
   */
  ipcMain.handle('whisper:transcribe', async (event, audioData) => {
    try {
      // Ensure model is loaded
      if (!sherpaService.isLoaded()) {
        const modelSize = getSetting('whisper.modelSize');
        const config = {
          vadThreshold: getSetting('whisper.vadThreshold'),
          vadMinSilenceDuration: getSetting('whisper.vadMinSilence'),
          vadMaxSpeechDuration: getSetting('whisper.vadMaxSpeech'),
          numThreads: getSetting('whisper.numThreads'),
          language: getSetting('whisper.language'),
        };
        await sherpaService.loadModel(modelSize, config);
      }

      // Convert array to buffer if needed
      let audioBuffer;
      if (Array.isArray(audioData)) {
        audioBuffer = Buffer.from(audioData);
      } else if (audioData instanceof ArrayBuffer) {
        audioBuffer = Buffer.from(audioData);
      } else {
        audioBuffer = audioData;
      }

      const result = await sherpaService.transcribe(audioBuffer, {
        language: getSetting('whisper.language'),
      });

      return {
        success: true,
        text: result.text,
        confidence: result.confidence,
        language: result.language,
      };
    } catch (error) {
      console.error('Transcription failed:', error);
      event.sender.send('whisper:error', error.message);
      return { success: false, error: error.message };
    }
  });

  /**
   * Check if transcription is available
   */
  ipcMain.handle('whisper:isAvailable', async () => {
    const enabled = getSetting('whisper.enabled');
    const modelSize = getSetting('whisper.modelSize');
    const status = await sherpaModelManager.getModelStatus(modelSize);
    const vadStatus = await sherpaModelManager.getVADStatus();

    return {
      enabled,
      modelDownloaded: status.installed && vadStatus.installed,
      modelLoaded: sherpaService.isLoaded(),
      modelSize,
      sherpaAvailable: sherpaService.isSherpaAvailable(),
    };
  });

  /**
   * Get service status
   */
  ipcMain.handle('whisper:getServiceStatus', () => {
    return sherpaService.getServiceStatus();
  });

  /**
   * List all downloaded models
   */
  ipcMain.handle('whisper:listModels', async () => {
    const results = [];

    for (const modelId of Object.keys(sherpaModelManager.SHERPA_ONNX_MODELS.whisper)) {
      const status = await sherpaModelManager.getModelStatus(modelId);
      if (status.installed) {
        const modelConfig = sherpaModelManager.SHERPA_ONNX_MODELS.whisper[modelId];
        results.push({
          size: modelId,
          ...modelConfig,
          ...status,
        });
      }
    }

    return results;
  });
}

module.exports = { register };
