/**
 * Panel Script
 */

// State
let notes = [];
let folders = [];
let tags = [];
let currentFolder = 'all';
let currentTag = null;
let currentFilter = 'all';
let currentSort = 'updated';
let searchQuery = '';
let contextMenuNote = null;

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchClear = document.getElementById('searchClear');
const newNoteBtn = document.getElementById('newNoteBtn');
const emptyNewNoteBtn = document.getElementById('emptyNewNoteBtn');
const settingsBtn = document.getElementById('settingsBtn');
const filterSelect = document.getElementById('filterSelect');
const sortSelect = document.getElementById('sortSelect');
const notesGrid = document.getElementById('notesGrid');
const emptyState = document.getElementById('emptyState');
const searchEmptyState = document.getElementById('searchEmptyState');
const folderTree = document.getElementById('folderTree');
const folderList = document.getElementById('folderList');
const tagList = document.getElementById('tagList');
const allNotesCount = document.getElementById('allNotesCount');
const noteCount = document.getElementById('noteCount');
const appVersion = document.getElementById('appVersion');
const noteContextMenu = document.getElementById('noteContextMenu');
const newFolderBtn = document.getElementById('newFolderBtn');

/**
 * Apply theme to document
 */
async function applyTheme(theme = null) {
  if (!theme) {
    theme = await api.getSetting('appearance.theme');
  }
  
  if (theme === 'system') {
    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', theme || 'light');
  }
}

/**
 * Initialize the panel
 */
async function init() {
  // Apply theme first
  await applyTheme();
  
  // Apply animations setting
  const enableAnimations = await api.getSetting('appearance.enableAnimations');
  document.body.classList.toggle('no-animations', enableAnimations === false);
  
  await loadData();
  setupEventListeners();
  
  // Listen for theme and other setting changes
  api.onSettingChanged((key, value) => {
    if (key === 'appearance.theme') {
      applyTheme(value);
    }
    if (key === 'appearance.enableAnimations') {
      document.body.classList.toggle('no-animations', value === false);
    }
    if (key === 'appearance.showNoteCount') {
      updateCounts();
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
  appVersion.textContent = `v${version}`;
}

/**
 * Load all data
 */
async function loadData() {
  await Promise.all([
    loadNotes(),
    loadFolders(),
    loadTags(),
  ]);
}

/**
 * Load notes
 */
async function loadNotes() {
  const options = {
    archivedOnly: currentFilter === 'archived',
    trashedOnly: currentFilter === 'trash',
    sort: currentSort,
    desc: true,
  };
  
  if (currentFolder !== 'all') {
    options.folder_id = currentFolder;
  }
  
  if (searchQuery) {
    notes = await api.searchNotes(searchQuery, options);
  } else {
    notes = await api.getNotes(options);
  }
  
  // Filter by tag if selected - use batch API for efficiency
  if (currentTag && !searchQuery && notes.length > 0) {
    const noteIds = notes.map(n => n.id);
    const tagsMap = await api.getTagsForNotes(noteIds);
    notes = notes.filter(note => {
      const noteTags = tagsMap[note.id] || [];
      return noteTags.some(t => t.name === currentTag);
    });
  }
  
  renderNotes();
  updateCounts();
}

/**
 * Load folders
 */
async function loadFolders() {
  folders = await api.getFolders();
  renderFolders();
}

/**
 * Load tags
 */
async function loadTags() {
  tags = await api.getTags({ withCounts: true });
  renderTags();
}

/**
 * Render notes grid
 */
function renderNotes() {
  // Show/hide empty states - MUST hide both first
  const hasNotes = notes.length > 0;
  const isSearching = searchQuery.length > 0;
  
  // Hide BOTH empty states first
  emptyState.hidden = true;
  searchEmptyState.hidden = true;
  
  // Only show one empty state if appropriate
  if (!hasNotes) {
    notesGrid.hidden = true;
    notesGrid.innerHTML = '';
    if (isSearching) {
      searchEmptyState.hidden = false;
    } else {
      emptyState.hidden = false;
    }
    return;
  }
  
  // Show notes grid
  notesGrid.hidden = false;
  
  // Clear and rebuild the grid
  notesGrid.innerHTML = '';
  
  // Use DocumentFragment for better performance
  const fragment = document.createDocumentFragment();
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = notes.map(note => createNoteCard(note)).join('');
  
  while (tempDiv.firstChild) {
    fragment.appendChild(tempDiv.firstChild);
  }
  
  notesGrid.appendChild(fragment);
  
  // Add click handlers
  notesGrid.querySelectorAll('.note-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.note-card-menu')) {
        openNote(card.dataset.id);
      }
    });
    
    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e, card.dataset.id);
    });
    
    const menuBtn = card.querySelector('.note-card-menu');
    menuBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      showContextMenu(e, card.dataset.id);
    });
  });
}

/**
 * Create note card HTML
 */
function createNoteCard(note) {
  const colorClass = `note-theme-${note.color || 'yellow'}`;
  const title = note.title || 'Untitled';
  const date = formatDate(note.updated_at);
  
  const hasReminder = note.reminder_at && !note.reminder_notified;
  const isPinned = note.is_pinned === 1;
  const isLocked = note.is_locked === 1;
  
  // For locked notes, show placeholder
  let previewContent = '';
  if (isLocked) {
    previewContent = '<span class="locked-preview">[LOCKED] Content is encrypted</span>';
  } else {
    // Use formatted content (HTML) for preview, sanitized
    previewContent = sanitizePreviewHtml(note.content || '');
  }
  
  return `
    <div class="note-card ${colorClass}" data-id="${note.id}">
      <div class="note-card-header">
        <span class="note-card-title">${escapeHtml(title)}</span>
        <button class="note-card-menu" title="More options">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="6" r="2"/>
            <circle cx="12" cy="12" r="2"/>
            <circle cx="12" cy="18" r="2"/>
          </svg>
        </button>
      </div>
      <div class="note-card-content">${previewContent}</div>
      <div class="note-card-footer">
        <span class="note-card-date">${date}</span>
        <div class="note-card-indicators">
          ${isPinned ? '<svg class="note-indicator" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="3"/></svg>' : ''}
          ${hasReminder ? '<svg class="note-indicator" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>' : ''}
          ${isLocked ? '<svg class="note-indicator" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>' : ''}
        </div>
      </div>
    </div>
  `;
}

/**
 * Sanitize HTML for preview - allow only safe formatting tags
 */
function sanitizePreviewHtml(html) {
  if (!html) return '';
  
  // Create a temporary element to parse HTML
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  // Count images before processing
  const imageCount = temp.querySelectorAll('img').length;
  
  // Process checkboxes to show visual representation
  temp.querySelectorAll('.checkbox').forEach(cb => {
    const input = cb.querySelector('input[type="checkbox"]');
    const checked = input?.checked ? '[x]' : '[ ]';
    const text = cb.textContent.trim();
    cb.outerHTML = `<span class="preview-checkbox">${checked} ${text}</span>`;
  });
  
  // Process code blocks
  temp.querySelectorAll('pre, code').forEach(code => {
    code.outerHTML = `<code class="preview-code">${code.textContent}</code>`;
  });
  
  // Process images - replace with thumbnail preview
  temp.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src');
    if (src && src.startsWith('data:')) {
      // For data URIs, create a small thumbnail to avoid huge HTML
      const container = img.closest('.image-container') || img.parentElement;
      const thumbnail = document.createElement('div');
      thumbnail.className = 'image-thumbnail';
      thumbnail.innerHTML = `<img src="${src}" class="preview-image" loading="lazy">`;
      if (container && container !== temp) {
        container.replaceWith(thumbnail);
      } else {
        img.replaceWith(thumbnail);
      }
    } else if (src && (src.startsWith('blob:') || src.startsWith('http'))) {
      // Keep external images but add preview class
      img.classList.add('preview-image');
      img.removeAttribute('style');
    } else {
      // Remove images with invalid/missing src
      img.remove();
    }
  });
  
  // Remove remaining image containers (empty ones)
  temp.querySelectorAll('.image-container').forEach(container => {
    if (!container.querySelector('img')) {
      container.remove();
    }
  });
  
  // Remove scripts and other dangerous elements
  temp.querySelectorAll('script, style, iframe, object, embed').forEach(el => el.remove());
  
  // Get the cleaned HTML
  let cleaned = temp.innerHTML;
  
  // Truncate if too long but no images
  if (imageCount === 0 && cleaned.length > 500) {
    cleaned = cleaned.substring(0, 500) + '...';
  }
  
  return cleaned;
}

/**
 * Render folders in sidebar
 */
function renderFolders() {
  folderList.innerHTML = folders.map(folder => `
    <button class="folder-item ${currentFolder === folder.id ? 'active' : ''}" data-folder="${folder.id}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
      </svg>
      ${escapeHtml(folder.name)}
    </button>
  `).join('');
  
  // Add click handlers
  folderList.querySelectorAll('.folder-item').forEach(item => {
    item.addEventListener('click', () => selectFolder(item.dataset.folder));
  });
  
  // Update all notes button
  document.querySelector('[data-folder="all"]').classList.toggle('active', currentFolder === 'all');
}

/**
 * Render tags in sidebar
 */
function renderTags() {
  tagList.innerHTML = tags.map(tag => `
    <button class="tag-badge ${currentTag === tag.name ? 'active' : ''}" data-tag="${tag.name}">
      ${escapeHtml(tag.name)}
      <span>(${tag.note_count || 0})</span>
    </button>
  `).join('');
  
  // Add click handlers
  tagList.querySelectorAll('.tag-badge').forEach(badge => {
    badge.addEventListener('click', () => {
      currentTag = currentTag === badge.dataset.tag ? null : badge.dataset.tag;
      renderTags();
      loadNotes();
    });
  });
}

/**
 * Update counts
 */
async function updateCounts() {
  allNotesCount.textContent = notes.length;
  
  // Check showNoteCount setting
  const showNoteCount = await api.getSetting('appearance.showNoteCount');
  if (showNoteCount === false) {
    noteCount.hidden = true;
  } else {
    noteCount.hidden = false;
    noteCount.textContent = `${notes.length} note${notes.length !== 1 ? 's' : ''}`;
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Window controls
  document.getElementById('minimizeBtn')?.addEventListener('click', () => {
    api.minimizeWindow();
  });
  
  document.getElementById('maximizeBtn')?.addEventListener('click', () => {
    api.maximizeWindow();
  });
  
  document.getElementById('closeBtn')?.addEventListener('click', () => {
    api.closeWindow();
  });
  
  // Search
  searchInput.addEventListener('input', debounce(() => {
    searchQuery = searchInput.value.trim();
    searchClear.hidden = !searchQuery;
    loadNotes();
  }, 300));
  
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    searchClear.hidden = true;
    loadNotes();
  });
  
  // New note buttons
  newNoteBtn.addEventListener('click', createNewNote);
  emptyNewNoteBtn.addEventListener('click', createNewNote);
  
  // Settings
  settingsBtn.addEventListener('click', () => {
    api.openSettings();
  });
  
  // Filter and sort
  filterSelect.addEventListener('change', () => {
    currentFilter = filterSelect.value;
    loadNotes();
  });
  
  sortSelect.addEventListener('change', () => {
    currentSort = sortSelect.value;
    loadNotes();
  });
  
  // Folder navigation
  document.querySelector('[data-folder="all"]').addEventListener('click', () => selectFolder('all'));
  
  // New folder
  newFolderBtn.addEventListener('click', async () => {
    const name = prompt('Folder name:');
    if (name) {
      await api.createFolder({ name });
      await loadFolders();
    }
  });
  
  // Context menu
  noteContextMenu.addEventListener('click', handleContextMenuAction);
  document.addEventListener('click', () => {
    noteContextMenu.hidden = true;
  });
  
  // Listen for updates
  api.onNoteCreated(async () => {
    await loadNotes();
    await loadTags();
  });
  
  api.onNoteUpdated(async () => {
    await loadNotes();
    await loadTags();
  });
  
  api.onNoteDeleted(async () => {
    await loadNotes();
    await loadTags();
  });
}

/**
 * Select a folder
 */
function selectFolder(folderId) {
  currentFolder = folderId;
  currentTag = null;
  
  // Update active states
  document.querySelectorAll('.folder-item').forEach(item => {
    item.classList.toggle('active', item.dataset.folder === folderId);
  });
  
  renderTags();
  loadNotes();
}

/**
 * Create a new note
 */
async function createNewNote() {
  const data = {};
  if (currentFolder !== 'all') {
    data.folder_id = currentFolder;
  }
  
  const note = await api.createNote(data);
  await api.openNote(note.id);
  await loadNotes();
}

/**
 * Open a note
 */
async function openNote(noteId) {
  await api.openNote(noteId);
}

/**
 * Show context menu
 */
function showContextMenu(e, noteId) {
  contextMenuNote = noteId;
  
  noteContextMenu.style.left = `${e.clientX}px`;
  noteContextMenu.style.top = `${e.clientY}px`;
  noteContextMenu.hidden = false;
  
  // Adjust position if off-screen
  const rect = noteContextMenu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    noteContextMenu.style.left = `${e.clientX - rect.width}px`;
  }
  if (rect.bottom > window.innerHeight) {
    noteContextMenu.style.top = `${e.clientY - rect.height}px`;
  }
}

/**
 * Handle context menu action
 */
async function handleContextMenuAction(e) {
  const menuItem = e.target.closest('.menu-item');
  if (!menuItem || !contextMenuNote) return;
  
  const action = menuItem.dataset.action;
  
  switch (action) {
    case 'open':
      await openNote(contextMenuNote);
      break;
    case 'duplicate': {
      await api.duplicateNote(contextMenuNote);
      await loadNotes();
      break;
    }
    case 'archive':
      await api.archiveNote(contextMenuNote);
      await loadNotes();
      break;
    case 'delete': {
      // Check confirmDelete setting
      const confirmDelete = await api.getSetting('general.confirmDelete');
      if (confirmDelete !== false) {
        if (!confirm('Move this note to trash?')) {
          break;
        }
      }
      await api.deleteNote(contextMenuNote);
      await loadNotes();
      break;
    }
  }
  
  noteContextMenu.hidden = true;
  contextMenuNote = null;
}

/**
 * Utility: Format date
 */
function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  
  return date.toLocaleDateString();
}

/**
 * Utility: Escape HTML
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Utility: Debounce
 */
function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
