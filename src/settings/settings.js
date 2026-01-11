/**
 * Settings Window Script
 */

// Setting element IDs mapped to setting keys
const settingMappings = {
  // General
  startOnBoot: 'general.startOnBoot',
  startMinimized: 'general.startMinimized',
  minimizeToTray: 'general.minimizeToTray',
  closeToTray: 'general.closeToTray',
  confirmDelete: 'general.confirmDelete',
  confirmPermanentDelete: 'general.confirmPermanentDelete',
  autoSaveDelay: 'general.autoSaveDelay',
  trashRetentionDays: 'general.trashRetentionDays',

  // Appearance
  theme: 'appearance.theme',
  defaultNoteColor: 'appearance.defaultNoteColor',
  defaultNoteWidth: 'appearance.defaultNoteWidth',
  defaultNoteHeight: 'appearance.defaultNoteHeight',
  defaultFontFamily: 'appearance.defaultFontFamily',
  noteOpacity: 'appearance.noteOpacity',
  enableShadows: 'appearance.enableShadows',
  enableAnimations: 'appearance.enableAnimations',
  showNoteCount: 'appearance.showNoteCount',

  // New Note
  newNotePosition: 'newNote.position',
  cascadeOffset: 'newNote.cascadeOffset',

  // Tray
  traySingleClickAction: 'tray.singleClickAction',
  trayDoubleClickAction: 'tray.doubleClickAction',

  // Shortcuts
  globalNewNote: 'shortcuts.globalNewNote',
  globalToggle: 'shortcuts.globalToggle',
  globalPanel: 'shortcuts.globalPanel',

  // Editor
  spellcheck: 'editor.spellcheck',
  autoLinks: 'editor.autoLinks',
  autoLists: 'editor.autoLists',
  defaultFontSize: 'appearance.defaultFontSize',
  tabSize: 'editor.tabSize',
  showWordCount: 'editor.showWordCount',

  // Reminders
  remindersEnabled: 'reminders.enabled',
  remindersSound: 'reminders.sound',
  snoozeMinutes: 'reminders.snoozeMinutes',
  persistUntilDismissed: 'reminders.persistUntilDismissed',

  // History
  maxVersions: 'history.maxVersions',
  saveInterval: 'history.saveInterval',

  // Advanced
  hardwareAcceleration: 'advanced.hardwareAcceleration',
  devTools: 'advanced.devTools',

  // Whisper/Transcription (v2 Sherpa-ONNX)
  whisperEnabled: 'whisper.enabled',
  whisperModelSize: 'whisper.modelSize',
  whisperLanguage: 'whisper.language',
  whisperDefaultSource: 'whisper.defaultSource',
  whisperInsertMode: 'whisper.insertMode',
  // VAD settings (v2)
  whisperVadThreshold: 'whisper.vadThreshold',
  whisperVadMinSilence: 'whisper.vadMinSilence',
  whisperVadMaxSpeech: 'whisper.vadMaxSpeech',
  whisperNumThreads: 'whisper.numThreads',
};

/**
 * Apply theme to document
 */
async function applyTheme(theme = null) {
  if (!theme) {
    theme = await api.getSetting('appearance.theme');
  }

  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', theme || 'light');
  }
}

/**
 * Initialize settings page
 */
async function init() {
  // Apply theme first
  await applyTheme();

  // Setup window controls
  document.getElementById('minimizeBtn')?.addEventListener('click', () => {
    api.minimizeWindow();
  });

  document.getElementById('closeBtn')?.addEventListener('click', () => {
    api.closeWindow();
  });

  await loadSettings();
  setupNavigation();
  setupEventListeners();
  setupWhisperSettings();
  setupStorageSettings();

  // Listen for theme changes (including from this window)
  api.onSettingChanged((key, value) => {
    if (key === 'appearance.theme') {
      applyTheme(value);
    }
  });

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
    const theme = await api.getSetting('appearance.theme');
    if (theme === 'system') {
      applyTheme('system');
    }
  });

  // Set version
  const version = await api.getAppVersion();
  document.getElementById('aboutVersion').textContent = `Version ${version}`;

  // Setup restart notification buttons
  const restartBtn = document.getElementById('restartButton');
  const dismissBtn = document.getElementById('dismissRestartBtn');

  if (restartBtn) {
    restartBtn.addEventListener('click', () => {
      api.restartApp();
    });
  }

  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      const notification = document.getElementById('restartNotification');
      if (notification) {
        notification.style.display = 'none';
      }
    });
  }
}

/**
 * Update font selector to show selected font in its own typeface
 */
function updateFontSelectorPreview() {
  const fontSelect = document.getElementById('defaultFontFamily');
  if (fontSelect && fontSelect.value) {
    fontSelect.style.fontFamily = fontSelect.value;
  }
}

/**
 * Load all settings
 */
async function loadSettings() {
  const settings = await api.getAllSettings();

  for (const [elementId, settingKey] of Object.entries(settingMappings)) {
    const element = document.getElementById(elementId);
    if (!element) continue;

    let value = settings[settingKey];

    // Special handling for saveInterval (stored in ms, display in minutes)
    if (settingKey === 'history.saveInterval') {
      value = Math.round(value / 60000); // ms to minutes
    }

    if (element.type === 'checkbox') {
      element.checked = value;
    } else if (element.type === 'range') {
      element.value = value;
      updateRangeValue(element);
    } else {
      element.value = value ?? '';
    }
  }

  // Update font selector to show in selected font
  updateFontSelectorPreview();
}

/**
 * Setup navigation between sections
 */
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.settings-section');

  navItems.forEach((item) => {
    item.addEventListener('click', () => {
      const sectionId = item.dataset.section;

      // Update active states
      navItems.forEach((n) => n.classList.remove('active'));
      item.classList.add('active');

      sections.forEach((s) => s.classList.remove('active'));
      document.getElementById(`section-${sectionId}`).classList.add('active');
    });
  });
}

/**
 * Show restart notification for settings that require restart
 */
function showRestartNotification(settingKey) {
  const restartNotification = document.getElementById('restartNotification');
  if (!restartNotification) return;

  // Display notification
  restartNotification.style.display = 'block';

  // Auto-hide after 10 seconds
  setTimeout(() => {
    if (restartNotification.style.display === 'block') {
      restartNotification.style.display = 'none';
    }
  }, 10000);
}

/**
 * Setup event listeners for settings changes
 */
function setupEventListeners() {
  // Auto-save on change
  for (const [elementId, settingKey] of Object.entries(settingMappings)) {
    const element = document.getElementById(elementId);
    if (!element) continue;

    const eventType = element.type === 'checkbox' ? 'change' : 'input';

    element.addEventListener(eventType, async () => {
      let value =
        element.type === 'checkbox'
          ? element.checked
          : element.type === 'number' || element.type === 'range'
            ? Number(element.value)
            : element.value;

      // Special handling for saveInterval (display in minutes, store in ms)
      if (settingKey === 'history.saveInterval') {
        value = value * 60000; // minutes to ms
      }

      await api.setSetting(settingKey, value);

      // Check if this setting requires a restart
      const needsRestart = await api.settingRequiresRestart(settingKey);
      if (needsRestart) {
        showRestartNotification(settingKey);
      }

      // Update range display
      if (element.type === 'range') {
        updateRangeValue(element);
      }

      // Update font selector preview when font changes
      if (elementId === 'defaultFontFamily') {
        updateFontSelectorPreview();
      }
    });
  }

  // Shortcut inputs
  document.querySelectorAll('.setting-input.shortcut').forEach((input) => {
    input.addEventListener('focus', () => {
      input.placeholder = 'Press keys...';
    });

    input.addEventListener('blur', () => {
      input.placeholder = 'Click to record';
    });

    input.addEventListener('keydown', async (e) => {
      e.preventDefault();

      const keys = [];
      if (e.ctrlKey) keys.push('Ctrl');
      if (e.altKey) keys.push('Alt');
      if (e.shiftKey) keys.push('Shift');
      if (e.metaKey) keys.push('Meta');

      const key = e.key.toUpperCase();
      if (!['CONTROL', 'ALT', 'SHIFT', 'META'].includes(key)) {
        keys.push(key);
      }

      if (keys.length > 1) {
        const shortcut = keys.join('+');
        input.value = shortcut;

        const settingKey = settingMappings[input.id];
        await api.setSetting(settingKey, shortcut);
        input.blur();
      }
    });
  });

  // Reset settings button
  document.getElementById('resetSettingsBtn').addEventListener('click', async () => {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      await api.resetSetting(null);
      await loadSettings();
    }
  });

  // Check for updates button
  document.getElementById('checkUpdatesBtn').addEventListener('click', () => {
    api.checkForUpdates();
  });
}

/**
 * Update range value display
 */
function updateRangeValue(rangeElement) {
  const valueDisplay =
    document.getElementById(`${rangeElement.id.replace(/([A-Z])/g, '_$1').toLowerCase()}Value`) ||
    rangeElement.nextElementSibling;
  if (valueDisplay && valueDisplay.classList.contains('range-value')) {
    valueDisplay.textContent = `${rangeElement.value}%`;
  }
}

/**
 * Setup Whisper/Transcription settings (v2 Sherpa-ONNX)
 */
async function setupWhisperSettings() {
  // Get DOM elements - Status Card
  const modelStatusIcon = document.getElementById('modelStatusIcon');
  const modelStatusLabel = document.getElementById('modelStatusLabel');
  const modelStatusSize = document.getElementById('modelStatusSize');
  const componentStatus = document.getElementById('componentStatus');
  const vadStatusEl = document.getElementById('vadStatus');
  const whisperStatusEl = document.getElementById('whisperStatus');

  // Progress elements
  const installProgress = document.getElementById('installProgress');
  const installStage = document.getElementById('installStage');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const cancelInstallBtn = document.getElementById('cancelInstallBtn');

  // Action buttons
  const installModelBtn = document.getElementById('installModelBtn');
  const changeModelBtn = document.getElementById('changeModelBtn');
  const deleteModelBtn = document.getElementById('deleteModelBtn');
  const whisperModelSize = document.getElementById('whisperModelSize');

  // Wizard elements
  const installerModal = document.getElementById('installerModal');
  const modelCards = document.getElementById('modelCards');
  const diskSpaceInfo = document.getElementById('diskSpaceInfo');
  const diskSpaceText = document.getElementById('diskSpaceText');
  const wizardStep1 = document.getElementById('wizardStep1');
  const wizardStep2 = document.getElementById('wizardStep2');
  const wizardStep3 = document.getElementById('wizardStep3');
  const wizardStepError = document.getElementById('wizardStepError');
  const wizardStageText = document.getElementById('wizardStageText');
  const wizardProgressFill = document.getElementById('wizardProgressFill');
  const wizardProgressText = document.getElementById('wizardProgressText');
  const wizardCancelBtn = document.getElementById('wizardCancelBtn');
  const wizardNextBtn = document.getElementById('wizardNextBtn');
  const closeInstallerBtn = document.getElementById('closeInstallerBtn');
  const errorDescription = document.getElementById('errorDescription');

  // Wizard step elements
  const stepVad = document.getElementById('stepVad');
  const stepDownload = document.getElementById('stepDownload');
  const stepExtract = document.getElementById('stepExtract');
  const stepVerify = document.getElementById('stepVerify');

  // Skip if elements not found
  if (!installModelBtn) return;

  // State
  let selectedModel = 'base.en';
  let isInstalling = false;
  let availableModels = [];

  /**
   * Update component status display
   */
  function updateComponentStatus(vadInstalled, whisperInstalled, modelName) {
    const vadIcon = vadStatusEl.querySelector('.component-icon');
    const vadState = vadStatusEl.querySelector('.component-state');
    const whisperIcon = whisperStatusEl.querySelector('.component-icon');
    const whisperState = whisperStatusEl.querySelector('.component-state');
    const whisperName = whisperStatusEl.querySelector('.component-name');

    if (vadInstalled) {
      vadIcon.textContent = '✓';
      vadIcon.classList.add('installed');
      vadState.textContent = 'Installed';
      vadState.classList.add('installed');
    } else {
      vadIcon.textContent = '○';
      vadIcon.classList.remove('installed');
      vadState.textContent = 'Not installed';
      vadState.classList.remove('installed');
    }

    if (whisperInstalled) {
      whisperIcon.textContent = '✓';
      whisperIcon.classList.add('installed');
      whisperState.textContent = 'Installed';
      whisperState.classList.add('installed');
      whisperName.textContent = `Whisper Model (${modelName})`;
    } else {
      whisperIcon.textContent = '○';
      whisperIcon.classList.remove('installed');
      whisperState.textContent = 'Not installed';
      whisperState.classList.remove('installed');
      whisperName.textContent = 'Whisper Model';
    }
  }

  /**
   * Update main status card
   */
  async function updateModelStatus() {
    try {
      const status = await api.whisperGetInstallStatus();
      const currentModel = await api.getSetting('whisper.modelSize');
      const modelStatus = status.whisperModels[currentModel];
      const vadInstalled = status.vadInstalled;
      const modelInstalled = modelStatus?.installed || false;

      // Update component status
      updateComponentStatus(vadInstalled, modelInstalled, currentModel);

      if (vadInstalled && modelInstalled) {
        modelStatusIcon.textContent = '✓';
        modelStatusIcon.className = 'model-status-icon ready';
        modelStatusLabel.textContent = 'Speech-to-Text Ready';
        modelStatusSize.textContent = `Model: ${currentModel}`;
        installModelBtn.textContent = 'Reinstall';
        changeModelBtn.hidden = false;
        deleteModelBtn.hidden = false;
      } else if (vadInstalled || modelInstalled) {
        modelStatusIcon.textContent = '⚠';
        modelStatusIcon.className = 'model-status-icon warning';
        modelStatusLabel.textContent = 'Partial Installation';
        modelStatusSize.textContent = 'Some components missing';
        installModelBtn.textContent = 'Complete Setup';
        changeModelBtn.hidden = true;
        deleteModelBtn.hidden = !modelInstalled;
      } else {
        modelStatusIcon.textContent = '⏳';
        modelStatusIcon.className = 'model-status-icon pending';
        modelStatusLabel.textContent = 'Not Installed';
        modelStatusSize.textContent = 'Setup required for transcription';
        installModelBtn.textContent = 'Install Models';
        changeModelBtn.hidden = true;
        deleteModelBtn.hidden = true;
      }
    } catch (error) {
      modelStatusIcon.textContent = '❌';
      modelStatusIcon.className = 'model-status-icon error';
      modelStatusLabel.textContent = 'Error checking status';
      modelStatusSize.textContent = error.message;
    }
  }

  /**
   * Load available models for wizard
   */
  async function loadAvailableModels() {
    try {
      availableModels = await api.whisperGetAvailableModels();
      renderModelCards();
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  }

  /**
   * Render model selection cards
   */
  function renderModelCards() {
    modelCards.innerHTML = availableModels
      .map(
        (model) => `
      <div class="model-card ${model.id === selectedModel ? 'selected' : ''}" data-model="${model.id}">
        <div class="model-card-radio"></div>
        <div class="model-card-info">
          <div class="model-card-name">${model.displayName}</div>
          <div class="model-card-desc">${model.description}</div>
        </div>
        <div class="model-card-size">${model.size}</div>
      </div>
    `
      )
      .join('');

    // Add click handlers
    modelCards.querySelectorAll('.model-card').forEach((card) => {
      card.addEventListener('click', () => {
        selectedModel = card.dataset.model;
        modelCards.querySelectorAll('.model-card').forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');
      });
    });
  }

  /**
   * Show installer wizard
   */
  function showInstallerWizard() {
    selectedModel = whisperModelSize.value || 'base.en';
    loadAvailableModels();
    showWizardStep(1);
    installerModal.hidden = false;
    wizardNextBtn.textContent = 'Install';
    wizardNextBtn.disabled = false;
    wizardCancelBtn.disabled = false;
  }

  /**
   * Hide installer wizard
   */
  function hideInstallerWizard() {
    installerModal.hidden = true;
    if (!isInstalling) {
      resetWizardSteps();
    }
  }

  /**
   * Show specific wizard step
   */
  function showWizardStep(step) {
    wizardStep1.hidden = step !== 1;
    wizardStep2.hidden = step !== 2;
    wizardStep3.hidden = step !== 3;
    wizardStepError.hidden = step !== 'error';

    if (step === 3) {
      wizardNextBtn.textContent = 'Done';
      wizardCancelBtn.hidden = true;
    } else if (step === 'error') {
      wizardNextBtn.textContent = 'Retry';
      wizardCancelBtn.hidden = false;
    }
  }

  /**
   * Reset wizard step indicators
   */
  function resetWizardSteps() {
    [stepVad, stepDownload, stepExtract, stepVerify].forEach((step) => {
      step.classList.remove('active', 'complete');
      step.querySelector('.step-icon').textContent = '○';
    });
  }

  /**
   * Update wizard step status
   */
  function updateWizardStep(stepEl, status) {
    stepEl.classList.remove('active', 'complete');
    const icon = stepEl.querySelector('.step-icon');
    if (status === 'active') {
      stepEl.classList.add('active');
      icon.textContent = '';
    } else if (status === 'complete') {
      stepEl.classList.add('complete');
      icon.textContent = '';
    } else {
      icon.textContent = '○';
    }
  }

  /**
   * Start installation
   */
  async function startInstallation() {
    isInstalling = true;
    showWizardStep(2);
    wizardNextBtn.disabled = true;
    wizardCancelBtn.disabled = true;
    resetWizardSteps();

    // Setup progress listener
    const removeProgressListener = api.onWhisperInstallProgress((data) => {
      wizardProgressFill.style.width = `${data.progress}%`;
      wizardProgressText.textContent = `${Math.round(data.progress)}%`;
      wizardStageText.textContent = data.message;

      // Update step indicators
      if (data.stage === 'vad') {
        updateWizardStep(stepVad, 'active');
      } else if (data.stage === 'model' || data.stage === 'download') {
        updateWizardStep(stepVad, 'complete');
        updateWizardStep(stepDownload, 'active');
      } else if (data.stage === 'extract') {
        updateWizardStep(stepVad, 'complete');
        updateWizardStep(stepDownload, 'complete');
        updateWizardStep(stepExtract, 'active');
      } else if (data.stage === 'verify') {
        updateWizardStep(stepVad, 'complete');
        updateWizardStep(stepDownload, 'complete');
        updateWizardStep(stepExtract, 'complete');
        updateWizardStep(stepVerify, 'active');
      } else if (data.stage === 'complete') {
        updateWizardStep(stepVad, 'complete');
        updateWizardStep(stepDownload, 'complete');
        updateWizardStep(stepExtract, 'complete');
        updateWizardStep(stepVerify, 'complete');
      }
    });

    const removeErrorListener = api.onWhisperInstallError((error) => {
      console.error('Install error:', error);
    });

    try {
      // Update model size setting
      await api.setSetting('whisper.modelSize', selectedModel);

      // Start installation
      const result = await api.whisperInstallModel(selectedModel);

      if (result.success) {
        showWizardStep(3);
        await updateModelStatus();
      } else {
        errorDescription.textContent = result.message || 'Installation failed';
        showWizardStep('error');
      }
    } catch (error) {
      errorDescription.textContent = error.message || 'An unexpected error occurred';
      showWizardStep('error');
    } finally {
      isInstalling = false;
      removeProgressListener();
      removeErrorListener();
      wizardCancelBtn.disabled = false;
    }
  }

  // ==================== Event Handlers ====================

  // Install button
  installModelBtn.addEventListener('click', showInstallerWizard);

  // Change model button
  changeModelBtn.addEventListener('click', showInstallerWizard);

  // Delete button
  deleteModelBtn.addEventListener('click', async () => {
    if (
      confirm('Uninstall speech-to-text models? You will need to reinstall to use transcription.')
    ) {
      try {
        const modelSize = await api.getSetting('whisper.modelSize');
        await api.whisperUninstallModel(modelSize);
        await updateModelStatus();
      } catch (error) {
        modelStatusLabel.textContent = `Uninstall failed: ${error.message}`;
      }
    }
  });

  // Model size change handler (for dropdown)
  whisperModelSize.addEventListener('change', async (e) => {
    await api.setSetting('whisper.modelSize', e.target.value);
    await updateModelStatus();
  });

  // Wizard cancel button
  wizardCancelBtn.addEventListener('click', hideInstallerWizard);

  // Wizard close button
  closeInstallerBtn.addEventListener('click', hideInstallerWizard);

  // Click outside modal to close
  installerModal.addEventListener('click', (e) => {
    if (e.target === installerModal && !isInstalling) {
      hideInstallerWizard();
    }
  });

  // Wizard next button
  wizardNextBtn.addEventListener('click', async () => {
    if (!wizardStep1.hidden) {
      // Step 1 -> Step 2 (start install)
      await startInstallation();
    } else if (!wizardStep3.hidden) {
      // Step 3 -> Close (done)
      hideInstallerWizard();
    } else if (!wizardStepError.hidden) {
      // Error -> Retry
      await startInstallation();
    }
  });

  // Enable toggle should prompt installation if not installed
  const whisperEnabledToggle = document.getElementById('whisperEnabled');
  if (whisperEnabledToggle) {
    whisperEnabledToggle.addEventListener('change', async (e) => {
      if (e.target.checked) {
        // Check if models are installed
        const status = await api.whisperGetInstallStatus();
        const currentModel = await api.getSetting('whisper.modelSize');
        const modelStatus = status.whisperModels[currentModel];

        if (!status.vadInstalled || !modelStatus?.installed) {
          // Prompt to install
          e.target.checked = false;
          showInstallerWizard();
        }
      }
    });
  }

  // ==================== Initialize ====================

  await updateModelStatus();
  await loadAvailableModels();
}

/**
 * Setup Storage Location settings
 */
function setupStorageSettings() {
  // DOM elements
  const storagePath = document.getElementById('storagePath');
  const storagePathBadge = document.getElementById('storagePathBadge');
  const storageDbSize = document.getElementById('storageDbSize');
  const storageAttachments = document.getElementById('storageAttachments');
  const storageModels = document.getElementById('storageModels');
  const storageTotal = document.getElementById('storageTotal');
  const changeStorageBtn = document.getElementById('changeStorageBtn');
  const resetStorageBtn = document.getElementById('resetStorageBtn');
  const migrationProgress = document.getElementById('migrationProgress');
  const migrationStage = document.getElementById('migrationStage');
  const migrationProgressFill = document.getElementById('migrationProgressFill');
  const migrationProgressText = document.getElementById('migrationProgressText');

  // Format bytes to human readable
  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Load and display storage info
  async function loadStorageInfo() {
    try {
      const info = await api.storageGetCurrentPath();

      // Update path display
      if (storagePath) {
        storagePath.textContent = info.currentPath;
      }

      // Update badge
      if (storagePathBadge) {
        if (info.isCustom) {
          storagePathBadge.textContent = 'Custom';
          storagePathBadge.classList.add('custom');
        } else {
          storagePathBadge.textContent = 'Default';
          storagePathBadge.classList.remove('custom');
        }
      }

      // Update stats
      if (storageDbSize) {
        storageDbSize.textContent = formatBytes(info.stats.dbSize);
      }
      if (storageAttachments) {
        storageAttachments.textContent = `${info.stats.attachmentCount} files (${formatBytes(info.stats.attachmentSize)})`;
      }
      if (storageModels) {
        storageModels.textContent =
          info.stats.modelCount > 0
            ? `${info.stats.modelCount} files (${formatBytes(info.stats.modelSize)})`
            : 'None';
      }
      if (storageTotal) {
        storageTotal.textContent = formatBytes(info.stats.totalSize);
      }

      // Show/hide reset button
      if (resetStorageBtn) {
        resetStorageBtn.style.display = info.isCustom ? 'inline-block' : 'none';
      }
    } catch (err) {
      console.error('Failed to load storage info:', err);
      if (storagePath) {
        storagePath.textContent = 'Error loading path';
      }
    }
  }

  // Change storage location
  if (changeStorageBtn) {
    changeStorageBtn.addEventListener('click', async () => {
      // Select folder
      const result = await api.storageSelectFolder();

      if (result.canceled) {
        return;
      }

      if (!result.valid) {
        alert(`Cannot use this folder: ${result.error}`);
        return;
      }

      // Check for existing data
      let proceed = true;
      if (result.hasExistingData) {
        proceed = confirm(
          `This folder already contains StickyNotes data:\n${result.existingFiles.join(', ')}\n\nDo you want to use this existing data instead of migrating your current data?`
        );

        if (!proceed) {
          return;
        }
      } else {
        // Confirm migration
        proceed = confirm(
          `Move your data to:\n${result.path}\n\nThis will copy your database, attachments, and AI models to the new location. The app will restart after migration.\n\nContinue?`
        );
      }

      if (!proceed) {
        return;
      }

      // Show progress
      if (migrationProgress) {
        migrationProgress.style.display = 'block';
      }
      if (changeStorageBtn) {
        changeStorageBtn.disabled = true;
      }

      // Start migration
      const migrationResult = await api.storageMigrateData(result.path, {
        overwriteExisting: result.hasExistingData,
      });

      if (migrationResult.success) {
        if (migrationResult.requiresRestart) {
          const restart = confirm(
            'Migration complete! The app needs to restart to use the new location.\n\nRestart now?'
          );
          if (restart) {
            api.storageRestartApp();
          }
        }
      } else {
        alert(`Migration failed: ${migrationResult.error}`);
      }

      // Hide progress
      if (migrationProgress) {
        migrationProgress.style.display = 'none';
      }
      if (changeStorageBtn) {
        changeStorageBtn.disabled = false;
      }

      // Refresh display
      await loadStorageInfo();
    });
  }

  // Reset to default
  if (resetStorageBtn) {
    resetStorageBtn.addEventListener('click', async () => {
      const result = await api.storageResetToDefault();

      if (result.canceled) {
        return;
      }

      if (result.success) {
        if (result.requiresRestart) {
          const restart = confirm(
            'Storage location has been reset to default. The app needs to restart.\n\nRestart now?'
          );
          if (restart) {
            api.storageRestartApp();
          }
        }
        await loadStorageInfo();
      } else if (result.error) {
        alert(`Reset failed: ${result.error}`);
      }
    });
  }

  // Listen for migration progress
  api.onStorageMigrationProgress((data) => {
    if (migrationStage) {
      migrationStage.textContent = data.message;
    }
    if (migrationProgressFill) {
      migrationProgressFill.style.width = `${data.percent}%`;
    }
    if (migrationProgressText) {
      migrationProgressText.textContent = `${data.percent}%`;
    }
  });

  // Load initial storage info
  loadStorageInfo();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
