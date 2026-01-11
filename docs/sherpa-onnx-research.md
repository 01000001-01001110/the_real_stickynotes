# Sherpa-ONNX Deep Research Report

**Date**: 2026-01-10
**Purpose**: Integration into Electron application for local speech-to-text

---

## Executive Summary

Sherpa-ONNX is a comprehensive, production-ready speech processing framework from the Next-gen Kaldi team (k2-fsa). It provides offline speech-to-text using ONNX Runtime with **Node.js support via `sherpa-onnx-node` npm package**.

**Key Findings:**

- Full Node.js native addon support with multi-threading
- Pre-built binaries for Windows/Mac/Linux (x64 and ARM64)
- Whisper models available in ONNX format (non-streaming only)
- Built-in VAD (Silero VAD) for speech segmentation
- 16kHz sample rate required
- **CRITICAL**: Whisper is non-streaming; use VAD + Whisper for real-time experience

---

## 1. Node.js Integration

### Installation

```bash
npm install sherpa-onnx-node
```

**Requirements:**

- Node.js >= 16 (v18+ recommended)
- No C/C++ compiler needed
- No Python needed
- Pre-built binaries included

### Platform Library Paths

**macOS (x64):**

```bash
export DYLD_LIBRARY_PATH=$PWD/node_modules/sherpa-onnx-darwin-x64:$DYLD_LIBRARY_PATH
```

**macOS (ARM64):**

```bash
export DYLD_LIBRARY_PATH=$PWD/node_modules/sherpa-onnx-darwin-arm64:$DYLD_LIBRARY_PATH
```

**Linux (x64):**

```bash
export LD_LIBRARY_PATH=$PWD/node_modules/sherpa-onnx-linux-x64:$LD_LIBRARY_PATH
```

**Windows:** No additional setup needed.

### Core API

```javascript
// Main exports
createOfflineRecognizer(config); // For Whisper (non-streaming)
createOnlineRecognizer(config); // For streaming models (NOT Whisper)
createVoiceActivityDetector(config, bufferSize); // Silero VAD
readWave(filename); // Utility
```

### OfflineRecognizer Config (for Whisper)

```javascript
const config = {
  featConfig: {
    sampleRate: 16000,
    featureDim: 80,
  },
  modelConfig: {
    whisper: {
      encoder: 'path/to/encoder.onnx',
      decoder: 'path/to/decoder.onnx',
      language: 'en',
      task: 'transcribe',
      tailPaddings: -1,
    },
    tokens: 'path/to/tokens.txt',
    numThreads: 4,
    provider: 'cpu',
    debug: 0,
  },
  decodingMethod: 'greedy_search',
  maxActivePaths: 4,
};
```

### VAD Config (Silero)

```javascript
const vadConfig = {
  sileroVad: {
    model: 'path/to/silero_vad.onnx',
    threshold: 0.5,
    minSilenceDuration: 0.25,
    minSpeechDuration: 0.25,
    maxSpeechDuration: 5.0,
    windowSize: 512,
  },
  sampleRate: 16000,
  numThreads: 1,
  debug: 0,
  provider: 'cpu',
};
```

---

## 2. Models

### Whisper Models (ONNX Format)

| Model     | Size (INT8) | Languages    | Use Case                  |
| --------- | ----------- | ------------ | ------------------------- |
| tiny.en   | ~117 MB     | English      | Fast, lower accuracy      |
| base.en   | ~160 MB     | English      | Good balance              |
| small.en  | ~400 MB     | English      | Very good accuracy        |
| medium.en | ~1 GB       | English      | High accuracy             |
| tiny      | ~117 MB     | Multilingual | Fast multilingual         |
| base      | ~160 MB     | Multilingual | Good multilingual         |
| small     | ~400 MB     | Multilingual | Best multilingual balance |

### Download URLs

```
https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-{model}.tar.bz2
```

Examples:

- `sherpa-onnx-whisper-tiny.en.tar.bz2`
- `sherpa-onnx-whisper-small.en.tar.bz2`
- `sherpa-onnx-whisper-base.tar.bz2` (multilingual)

### Model File Structure

```
sherpa-onnx-whisper-{model}/
├── {model}-encoder.int8.onnx   # Quantized encoder
├── {model}-decoder.int8.onnx   # Quantized decoder
├── {model}-tokens.txt          # Vocabulary
└── test_wavs/                  # Sample files
```

### VAD Model

```
https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx
```

Size: ~2 MB

---

## 3. Platform Support

| Platform | Architecture     | Status       |
| -------- | ---------------- | ------------ |
| Windows  | x64              | Full Support |
| macOS    | x64 (Intel)      | Full Support |
| macOS    | ARM64 (M1/M2/M3) | Full Support |
| Linux    | x64              | Full Support |
| Linux    | ARM64            | Full Support |

GPU: CUDA available for Linux/Windows x64 only.

---

## 4. Audio Requirements

- **Sample Rate**: 16000 Hz (required)
- **Format**: Float32 PCM (samples in [-1, 1])
- **VAD Window**: 512 samples (32ms at 16kHz)

---

## 5. Architecture for Electron

```
Renderer Process (Audio Capture)
         │
         ▼ Float32Array via IPC
Main Process
    ├── Silero VAD (detect speech segments)
    │        │
    │        ▼ speech segments
    └── Whisper (transcribe segment)
              │
              ▼ text via IPC
Renderer Process (UI Update)
```

**Why VAD + Whisper:**

- Whisper is NOT streaming (processes complete audio)
- VAD detects when speech ends
- Send speech segment to Whisper for transcription
- Gives pseudo-real-time experience (text appears after pauses)

---

## 6. Example Code

```javascript
const sherpa = require('sherpa-onnx-node');

class Transcriber {
  constructor(modelPath) {
    // Initialize VAD
    this.vad = sherpa.createVoiceActivityDetector(
      {
        sileroVad: {
          model: `${modelPath}/silero_vad.onnx`,
          threshold: 0.5,
          minSilenceDuration: 0.25,
          minSpeechDuration: 0.25,
          maxSpeechDuration: 5.0,
          windowSize: 512,
        },
        sampleRate: 16000,
        numThreads: 1,
        provider: 'cpu',
      },
      30.0
    );

    // Initialize Whisper
    this.recognizer = sherpa.createOfflineRecognizer({
      featConfig: { sampleRate: 16000, featureDim: 80 },
      modelConfig: {
        whisper: {
          encoder: `${modelPath}/small.en-encoder.int8.onnx`,
          decoder: `${modelPath}/small.en-decoder.int8.onnx`,
          language: 'en',
          task: 'transcribe',
          tailPaddings: -1,
        },
        tokens: `${modelPath}/small.en-tokens.txt`,
        numThreads: 4,
        provider: 'cpu',
      },
      decodingMethod: 'greedy_search',
    });
  }

  feedAudio(samples) {
    this.vad.acceptWaveform(samples);

    const results = [];
    while (!this.vad.isEmpty()) {
      const segment = this.vad.front();
      this.vad.pop();

      const stream = this.recognizer.createStream();
      stream.acceptWaveform(16000, segment.samples);
      this.recognizer.decode(stream);

      const result = this.recognizer.getResult(stream);
      if (result.text.trim()) {
        results.push(result.text.trim());
      }
    }
    return results;
  }

  flush() {
    this.vad.flush();
    return this.feedAudio(new Float32Array(0));
  }
}

module.exports = Transcriber;
```

---

## 7. Settings Mapping (Current → New)

| Current Setting       | Sherpa-ONNX Equivalent                          |
| --------------------- | ----------------------------------------------- |
| whisper.enabled       | Keep as-is                                      |
| whisper.modelSize     | Map: tiny→tiny.en, base→base.en, small→small.en |
| whisper.language      | Keep (en, zh, etc.)                             |
| whisper.insertMode    | Keep (UI only, not model config)                |
| whisper.defaultSource | Keep (audio capture, not model)                 |
| whisper.chunkDuration | **REMOVE** - VAD handles segmentation now       |

### New Settings Needed

```javascript
'whisper.vadThreshold': {
  type: 'number',
  default: 0.5,
  min: 0.1,
  max: 0.9,
  description: 'Voice activity detection sensitivity'
},
'whisper.numThreads': {
  type: 'number',
  default: 4,
  min: 1,
  max: 8,
  description: 'CPU threads for transcription'
}
```

---

## 8. Implementation Checklist

- [ ] Add sherpa-onnx-node dependency
- [ ] Create model download manager (GitHub releases)
- [ ] Create Silero VAD service
- [ ] Create Whisper transcription service
- [ ] Update IPC handlers
- [ ] Update settings schema
- [ ] Create installer UI in settings
- [ ] Update audio capture (ensure 16kHz Float32)
- [ ] Remove old whisper-node dependency
- [ ] Write tests

---

## Sources

- [GitHub - k2-fsa/sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx)
- [Node.js Examples](https://github.com/k2-fsa/sherpa-onnx/tree/master/nodejs-addon-examples)
- [Whisper Models](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/whisper/index.html)
- [Model Releases](https://github.com/k2-fsa/sherpa-onnx/releases/tag/asr-models)
