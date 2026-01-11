/**
 * Image Viewer Window Script
 * Features: Zoom, Rotate, Draw, Undo (up to 5), Save
 */

// State
let imageSrc = null;
let zoom = 100;
let rotation = 0;
let isDrawingMode = false;
let isEraserMode = false;
let isDrawing = false;
let lastX = 0;
let lastY = 0;

// Undo history (max 5 states)
const MAX_UNDO = 5;
let undoStack = [];

// DOM Elements
const viewerContainer = document.getElementById('viewerContainer');
const canvasWrapper = document.getElementById('canvasWrapper');
const imageCanvas = document.getElementById('imageCanvas');
const drawingCanvas = document.getElementById('drawingCanvas');
const imageCtx = imageCanvas.getContext('2d');
const drawingCtx = drawingCanvas.getContext('2d');

// Toolbar elements
const zoomDisplay = document.getElementById('zoomDisplay');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const zoomFitBtn = document.getElementById('zoomFitBtn');
const rotateLeftBtn = document.getElementById('rotateLeftBtn');
const rotateRightBtn = document.getElementById('rotateRightBtn');
const drawBtn = document.getElementById('drawBtn');
const drawColor = document.getElementById('drawColor');
const brushSize = document.getElementById('brushSize');
const eraserBtn = document.getElementById('eraserBtn');
const undoBtn = document.getElementById('undoBtn');
const undoCount = document.getElementById('undoCount');
const clearDrawingBtn = document.getElementById('clearDrawingBtn');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');

// Title bar buttons
const minimizeBtn = document.getElementById('minimizeBtn');
const maximizeBtn = document.getElementById('maximizeBtn');
const closeBtn = document.getElementById('closeBtn');

// Status elements
const imageInfo = document.getElementById('imageInfo');
const drawingStatus = document.getElementById('drawingStatus');

// Image object
let img = new Image();

/**
 * Initialize the viewer
 */
async function init() {
  // Apply theme
  await applyTheme();
  
  // Get image data from main process
  imageSrc = await window.api.getImageData();
  
  if (!imageSrc) {
    imageInfo.textContent = 'No image data';
    return;
  }
  
  // Load the image
  img.onload = () => {
    setupCanvas();
    fitToWindow();
    updateImageInfo();
  };
  
  img.onerror = () => {
    imageInfo.textContent = 'Failed to load image';
  };
  
  img.src = imageSrc;
  
  setupEventListeners();
}

/**
 * Apply theme
 */
async function applyTheme() {
  try {
    const theme = await window.api.getSetting('appearance.theme');
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme || 'light');
    }
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
}

/**
 * Setup canvas with image
 */
function setupCanvas() {
  // Set canvas sizes to match image
  imageCanvas.width = img.width;
  imageCanvas.height = img.height;
  drawingCanvas.width = img.width;
  drawingCanvas.height = img.height;
  
  // Draw image
  imageCtx.drawImage(img, 0, 0);
  
  // Setup drawing context
  drawingCtx.lineCap = 'round';
  drawingCtx.lineJoin = 'round';
}

/**
 * Update canvas transform (zoom + rotation)
 */
function updateTransform() {
  canvasWrapper.style.transform = `scale(${zoom / 100}) rotate(${rotation}deg)`;
  zoomDisplay.textContent = `${zoom}%`;
}

/**
 * Fit image to window
 */
function fitToWindow() {
  const containerRect = viewerContainer.getBoundingClientRect();
  const padding = 40;
  
  const scaleX = (containerRect.width - padding) / img.width;
  const scaleY = (containerRect.height - padding) / img.height;
  
  zoom = Math.min(scaleX, scaleY, 1) * 100;
  zoom = Math.round(zoom);
  
  updateTransform();
}

/**
 * Update image info in status bar
 */
function updateImageInfo() {
  imageInfo.textContent = `${img.width} x ${img.height} px`;
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Title bar
  minimizeBtn.addEventListener('click', () => window.api.minimize());
  maximizeBtn.addEventListener('click', () => window.api.maximize());
  closeBtn.addEventListener('click', () => window.api.close());
  
  // Zoom controls
  zoomInBtn.addEventListener('click', () => zoomIn());
  zoomOutBtn.addEventListener('click', () => zoomOut());
  zoomFitBtn.addEventListener('click', () => fitToWindow());
  
  // Rotation
  rotateLeftBtn.addEventListener('click', () => rotate(-90));
  rotateRightBtn.addEventListener('click', () => rotate(90));
  
  // Drawing mode
  drawBtn.addEventListener('click', toggleDrawMode);
  eraserBtn.addEventListener('click', toggleEraserMode);
  
  // Undo
  undoBtn.addEventListener('click', undo);
  
  // Clear drawing
  clearDrawingBtn.addEventListener('click', clearDrawing);
  
  // Save
  saveBtn.addEventListener('click', saveImage);
  
  // Reset
  resetBtn.addEventListener('click', resetView);
  
  // Drawing events
  drawingCanvas.addEventListener('mousedown', startDrawing);
  drawingCanvas.addEventListener('mousemove', draw);
  drawingCanvas.addEventListener('mouseup', stopDrawing);
  drawingCanvas.addEventListener('mouseout', stopDrawing);
  
  // Mouse wheel zoom
  viewerContainer.addEventListener('wheel', handleWheel);
  
  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeydown);
}

/**
 * Zoom in
 */
function zoomIn() {
  if (zoom < 500) {
    zoom = Math.min(zoom + 25, 500);
    updateTransform();
  }
}

/**
 * Zoom out
 */
function zoomOut() {
  if (zoom > 10) {
    zoom = Math.max(zoom - 25, 10);
    updateTransform();
  }
}

/**
 * Rotate image
 */
function rotate(degrees) {
  rotation = (rotation + degrees) % 360;
  updateTransform();
}

/**
 * Toggle drawing mode
 */
function toggleDrawMode() {
  isDrawingMode = !isDrawingMode;
  isEraserMode = false;
  
  drawBtn.classList.toggle('active', isDrawingMode);
  eraserBtn.classList.remove('active');
  
  updateDrawingStatus();
}

/**
 * Toggle eraser mode
 */
function toggleEraserMode() {
  isEraserMode = !isEraserMode;
  isDrawingMode = isEraserMode;
  
  eraserBtn.classList.toggle('active', isEraserMode);
  drawBtn.classList.remove('active');
  
  updateDrawingStatus();
}

/**
 * Update drawing status display
 */
function updateDrawingStatus() {
  if (isEraserMode) {
    drawingStatus.textContent = 'Eraser Mode';
    drawingCanvas.style.cursor = 'cell';
  } else if (isDrawingMode) {
    drawingStatus.textContent = 'Draw Mode';
    drawingCanvas.style.cursor = 'crosshair';
  } else {
    drawingStatus.textContent = '';
    drawingCanvas.style.cursor = 'default';
  }
}

/**
 * Start drawing
 */
function startDrawing(e) {
  if (!isDrawingMode) return;
  
  isDrawing = true;
  
  // Save state for undo before drawing
  saveUndoState();
  
  const rect = drawingCanvas.getBoundingClientRect();
  const scaleX = drawingCanvas.width / rect.width;
  const scaleY = drawingCanvas.height / rect.height;
  
  lastX = (e.clientX - rect.left) * scaleX;
  lastY = (e.clientY - rect.top) * scaleY;
}

/**
 * Draw on canvas
 */
function draw(e) {
  if (!isDrawing || !isDrawingMode) return;
  
  const rect = drawingCanvas.getBoundingClientRect();
  const scaleX = drawingCanvas.width / rect.width;
  const scaleY = drawingCanvas.height / rect.height;
  
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;
  
  drawingCtx.beginPath();
  
  if (isEraserMode) {
    // Eraser - use destination-out composite
    drawingCtx.globalCompositeOperation = 'destination-out';
    drawingCtx.lineWidth = parseInt(brushSize.value) * 3;
  } else {
    // Normal drawing
    drawingCtx.globalCompositeOperation = 'source-over';
    drawingCtx.strokeStyle = drawColor.value;
    drawingCtx.lineWidth = parseInt(brushSize.value);
  }
  
  drawingCtx.moveTo(lastX, lastY);
  drawingCtx.lineTo(x, y);
  drawingCtx.stroke();
  
  lastX = x;
  lastY = y;
}

/**
 * Stop drawing
 */
function stopDrawing() {
  isDrawing = false;
}

/**
 * Save current drawing state for undo
 */
function saveUndoState() {
  // Get current canvas state
  const state = drawingCtx.getImageData(0, 0, drawingCanvas.width, drawingCanvas.height);
  
  // Add to stack
  undoStack.push(state);
  
  // Limit to MAX_UNDO
  if (undoStack.length > MAX_UNDO) {
    undoStack.shift();
  }
  
  updateUndoButton();
}

/**
 * Undo last drawing action
 */
function undo() {
  if (undoStack.length === 0) return;
  
  // Pop the last state (current state before this action)
  const state = undoStack.pop();
  
  // Clear and restore
  drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
  drawingCtx.putImageData(state, 0, 0);
  
  updateUndoButton();
}

/**
 * Update undo button state
 */
function updateUndoButton() {
  undoBtn.disabled = undoStack.length === 0;
  undoCount.textContent = undoStack.length > 0 ? undoStack.length : '';
}

/**
 * Clear all drawing
 */
function clearDrawing() {
  if (drawingCtx.getImageData(0, 0, drawingCanvas.width, drawingCanvas.height).data.some(x => x !== 0)) {
    saveUndoState();
  }
  drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
}

/**
 * Save image with drawings
 */
async function saveImage() {
  // Create a combined canvas
  const combinedCanvas = document.createElement('canvas');
  combinedCanvas.width = img.width;
  combinedCanvas.height = img.height;
  const combinedCtx = combinedCanvas.getContext('2d');
  
  // Draw original image
  combinedCtx.drawImage(imageCanvas, 0, 0);
  
  // Draw annotations on top
  combinedCtx.drawImage(drawingCanvas, 0, 0);
  
  // Get data URL
  const dataUrl = combinedCanvas.toDataURL('image/png');
  
  // Send to main process for saving
  const saved = await window.api.saveImage(dataUrl);
  
  if (saved) {
    drawingStatus.textContent = 'Image saved!';
    setTimeout(() => updateDrawingStatus(), 2000);
  }
}

/**
 * Reset view to default
 */
function resetView() {
  rotation = 0;
  fitToWindow();
}

/**
 * Handle mouse wheel for zoom
 */
function handleWheel(e) {
  e.preventDefault();
  
  if (e.deltaY < 0) {
    zoomIn();
  } else {
    zoomOut();
  }
}

/**
 * Handle keyboard shortcuts
 */
function handleKeydown(e) {
  // Zoom shortcuts
  if (e.key === '+' || e.key === '=') {
    zoomIn();
  } else if (e.key === '-') {
    zoomOut();
  }
  
  // Undo
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    undo();
  }
  
  // Save
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveImage();
  }
  
  // Drawing mode
  if (e.key === 'd' || e.key === 'D') {
    toggleDrawMode();
  }
  
  // Eraser mode
  if (e.key === 'e' || e.key === 'E') {
    toggleEraserMode();
  }
  
  // Escape - exit drawing mode
  if (e.key === 'Escape') {
    if (isDrawingMode) {
      isDrawingMode = false;
      isEraserMode = false;
      drawBtn.classList.remove('active');
      eraserBtn.classList.remove('active');
      updateDrawingStatus();
    } else {
      window.api.close();
    }
  }
  
  // Rotate
  if (e.key === '[') {
    rotate(-90);
  } else if (e.key === ']') {
    rotate(90);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
