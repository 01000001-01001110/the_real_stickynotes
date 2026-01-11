/**
 * Storage Location IPC handlers
 *
 * Handles cloud storage path selection, migration, and management.
 */
const { ipcMain, dialog, app } = require('electron');
const fs = require('fs');
const path = require('path');
const {
  getAppDataPath,
  getDefaultDataPath,
  validateDataPath,
  checkExistingData,
  getStorageStats,
  isUsingCustomPath,
} = require('../../shared/utils/paths');
const { getStorageConfig, setStorageConfig, clearStorageConfig } = require('../storage-config');
const { closeDatabase } = require('../../shared/database');

let windowManager = null;

function register(wm) {
  windowManager = wm;

  /**
   * Get current storage path information
   */
  ipcMain.handle('storage:getCurrentPath', () => {
    const config = getStorageConfig();
    const currentPath = getAppDataPath();
    const defaultPath = getDefaultDataPath();
    const stats = getStorageStats(currentPath);

    return {
      currentPath,
      defaultPath,
      isCustom: isUsingCustomPath(),
      customPath: config.dataPath,
      stats: {
        dbSize: stats.dbSize,
        attachmentCount: stats.attachmentCount,
        attachmentSize: stats.attachmentSize,
        modelCount: stats.modelCount,
        modelSize: stats.modelSize,
        totalSize: stats.totalSize,
      },
    };
  });

  /**
   * Open folder picker dialog
   */
  ipcMain.handle('storage:selectFolder', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Storage Location',
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: 'Select Folder',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const selectedPath = result.filePaths[0];

    // Validate the selected path
    const validation = validateDataPath(selectedPath);
    if (!validation.valid) {
      return {
        canceled: false,
        valid: false,
        error: validation.error,
        path: selectedPath,
      };
    }

    // Check for existing data
    const existing = checkExistingData(selectedPath);

    return {
      canceled: false,
      valid: true,
      path: selectedPath,
      hasExistingData: existing.hasData,
      existingFiles: existing.files,
    };
  });

  /**
   * Get migration info - sizes and file counts
   */
  ipcMain.handle('storage:getMigrationInfo', (event, targetPath) => {
    const currentPath = getAppDataPath();
    const currentStats = getStorageStats(currentPath);

    let targetStats = null;
    const existingData = checkExistingData(targetPath);

    if (existingData.hasData) {
      targetStats = getStorageStats(targetPath);
    }

    return {
      source: {
        path: currentPath,
        stats: currentStats,
      },
      target: {
        path: targetPath,
        hasExistingData: existingData.hasData,
        existingFiles: existingData.files,
        stats: targetStats,
      },
    };
  });

  /**
   * Migrate data to new location
   */
  ipcMain.handle('storage:migrateData', async (event, targetPath, options = {}) => {
    const { overwriteExisting = false } = options;
    const sourcePath = getAppDataPath();

    // Send progress updates
    const sendProgress = (step, message, percent) => {
      if (windowManager) {
        windowManager.broadcast('storage:migrationProgress', { step, message, percent });
      }
    };

    try {
      sendProgress('preparing', 'Preparing migration...', 0);

      // Validate target
      const validation = validateDataPath(targetPath);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Check existing data at target
      const existing = checkExistingData(targetPath);
      if (existing.hasData && !overwriteExisting) {
        return {
          success: false,
          error:
            'Target folder contains existing StickyNotes data. Use overwrite option or choose a different folder.',
          existingFiles: existing.files,
        };
      }

      sendProgress('closing', 'Closing database connection...', 10);

      // Close the database before copying
      closeDatabase();

      sendProgress('copying', 'Copying database...', 20);

      // Copy database files
      const dbFiles = ['stickynotes.db', 'stickynotes.db-wal', 'stickynotes.db-shm'];
      for (const dbFile of dbFiles) {
        const sourceFile = path.join(sourcePath, dbFile);
        const targetFile = path.join(targetPath, dbFile);
        if (fs.existsSync(sourceFile)) {
          fs.copyFileSync(sourceFile, targetFile);
        }
      }

      sendProgress('copying', 'Copying attachments...', 40);

      // Copy attachments directory
      const sourceAttachments = path.join(sourcePath, 'attachments');
      const targetAttachments = path.join(targetPath, 'attachments');
      if (fs.existsSync(sourceAttachments)) {
        copyDirRecursive(sourceAttachments, targetAttachments);
      } else {
        // Ensure attachments directory exists
        fs.mkdirSync(targetAttachments, { recursive: true });
      }

      sendProgress('copying', 'Copying AI models...', 70);

      // Copy models directory
      const sourceModels = path.join(sourcePath, 'models');
      const targetModels = path.join(targetPath, 'models');
      if (fs.existsSync(sourceModels)) {
        copyDirRecursive(sourceModels, targetModels);
      } else {
        // Ensure models directory exists
        fs.mkdirSync(targetModels, { recursive: true });
      }

      sendProgress('saving', 'Saving configuration...', 90);

      // Update storage config
      setStorageConfig(targetPath);

      sendProgress('complete', 'Migration complete! Restart required.', 100);

      return {
        success: true,
        newPath: targetPath,
        requiresRestart: true,
      };
    } catch (error) {
      console.error('[Storage] Migration failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Reset storage to default location
   */
  ipcMain.handle('storage:resetToDefault', async () => {
    try {
      const customPath = getStorageConfig().dataPath;

      if (!customPath) {
        return { success: true, message: 'Already using default location' };
      }

      // Ask user if they want to migrate data back
      const result = await dialog.showMessageBox({
        type: 'question',
        title: 'Reset Storage Location',
        message: 'Reset to default storage location?',
        detail:
          'Your current custom location will no longer be used.\n\nDo you want to copy your data back to the default location, or just switch and keep data in both places?',
        buttons: ['Copy Data Back', 'Just Switch (Keep Both)', 'Cancel'],
        defaultId: 0,
        cancelId: 2,
      });

      if (result.response === 2) {
        return { success: false, canceled: true };
      }

      const copyDataBack = result.response === 0;

      if (copyDataBack) {
        const defaultPath = getDefaultDataPath();

        // Close database
        closeDatabase();

        // Copy data back
        const dbFiles = ['stickynotes.db', 'stickynotes.db-wal', 'stickynotes.db-shm'];
        for (const dbFile of dbFiles) {
          const sourceFile = path.join(customPath, dbFile);
          const targetFile = path.join(defaultPath, dbFile);
          if (fs.existsSync(sourceFile)) {
            fs.copyFileSync(sourceFile, targetFile);
          }
        }

        // Copy attachments
        const sourceAttachments = path.join(customPath, 'attachments');
        const targetAttachments = path.join(defaultPath, 'attachments');
        if (fs.existsSync(sourceAttachments)) {
          copyDirRecursive(sourceAttachments, targetAttachments);
        }

        // Copy models
        const sourceModels = path.join(customPath, 'models');
        const targetModels = path.join(defaultPath, 'models');
        if (fs.existsSync(sourceModels)) {
          copyDirRecursive(sourceModels, targetModels);
        }
      }

      // Clear the custom path setting
      clearStorageConfig();

      return {
        success: true,
        requiresRestart: true,
        dataCopied: copyDataBack,
      };
    } catch (error) {
      console.error('[Storage] Reset failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Restart the app (used after migration)
   */
  ipcMain.handle('storage:restartApp', () => {
    app.relaunch();
    app.exit(0);
  });
}

/**
 * Recursively copy a directory
 */
function copyDirRecursive(source, target) {
  // Create target directory
  fs.mkdirSync(target, { recursive: true });

  // Read source directory
  const entries = fs.readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

module.exports = { register };
