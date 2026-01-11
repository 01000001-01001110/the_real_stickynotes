/**
 * Settings IPC handlers
 */
const { ipcMain, nativeTheme } = require('electron');
const {
  getSetting,
  setSetting,
  getAllSettings,
  resetSetting,
  resetAllSettings,
} = require('../../shared/database/settings');
const { requiresRestart } = require('../../shared/constants/settings');
const { updateShortcuts } = require('../shortcuts');
const { getAppDataPath, getDatabasePath, getAttachmentsPath } = require('../../shared/utils/paths');

let windowManager = null;

function register(wm) {
  windowManager = wm;
  
  // Get a setting
  ipcMain.handle('settings:get', (event, key) => {
    return getSetting(key);
  });
  
  // Get default paths (for display in settings)
  ipcMain.handle('settings:getDefaultPaths', () => {
    return {
      appData: getAppDataPath(),
      database: getDatabasePath(),
      attachments: getAttachmentsPath(),
    };
  });
  
  // Set a setting
  ipcMain.handle('settings:set', (event, key, value) => {
    setSetting(key, value);
    
    // Handle special settings
    handleSettingChange(key, value);
    
    // Broadcast change
    if (windowManager) {
      windowManager.broadcast('setting:changed', key, value);
    }
    
    return true;
  });
  
  // Get all settings
  ipcMain.handle('settings:getAll', () => {
    return getAllSettings();
  });
  
  // Check if a setting requires restart
  ipcMain.handle('settings:requiresRestart', (event, key) => {
    return requiresRestart(key);
  });
  
  // Reset a setting
  ipcMain.handle('settings:reset', (event, key) => {
    if (key) {
      return resetSetting(key);
    } else {
      return resetAllSettings();
    }
  });
}

/**
 * Handle special setting changes that require immediate action
 */
function handleSettingChange(key, value) {
  switch (key) {
    case 'shortcuts.globalNewNote':
    case 'shortcuts.globalToggle':
    case 'shortcuts.globalPanel':
      // Re-register shortcuts
      updateShortcuts();
      break;
      
    case 'appearance.theme':
      // Update native theme
      if (value === 'dark') {
        nativeTheme.themeSource = 'dark';
      } else if (value === 'light') {
        nativeTheme.themeSource = 'light';
      } else {
        nativeTheme.themeSource = 'system';
      }
      break;
      
    case 'general.startOnBoot':
      // Update auto-launch
      updateAutoLaunch(value);
      break;
  }
}

/**
 * Update auto-launch setting
 */
function updateAutoLaunch(enabled) {
  const { app } = require('electron');
  
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: app.getPath('exe'),
  });
}

module.exports = { register };
