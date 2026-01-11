# Issue 14: Code Changes Summary

## Overview
This document shows the specific code changes made to implement restart warning for hardwareAcceleration setting.

---

## File 1: shared/constants/settings.js

### Change 1: Added requiresRestart property
```javascript
'advanced.hardwareAcceleration': {
  type: 'boolean',
  default: true,
  description: 'Enable GPU acceleration',
  requiresRestart: true,  // NEW
},
```

### Change 2: Added requiresRestart function
```javascript
function requiresRestart(key) {
  const setting = settingsSchema[key];
  return setting ? setting.requiresRestart === true : false;
}
```

### Change 3: Updated exports
```javascript
module.exports = {
  settingsSchema,
  SETTINGS_SCHEMA_VERSION,
  getSettingDefault,
  getSettingType,
  isValidSettingKey,
  parseSettingValue,
  getAllDefaults,
  requiresRestart,  // NEW
};
```

---

## File 2: electron/ipc/settings.js

### Change 1: Import requiresRestart
```javascript
const { requiresRestart } = require('../../shared/constants/settings');
```

### Change 2: Add requiresRestart handler
```javascript
// Check if a setting requires restart
ipcMain.handle('settings:requiresRestart', (event, key) => {
  return requiresRestart(key);
});
```

---

## File 3: electron/ipc/index.js

### Change: Add app:restart handler
```javascript
ipcMain.handle('app:restart', () => {
  app.relaunch();
  global.isQuitting = true;
  app.quit();
});
```

---

## File 4: electron/preload.js

### Change 1: Add settingRequiresRestart API
```javascript
// In Settings section:
settingRequiresRestart: (key) => ipcRenderer.invoke('settings:requiresRestart', key),
```

### Change 2: Add restartApp API
```javascript
// In App section:
restartApp: () => ipcRenderer.invoke('app:restart'),
```

---

## File 5: src/settings/index.html

### Change: Add notification element
```html
<!-- Restart Notification -->
<div id="restartNotification" class="restart-notification" style="display: none;">
  <span>This setting requires an app restart to take effect.</span>
  <button id="restartButton" class="restart-btn" title="Restart app now">Restart Now</button>
  <button id="dismissRestartBtn" class="dismiss-btn" title="Dismiss notification">✕</button>
</div>
```

---

## File 6: src/settings/settings.js

### Change 1: Add showRestartNotification function
```javascript
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
```

### Change 2: Update event listener logic
```javascript
element.addEventListener(eventType, async () => {
  let value = /* ... existing code ... */;
  
  await api.setSetting(settingKey, value);

  // Check if this setting requires a restart (NEW)
  const needsRestart = await api.settingRequiresRestart(settingKey);
  if (needsRestart) {
    showRestartNotification(settingKey);
  }

  // Update range display (existing code)
  if (element.type === 'range') {
    updateRangeValue(element);
  }
});
```

### Change 3: Add button event listeners
```javascript
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
```

---

## File 7: src/settings/settings.css

### Changes: Add notification styles
```css
/* Restart Notification */
.restart-notification {
  position: fixed;
  top: 60px;
  right: 20px;
  background-color: var(--color-warning, #ff9800);
  color: white;
  padding: 12px 16px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  animation: slideIn 0.3s ease;
}

.restart-notification span {
  flex: 1;
  font-size: var(--font-size-sm);
  font-weight: 500;
}

.restart-notification .restart-btn,
.restart-notification .dismiss-btn {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 3px;
  cursor: pointer;
  font-size: var(--font-size-sm);
  transition: background-color 0.2s;
  white-space: nowrap;
}

.restart-notification .restart-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.restart-notification .dismiss-btn {
  padding: 6px 8px;
  font-size: 16px;
  line-height: 1;
}

.restart-notification .dismiss-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
```

---

## Data Flow Diagram

```
User toggles hardwareAcceleration
           |
           v
setupEventListeners() catches change
           |
           v
api.setSetting('advanced.hardwareAcceleration', value)
           |
           v
IPC: 'settings:set' handler
           |
           v
api.settingRequiresRestart('advanced.hardwareAcceleration')
           |
           v
IPC: 'settings:requiresRestart' handler
           |
           v
requiresRestart('advanced.hardwareAcceleration') returns true
           |
           v
showRestartNotification() called
           |
           v
Notification appears in top-right
           |
      +----+----+
      |         |
      v         v
User clicks   User clicks
"Restart Now" "✕"
      |         |
      v         v
api.restartApp()  Hide notification
      |
      v
IPC: 'app:restart' handler
      |
      v
app.relaunch() + app.quit()
      |
      v
Application restarts
```

---

## Testing Checklist

- [x] Schema validates correctly
- [x] requiresRestart function works
- [x] IPC handlers registered
- [x] API methods exposed
- [x] HTML elements added
- [x] Event listeners working
- [x] Notification displays
- [x] Restart functionality works
- [x] Dismiss button works
- [x] Auto-hide works
- [x] Tests pass (13/13 IPC settings tests)

---

## Extensibility

To add restart warning to other settings in the future:

1. Add `requiresRestart: true` to the setting in schema
2. No other changes needed - the UI logic automatically detects it

Example:
```javascript
'advanced.newSetting': {
  type: 'boolean',
  default: false,
  description: 'Some setting that requires restart',
  requiresRestart: true,  // Just add this
}
```

