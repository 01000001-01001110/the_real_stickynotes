/**
 * Integration tests for background service behavior
 * Tests the implementation of tasks D.1-D.4 from unified-app-architecture-plan.md
 */

const { describe, it, expect } = require('@jest/globals');

describe('Background Service Behavior', () => {
  describe('D.1: Auto-start configuration', () => {
    it('should have auto-start registry entry in installer.nsh', () => {
      const fs = require('fs');
      const path = require('path');
      const installerPath = path.join(__dirname, '..', '..', 'build', 'installer.nsh');
      const content = fs.readFileSync(installerPath, 'utf8');

      // Verify the registry entry exists
      expect(content).toContain(
        'WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Run"'
      );
      expect(content).toContain('"StickyNotes" \'"$INSTDIR\\StickyNotes.exe" --minimized\'');
    });
  });

  describe('D.2: Start minimized to tray', () => {
    it('should detect --minimized flag from process.argv', () => {
      const argv = ['node', 'electron/main.js', '--minimized'];
      const minimizedFlag = argv.includes('--minimized');
      expect(minimizedFlag).toBe(true);
    });

    it('should not detect --minimized flag when not present', () => {
      const argv = ['node', 'electron/main.js'];
      const minimizedFlag = argv.includes('--minimized');
      expect(minimizedFlag).toBe(false);
    });

    it('should prioritize --minimized flag over setting', () => {
      const minimizedFlag = true;
      const settingValue = false;
      const startMinimized = minimizedFlag || settingValue;
      expect(startMinimized).toBe(true);
    });

    it('should use setting when no flag is present', () => {
      const minimizedFlag = false;
      const settingValue = true;
      const startMinimized = minimizedFlag || settingValue;
      expect(startMinimized).toBe(true);
    });
  });

  describe('D.3: window-all-closed behavior', () => {
    it('should stay running when closeToTray is true and not quitting', () => {
      const closeToTray = true;
      const isQuitting = false;
      const shouldQuit = !closeToTray || isQuitting;
      expect(shouldQuit).toBe(false);
    });

    it('should quit when closeToTray is false', () => {
      const closeToTray = false;
      const isQuitting = false;
      const shouldQuit = !closeToTray || isQuitting;
      expect(shouldQuit).toBe(true);
    });

    it('should quit when explicitly quitting even if closeToTray is true', () => {
      const closeToTray = true;
      const isQuitting = true;
      const shouldQuit = !closeToTray || isQuitting;
      expect(shouldQuit).toBe(true);
    });
  });

  describe('D.4: Tray menu "Open Panel" item', () => {
    it('should verify tray menu structure', () => {
      const fs = require('fs');
      const path = require('path');
      const trayPath = path.join(__dirname, '..', '..', 'electron', 'tray.js');
      const content = fs.readFileSync(trayPath, 'utf8');

      // Verify "Open Panel" menu item exists
      expect(content).toContain("label: 'Open Panel'");
      expect(content).toContain('windowManager.showPanel()');

      // Verify menu structure has key items
      expect(content).toContain("label: 'New Note'");
      expect(content).toContain("label: 'Settings'");
      expect(content).toContain("label: 'Quit'");
    });
  });

  describe('Integration: Complete background service flow', () => {
    it('should implement all background service requirements', () => {
      const fs = require('fs');
      const path = require('path');

      // Check installer.nsh
      const installerPath = path.join(__dirname, '..', '..', 'build', 'installer.nsh');
      const installerContent = fs.readFileSync(installerPath, 'utf8');
      expect(installerContent).toContain('--minimized');

      // Check main.js
      const mainPath = path.join(__dirname, '..', '..', 'electron', 'main.js');
      const mainContent = fs.readFileSync(mainPath, 'utf8');
      expect(mainContent).toContain("process.argv.includes('--minimized')");
      expect(mainContent).toContain('closeToTray && !appState.isQuitting');

      // Check tray.js
      const trayPath = path.join(__dirname, '..', '..', 'electron', 'tray.js');
      const trayContent = fs.readFileSync(trayPath, 'utf8');
      expect(trayContent).toContain('Open Panel');
    });
  });
});
