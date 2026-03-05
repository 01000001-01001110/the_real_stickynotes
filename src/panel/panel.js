/**
 * Panel Script
 */

// Platform detection - add class for platform-specific CSS
if (window.api && window.api.getPlatform && window.api.getPlatform() === 'darwin') {
  document.body.classList.add('platform-darwin');
}

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
// folderTree element reserved for future folder tree UI enhancements
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
  try {
    await Promise.all([loadNotes(), loadFolders(), loadTags()]);
  } catch (error) {
    console.error('Failed to load data:', error);
    // Continue with partial data - individual loaders handle their own errors
  }
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
    const noteIds = notes.map((n) => n.id);
    const tagsMap = await api.getTagsForNotes(noteIds);
    notes = notes.filter((note) => {
      const noteTags = tagsMap[note.id] || [];
      return noteTags.some((t) => t.name === currentTag);
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
  // Clean up any orphaned tags before loading
  await api.cleanupOrphanedTags();

  const allTags = await api.getTags({ withCounts: true });
  // Only show tags that have at least one active note (defensive filter)
  tags = allTags.filter((tag) => tag.note_count > 0);
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

  // Render each note with error handling to prevent one bad note from breaking the list
  const noteCards = notes
    .map((note) => {
      try {
        return createNoteCard(note);
      } catch (error) {
        console.error(`[Panel] Error rendering note ${note.id}:`, error);
        console.error('[Panel] Error stack:', error.stack);
        // Return a fallback card for broken notes
        return `<div class="note-card note-theme-yellow" data-id="${note.id}">
        <div class="note-card-header">
          <span class="note-card-title">${escapeHtml(note.title || 'Untitled')}</span>
        </div>
        <div class="note-card-content"><span style="color: red;">[Error rendering note]</span></div>
      </div>`;
      }
    })
    .join('');

  tempDiv.innerHTML = noteCards;

  while (tempDiv.firstChild) {
    fragment.appendChild(tempDiv.firstChild);
  }

  notesGrid.appendChild(fragment);

  // Add click handlers
  notesGrid.querySelectorAll('.note-card').forEach((card) => {
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
          ${hasReminder ? '<svg class="note-indicator" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>' : ''}
          ${isLocked ? '<svg class="note-indicator" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>' : ''}
        </div>
      </div>
    </div>
  `;
}

/**
 * Sanitize HTML for preview - preserve safe formatting elements
 */
function sanitizePreviewHtml(html) {
  if (!html) {
    return '';
  }

  // Parse HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Remove dangerous elements and UI elements not needed in preview
  const dangerousElements = doc.querySelectorAll(
    'script, style, iframe, object, embed, form, .image-delete-btn'
  );
  dangerousElements.forEach((el) => el.remove());

  // Remove all event handlers and dangerous attributes
  const allElements = doc.body.querySelectorAll('*');
  allElements.forEach((el) => {
    // Remove event handlers
    Array.from(el.attributes).forEach((attr) => {
      if (
        attr.name.startsWith('on') ||
        (attr.name === 'href' && !el.classList.contains('note-link'))
      ) {
        el.removeAttribute(attr.name);
      }
    });
    // Remove contenteditable
    el.removeAttribute('contenteditable');
  });

  // Process images - only allow data: URLs
  const images = doc.querySelectorAll('img');
  images.forEach((img) => {
    if (!img.src.startsWith('data:')) {
      img.remove();
    } else {
      // Wrap in thumbnail container and limit to first image
      if (!doc.body.querySelector('.image-thumbnail')) {
        const wrapper = doc.createElement('span');
        wrapper.className = 'image-thumbnail';
        img.parentNode.insertBefore(wrapper, img);
        wrapper.appendChild(img);
      } else {
        img.remove(); // Remove additional images
      }
    }
  });

  // Convert checkboxes to preview format
  const checkboxDivs = doc.querySelectorAll('.checkbox');
  checkboxDivs.forEach((cb) => {
    const isChecked = cb.classList.contains('checked');
    const text = cb.textContent || '';
    const previewCb = doc.createElement('span');
    previewCb.className = 'preview-checkbox';
    previewCb.innerHTML = (isChecked ? '☑ ' : '☐ ') + escapeHtml(text.trim());
    cb.replaceWith(previewCb);
  });

  // Get the sanitized HTML
  let sanitizedHtml = doc.body.innerHTML;

  // Truncate if too long (by text content length)
  const textLength = doc.body.textContent.length;
  if (textLength > 150) {
    // Truncate by finding a good break point in the HTML
    // Re-parse and limit content
    const tempDoc = parser.parseFromString(sanitizedHtml, 'text/html');
    let charCount = 0;
    const truncateNode = (node) => {
      if (charCount >= 150) {
        node.remove();
        return;
      }
      if (node.nodeType === Node.TEXT_NODE) {
        const remaining = 150 - charCount;
        if (node.textContent.length > remaining) {
          node.textContent = node.textContent.substring(0, remaining) + '...';
          charCount = 150;
        } else {
          charCount += node.textContent.length;
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Process children
        Array.from(node.childNodes).forEach((child) => truncateNode(child));
      }
    };
    truncateNode(tempDoc.body);
    sanitizedHtml = tempDoc.body.innerHTML;
  }

  return sanitizedHtml;
}

/**
 * Render folders in sidebar
 */
function renderFolders() {
  folderList.innerHTML = folders
    .map(
      (folder) => `
    <button class="folder-item ${currentFolder === folder.id ? 'active' : ''}" data-folder="${folder.id}">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
      </svg>
      ${escapeHtml(folder.name)}
    </button>
  `
    )
    .join('');

  // Add click handlers
  folderList.querySelectorAll('.folder-item').forEach((item) => {
    item.addEventListener('click', () => selectFolder(item.dataset.folder));
  });

  // Update all notes button
  document.querySelector('[data-folder="all"]').classList.toggle('active', currentFolder === 'all');
}

/**
 * Render tags in sidebar
 */
function renderTags() {
  tagList.innerHTML = tags
    .map(
      (tag) => `
    <button class="tag-badge ${currentTag === tag.name ? 'active' : ''}" data-tag="${tag.name}">
      ${escapeHtml(tag.name)}
      <span>(${tag.note_count || 0})</span>
    </button>
  `
    )
    .join('');

  // Add click handlers
  tagList.querySelectorAll('.tag-badge').forEach((badge) => {
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
  searchInput.addEventListener(
    'input',
    debounce(() => {
      searchQuery = searchInput.value.trim();
      searchClear.hidden = !searchQuery;
      loadNotes();
    }, 300)
  );

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
  document
    .querySelector('[data-folder="all"]')
    .addEventListener('click', () => selectFolder('all'));

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

  // Listen for updates - consolidated refresh handler
  const refreshData = async () => {
    await loadNotes();
    await loadTags();
  };
  api.onNoteCreated(refreshData);
  api.onNoteUpdated(refreshData);
  api.onNoteDeleted(refreshData);
}

/**
 * Select a folder
 */
function selectFolder(folderId) {
  currentFolder = folderId;
  currentTag = null;

  // Update active states
  document.querySelectorAll('.folder-item').forEach((item) => {
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

  const result = await api.createNote(data);

  if (result.success && result.note) {
    await api.openNote(result.note.id);
  }

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
        const confirmed = await showConfirmModal(
          'Delete Note',
          'Are you sure you want to move this note to trash?'
        );
        if (!confirmed) break;
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
 * Show custom confirmation modal
 */
function showConfirmModal(title, message) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmTitle');
    const messageEl = document.getElementById('confirmMessage');
    const cancelBtn = document.getElementById('confirmCancelBtn');
    const okBtn = document.getElementById('confirmOkBtn');

    titleEl.textContent = title;
    messageEl.textContent = message;

    const handleClose = (result) => {
      modal.hidden = true;
      // Remove listeners to prevent memory leaks/duplicate calls
      cancelBtn.removeEventListener('click', onCancel);
      okBtn.removeEventListener('click', onOk);
      document.removeEventListener('keydown', onKey);
      resolve(result);
    };

    const onCancel = () => handleClose(false);
    const onOk = () => handleClose(true);
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onOk();
    };

    cancelBtn.addEventListener('click', onCancel);
    okBtn.addEventListener('click', onOk);
    document.addEventListener('keydown', onKey);

    modal.hidden = false;
    okBtn.focus();
  });
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
