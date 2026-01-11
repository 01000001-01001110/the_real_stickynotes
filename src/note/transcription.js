/**
 * Transcription Manager
 * Handles audio capture using Web APIs (like Teams/Zoom)
 * and communication with the Whisper service
 */

class TranscriptionManager {
  constructor() {
    this.micStream = null;
    this.systemStream = null;
    this.mixedStream = null;
    this.audioContext = null;
    this.mediaRecorder = null;
    this.isRecording = false;
    this.audioChunks = [];
    this.onTranscription = null;
    this.onStatusChange = null;
    this.onError = null;
    this.currentSource = null;
    this.chunkInterval = null;
  }

  /**
   * Start microphone capture
   * @returns {Promise<MediaStream>}
   */
  async startMicrophone() {
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      return this.micStream;
    } catch (error) {
      if (error.name === 'NotAllowedError') {
        throw new Error('Microphone permission denied. Please allow microphone access.');
      }
      throw error;
    }
  }

  /**
   * Start system audio capture (shows share dialog like Teams)
   * @returns {Promise<MediaStream>}
   */
  async startSystemAudio() {
    try {
      this.systemStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: 1,
          height: 1,
        },
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      
      // Stop the video track since we only want audio
      const videoTracks = this.systemStream.getVideoTracks();
      videoTracks.forEach(track => track.stop());
      
      // Check if we got audio
      const audioTracks = this.systemStream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio selected. Make sure to check "Share audio" in the dialog.');
      }
      
      return this.systemStream;
    } catch (error) {
      if (error.name === 'NotAllowedError') {
        throw new Error('Screen sharing cancelled. To capture system audio, share your screen with audio enabled.');
      }
      throw error;
    }
  }

  /**
   * Mix multiple audio streams
   * @returns {MediaStream}
   */
  mixStreams() {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: 16000 });
    }
    
    const destination = this.audioContext.createMediaStreamDestination();
    
    if (this.micStream) {
      const micSource = this.audioContext.createMediaStreamSource(this.micStream);
      micSource.connect(destination);
    }
    
    if (this.systemStream) {
      const sysSource = this.audioContext.createMediaStreamSource(this.systemStream);
      sysSource.connect(destination);
    }
    
    this.mixedStream = destination.stream;
    return this.mixedStream;
  }

  /**
   * Start recording from specified source
   * @param {string} source - 'microphone', 'system', or 'both'
   * @param {object} options - Recording options
   */
  async start(source, options = {}) {
    if (this.isRecording) {
      throw new Error('Already recording');
    }

    this.currentSource = source;
    const chunkDuration = options.chunkDuration || 5000;

    try {
      this.updateStatus('starting');

      // Capture audio based on source
      if (source === 'microphone') {
        await this.startMicrophone();
        this.mixedStream = this.micStream;
      } else if (source === 'system') {
        await this.startSystemAudio();
        this.mixedStream = this.systemStream;
      } else if (source === 'both') {
        await this.startMicrophone();
        await this.startSystemAudio();
        this.mixStreams();
      }

      if (!this.mixedStream) {
        throw new Error('Failed to get audio stream');
      }

      // Setup MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.mixedStream, {
        mimeType: this.getSupportedMimeType(),
      });

      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.processAudioChunks();
      };

      // Start recording
      this.mediaRecorder.start();
      this.isRecording = true;
      this.updateStatus('recording');

      // Setup chunk processing interval
      this.chunkInterval = setInterval(() => {
        if (this.isRecording && this.mediaRecorder.state === 'recording') {
          this.mediaRecorder.stop();
          this.mediaRecorder.start();
        }
      }, chunkDuration);

    } catch (error) {
      this.cleanup();
      this.updateStatus('error');
      if (this.onError) {
        this.onError(error);
      }
      throw error;
    }
  }

  /**
   * Stop recording
   */
  stop() {
    if (!this.isRecording) return;

    this.isRecording = false;

    if (this.chunkInterval) {
      clearInterval(this.chunkInterval);
      this.chunkInterval = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    this.cleanup();
    this.updateStatus('idle');
  }

  /**
   * Process recorded audio chunks and send for transcription
   */
  async processAudioChunks() {
    if (this.audioChunks.length === 0) return;

    try {
      this.updateStatus('processing');

      // Combine chunks into a blob
      const audioBlob = new Blob(this.audioChunks, { 
        type: this.getSupportedMimeType() 
      });
      
      // Convert to array buffer
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      // Convert to PCM data for Whisper
      const pcmData = await this.convertToPCM(arrayBuffer);
      
      // Send to main process for transcription
      const result = await window.api.whisperTranscribe(Array.from(pcmData));
      
      if (result.success && result.text && this.onTranscription) {
        this.onTranscription(result.text, result.confidence);
      }

      // Clear processed chunks
      this.audioChunks = [];
      
      if (this.isRecording) {
        this.updateStatus('recording');
      }
    } catch (error) {
      console.error('Failed to process audio:', error);
      if (this.onError) {
        this.onError(error);
      }
    }
  }

  /**
   * Convert audio blob to PCM Int16 array
   * @param {ArrayBuffer} arrayBuffer - Audio data
   * @returns {Promise<Int16Array>}
   */
  async convertToPCM(arrayBuffer) {
    // Decode audio data
    const audioContext = new AudioContext({ sampleRate: 16000 });
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Get channel data (mono)
    const channelData = audioBuffer.getChannelData(0);
    
    // Resample to 16kHz if needed
    let samples = channelData;
    if (audioBuffer.sampleRate !== 16000) {
      samples = this.resample(channelData, audioBuffer.sampleRate, 16000);
    }
    
    // Convert Float32 to Int16
    const pcmData = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    audioContext.close();
    return pcmData;
  }

  /**
   * Resample audio data
   * @param {Float32Array} data - Input samples
   * @param {number} fromRate - Source sample rate
   * @param {number} toRate - Target sample rate
   * @returns {Float32Array}
   */
  resample(data, fromRate, toRate) {
    const ratio = fromRate / toRate;
    const newLength = Math.round(data.length / ratio);
    const result = new Float32Array(newLength);
    
    for (let i = 0; i < newLength; i++) {
      const srcIndex = i * ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, data.length - 1);
      const t = srcIndex - srcIndexFloor;
      result[i] = data[srcIndexFloor] * (1 - t) + data[srcIndexCeil] * t;
    }
    
    return result;
  }

  /**
   * Get supported MIME type for recording
   * @returns {string}
   */
  getSupportedMimeType() {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    
    return '';
  }

  /**
   * Cleanup streams and resources
   */
  cleanup() {
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
    
    if (this.systemStream) {
      this.systemStream.getTracks().forEach(track => track.stop());
      this.systemStream = null;
    }
    
    if (this.mixedStream) {
      this.mixedStream.getTracks().forEach(track => track.stop());
      this.mixedStream = null;
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.mediaRecorder = null;
    this.audioChunks = [];
  }

  /**
   * Update status and call callback
   * @param {string} status
   */
  updateStatus(status) {
    if (this.onStatusChange) {
      this.onStatusChange(status);
    }
  }

  /**
   * Check if recording is active
   * @returns {boolean}
   */
  isActive() {
    return this.isRecording;
  }

  /**
   * Get current source being recorded
   * @returns {string|null}
   */
  getSource() {
    return this.currentSource;
  }
}

// Export for use in note.js
window.TranscriptionManager = TranscriptionManager;
