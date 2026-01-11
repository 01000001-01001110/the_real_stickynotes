# Issue 14: No Restart Warning for hardwareAcceleration Setting

## Status: COMPLETED

## Issue Summary
Setting `advanced.hardwareAcceleration` requires app restart but the UI didn't warn users about this requirement.

---

## PHASE 1: VALIDATION (COMPLETED)

### Findings

#### Setting Exists
- **Location**: `/shared/constants/settings.js`
- **Schema Definition**:
```javascript
'advanced.hardwareAcceleration': {
  type: 'boolean',
  default: true,
  description: 'Enable GPU acceleration',
  requiresRestart: true,
}
```

#### How It's Used
- **Location**: `/electron/main.js` (startup)
- **Implementation**: Called at app startup before windows are created
```javascript
const hwAccel = getSetting('advanced.hardwareAcceleration');
if (hwAccel === false) {
  app.disableHardwareAcceleration();
  console.log('Hardware acceleration disabled');
}
```

#### Current UI Behavior
- **HTML Location**: `/src/settings/index.html`
- **Current Description**: "Enable GPU rendering (requires restart)"
- **No Visual Warning**: Despite the description mentioning restart, there was no:
  - Visual indicator highlighting the restart requirement
  - Dialog/notification when the setting changes
  - Badge or label identifying it as requiring restart

#### Settings Form Handler
- **Location**: `/src/settings/settings.js`
- **Current Behavior**: All settings saved immediately with `api.setSetting()`
- **No Special Handling**: Hardware acceleration changes were not distinguished

#### IPC Handler
- **Location**: `/electron/ipc/settings.js`
- **Current Behavior**: Broadcasts setting changes but doesn't indicate restart requirements

---

## PHASE 2: INVESTIGATION (COMPLETED)

### Solution Approach
Combined approach for layered warning system:
1. Add `requiresRestart` property to schema
2. Add visual notification when setting changes
3. Provide "Restart Now" button for user convenience

---

## PHASE 3: IMPLEMENTATION (COMPLETED)

### Changes Made

#### 1. Updated Settings Schema
**File**: `/shared/constants/settings.js`
- Added `requiresRestart: true` to `advanced.hardwareAcceleration` setting
- Added `requiresRestart(key)` function to check if a setting requires restart
- Exported the `requiresRestart` function in module.exports

#### 2. Updated IPC Settings Handler
**File**: `/electron/ipc/settings.js`
- Imported `requiresRestart` function from settings schema
- Added IPC handler: `ipcMain.handle('settings:requiresRestart', ...)`
- Handler checks if setting requires restart and returns boolean

#### 3. Updated App IPC Handler
**File**: `/electron/ipc/index.js`
- Added IPC handler: `ipcMain.handle('app:restart', ...)`
- Calls `app.relaunch()` followed by `app.quit()` to restart the application

#### 4. Updated Preload Script
**File**: `/electron/preload.js`
- Added `settingRequiresRestart(key)` API method to Settings section
- Added `restartApp()` API method to App section
- Methods exposed to renderer process via contextBridge

#### 5. Updated HTML UI
**File**: `/src/settings/index.html`
- Added restart notification div with three elements:
  - Notification message: "This setting requires an app restart to take effect."
  - "Restart Now" button to immediately restart the application
  - Dismiss button (✕) to close the notification

#### 6. Updated Settings UI JavaScript
**File**: `/src/settings/settings.js`
- Added `showRestartNotification(settingKey)` function
  - Displays the notification element
  - Auto-hides after 10 seconds
- Updated event listeners to detect `requiresRestart` settings
  - Calls API to check if setting requires restart
  - Shows notification if restart is needed
- Added button handlers:
  - "Restart Now" button: calls `api.restartApp()`
  - Dismiss button: hides the notification

#### 7. Updated CSS Styles
**File**: `/src/settings/settings.css`
- Added `.restart-notification` styles:
  - Fixed position (top-right)
  - Orange background (warning color)
  - White text and buttons
  - Box shadow for visibility
  - Z-index: 1000 (above other content)
- Added button styles:
  - Semi-transparent white background
  - Hover effects for better UX
  - Smooth transitions
- Added `@keyframes slideIn` animation for notification entrance

---

## PHASE 4: TESTING (COMPLETED)

### Test Results

#### Unit Tests
Ran: `npm test -- --testNamePattern="settings"`
- **Result**: All IPC settings tests PASSED (13/13)
- **Status**: No new test failures introduced
- **Pre-existing failures**: Database tests fail due to missing better-sqlite3 binary (unrelated to this change)

#### Manual Verification

1. **Schema Changes**
   - Verified `requiresRestart: true` in `advanced.hardwareAcceleration`
   - Verified `requiresRestart()` function exports correctly

2. **IPC Handlers**
   - Verified `settings:requiresRestart` handler exists
   - Verified `app:restart` handler exists

3. **API Methods**
   - Verified `settingRequiresRestart()` in preload
   - Verified `restartApp()` in preload

4. **UI Elements**
   - Verified restart notification HTML exists
   - Verified CSS styling applied
   - Verified button handlers defined

### How to Test Manually

1. Open Settings window
2. Navigate to Advanced section
3. Toggle "Hardware acceleration" setting
4. Verify:
   - Notification appears in top-right corner
   - Shows message: "This setting requires an app restart to take effect."
   - Provides "Restart Now" and "✕" (dismiss) buttons
   - Auto-hides after 10 seconds if not dismissed
   - Clicking "Restart Now" restarts the application
   - Clicking "✕" dismisses the notification

5. Toggle other settings (e.g., theme)
   - Verify NO notification appears (working correctly)

---

## Architecture Overview

```
User changes hardwareAcceleration
    |
    v
setupEventListeners() listener triggers
    |
    v
api.setSetting(key, value) called
    |
    v
api.settingRequiresRestart(key) called
    |
    v
IPC: settings:requiresRestart handler
    |
    v
Return requiresRestart(key) result
    |
    v
If true: showRestartNotification(key)
    |
    v
Display notification with auto-hide
    |
    User clicks "Restart Now" or "✕"
    |
    v
If "Restart Now": api.restartApp()
    |
    v
IPC: app:restart handler
    |
    v
app.relaunch() then app.quit()
    |
    v
Application restarts
```

---

## Files Modified

1. `/shared/constants/settings.js` - Schema with requiresRestart property
2. `/electron/ipc/settings.js` - IPC handler for requiresRestart check
3. `/electron/preload.js` - API methods exposed to renderer
4. `/electron/ipc/index.js` - App restart handler
5. `/src/settings/index.html` - Notification UI element
6. `/src/settings/settings.js` - Notification logic and button handlers
7. `/src/settings/settings.css` - Notification styling and animation

---

## Summary

Issue 14 has been successfully fixed. Users will now:
1. See a visual notification when changing `hardwareAcceleration`
2. Be informed that the setting requires app restart
3. Have the option to restart immediately or dismiss the notification
4. Understand the action required to apply the setting change

The implementation uses a modular approach that can be extended to support other settings that require restart in the future by simply adding `requiresRestart: true` to their schema definitions.

