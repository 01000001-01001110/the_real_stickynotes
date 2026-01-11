/**
 * First Launch Setup
 * Handles first-time setup tasks like transcription model installation
 */
const { dialog, BrowserWindow } = require('electron');
const { getSetting, setSetting } = require('../shared/database/settings');
const sherpaModelManager = require('./whisper/sherpa-model-manager');

// Default model to install (balanced speed/accuracy)
const DEFAULT_MODEL = 'base.en';
const DEFAULT_MODEL_SIZE = '160MB';

/**
 * Check if transcription setup has been offered to user
 * @returns {boolean}
 */
function hasOfferedTranscription() {
  return getSetting('setup.transcriptionOffered') === true;
}

/**
 * Mark transcription as offered (so we don't ask again)
 */
function markTranscriptionOffered() {
  setSetting('setup.transcriptionOffered', true);
}

/**
 * Show first-launch transcription setup dialog
 * @param {BrowserWindow} parentWindow - Parent window for dialog
 * @returns {Promise<boolean>} - true if user wants transcription
 */
async function showTranscriptionSetupDialog(parentWindow) {
  const result = await dialog.showMessageBox(parentWindow, {
    type: 'question',
    title: 'Enable Voice Transcription?',
    message: 'Would you like to enable voice-to-text transcription?',
    detail: `StickyNotes can transcribe your voice recordings to text using AI.\n\nThis will download a ${DEFAULT_MODEL_SIZE} model that runs locally on your CPU - no internet needed after download.\n\nYou can change this later in Settings > Transcription.`,
    buttons: ['Enable Transcription', 'Skip for Now'],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });

  return result.response === 0;
}

/**
 * Show download progress dialog
 * @param {BrowserWindow} parentWindow - Parent window
 * @returns {Promise<BrowserWindow>} - Progress window
 */
function createProgressWindow(parentWindow) {
  const progressWindow = new BrowserWindow({
    width: 400,
    height: 150,
    parent: parentWindow,
    modal: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    frame: false,
    transparent: false,
    backgroundColor: '#1e1e1e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #1e1e1e;
          color: #fff;
          padding: 24px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          height: 100vh;
        }
        h3 { margin-bottom: 8px; font-size: 14px; font-weight: 500; }
        .status { color: #888; font-size: 12px; margin-bottom: 16px; }
        .progress-bar {
          width: 100%;
          height: 6px;
          background: #333;
          border-radius: 3px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: #4a9eff;
          width: 0%;
          transition: width 0.2s ease;
        }
        .percent { text-align: right; font-size: 12px; color: #888; margin-top: 8px; }
      </style>
    </head>
    <body>
      <h3>Setting up voice transcription...</h3>
      <div class="status" id="status">Initializing...</div>
      <div class="progress-bar">
        <div class="progress-fill" id="progress"></div>
      </div>
      <div class="percent" id="percent">0%</div>
      <script>
        window.updateProgress = (percent, status) => {
          document.getElementById('progress').style.width = percent + '%';
          document.getElementById('percent').textContent = Math.round(percent) + '%';
          if (status) document.getElementById('status').textContent = status;
        };
      </script>
    </body>
    </html>
  `;

  progressWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  return progressWindow;
}

/**
 * Install transcription model with progress
 * @param {BrowserWindow} parentWindow - Parent window
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function installTranscriptionModel(parentWindow) {
  const progressWindow = createProgressWindow(parentWindow);

  try {
    // Wait for window to load
    await new Promise((resolve) => progressWindow.webContents.once('did-finish-load', resolve));
    progressWindow.show();

    // Check disk space first
    const modelConfig = sherpaModelManager.SHERPA_ONNX_MODELS.whisper[DEFAULT_MODEL];
    const requiredSpace = modelConfig.sizeBytes * 2.5; // Archive + extracted + buffer

    const spaceCheck = await sherpaModelManager.checkDiskSpace(requiredSpace);
    if (!spaceCheck.sufficient) {
      throw new Error(
        `Insufficient disk space. Need ${Math.round(requiredSpace / 1024 / 1024)}MB.`
      );
    }

    // Download VAD model first
    const vadStatus = await sherpaModelManager.getVADStatus();
    if (!vadStatus.installed) {
      progressWindow.webContents.executeJavaScript(
        `updateProgress(0, 'Downloading voice detection model...')`
      );

      await sherpaModelManager.downloadVAD((progress) => {
        const overallProgress = progress * 0.1; // 0-10%
        progressWindow.webContents.executeJavaScript(
          `updateProgress(${overallProgress}, 'Downloading voice detection model...')`
        );
      });
    }

    // Download Whisper model
    progressWindow.webContents.executeJavaScript(
      `updateProgress(10, 'Downloading transcription model (${DEFAULT_MODEL_SIZE})...')`
    );

    await sherpaModelManager.downloadModel(DEFAULT_MODEL, (progress, stage) => {
      let overallProgress;
      let message;

      if (stage === 'download') {
        overallProgress = 10 + progress * 0.7; // 10-80%
        message = `Downloading transcription model... ${progress}%`;
      } else if (stage === 'extract') {
        overallProgress = 80 + progress * 0.15; // 80-95%
        message = 'Extracting model files...';
      } else if (stage === 'verify') {
        overallProgress = 95 + progress * 0.05; // 95-100%
        message = 'Verifying installation...';
      }

      progressWindow.webContents.executeJavaScript(
        `updateProgress(${overallProgress}, '${message}')`
      );
    });

    // Set as default model
    setSetting('whisper.modelSize', DEFAULT_MODEL);
    setSetting('whisper.enabled', true);

    progressWindow.webContents.executeJavaScript(`updateProgress(100, 'Complete!')`);

    // Brief pause to show completion
    await new Promise((resolve) => setTimeout(resolve, 500));

    return { success: true };
  } catch (error) {
    console.error('Failed to install transcription model:', error);
    return { success: false, error: error.message };
  } finally {
    if (!progressWindow.isDestroyed()) {
      progressWindow.close();
    }
  }
}

/**
 * Run first-launch setup
 * @param {BrowserWindow} parentWindow - Main window to show dialogs on
 */
async function runFirstLaunchSetup(parentWindow) {
  // Check if we've already offered transcription
  if (hasOfferedTranscription()) {
    return;
  }

  // Mark as offered (even if they skip, we won't ask again)
  markTranscriptionOffered();

  // Ask user if they want transcription
  const wantsTranscription = await showTranscriptionSetupDialog(parentWindow);

  if (wantsTranscription) {
    const result = await installTranscriptionModel(parentWindow);

    if (!result.success) {
      await dialog.showMessageBox(parentWindow, {
        type: 'warning',
        title: 'Setup Incomplete',
        message: 'Transcription setup was not completed',
        detail: `Error: ${result.error}\n\nYou can try again later in Settings > Transcription.`,
        buttons: ['OK'],
      });
    } else {
      await dialog.showMessageBox(parentWindow, {
        type: 'info',
        title: 'Setup Complete',
        message: 'Voice transcription is ready!',
        detail: 'Click the microphone icon in any note to start recording.',
        buttons: ['Got it'],
      });
    }
  }
}

module.exports = {
  runFirstLaunchSetup,
  hasOfferedTranscription,
  markTranscriptionOffered,
  DEFAULT_MODEL,
};
