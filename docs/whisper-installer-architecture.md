# Sherpa-ONNX Whisper Installer Architecture

**Document Version**: 1.0
**Date**: 2026-01-10
**Status**: Design Complete
**Author**: System Architecture Designer

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Context](#2-system-context)
3. [File and Folder Structure](#3-file-and-folder-structure)
4. [Component Architecture](#4-component-architecture)
5. [Model Manager Service](#5-model-manager-service)
6. [Installer Flow](#6-installer-flow)
7. [IPC Interface](#7-ipc-interface)
8. [UI Components](#8-ui-components)
9. [Error Handling](#9-error-handling)
10. [Platform Considerations](#10-platform-considerations)
11. [Security Considerations](#11-security-considerations)
12. [Testing Strategy](#12-testing-strategy)
13. [Architecture Decision Records](#13-architecture-decision-records)

---

## 1. Executive Summary

This document defines the architecture for integrating a user-friendly Sherpa-ONNX Whisper model installer into StickyNotes. The system enables local speech-to-text transcription using pre-trained ONNX models with Voice Activity Detection (VAD).

### Key Design Goals

- **User-Friendly**: One-click installation from Settings UI
- **Cross-Platform**: Windows, macOS (Intel + ARM), Linux support
- **Reliable**: Robust error handling, download resumption, integrity verification
- **Minimal Footprint**: Only download what's needed (VAD ~2MB + Model 117-400MB)
- **Non-Blocking**: Background downloads with progress indication

### Technology Stack

| Layer          | Technology                     |
| -------------- | ------------------------------ |
| Runtime        | sherpa-onnx-node (npm)         |
| Models         | Whisper ONNX (INT8 quantized)  |
| VAD            | Silero VAD ONNX                |
| Archive Format | tar.bz2 (bzip2 compressed)     |
| Extraction     | decompress + decompress-tarbz2 |

---

## 2. System Context

### C4 Context Diagram

```
                    +------------------+
                    |     User         |
                    +--------+---------+
                             |
                             | Enables transcription
                             v
+-----------------------------------------------------------+
|                    StickyNotes App                        |
|  +------------------+    +----------------------------+   |
|  | Settings Window  |--->| Sherpa Model Manager      |   |
|  | (Renderer)       |    | (Main Process)            |   |
|  +------------------+    +----------------------------+   |
|                                   |                       |
+-----------------------------------|------------------------+
                                    |
          +-------------------------+-------------------------+
          |                         |                         |
          v                         v                         v
  +---------------+       +------------------+      +-----------------+
  | GitHub        |       | App Data Dir     |      | sherpa-onnx-node|
  | Releases      |       | ~/.stickynotes/  |      | (npm package)   |
  | (Models)      |       | sherpa-onnx/     |      |                 |
  +---------------+       +------------------+      +-----------------+
```

### Integration Points

| Component        | Interface    | Description                       |
| ---------------- | ------------ | --------------------------------- |
| Settings UI      | IPC Renderer | Model selection, progress display |
| Model Manager    | IPC Main     | Download orchestration            |
| Whisper Service  | Local Files  | Model file loading                |
| sherpa-onnx-node | Native Addon | Transcription execution           |

---

## 3. File and Folder Structure

### 3.1 Model Storage Layout

```
{AppDataPath}/                          # Platform-specific app data
└── sherpa-onnx/                        # Root for all sherpa-onnx assets
    ├── .metadata.json                  # Installation metadata
    ├── vad/                            # Voice Activity Detection
    │   └── silero_vad.onnx            # Silero VAD model (~2MB)
    └── whisper/                        # Whisper models
        └── {model-name}/               # e.g., "tiny.en", "base.en", "small.en"
            ├── encoder.int8.onnx       # Whisper encoder (INT8 quantized)
            ├── decoder.int8.onnx       # Whisper decoder (INT8 quantized)
            └── tokens.txt              # Vocabulary/tokens file
```

### 3.2 Platform-Specific Paths

| Platform | AppDataPath                                 |
| -------- | ------------------------------------------- |
| Windows  | `%APPDATA%/StickyNotes`                     |
| macOS    | `~/Library/Application Support/StickyNotes` |
| Linux    | `~/.config/stickynotes`                     |

### 3.3 Metadata Schema (.metadata.json)

```json
{
  "version": "1.0.0",
  "installedAt": "2026-01-10T12:00:00Z",
  "vad": {
    "installed": true,
    "version": "silero_vad_v4",
    "size": 2048000,
    "checksum": "sha256:..."
  },
  "whisper": {
    "tiny.en": {
      "installed": true,
      "version": "1.0.0",
      "size": 117000000,
      "checksum": "sha256:...",
      "installedAt": "2026-01-10T12:05:00Z"
    }
  }
}
```

### 3.4 Source Code Structure

```
electron/
└── whisper/
    ├── model-manager.js          # EXISTING - to be deprecated
    ├── sherpa-model-manager.js   # NEW - Sherpa-ONNX model management
    ├── sherpa-service.js         # NEW - Sherpa-ONNX transcription service
    └── service.js                # EXISTING - to be replaced

shared/
└── constants/
    └── whisper.js                # UPDATE - Add SHERPA_ONNX_MODELS

src/
└── settings/
    └── components/
        └── WhisperInstaller.jsx  # NEW - Installer UI component (if using React)
                                  # OR update settings.js for vanilla JS
```

---

## 4. Component Architecture

### 4.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Renderer Process                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Settings Window                           │   │
│  │  ┌──────────────────┐  ┌───────────────────────────────┐    │   │
│  │  │ Model Selector   │  │    Progress Indicator         │    │   │
│  │  │ - tiny.en        │  │    [████████░░░░] 65%          │    │   │
│  │  │ - base.en        │  │    "Downloading encoder..."    │    │   │
│  │  │ - small.en       │  └───────────────────────────────┘    │   │
│  │  └──────────────────┘                                       │   │
│  │  ┌──────────────────┐  ┌───────────────────────────────┐    │   │
│  │  │ Install Button   │  │    Status Display             │    │   │
│  │  │ [Install Model]  │  │    ✓ VAD Installed            │    │   │
│  │  │ [Uninstall]      │  │    ✓ tiny.en Ready            │    │   │
│  │  └──────────────────┘  └───────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ IPC
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          Main Process                               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  IPC Handler (whisper.js)                    │   │
│  │  - whisper:installModel                                      │   │
│  │  - whisper:uninstallModel                                    │   │
│  │  - whisper:getInstallStatus                                  │   │
│  └──────────────────────────────┬──────────────────────────────┘   │
│                                 │                                   │
│  ┌──────────────────────────────▼──────────────────────────────┐   │
│  │              SherpaModelManager                              │   │
│  │  ┌─────────────────┐  ┌─────────────────┐                   │   │
│  │  │ DownloadManager │  │ ExtractionUtil  │                   │   │
│  │  │ - HTTP/HTTPS    │  │ - tar.bz2       │                   │   │
│  │  │ - Progress      │  │ - Verification  │                   │   │
│  │  │ - Resume        │  │                 │                   │   │
│  │  └─────────────────┘  └─────────────────┘                   │   │
│  │  ┌─────────────────┐  ┌─────────────────┐                   │   │
│  │  │ DiskSpaceCheck  │  │ MetadataManager │                   │   │
│  │  │ - Free space    │  │ - .metadata.json│                   │   │
│  │  │ - Cleanup       │  │ - Checksums     │                   │   │
│  │  └─────────────────┘  └─────────────────┘                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                SherpaTranscriptionService                    │   │
│  │  - VAD (Silero)                                              │   │
│  │  - Whisper OfflineRecognizer                                 │   │
│  │  - Audio Processing                                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Dependency Graph

```
sherpa-model-manager.js
    ├── node:fs/promises
    ├── node:path
    ├── node:https
    ├── node:crypto (for checksums)
    ├── decompress (npm)
    ├── decompress-tarbz2 (npm)
    └── shared/utils/paths.js

sherpa-service.js
    ├── sherpa-onnx-node (npm)
    ├── sherpa-model-manager.js
    └── shared/constants/whisper.js
```

---

## 5. Model Manager Service

### 5.1 API Specification

**File**: `electron/whisper/sherpa-model-manager.js`

```javascript
/**
 * Sherpa-ONNX Model Manager
 *
 * Manages downloading, extracting, and verifying Sherpa-ONNX models
 * including Whisper and Silero VAD.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const SHERPA_ONNX_MODELS = {
  vad: {
    name: 'silero_vad',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx',
    filename: 'silero_vad.onnx',
    size: '2MB',
    sizeBytes: 2 * 1024 * 1024,
    checksum: null, // To be verified from release
  },
  whisper: {
    'tiny.en': {
      name: 'tiny.en',
      displayName: 'Tiny (English)',
      url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-tiny.en.tar.bz2',
      size: '117MB',
      sizeBytes: 117 * 1024 * 1024,
      description: 'Fastest, good for quick notes',
      files: ['tiny.en-encoder.int8.onnx', 'tiny.en-decoder.int8.onnx', 'tiny.en-tokens.txt'],
    },
    'base.en': {
      name: 'base.en',
      displayName: 'Base (English)',
      url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-base.en.tar.bz2',
      size: '160MB',
      sizeBytes: 160 * 1024 * 1024,
      description: 'Balanced speed and accuracy',
      files: ['base.en-encoder.int8.onnx', 'base.en-decoder.int8.onnx', 'base.en-tokens.txt'],
    },
    'small.en': {
      name: 'small.en',
      displayName: 'Small (English)',
      url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-small.en.tar.bz2',
      size: '400MB',
      sizeBytes: 400 * 1024 * 1024,
      description: 'Best accuracy for important recordings',
      files: ['small.en-encoder.int8.onnx', 'small.en-decoder.int8.onnx', 'small.en-tokens.txt'],
    },
  },
};

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get the base path for sherpa-onnx models
 * @returns {string} Absolute path to sherpa-onnx directory
 */
function getSherpaBasePath(): string;

/**
 * Get the path to the VAD model
 * @returns {string} Absolute path to silero_vad.onnx
 */
function getVADPath(): string;

/**
 * Get the path to a Whisper model directory
 * @param {string} modelSize - Model identifier (e.g., 'tiny.en', 'base.en')
 * @returns {string} Absolute path to model directory
 */
function getWhisperModelPath(modelSize: string): string;

/**
 * Check installation status of all models
 * @returns {Promise<InstallStatus>}
 */
async function getInstallStatus(): Promise<{
  vadInstalled: boolean;
  vadPath: string | null;
  whisperModels: {
    [key: string]: {
      installed: boolean;
      path: string | null;
      size: string;
      verified: boolean;
    };
  };
  activeModel: string | null;
}>;

/**
 * Get detailed status of VAD model
 * @returns {Promise<VADStatus>}
 */
async function getVADStatus(): Promise<{
  installed: boolean;
  path: string | null;
  size: number | null;
  verified: boolean;
}>;

/**
 * Get detailed status of a Whisper model
 * @param {string} modelSize - Model identifier
 * @returns {Promise<ModelStatus>}
 */
async function getModelStatus(modelSize: string): Promise<{
  installed: boolean;
  path: string | null;
  size: number | null;
  expectedSize: number;
  verified: boolean;
  files: {
    encoder: boolean;
    decoder: boolean;
    tokens: boolean;
  };
}>;

/**
 * Download and install the VAD model
 * @param {function} onProgress - Progress callback (0-100)
 * @returns {Promise<string>} Path to installed model
 * @throws {DiskSpaceError} If insufficient disk space
 * @throws {NetworkError} If download fails
 */
async function downloadVAD(
  onProgress?: (progress: number, stage: string) => void
): Promise<string>;

/**
 * Download and install a Whisper model
 * @param {string} modelSize - Model identifier
 * @param {function} onProgress - Progress callback (0-100)
 * @returns {Promise<string>} Path to installed model directory
 * @throws {DiskSpaceError} If insufficient disk space
 * @throws {NetworkError} If download fails
 * @throws {ExtractionError} If archive extraction fails
 */
async function downloadModel(
  modelSize: string,
  onProgress?: (progress: number, stage: string) => void
): Promise<string>;

/**
 * Delete a Whisper model
 * @param {string} modelSize - Model identifier
 * @returns {Promise<boolean>} True if deleted successfully
 */
async function deleteModel(modelSize: string): Promise<boolean>;

/**
 * Delete the VAD model
 * @returns {Promise<boolean>} True if deleted successfully
 */
async function deleteVAD(): Promise<boolean>;

/**
 * Verify model files integrity
 * @param {string} modelSize - Model identifier
 * @returns {Promise<VerificationResult>}
 */
async function verifyModel(modelSize: string): Promise<{
  valid: boolean;
  missing: string[];
  corrupted: string[];
}>;

/**
 * Extract a tar.bz2 archive
 * @param {string} archivePath - Path to .tar.bz2 file
 * @param {string} destPath - Extraction destination
 * @returns {Promise<string[]>} List of extracted files
 */
async function extractTarBz2(
  archivePath: string,
  destPath: string
): Promise<string[]>;

/**
 * Check available disk space
 * @param {number} requiredBytes - Required space in bytes
 * @returns {Promise<{sufficient: boolean, available: number, required: number}>}
 */
async function checkDiskSpace(requiredBytes: number): Promise<{
  sufficient: boolean;
  available: number;
  required: number;
}>;

/**
 * List all available model configurations
 * @returns {ModelConfig[]}
 */
function getAvailableModels(): Array<{
  id: string;
  name: string;
  displayName: string;
  size: string;
  sizeBytes: number;
  description: string;
}>;
```

### 5.2 Implementation Details

#### Download Manager Implementation

```javascript
/**
 * Downloads a file with progress tracking and redirect handling
 */
async function downloadFile(url, destPath, onProgress) {
  const tempPath = `${destPath}.tmp`;

  return new Promise((resolve, reject) => {
    const makeRequest = (targetUrl) => {
      const protocol = targetUrl.startsWith('https') ? https : http;

      const request = protocol.get(
        targetUrl,
        {
          headers: {
            'User-Agent': 'StickyNotes/2.0',
            Accept: '*/*',
          },
          timeout: 30000,
        },
        (response) => {
          // Handle redirects (GitHub releases use 302)
          if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
            const redirectUrl = response.headers.location;
            if (redirectUrl) {
              return makeRequest(redirectUrl);
            }
          }

          if (response.statusCode !== 200) {
            reject(new NetworkError(`HTTP ${response.statusCode}`));
            return;
          }

          const totalBytes = parseInt(response.headers['content-length'], 10) || 0;
          let downloadedBytes = 0;

          const file = fs.createWriteStream(tempPath);

          response.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            if (totalBytes > 0 && onProgress) {
              onProgress(Math.round((downloadedBytes / totalBytes) * 100));
            }
          });

          response.pipe(file);

          file.on('finish', async () => {
            file.close();
            await fs.promises.rename(tempPath, destPath);
            resolve(destPath);
          });

          file.on('error', (err) => {
            fs.promises.unlink(tempPath).catch(() => {});
            reject(err);
          });
        }
      );

      request.on('error', (err) => {
        fs.promises.unlink(tempPath).catch(() => {});
        reject(new NetworkError(err.message));
      });

      request.on('timeout', () => {
        request.destroy();
        fs.promises.unlink(tempPath).catch(() => {});
        reject(new NetworkError('Download timeout'));
      });
    };

    makeRequest(url);
  });
}
```

#### Extraction Implementation

```javascript
const decompress = require('decompress');
const decompressTarbz2 = require('decompress-tarbz2');

/**
 * Extract tar.bz2 archive with platform-appropriate handling
 */
async function extractTarBz2(archivePath, destPath) {
  // Ensure destination exists
  await fs.promises.mkdir(destPath, { recursive: true });

  try {
    const files = await decompress(archivePath, destPath, {
      plugins: [decompressTarbz2()],
      strip: 1, // Remove top-level directory from archive
    });

    return files.map((f) => f.path);
  } catch (error) {
    throw new ExtractionError(`Failed to extract archive: ${error.message}`);
  }
}
```

#### File Verification Implementation

```javascript
/**
 * Verify all required model files exist and are non-empty
 */
async function verifyModel(modelSize) {
  const model = SHERPA_ONNX_MODELS.whisper[modelSize];
  if (!model) {
    throw new Error(`Unknown model: ${modelSize}`);
  }

  const modelPath = getWhisperModelPath(modelSize);
  const missing = [];
  const corrupted = [];

  const requiredFiles = [
    { name: 'encoder', file: `${modelSize}-encoder.int8.onnx` },
    { name: 'decoder', file: `${modelSize}-decoder.int8.onnx` },
    { name: 'tokens', file: `${modelSize}-tokens.txt` },
  ];

  for (const { name, file } of requiredFiles) {
    const filePath = path.join(modelPath, file);

    try {
      const stats = await fs.promises.stat(filePath);

      // Check file is not empty (basic corruption check)
      if (stats.size === 0) {
        corrupted.push(name);
      }

      // For ONNX files, verify minimum expected size
      if (file.endsWith('.onnx') && stats.size < 1000) {
        corrupted.push(name);
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        missing.push(name);
      } else {
        corrupted.push(name);
      }
    }
  }

  return {
    valid: missing.length === 0 && corrupted.length === 0,
    missing,
    corrupted,
  };
}
```

---

## 6. Installer Flow

### 6.1 State Machine Diagram

```
                          ┌─────────────────┐
                          │     IDLE        │
                          │ (Check Status)  │
                          └────────┬────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
           ┌──────────────┐ ┌──────────┐ ┌──────────────┐
           │ NOT_INSTALLED│ │ PARTIAL  │ │  INSTALLED   │
           │              │ │ (repair) │ │   (ready)    │
           └───────┬──────┘ └────┬─────┘ └──────────────┘
                   │             │              ▲
                   │ Install     │ Repair       │
                   ▼             ▼              │
           ┌────────────────────────────────────┤
           │                                    │
           ▼                                    │
    ┌─────────────────┐                         │
    │ CHECKING_SPACE  │                         │
    └────────┬────────┘                         │
             │                                  │
             ├── Insufficient ──► ERROR ────────┤
             │                                  │
             ▼                                  │
    ┌─────────────────┐                         │
    │ DOWNLOADING_VAD │◄── If needed            │
    │    (0-10%)      │                         │
    └────────┬────────┘                         │
             │                                  │
             ▼                                  │
    ┌─────────────────┐                         │
    │DOWNLOADING_MODEL│                         │
    │   (10-80%)      │                         │
    └────────┬────────┘                         │
             │                                  │
             ├── Network Error ──► RETRY ───────┤
             │                                  │
             ▼                                  │
    ┌─────────────────┐                         │
    │   EXTRACTING    │                         │
    │   (80-95%)      │                         │
    └────────┬────────┘                         │
             │                                  │
             ├── Extraction Error ──► CLEANUP ──┤
             │                                  │
             ▼                                  │
    ┌─────────────────┐                         │
    │   VERIFYING     │                         │
    │   (95-100%)     │                         │
    └────────┬────────┘                         │
             │                                  │
             ├── Verification Failed ──► REPAIR │
             │                                  │
             ▼                                  │
    ┌─────────────────┐                         │
    │   COMPLETE      │─────────────────────────┘
    └─────────────────┘
```

### 6.2 Detailed Flow Sequence

```
User clicks "Enable Transcription"
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. CHECK INSTALLATION STATUS                                │
│    - Call getInstallStatus()                                │
│    - Check vadInstalled && selectedModelInstalled           │
└─────────────────────────────────────────────────────────────┘
         │
         ├── All installed ──► Enable transcription
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. SHOW INSTALLER DIALOG                                    │
│    - Display model options with sizes                       │
│    - Show disk space requirement                            │
│    - "Install" button                                       │
└─────────────────────────────────────────────────────────────┘
         │
         │ User clicks Install
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. CHECK DISK SPACE                                         │
│    - Calculate: VAD (~2MB) + Model (varies) + 20% buffer    │
│    - Check available space                                  │
│    - Show error if insufficient                             │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. DOWNLOAD VAD (if needed)                     [0% - 10%]  │
│    - Progress: "Downloading voice detection model..."       │
│    - Download silero_vad.onnx to temp                       │
│    - Move to final location                                 │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. DOWNLOAD MODEL ARCHIVE                       [10% - 80%] │
│    - Progress: "Downloading {model} model..."               │
│    - Download .tar.bz2 to temp directory                    │
│    - Handle GitHub redirects (302)                          │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. EXTRACT ARCHIVE                              [80% - 95%] │
│    - Progress: "Extracting model files..."                  │
│    - Extract tar.bz2 using decompress                       │
│    - Rename/move files to final structure                   │
│    - Delete archive after extraction                        │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. VERIFY INSTALLATION                          [95% - 100%]│
│    - Progress: "Verifying installation..."                  │
│    - Check all required files exist                         │
│    - Verify file sizes are reasonable                       │
│    - Update .metadata.json                                  │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. ENABLE TRANSCRIPTION                                     │
│    - Set whisper.enabled = true                             │
│    - Initialize sherpa-onnx-node                            │
│    - Show success message                                   │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 Progress Mapping

| Stage             | Progress Range | Description                 |
| ----------------- | -------------- | --------------------------- |
| Initializing      | 0%             | Checking current status     |
| Disk Space Check  | 0-2%           | Verifying sufficient space  |
| Downloading VAD   | 2-10%          | Silero VAD (~2MB)           |
| Downloading Model | 10-80%         | Whisper archive (117-400MB) |
| Extracting        | 80-95%         | tar.bz2 decompression       |
| Verifying         | 95-99%         | File integrity checks       |
| Complete          | 100%           | Ready for use               |

---

## 7. IPC Interface

### 7.1 Handler Registration

**File**: `electron/ipc/whisper.js` (update existing)

```javascript
const { ipcMain } = require('electron');
const sherpaModelManager = require('../whisper/sherpa-model-manager');

function register(wm) {
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

      const requiredSpace = modelConfig.sizeBytes * 2.5; // Archive + extracted + buffer
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
      return await sherpaModelManager.getInstallStatus();
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
}

module.exports = { register };
```

### 7.2 Preload API Additions

**File**: `electron/preload.js` (additions)

```javascript
// Add to existing whisper API
whisperInstallModel: (modelSize) => ipcRenderer.invoke('whisper:installModel', modelSize),
whisperUninstallModel: (modelSize) => ipcRenderer.invoke('whisper:uninstallModel', modelSize),
whisperGetInstallStatus: () => ipcRenderer.invoke('whisper:getInstallStatus'),
whisperGetAvailableModels: () => ipcRenderer.invoke('whisper:getAvailableModels'),
whisperVerifyModel: (modelSize) => ipcRenderer.invoke('whisper:verifyModel', modelSize),

onWhisperInstallProgress: (callback) => {
  const handler = (event, data) => callback(data);
  ipcRenderer.on('whisper:installProgress', handler);
  return () => ipcRenderer.removeListener('whisper:installProgress', handler);
},

onWhisperInstallError: (callback) => {
  const handler = (event, error) => callback(error);
  ipcRenderer.on('whisper:installError', handler);
  return () => ipcRenderer.removeListener('whisper:installError', handler);
},
```

### 7.3 IPC Message Types

```typescript
// Type definitions for IPC messages

interface InstallProgressEvent {
  stage: 'init' | 'vad' | 'model' | 'extract' | 'verify' | 'complete';
  progress: number; // 0-100
  message: string;
}

interface InstallResult {
  success: boolean;
  error?: 'INSUFFICIENT_SPACE' | 'NETWORK_ERROR' | 'EXTRACTION_FAILED' | 'VERIFICATION_FAILED';
  message?: string;
}

interface InstallStatus {
  vadInstalled: boolean;
  vadPath: string | null;
  whisperModels: {
    [modelId: string]: {
      installed: boolean;
      path: string | null;
      size: string;
      verified: boolean;
    };
  };
  activeModel: string | null;
}

interface ModelInfo {
  id: string;
  name: string;
  displayName: string;
  size: string;
  sizeBytes: number;
  description: string;
}
```

---

## 8. UI Components

### 8.1 Installer Section (Settings HTML)

**File**: `src/settings/settings.html` (addition to Transcription section)

```html
<!-- Whisper Model Installer -->
<div class="setting-group" id="whisperInstallerSection">
  <h3 class="setting-group-title">Model Installation</h3>

  <!-- Status Display -->
  <div class="installer-status" id="installerStatus">
    <div class="status-row">
      <span class="status-icon" id="vadStatusIcon">⏳</span>
      <span class="status-label">Voice Detection (VAD)</span>
      <span class="status-value" id="vadStatusValue">Not installed</span>
    </div>
    <div class="status-row">
      <span class="status-icon" id="modelStatusIcon">⏳</span>
      <span class="status-label">Whisper Model</span>
      <span class="status-value" id="modelStatusValue">Not installed</span>
    </div>
  </div>

  <!-- Model Selector -->
  <div class="setting-row">
    <label for="whisperModelSelect">Model Size</label>
    <div class="setting-control">
      <select id="whisperModelSelect" class="setting-input">
        <option value="tiny.en">Tiny (~117MB) - Fast, good for quick notes</option>
        <option value="base.en" selected>Base (~160MB) - Balanced</option>
        <option value="small.en">Small (~400MB) - Best accuracy</option>
      </select>
    </div>
  </div>

  <!-- Size Info -->
  <div class="setting-info" id="modelSizeInfo">
    <span class="info-icon">ℹ️</span>
    <span id="downloadSizeText">Download size: ~160MB (requires ~350MB during installation)</span>
  </div>

  <!-- Progress Bar -->
  <div class="installer-progress" id="installerProgress" hidden>
    <div class="progress-bar">
      <div class="progress-fill" id="installProgressFill" style="width: 0%"></div>
    </div>
    <div class="progress-info">
      <span class="progress-text" id="installProgressText">Preparing...</span>
      <span class="progress-percent" id="installProgressPercent">0%</span>
    </div>
  </div>

  <!-- Action Buttons -->
  <div class="installer-actions" id="installerActions">
    <button class="btn btn-primary" id="installModelBtn">
      <span class="btn-icon">⬇️</span>
      Install Model
    </button>
    <button class="btn btn-secondary" id="uninstallModelBtn" hidden>
      <span class="btn-icon">🗑️</span>
      Uninstall
    </button>
    <button class="btn btn-link" id="cancelInstallBtn" hidden>Cancel</button>
  </div>

  <!-- Error Display -->
  <div class="installer-error" id="installerError" hidden>
    <span class="error-icon">⚠️</span>
    <span class="error-message" id="installerErrorMessage"></span>
    <button class="btn btn-link" id="retryInstallBtn">Retry</button>
  </div>
</div>
```

### 8.2 Installer CSS

**File**: `src/settings/settings.css` (additions)

```css
/* =========================================================================
   WHISPER INSTALLER STYLES
   ========================================================================= */

.installer-status {
  background: var(--surface-secondary);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}

.status-row + .status-row {
  border-top: 1px solid var(--border-color);
}

.status-icon {
  font-size: 18px;
  width: 24px;
  text-align: center;
}

.status-icon.ready {
  color: var(--color-success);
}
.status-icon.pending {
  color: var(--color-warning);
}
.status-icon.error {
  color: var(--color-error);
}

.status-label {
  flex: 1;
  font-weight: 500;
}

.status-value {
  color: var(--text-secondary);
  font-size: 13px;
}

/* Progress Bar */
.installer-progress {
  margin: 16px 0;
}

.progress-bar {
  height: 8px;
  background: var(--surface-secondary);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 13px;
}

.progress-text {
  color: var(--text-secondary);
}

.progress-percent {
  font-weight: 600;
  color: var(--color-primary);
}

/* Actions */
.installer-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

/* Error Display */
.installer-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--color-error-bg);
  border-radius: 8px;
  margin-top: 16px;
  color: var(--color-error);
}

.installer-error .error-message {
  flex: 1;
}

/* Model Size Info */
.setting-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--color-info-bg);
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  margin: 8px 0;
}

.info-icon {
  font-size: 16px;
}
```

### 8.3 Installer JavaScript

**File**: `src/settings/settings.js` (update setupWhisperSettings function)

```javascript
/**
 * Setup Whisper Installer functionality
 */
async function setupWhisperInstaller() {
  // DOM Elements
  const modelSelect = document.getElementById('whisperModelSelect');
  const installBtn = document.getElementById('installModelBtn');
  const uninstallBtn = document.getElementById('uninstallModelBtn');
  const cancelBtn = document.getElementById('cancelInstallBtn');
  const retryBtn = document.getElementById('retryInstallBtn');
  const progressSection = document.getElementById('installerProgress');
  const progressFill = document.getElementById('installProgressFill');
  const progressText = document.getElementById('installProgressText');
  const progressPercent = document.getElementById('installProgressPercent');
  const errorSection = document.getElementById('installerError');
  const errorMessage = document.getElementById('installerErrorMessage');
  const vadStatusIcon = document.getElementById('vadStatusIcon');
  const vadStatusValue = document.getElementById('vadStatusValue');
  const modelStatusIcon = document.getElementById('modelStatusIcon');
  const modelStatusValue = document.getElementById('modelStatusValue');
  const downloadSizeText = document.getElementById('downloadSizeText');

  // State
  let isInstalling = false;
  let removeProgressListener = null;
  let removeErrorListener = null;

  // Model size info
  const modelSizes = {
    'tiny.en': { download: '117MB', install: '250MB' },
    'base.en': { download: '160MB', install: '350MB' },
    'small.en': { download: '400MB', install: '850MB' },
  };

  /**
   * Update status display
   */
  async function updateStatus() {
    try {
      const status = await api.whisperGetInstallStatus();

      // VAD status
      if (status.vadInstalled) {
        vadStatusIcon.textContent = '✓';
        vadStatusIcon.className = 'status-icon ready';
        vadStatusValue.textContent = 'Installed';
      } else {
        vadStatusIcon.textContent = '⏳';
        vadStatusIcon.className = 'status-icon pending';
        vadStatusValue.textContent = 'Not installed (will download with model)';
      }

      // Whisper model status
      const selectedModel = modelSelect.value;
      const modelStatus = status.whisperModels[selectedModel];

      if (modelStatus?.installed && modelStatus?.verified) {
        modelStatusIcon.textContent = '✓';
        modelStatusIcon.className = 'status-icon ready';
        modelStatusValue.textContent = `${selectedModel} - Ready`;
        installBtn.textContent = 'Reinstall';
        uninstallBtn.hidden = false;
      } else if (modelStatus?.installed && !modelStatus?.verified) {
        modelStatusIcon.textContent = '⚠️';
        modelStatusIcon.className = 'status-icon error';
        modelStatusValue.textContent = 'Corrupted - reinstall recommended';
        installBtn.textContent = 'Repair';
        uninstallBtn.hidden = false;
      } else {
        modelStatusIcon.textContent = '⏳';
        modelStatusIcon.className = 'status-icon pending';
        modelStatusValue.textContent = 'Not installed';
        installBtn.innerHTML = '<span class="btn-icon">⬇️</span> Install Model';
        uninstallBtn.hidden = true;
      }
    } catch (error) {
      console.error('Failed to get install status:', error);
    }
  }

  /**
   * Update size info display
   */
  function updateSizeInfo() {
    const model = modelSelect.value;
    const sizes = modelSizes[model];
    downloadSizeText.textContent = `Download size: ~${sizes.download} (requires ~${sizes.install} during installation)`;
  }

  /**
   * Start installation
   */
  async function startInstall() {
    if (isInstalling) return;

    isInstalling = true;
    const modelSize = modelSelect.value;

    // Update UI
    installBtn.disabled = true;
    modelSelect.disabled = true;
    progressSection.hidden = false;
    errorSection.hidden = true;
    cancelBtn.hidden = false;

    // Setup progress listener
    removeProgressListener = api.onWhisperInstallProgress((data) => {
      progressFill.style.width = `${data.progress}%`;
      progressText.textContent = data.message;
      progressPercent.textContent = `${Math.round(data.progress)}%`;
    });

    // Setup error listener
    removeErrorListener = api.onWhisperInstallError((error) => {
      showError(error);
    });

    try {
      const result = await api.whisperInstallModel(modelSize);

      if (result.success) {
        progressSection.hidden = true;
        await updateStatus();
      } else {
        showError(result.message || 'Installation failed');
      }
    } catch (error) {
      showError(error.message || 'Installation failed');
    } finally {
      cleanup();
    }
  }

  /**
   * Show error state
   */
  function showError(message) {
    errorSection.hidden = false;
    errorMessage.textContent = message;
    progressSection.hidden = true;
  }

  /**
   * Cleanup after install attempt
   */
  function cleanup() {
    isInstalling = false;
    installBtn.disabled = false;
    modelSelect.disabled = false;
    cancelBtn.hidden = true;

    if (removeProgressListener) {
      removeProgressListener();
      removeProgressListener = null;
    }
    if (removeErrorListener) {
      removeErrorListener();
      removeErrorListener = null;
    }
  }

  /**
   * Uninstall model
   */
  async function uninstallModel() {
    const modelSize = modelSelect.value;

    if (
      !confirm(`Uninstall ${modelSize} model? You will need to reinstall to use transcription.`)
    ) {
      return;
    }

    try {
      await api.whisperUninstallModel(modelSize);
      await updateStatus();
    } catch (error) {
      showError(`Uninstall failed: ${error.message}`);
    }
  }

  // Event listeners
  modelSelect.addEventListener('change', () => {
    updateSizeInfo();
    updateStatus();
  });

  installBtn.addEventListener('click', startInstall);
  uninstallBtn.addEventListener('click', uninstallModel);
  retryBtn.addEventListener('click', () => {
    errorSection.hidden = true;
    startInstall();
  });

  cancelBtn.addEventListener('click', () => {
    // Note: Cancellation requires additional implementation
    // For now, just cleanup UI state
    cleanup();
    progressSection.hidden = true;
  });

  // Initial setup
  updateSizeInfo();
  await updateStatus();
}

// Call from init()
async function init() {
  // ... existing code ...
  await setupWhisperInstaller();
}
```

---

## 9. Error Handling

### 9.1 Error Classification

```javascript
/**
 * Custom error classes for model installation
 */

class InstallerError extends Error {
  constructor(message, code, recoverable = true) {
    super(message);
    this.name = 'InstallerError';
    this.code = code;
    this.recoverable = recoverable;
  }
}

class NetworkError extends InstallerError {
  constructor(message) {
    super(message, 'NETWORK_ERROR', true);
    this.name = 'NetworkError';
  }
}

class DiskSpaceError extends InstallerError {
  constructor(required, available) {
    super(
      `Insufficient disk space: need ${formatBytes(required)}, have ${formatBytes(available)}`,
      'INSUFFICIENT_SPACE',
      false
    );
    this.name = 'DiskSpaceError';
    this.required = required;
    this.available = available;
  }
}

class ExtractionError extends InstallerError {
  constructor(message) {
    super(message, 'EXTRACTION_FAILED', true);
    this.name = 'ExtractionError';
  }
}

class VerificationError extends InstallerError {
  constructor(missing, corrupted) {
    const details = [];
    if (missing.length) details.push(`Missing: ${missing.join(', ')}`);
    if (corrupted.length) details.push(`Corrupted: ${corrupted.join(', ')}`);

    super(`Model verification failed: ${details.join('; ')}`, 'VERIFICATION_FAILED', true);
    this.name = 'VerificationError';
    this.missing = missing;
    this.corrupted = corrupted;
  }
}
```

### 9.2 Error Recovery Strategies

| Error Type          | Strategy                               | User Action            |
| ------------------- | -------------------------------------- | ---------------------- |
| Network Error       | Auto-retry 3x with exponential backoff | "Retry" button         |
| Disk Space          | Block installation                     | "Free space and retry" |
| Extraction Failed   | Delete partial files, prompt retry     | "Retry" button         |
| Verification Failed | Prompt re-download                     | "Repair" button        |
| Permission Denied   | Show path, request manual action       | Instructions           |
| Timeout             | Increase timeout, retry                | "Retry" button         |

### 9.3 Cleanup on Failure

```javascript
/**
 * Clean up partial installation on failure
 */
async function cleanupFailedInstall(modelSize) {
  const tempDir = path.join(os.tmpdir(), 'stickynotes-whisper');
  const modelDir = getWhisperModelPath(modelSize);

  // Remove temp files
  try {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  } catch (e) {
    console.warn('Failed to clean temp dir:', e.message);
  }

  // Remove partial model installation
  try {
    const verification = await verifyModel(modelSize);
    if (!verification.valid) {
      await fs.promises.rm(modelDir, { recursive: true, force: true });
    }
  } catch (e) {
    console.warn('Failed to clean model dir:', e.message);
  }
}
```

### 9.4 Retry Logic

```javascript
/**
 * Retry wrapper with exponential backoff
 */
async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    retryOn = (error) => error instanceof NetworkError,
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!retryOn(error) || attempt === maxRetries) {
        throw error;
      }

      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * backoffFactor, maxDelay);
    }
  }

  throw lastError;
}
```

---

## 10. Platform Considerations

### 10.1 Library Path Configuration

**macOS (x64 Intel)**

```javascript
process.env.DYLD_LIBRARY_PATH = [
  path.join(__dirname, 'node_modules/sherpa-onnx-darwin-x64'),
  process.env.DYLD_LIBRARY_PATH || '',
]
  .filter(Boolean)
  .join(':');
```

**macOS (ARM64 Apple Silicon)**

```javascript
process.env.DYLD_LIBRARY_PATH = [
  path.join(__dirname, 'node_modules/sherpa-onnx-darwin-arm64'),
  process.env.DYLD_LIBRARY_PATH || '',
]
  .filter(Boolean)
  .join(':');
```

**Linux (x64)**

```javascript
process.env.LD_LIBRARY_PATH = [
  path.join(__dirname, 'node_modules/sherpa-onnx-linux-x64'),
  process.env.LD_LIBRARY_PATH || '',
]
  .filter(Boolean)
  .join(':');
```

**Windows**
No additional library path configuration needed.

### 10.2 Platform Detection

```javascript
/**
 * Get platform-specific configuration
 */
function getPlatformConfig() {
  const platform = process.platform;
  const arch = process.arch;

  const configs = {
    'win32-x64': {
      libraryPath: null, // Not needed
      archiveFormat: 'tar.bz2',
      pathSeparator: ';',
    },
    'darwin-x64': {
      libraryPath: 'DYLD_LIBRARY_PATH',
      packageName: 'sherpa-onnx-darwin-x64',
      archiveFormat: 'tar.bz2',
      pathSeparator: ':',
    },
    'darwin-arm64': {
      libraryPath: 'DYLD_LIBRARY_PATH',
      packageName: 'sherpa-onnx-darwin-arm64',
      archiveFormat: 'tar.bz2',
      pathSeparator: ':',
    },
    'linux-x64': {
      libraryPath: 'LD_LIBRARY_PATH',
      packageName: 'sherpa-onnx-linux-x64',
      archiveFormat: 'tar.bz2',
      pathSeparator: ':',
    },
    'linux-arm64': {
      libraryPath: 'LD_LIBRARY_PATH',
      packageName: 'sherpa-onnx-linux-arm64',
      archiveFormat: 'tar.bz2',
      pathSeparator: ':',
    },
  };

  const key = `${platform}-${arch}`;
  const config = configs[key];

  if (!config) {
    throw new Error(`Unsupported platform: ${key}`);
  }

  return config;
}
```

### 10.3 Startup Library Path Setup

**File**: `electron/main.js` (add near top)

```javascript
/**
 * Configure sherpa-onnx library paths before loading
 */
function setupSherpaLibraryPath() {
  try {
    const config = require('./whisper/sherpa-model-manager').getPlatformConfig();

    if (config.libraryPath) {
      const packagePath = path.join(__dirname, '..', 'node_modules', config.packageName);

      if (fs.existsSync(packagePath)) {
        const currentPath = process.env[config.libraryPath] || '';
        process.env[config.libraryPath] = [packagePath, currentPath]
          .filter(Boolean)
          .join(config.pathSeparator);

        console.log(`Set ${config.libraryPath} to include sherpa-onnx libraries`);
      }
    }
  } catch (error) {
    console.warn('Failed to setup sherpa library path:', error.message);
  }
}

// Call before app.whenReady()
setupSherpaLibraryPath();
```

### 10.4 Archive Extraction (tar.bz2)

```javascript
const decompress = require('decompress');
const decompressTarbz2 = require('decompress-tarbz2');

/**
 * Extract tar.bz2 archive cross-platform
 */
async function extractTarBz2(archivePath, destPath) {
  await fs.promises.mkdir(destPath, { recursive: true });

  const files = await decompress(archivePath, destPath, {
    plugins: [decompressTarbz2()],
    strip: 1, // Remove top-level directory (e.g., sherpa-onnx-whisper-tiny.en/)
    filter: (file) => {
      // Only extract required files
      return file.path.endsWith('.onnx') || file.path.endsWith('.txt');
    },
  });

  // Rename files to standard names
  await renameModelFiles(destPath);

  return files.map((f) => f.path);
}

/**
 * Rename model files to consistent naming
 * Archives contain: tiny.en-encoder.int8.onnx
 * We want: encoder.int8.onnx
 */
async function renameModelFiles(modelDir) {
  const files = await fs.promises.readdir(modelDir);

  for (const file of files) {
    // Match pattern: {model}-{type}.{ext}
    const match = file.match(/^[\w.]+-(encoder|decoder|tokens)\.(int8\.onnx|txt)$/);
    if (match) {
      const newName = `${match[1]}.${match[2]}`;
      await fs.promises.rename(path.join(modelDir, file), path.join(modelDir, newName));
    }
  }
}
```

---

## 11. Security Considerations

### 11.1 Download Security

```javascript
/**
 * Verify download is from trusted source
 */
function isValidDownloadUrl(url) {
  const trustedHosts = [
    'github.com',
    'objects.githubusercontent.com', // GitHub releases CDN
    'github-releases.githubusercontent.com',
  ];

  try {
    const parsed = new URL(url);
    return trustedHosts.includes(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Verify GitHub release download
 */
async function downloadFromGitHub(url, destPath, onProgress) {
  if (!isValidDownloadUrl(url)) {
    throw new Error('Untrusted download URL');
  }

  return downloadFile(url, destPath, onProgress);
}
```

### 11.2 File Integrity

```javascript
const crypto = require('crypto');

/**
 * Calculate SHA256 checksum of file
 */
async function calculateChecksum(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Verify file checksum
 */
async function verifyChecksum(filePath, expectedChecksum) {
  const actualChecksum = await calculateChecksum(filePath);
  return actualChecksum === expectedChecksum;
}
```

### 11.3 Path Traversal Prevention

```javascript
/**
 * Sanitize extracted file paths
 */
function sanitizePath(basePath, filePath) {
  const resolved = path.resolve(basePath, filePath);

  // Ensure resolved path is within base path
  if (!resolved.startsWith(path.resolve(basePath))) {
    throw new Error(`Path traversal detected: ${filePath}`);
  }

  return resolved;
}
```

---

## 12. Testing Strategy

### 12.1 Unit Tests

**File**: `test/unit/whisper/sherpa-model-manager.test.js`

```javascript
const { describe, it, expect, beforeEach, afterEach, jest } = require('@jest/globals');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Mock the paths module
jest.mock('../../../shared/utils/paths', () => ({
  getAppDataPath: () => path.join(os.tmpdir(), 'stickynotes-test'),
  ensureDir: jest.fn(),
}));

const sherpaModelManager = require('../../../electron/whisper/sherpa-model-manager');

describe('SherpaModelManager', () => {
  let testDir;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `stickynotes-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('getInstallStatus', () => {
    it('returns not installed when no models exist', async () => {
      const status = await sherpaModelManager.getInstallStatus();

      expect(status.vadInstalled).toBe(false);
      expect(status.whisperModels['tiny.en'].installed).toBe(false);
    });

    it('detects installed VAD', async () => {
      // Create mock VAD file
      const vadPath = sherpaModelManager.getVADPath();
      await fs.mkdir(path.dirname(vadPath), { recursive: true });
      await fs.writeFile(vadPath, 'mock vad content');

      const status = await sherpaModelManager.getInstallStatus();

      expect(status.vadInstalled).toBe(true);
      expect(status.vadPath).toBe(vadPath);
    });
  });

  describe('verifyModel', () => {
    it('reports missing files', async () => {
      const result = await sherpaModelManager.verifyModel('tiny.en');

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('encoder');
      expect(result.missing).toContain('decoder');
      expect(result.missing).toContain('tokens');
    });

    it('validates complete installation', async () => {
      const modelPath = sherpaModelManager.getWhisperModelPath('tiny.en');
      await fs.mkdir(modelPath, { recursive: true });

      // Create mock model files
      await fs.writeFile(path.join(modelPath, 'encoder.int8.onnx'), Buffer.alloc(1000));
      await fs.writeFile(path.join(modelPath, 'decoder.int8.onnx'), Buffer.alloc(1000));
      await fs.writeFile(path.join(modelPath, 'tokens.txt'), 'token list');

      const result = await sherpaModelManager.verifyModel('tiny.en');

      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
      expect(result.corrupted).toHaveLength(0);
    });
  });

  describe('checkDiskSpace', () => {
    it('returns sufficient for small requirements', async () => {
      const result = await sherpaModelManager.checkDiskSpace(1024); // 1KB

      expect(result.sufficient).toBe(true);
      expect(result.available).toBeGreaterThan(result.required);
    });
  });

  describe('extractTarBz2', () => {
    it('extracts archive correctly', async () => {
      // This test requires a real test archive
      // Skip in CI if no test fixtures
    });
  });
});
```

### 12.2 Integration Tests

```javascript
describe('Whisper Installer Integration', () => {
  describe('Full Installation Flow', () => {
    it('downloads and installs VAD + model', async () => {
      // Mock network to use local fixtures
      // Run full installation
      // Verify all files present
      // Verify can load with sherpa-onnx-node
    });

    it('handles network interruption gracefully', async () => {
      // Mock network failure mid-download
      // Verify cleanup
      // Verify retry works
    });

    it('handles disk space exhaustion', async () => {
      // Mock disk full
      // Verify appropriate error
      // Verify no partial files
    });
  });
});
```

### 12.3 E2E Tests

```javascript
describe('Whisper Installer E2E', () => {
  it('user can install model from Settings', async () => {
    // Open settings window
    // Navigate to Transcription section
    // Select model size
    // Click Install
    // Verify progress updates
    // Verify completion message
    // Verify status shows installed
  });

  it('user can uninstall and reinstall', async () => {
    // With model installed
    // Click Uninstall
    // Confirm dialog
    // Verify status shows not installed
    // Install again
    // Verify works
  });
});
```

---

## 13. Architecture Decision Records

### ADR-001: Use sherpa-onnx-node instead of whisper.cpp

**Status**: Accepted

**Context**: Need local speech-to-text without external dependencies or compilation.

**Decision**: Use `sherpa-onnx-node` npm package with Whisper ONNX models.

**Rationale**:

- Pre-built binaries for all platforms
- No C++ compiler required
- Includes VAD for better UX
- Active maintenance by k2-fsa team
- Consistent API across platforms

**Consequences**:

- (+) Simple npm install
- (+) Cross-platform support out of box
- (-) Larger bundle size (~50MB for native modules)
- (-) Only CPU inference (no GPU)

---

### ADR-002: tar.bz2 extraction via decompress package

**Status**: Accepted

**Context**: GitHub releases use tar.bz2 format for model archives.

**Decision**: Use `decompress` + `decompress-tarbz2` npm packages.

**Rationale**:

- Pure JavaScript implementation
- No native dependencies
- Works on all platforms
- Simple API

**Alternatives Considered**:

1. `tar-stream` + `unbzip2-stream`: More manual, requires stream piping
2. Shell commands: Not portable across platforms
3. `node-tar`: Doesn't support bz2

**Consequences**:

- (+) Simple, portable
- (-) Slightly slower than native tar

---

### ADR-003: Store models in AppData/sherpa-onnx directory

**Status**: Accepted

**Context**: Need to store ~400MB+ of model files persistently.

**Decision**: Use `{AppData}/StickyNotes/sherpa-onnx/` with subdirectories for VAD and each Whisper model.

**Rationale**:

- Follows platform conventions
- Separate from whisper.cpp models (migration)
- Easy to find for users
- Survives app updates

**Consequences**:

- (+) Clean separation from old system
- (+) Easy migration path
- (-) Users manually deleting old models directory doesn't affect new

---

### ADR-004: Progress reporting via IPC events

**Status**: Accepted

**Context**: Need real-time progress during multi-minute downloads.

**Decision**: Use IPC `sender.send()` for progress events, `ipcRenderer.on()` for listening.

**Rationale**:

- Non-blocking
- Supports multiple listeners
- Can be easily cleaned up
- Matches Electron patterns

**Alternatives Considered**:

1. Polling: Wasteful, poor UX
2. Streaming response: More complex
3. WebSocket: Overkill

---

### ADR-005: English-only models for initial release

**Status**: Accepted

**Context**: Full Whisper has multilingual models but significantly larger.

**Decision**: Offer only `.en` (English-only) models initially.

**Rationale**:

- Smaller download sizes
- Faster inference
- Better English accuracy
- Covers primary user base

**Future**:

- Add multilingual models as option
- Keep English as default

---

## Appendix A: npm Dependencies

```json
{
  "dependencies": {
    "sherpa-onnx-node": "^1.10.0",
    "decompress": "^4.2.1",
    "decompress-tarbz2": "^4.1.1"
  }
}
```

## Appendix B: Model URLs Reference

| Model    | URL                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------- |
| VAD      | https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx                      |
| tiny.en  | https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-tiny.en.tar.bz2  |
| base.en  | https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-base.en.tar.bz2  |
| small.en | https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-small.en.tar.bz2 |

## Appendix C: File Size Reference

| Component        | Compressed | Extracted |
| ---------------- | ---------- | --------- |
| Silero VAD       | 2 MB       | 2 MB      |
| Whisper tiny.en  | 40 MB      | 117 MB    |
| Whisper base.en  | 55 MB      | 160 MB    |
| Whisper small.en | 140 MB     | 400 MB    |

---

_Document generated by System Architecture Designer_
_For questions or updates, refer to the StickyNotes development team_
