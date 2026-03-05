/**
 * Note Window Script
 */

// Platform detection - add class for platform-specific CSS
if (window.api && window.api.getPlatform && window.api.getPlatform() === 'darwin') {
  document.body.classList.add('platform-darwin');
}

// CRITICAL: Catch ALL errors including those that would cause white screen
window.onerror = function (message, source, lineno, colno, error) {
  console.error('[CRITICAL ERROR CAUGHT]', {
    message,
    source,
    lineno,
    colno,
    error: error ? error.stack : 'no stack',
  });
  // Don't return true - let error propagate for debugging
  return false;
};

window.addEventListener('unhandledrejection', function (event) {
  console.error('[CRITICAL UNHANDLED REJECTION]', {
    reason: event.reason,
    promise: event.promise,
  });
});

// Global error handlers for debugging
window.addEventListener('error', (event) => {
  console.error('[Note Window] Uncaught error:', event.error);
  console.error('Error details:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
});

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
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

// State
let noteId = null;
let note = null;
let saveTimeout = null;
let lastSavedContent = '';
let lastSavedTitle = '';
let isPinned = false;
let historyInterval = null;
let lastHistorySaveContent = '';

// DOM Elements
const titleInput = document.getElementById('titleInput');
const noteEditor = document.getElementById('noteEditor');
const colorPickerBtn = document.getElementById('colorPickerBtn');
const colorPicker = document.getElementById('colorPicker');
const menuBtn = document.getElementById('menuBtn');
const contextMenu = document.getElementById('contextMenu');
const pinBtn = document.getElementById('pinBtn');
const closeBtn = document.getElementById('closeBtn');
const statusText = document.getElementById('statusText');
const wordCount = document.getElementById('wordCount');
const lockedOverlay = document.getElementById('lockedOverlay');
const passwordInput = document.getElementById('passwordInput');
const unlockBtn = document.getElementById('unlockBtn');
const editorToolbar = document.getElementById('editorToolbar');

// Dialog elements
const tagsDialog = document.getElementById('tagsDialog');
const tagInput = document.getElementById('tagInput');
const addTagBtn = document.getElementById('addTagBtn');
const tagsList = document.getElementById('tagsList');

const reminderDialog = document.getElementById('reminderDialog');
const reminderDate = document.getElementById('reminderDate');
const reminderTime = document.getElementById('reminderTime');
const setReminderBtn = document.getElementById('setReminderBtn');
const clearReminderBtn = document.getElementById('clearReminderBtn');
const reminderCurrent = document.getElementById('reminderCurrent');
const currentReminderTime = document.getElementById('currentReminderTime');

const historyDialog = document.getElementById('historyDialog');
const historyList = document.getElementById('historyList');

const closeHintDialog = document.getElementById('closeHintDialog');
const closeHintOkBtn = document.getElementById('closeHintOkBtn');

// Image viewer is now a separate window - see src/imageviewer/

/**
 * Apply theme to document
 */
async function applyTheme(theme = null) {
  if (!theme) {
    theme = await api.getSetting('appearance.theme');
  }

  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', theme || 'light');
  }
}

/**
 * Initialize the note window
 */
async function init() {
  // Apply theme first
  await applyTheme();

  noteId = await api.getCurrentNoteId();
  if (!noteId) {
    console.error('No note ID provided');
    return;
  }

  await loadNote();
  setupEventListeners();
  setupFormatting();
  setupImageHandlers(); // Handle image clicks via delegation (survives reload)
  setupNoteLinkHandlers(); // Handle [[wiki link]] clicks
  await applyEditorSettings(); // Apply spellcheck, font size, etc.
  setupHistoryAutoSave(); // Setup periodic history saving

  // Listen for theme changes
  api.onSettingChanged((key, value) => {
    if (key === 'appearance.theme') {
      applyTheme(value);
    }
    // Listen for editor setting changes
    if (
      key.startsWith('editor.') ||
      key === 'appearance.defaultFontSize' ||
      key === 'appearance.defaultFontFamily' ||
      key === 'appearance.enableAnimations'
    ) {
      applyEditorSettings();
    }
    // Update auto-save delay if changed
    if (key === 'general.autoSaveDelay') {
      window.autoSaveDelay = value || 1000;
    }
    // Restart history interval if interval changed
    if (key === 'history.saveInterval') {
      setupHistoryAutoSave();
    }
    // Update window opacity if changed (only if note doesn't have custom opacity)
    if (key === 'appearance.noteOpacity' && note && note.opacity === null) {
      api.setWindowOpacity(value / 100);
    }
  });

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
    const theme = await api.getSetting('appearance.theme');
    if (theme === 'system') {
      applyTheme('system');
    }
  });
}

/**
 * Load note data
 */
async function loadNote() {
  note = await api.getNote(noteId);
  if (!note) {
    console.error('Note not found:', noteId);
    return;
  }

  // Apply color theme
  applyColorTheme(note.color);

  // Set title
  titleInput.value = note.title || '';
  lastSavedTitle = note.title || '';

  // Check if locked
  if (note.is_locked && note.password_hash) {
    showLockedOverlay();
  } else {
    // Set content - render [[wiki links]] as clickable anchors
    const renderedContent = await api.renderLinks(note.content || '');
    noteEditor.innerHTML = renderedContent;
    lastSavedContent = renderedContent;
  }

  // Set pinned state
  isPinned = note.is_pinned === 1;
  updatePinButton();

  // Update word count
  updateWordCount();
}

/**
 * Apply editor settings (spellcheck, font size, font family, tab size, word count, etc.)
 */
async function applyEditorSettings() {
  try {
    // Batch fetch all settings in a single IPC call
    const settings = await api.getSettings([
      'editor.spellcheck',
      'appearance.defaultFontSize',
      'appearance.defaultFontFamily',
      'editor.tabSize',
      'editor.autoLists',
      'editor.autoLinks',
      'editor.showWordCount',
      'appearance.enableAnimations',
      'general.autoSaveDelay',
    ]);

    // Spellcheck
    noteEditor.setAttribute(
      'spellcheck',
      settings['editor.spellcheck'] !== false ? 'true' : 'false'
    );

    // Font size
    if (settings['appearance.defaultFontSize']) {
      noteEditor.style.fontSize = `${settings['appearance.defaultFontSize']}px`;
    }

    // Font family
    if (settings['appearance.defaultFontFamily']) {
      noteEditor.style.fontFamily = settings['appearance.defaultFontFamily'];
    }

    // Tab size
    if (settings['editor.tabSize']) {
      noteEditor.style.tabSize = settings['editor.tabSize'];
      noteEditor.style.MozTabSize = settings['editor.tabSize']; // Firefox
    }

    // Store autoLists setting for use in keydown handler
    window.editorAutoLists = settings['editor.autoLists'];

    // Store autoLinks setting (for future URL detection implementation)
    window.editorAutoLinks = settings['editor.autoLinks'];

    // Show/hide word count based on setting
    if (wordCount) {
      wordCount.hidden = settings['editor.showWordCount'] === false;
    }

    // Apply animations setting
    document.body.classList.toggle(
      'no-animations',
      settings['appearance.enableAnimations'] === false
    );

    // Store auto-save delay for use in scheduleAutoSave
    window.autoSaveDelay = settings['general.autoSaveDelay'] || 1000;
  } catch (err) {
    console.error('Failed to apply editor settings:', err);
  }
}

/**
 * Apply color theme to the note
 */
function applyColorTheme(color) {
  // Remove all theme classes
  document.body.className = document.body.className
    .split(' ')
    .filter((c) => !c.startsWith('note-theme-'))
    .join(' ');

  // Add new theme class
  document.body.classList.add(`note-theme-${color || 'yellow'}`);

  // Update color picker active state
  document.querySelectorAll('.color-swatch').forEach((swatch) => {
    swatch.classList.toggle('active', swatch.dataset.color === color);
  });
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Title input
  titleInput.addEventListener('input', () => {
    scheduleAutoSave();
  });

  titleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      noteEditor.focus();
    }
  });

  // Editor
  noteEditor.addEventListener('input', (e) => {
    scheduleAutoSave();
    updateWordCount();

    // Check for space (regular or non-breaking)
    const isSpace = e.inputType === 'insertText' && (e.data === ' ' || e.data === '\u00A0');

    // Auto-detect URLs if enabled
    if (window.editorAutoLinks !== false && isSpace) {
      autoLinkifyLastWord();
    }

    // Markdown Auto-formatting on space
    if (isSpace) {
      handleAutoFormatting();
    }
  });

  // Handle image paste
  noteEditor.addEventListener('paste', handlePaste);

  // Handle Enter and Backspace in checkboxes and lists
  noteEditor.addEventListener('keydown', (e) => {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    let container = selection.getRangeAt(0).startContainer;

    if (e.key === 'Enter') {
      // Check if we're inside a checkbox
      let checkboxContainer = container;
      while (checkboxContainer && checkboxContainer !== noteEditor) {
        if (checkboxContainer.classList && checkboxContainer.classList.contains('checkbox')) {
          // Only auto-continue if autoLists is enabled
          if (window.editorAutoLists !== false) {
            e.preventDefault();
            // Insert new checkbox after current one
            const newCheckbox = document.createElement('div');
            newCheckbox.className = 'checkbox';
            newCheckbox.innerHTML = '<input type="checkbox"><span contenteditable="true"></span>';
            checkboxContainer.after(newCheckbox);
            // Focus the new checkbox span
            const span = newCheckbox.querySelector('span');
            if (span) {
              span.focus();
            }
            scheduleAutoSave();
            return;
          }
          break;
        }
        checkboxContainer = checkboxContainer.parentNode;
      }

      // Check if we're in an empty list item - exit the list
      let listItem = container;
      while (listItem && listItem !== noteEditor) {
        if (listItem.nodeName === 'LI') {
          if (listItem.textContent.trim() === '') {
            e.preventDefault();
            const list = listItem.parentNode;
            // Create a paragraph after the list
            const p = document.createElement('div');
            p.innerHTML = '<br>';
            list.after(p);
            // Remove empty list item
            listItem.remove();
            // If list is now empty, remove it
            if (list.children.length === 0) {
              list.remove();
            }
            // Move cursor to the new paragraph
            const range = document.createRange();
            range.setStart(p, 0);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            scheduleAutoSave();
            return;
          }
          break;
        }
        listItem = listItem.parentNode;
      }
    }

    // Handle Backspace on empty checkbox to delete it
    if (e.key === 'Backspace') {
      let checkboxContainer = container;
      while (checkboxContainer && checkboxContainer !== noteEditor) {
        if (checkboxContainer.classList && checkboxContainer.classList.contains('checkbox')) {
          const span = checkboxContainer.querySelector('span');
          if (span && span.textContent === '') {
            e.preventDefault();
            const prev = checkboxContainer.previousElementSibling;
            checkboxContainer.remove();
            // Focus previous element
            if (prev && prev.classList.contains('checkbox')) {
              const prevSpan = prev.querySelector('span');
              if (prevSpan) {
                prevSpan.focus();
                // Move cursor to end
                const range = document.createRange();
                range.selectNodeContents(prevSpan);
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
              }
            }
            scheduleAutoSave();
            return;
          }
          break;
        }
        checkboxContainer = checkboxContainer.parentNode;
      }
    }
  });

  // Handle checkbox toggle
  noteEditor.addEventListener('change', (e) => {
    if (e.target.type === 'checkbox') {
      const checkbox = e.target.closest('.checkbox');
      if (checkbox) {
        checkbox.classList.toggle('checked', e.target.checked);
        scheduleAutoSave();
      }
    }
  });

  // Color picker
  colorPickerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown(colorPicker);
    contextMenu.hidden = true;
  });

  colorPicker.addEventListener('click', async (e) => {
    const swatch = e.target.closest('.color-swatch');
    if (swatch) {
      const color = swatch.dataset.color;
      applyColorTheme(color);
      await api.updateNote(noteId, { color });
      colorPicker.hidden = true;
    }
  });

  // Context menu
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown(contextMenu);
    colorPicker.hidden = true;
  });

  contextMenu.addEventListener('click', async (e) => {
    const menuItem = e.target.closest('.menu-item');
    if (menuItem) {
      const action = menuItem.dataset.action;
      await handleMenuAction(action);
      contextMenu.hidden = true;
    }
  });

  // Pin button
  pinBtn.addEventListener('click', async () => {
    isPinned = !isPinned;
    await api.updateNote(noteId, { is_pinned: isPinned ? 1 : 0 });
    await api.setAlwaysOnTop(isPinned);
    updatePinButton();
  });

  // Close button
  closeBtn.addEventListener('click', async () => {
    await saveNote();
    // Clean up history interval
    if (historyInterval) {
      clearInterval(historyInterval);
      historyInterval = null;
    }

    // Check if user has seen the close hint before
    const hasSeenHint = await api.getSetting('hints.noteCloseHintSeen');
    if (!hasSeenHint) {
      // Show the hint dialog
      closeHintDialog.hidden = false;
    } else {
      api.closeWindow();
    }
  });

  // Close hint dialog OK button
  closeHintOkBtn?.addEventListener('click', async () => {
    // Save that user has seen the hint
    await api.setSetting('hints.noteCloseHintSeen', true);
    closeHintDialog.hidden = true;
    api.closeWindow();
  });

  // Click outside to close dropdowns
  document.addEventListener('click', () => {
    colorPicker.hidden = true;
    contextMenu.hidden = true;
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeydown);

  // Unlock button
  unlockBtn.addEventListener('click', attemptUnlock);
  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') attemptUnlock();
  });

  // Tags dialog
  addTagBtn.addEventListener('click', addTag);
  tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTag();
  });
  tagsList.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-remove]');
    if (removeBtn) {
      removeTag(removeBtn.dataset.remove);
    }
  });

  // Reminder dialog
  setReminderBtn.addEventListener('click', setReminder);
  clearReminderBtn.addEventListener('click', clearReminder);
  reminderDialog.querySelectorAll('[data-quick]').forEach((btn) => {
    btn.addEventListener('click', () => setQuickReminder(btn.dataset.quick));
  });

  // History dialog
  historyList.addEventListener('click', (e) => {
    const restoreBtn = e.target.closest('[data-restore]');
    if (restoreBtn) {
      restoreVersion(parseInt(restoreBtn.dataset.restore));
    }
  });

  // Close dialogs
  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', closeAllDialogs);
  });
  document.querySelectorAll('.dialog-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeAllDialogs();
    });
  });

  // Listen for updates from other windows
  api.onNoteUpdated(async (updatedNote) => {
    if (updatedNote.id === noteId) {
      // Don't overwrite if we have unsaved changes
      if (noteEditor.innerHTML === lastSavedContent) {
        // Render [[wiki links]] as clickable anchors
        const renderedContent = await api.renderLinks(updatedNote.content || '');
        noteEditor.innerHTML = renderedContent;
        lastSavedContent = renderedContent;
      }
      if (titleInput.value === lastSavedTitle) {
        titleInput.value = updatedNote.title || '';
        lastSavedTitle = updatedNote.title || '';
      }
      applyColorTheme(updatedNote.color);
    }
  });

  api.onNoteDeleted((deletedId) => {
    if (deletedId === noteId) {
      api.closeWindow();
    }
  });
}

/**
 * Toggle dropdown visibility
 */
function toggleDropdown(dropdown) {
  dropdown.hidden = !dropdown.hidden;
}

/**
 * Handle keyboard shortcuts
 */
function handleKeydown(e) {
  // Save shortcut
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveNote();
  }

  // Close on Escape
  if (e.key === 'Escape') {
    colorPicker.hidden = true;
    contextMenu.hidden = true;
  }
}

/**
 * Setup formatting buttons
 */
function setupFormatting() {
  editorToolbar.addEventListener('click', (e) => {
    const btn = e.target.closest('.toolbar-btn');
    if (!btn) return;

    const format = btn.dataset.format;
    applyFormat(format);
    noteEditor.focus();
  });

  // Update toolbar state on selection change
  document.addEventListener('selectionchange', updateToolbarState);
}

/**
 * Apply text formatting
 */
function applyFormat(format) {
  switch (format) {
    case 'bold':
      document.execCommand('bold', false, null);
      break;
    case 'italic':
      document.execCommand('italic', false, null);
      break;
    case 'underline':
      document.execCommand('underline', false, null);
      break;
    case 'strikethrough':
      document.execCommand('strikeThrough', false, null);
      break;
    case 'bullet':
      insertBulletList();
      break;
    case 'checkbox':
      insertCheckbox();
      break;
    case 'code':
      insertInlineCode();
      break;
    case 'codeblock':
      insertCodeBlock();
      break;
  }
  scheduleAutoSave();
}

/**
 * Insert or toggle bullet list
 */
function insertBulletList() {
  const selection = window.getSelection();
  if (selection.rangeCount === 0) return;

  // Check if we're already in a list
  let container = selection.getRangeAt(0).startContainer;
  let inList = false;

  while (container && container !== noteEditor) {
    if (container.nodeName === 'UL' || container.nodeName === 'OL') {
      inList = true;
      break;
    }
    if (container.nodeName === 'LI') {
      inList = true;
      break;
    }
    container = container.parentNode;
  }

  if (inList) {
    // Toggle off the list
    document.execCommand('insertUnorderedList', false, null);
  } else {
    // Create a new list
    document.execCommand('insertUnorderedList', false, null);
  }
}

/**
 * Insert a checkbox
 */
function insertCheckbox() {
  const selection = window.getSelection();
  if (selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);

  // Find if we're inside a checkbox and move outside it
  let container = range.startContainer;
  while (container && container !== noteEditor) {
    if (container.classList && container.classList.contains('checkbox')) {
      // Move cursor after this checkbox
      range.setStartAfter(container);
      range.setEndAfter(container);
      break;
    }
    container = container.parentNode;
  }

  // Create new checkbox element
  const checkbox = document.createElement('div');
  checkbox.className = 'checkbox';
  checkbox.innerHTML = '<input type="checkbox"><span contenteditable="true">Task item</span>';

  // Insert a line break first if not at the start of a block
  const needsLineBreak = range.startContainer.nodeType === Node.TEXT_NODE && range.startOffset > 0;

  if (needsLineBreak) {
    const br = document.createElement('br');
    range.insertNode(br);
    range.setStartAfter(br);
    range.setEndAfter(br);
  }

  // Insert the checkbox
  range.insertNode(checkbox);

  // Move cursor to the span text
  const span = checkbox.querySelector('span');
  if (span) {
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    selection.removeAllRanges();
    selection.addRange(newRange);
  }
}

/**
 * Insert inline code
 */
function insertInlineCode() {
  const selection = window.getSelection();
  if (selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const selectedText = range.toString();

  // Check if we're inside a code element - if so, unwrap it
  let container = range.startContainer;
  while (container && container !== noteEditor) {
    if (container.tagName === 'CODE') {
      // Remove the code wrapper
      const text = container.textContent;
      const textNode = document.createTextNode(text);
      container.parentNode.replaceChild(textNode, container);
      return;
    }
    container = container.parentNode;
  }

  // Create code element
  const code = document.createElement('code');

  if (selectedText) {
    // Wrap selected text in code
    code.textContent = selectedText;
    range.deleteContents();
    range.insertNode(code);

    // Move cursor after code
    range.setStartAfter(code);
    range.setEndAfter(code);
    selection.removeAllRanges();
    selection.addRange(range);
  } else {
    // Insert empty code with placeholder
    code.textContent = 'code';
    range.insertNode(code);

    // Select the placeholder text
    const newRange = document.createRange();
    newRange.selectNodeContents(code);
    selection.removeAllRanges();
    selection.addRange(newRange);
  }
}

/**
 * Insert code block
 */
function insertCodeBlock() {
  const selection = window.getSelection();
  if (selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const selectedText = range.toString();

  // Check if we're inside a pre element - if so, unwrap it
  let container = range.startContainer;
  while (container && container !== noteEditor) {
    if (container.tagName === 'PRE') {
      // Convert back to normal text
      const text = container.textContent;
      const p = document.createElement('p');
      p.textContent = text;
      container.parentNode.replaceChild(p, container);
      return;
    }
    container = container.parentNode;
  }

  // Create pre element for code block
  const pre = document.createElement('pre');
  const code = document.createElement('code');

  if (selectedText) {
    code.textContent = selectedText;
  } else {
    code.textContent = '// Enter code here...';
  }

  pre.appendChild(code);

  // Insert line breaks for proper block formatting
  const br1 = document.createElement('br');
  const br2 = document.createElement('br');

  range.deleteContents();
  range.insertNode(br2);
  range.insertNode(pre);
  range.insertNode(br1);

  // Move cursor inside the code block
  const newRange = document.createRange();
  newRange.selectNodeContents(code);
  selection.removeAllRanges();
  selection.addRange(newRange);
}

/**
 * Handle paste events (especially for images)
 */
function handlePaste(e) {
  const clipboardData = e.clipboardData || window.clipboardData;
  if (!clipboardData) return;

  const items = clipboardData.items;
  if (!items) return;

  // Check for images first
  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (item.type.indexOf('image') !== -1) {
      e.preventDefault();

      const file = item.getAsFile();
      if (!file) continue;

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target.result;
        insertImage(base64, file.name || 'pasted-image');
      };
      reader.readAsDataURL(file);
      return;
    }
  }

  // Check for HTML content with links
  const htmlData = clipboardData.getData('text/html');
  if (htmlData) {
    // Check if it contains links we should preserve
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlData, 'text/html');
    const links = doc.querySelectorAll('a[href]');

    if (links.length > 0) {
      e.preventDefault();

      // Clean the HTML but preserve links
      const cleanHtml = sanitizePastedHtml(htmlData);
      document.execCommand('insertHTML', false, cleanHtml);
      scheduleAutoSave();
      return;
    }
  }

  // Check for plain text URLs
  const plainText = clipboardData.getData('text/plain');
  if (plainText && window.editorAutoLinks !== false) {
    const urlPattern = /^(https?:\/\/|www\.)[^\s]+$/i;
    const trimmedText = plainText.trim();

    if (urlPattern.test(trimmedText)) {
      e.preventDefault();

      const href = trimmedText.startsWith('www.') ? 'https://' + trimmedText : trimmedText;
      const linkHtml = `<a href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtml(trimmedText)}</a>`;
      document.execCommand('insertHTML', false, linkHtml);
      scheduleAutoSave();
      return;
    }
  }

  // For other content, let the default paste behavior happen
}

/**
 * Sanitize pasted HTML while preserving safe elements like links
 */
function sanitizePastedHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Remove dangerous elements
  const dangerous = doc.querySelectorAll('script, style, iframe, object, embed, form, meta, link');
  dangerous.forEach((el) => el.remove());

  // Clean all elements
  const allElements = doc.body.querySelectorAll('*');
  allElements.forEach((el) => {
    // Remove event handlers
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }
    });

    // For links, ensure they open in new tab and are safe
    if (el.tagName === 'A' && el.href) {
      // Only allow http/https links
      if (!el.href.startsWith('http://') && !el.href.startsWith('https://')) {
        el.removeAttribute('href');
      } else {
        el.target = '_blank';
        el.rel = 'noopener noreferrer';
      }
    }
  });

  return doc.body.innerHTML;
}

/**
 * Insert an image into the editor
 */
function insertImage(src, alt = 'image') {
  const selection = window.getSelection();
  if (selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);

  // Create image container for better styling
  const container = document.createElement('div');
  container.className = 'image-container';
  container.contentEditable = 'false';

  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;
  img.className = 'note-image';
  // Note: Event handlers are added via delegation in setupImageHandlers()
  // so they work even after note reload

  container.appendChild(img);

  // Add delete button (handled via delegation)
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'image-delete-btn';
  deleteBtn.innerHTML = '&times;';
  deleteBtn.title = 'Remove image';
  container.appendChild(deleteBtn);

  // Insert the image
  range.deleteContents();
  range.insertNode(container);

  // Add a line break after for easier typing
  const br = document.createElement('br');
  container.after(br);

  // Move cursor after the image
  range.setStartAfter(br);
  range.setEndAfter(br);
  selection.removeAllRanges();
  selection.addRange(range);

  scheduleAutoSave();
}

/**
 * Auto-detect and linkify URLs in the last typed word
 */
function autoLinkifyLastWord() {
  try {
    const selection = window.getSelection();
    if (!selection.rangeCount) {
      return;
    }

    const range = selection.getRangeAt(0);
    const node = range.startContainer;

    if (node.nodeType !== Node.TEXT_NODE) {
      return;
    }

    const text = node.textContent;
    const cursorPos = range.startOffset;

    // Find the last word before cursor (before the space that was just typed)
    const beforeCursor = text.slice(0, cursorPos - 1); // -1 for the space
    const words = beforeCursor.split(/\s/);
    const lastWord = words[words.length - 1];

    // URL pattern
    const urlPattern = /^(https?:\/\/|www\.)[^\s]+$/i;

    if (urlPattern.test(lastWord)) {
      const wordStart = beforeCursor.lastIndexOf(lastWord);
      const wordEnd = wordStart + lastWord.length;

      // Create link element
      const link = document.createElement('a');
      link.href = lastWord.startsWith('www.') ? 'https://' + lastWord : lastWord;
      link.textContent = lastWord;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';

      // Replace the text with the link
      const beforeText = text.slice(0, wordStart);
      const afterText = text.slice(wordEnd);

      const beforeNode = document.createTextNode(beforeText);
      const afterNode = document.createTextNode(afterText);

      const parent = node.parentNode;
      parent.insertBefore(beforeNode, node);
      parent.insertBefore(link, node);
      parent.insertBefore(afterNode, node);
      parent.removeChild(node);

      // Restore cursor position after the space
      const newRange = document.createRange();
      newRange.setStart(afterNode, 1); // After the space
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
  } catch (err) {
    console.error('[AutoLink] Error:', err);
  }
}

/**
 * Setup event delegation for images in the editor
 * This handles clicks on images even after reload (when inline handlers are lost)
 */
function setupImageHandlers() {
  noteEditor.addEventListener('click', (e) => {
    // Handle image click - open viewer in new window
    if (e.target.classList.contains('note-image')) {
      e.preventDefault();
      e.stopPropagation();
      const src = e.target.src;
      if (src) {
        // Open image in dedicated viewer window with drawing support
        api.openImageViewer(src);
      }
      return;
    }

    // Handle delete button click
    if (e.target.classList.contains('image-delete-btn')) {
      e.preventDefault();
      e.stopPropagation();
      const container = e.target.closest('.image-container');
      if (container) {
        container.remove();
        scheduleAutoSave();
      }
      return;
    }
  });
}

/**
 * Setup event delegation for [[wiki links]] in the editor
 * Handles clicks on rendered note links to open linked notes
 */
function setupNoteLinkHandlers() {
  noteEditor.addEventListener('click', async (e) => {
    // Check for wiki links first
    const noteLink = e.target.closest('.note-link');
    if (noteLink) {
      e.preventDefault();
      e.stopPropagation();

      // Check if this is an unresolved link (link to non-existent note)
      if (noteLink.classList.contains('unresolved')) {
        const linkText = noteLink.dataset.linkText;
        if (linkText) {
          // Ask user if they want to create a new note with this title
          if (confirm(`Create a new note titled "${linkText}"?`)) {
            const newNote = await api.createNoteFromLink(linkText, noteId);
            if (newNote) {
              await api.openNote(newNote.id);
            }
          }
        }
      } else {
        // Resolved link - open the linked note
        const targetNoteId = noteLink.dataset.noteId;
        if (targetNoteId) {
          await api.openNote(targetNoteId);
        }
      }
      return;
    }

    // Check for external links (http/https)
    // Require Ctrl+click (or Cmd+click on Mac) to open links
    const externalLink = e.target.closest('a[href^="http"]');
    if (externalLink && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.stopPropagation();

      const href = externalLink.getAttribute('href');
      if (href) {
        // Open in default browser via Electron shell
        api.openExternal(href);
      }
    }
  });

  // Toggle ctrl-active class for link cursor styling
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Control' || e.key === 'Meta') {
      noteEditor.classList.add('ctrl-active');
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.key === 'Control' || e.key === 'Meta') {
      noteEditor.classList.remove('ctrl-active');
    }
  });

  // Also remove on window blur (in case user switches windows while holding Ctrl)
  window.addEventListener('blur', () => {
    noteEditor.classList.remove('ctrl-active');
  });
}

/**
 * Update toolbar button states
 */
function updateToolbarState() {
  const buttons = editorToolbar.querySelectorAll('.toolbar-btn');
  const selection = window.getSelection();

  buttons.forEach((btn) => {
    const format = btn.dataset.format;
    let isActive = false;

    switch (format) {
      case 'bold':
        isActive = document.queryCommandState('bold');
        break;
      case 'italic':
        isActive = document.queryCommandState('italic');
        break;
      case 'underline':
        isActive = document.queryCommandState('underline');
        break;
      case 'strikethrough':
        isActive = document.queryCommandState('strikeThrough');
        break;
      case 'code':
        if (selection.rangeCount > 0) {
          let container = selection.getRangeAt(0).startContainer;
          while (container && container !== noteEditor) {
            if (container.tagName === 'CODE' && container.parentNode?.tagName !== 'PRE') {
              isActive = true;
              break;
            }
            container = container.parentNode;
          }
        }
        break;
      case 'codeblock':
        if (selection.rangeCount > 0) {
          let container = selection.getRangeAt(0).startContainer;
          while (container && container !== noteEditor) {
            if (container.tagName === 'PRE') {
              isActive = true;
              break;
            }
            container = container.parentNode;
          }
        }
        break;
    }

    btn.classList.toggle('active', isActive);
  });
}

/**
 * Setup automatic history saving at intervals
 */
async function setupHistoryAutoSave() {
  try {
    const saveInterval = await api.getSetting('history.saveInterval');
    if (saveInterval && saveInterval > 0) {
      // Store initial content for comparison
      lastHistorySaveContent = noteEditor.innerHTML;

      // Clear any existing interval
      if (historyInterval) {
        clearInterval(historyInterval);
      }

      // Setup interval to check and save history
      historyInterval = setInterval(async () => {
        const currentContent = noteEditor.innerHTML;
        // Only save to history if content has changed since last history save
        if (currentContent !== lastHistorySaveContent && currentContent !== '') {
          // The server-side will handle the actual history save when we update
          // Just trigger a save which will also update history via server hooks
          await saveNote();
          lastHistorySaveContent = currentContent;
        }
      }, saveInterval);
    }
  } catch (err) {
    console.error('Failed to setup history auto-save:', err);
  }
}

/**
 * Schedule auto-save
 */
async function scheduleAutoSave() {
  statusText.textContent = 'Saving...';
  statusText.classList.add('saving');
  statusText.classList.remove('saved');

  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  // Use autoSaveDelay setting (default 1000ms if not set)
  const delay = window.autoSaveDelay || 1000;
  saveTimeout = setTimeout(saveNote, delay);
}

/**
 * Save the note
 */
async function saveNote() {
  const content = noteEditor.innerHTML;
  const title = titleInput.value;

  // Only save if changed
  if (content === lastSavedContent && title === lastSavedTitle) {
    return;
  }

  try {
    await api.updateNote(noteId, { title, content });
    lastSavedContent = content;
    lastSavedTitle = title;

    statusText.textContent = 'Saved';
    statusText.classList.remove('saving');
    statusText.classList.add('saved');
  } catch (err) {
    console.error('Failed to save note:', err);
    statusText.textContent = 'Error saving';
    statusText.classList.remove('saving');
  }
}

/**
 * Update word count display
 */
function updateWordCount() {
  const text = noteEditor.innerText || '';
  const words = text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
  const chars = text.length;
  wordCount.textContent = `${words} words, ${chars} chars`;
}

/**
 * Update pin button state
 */
function updatePinButton() {
  pinBtn.classList.toggle('pinned', isPinned);
  pinBtn.title = isPinned ? 'Unpin' : 'Pin on top';
}

/**
 * Handle context menu actions
 */
async function handleMenuAction(action) {
  switch (action) {
    case 'duplicate': {
      const newNote = await api.duplicateNote(noteId);
      if (newNote) {
        await api.openNote(newNote.id);
      }
      break;
    }

    case 'tags':
      await openTagsDialog();
      break;

    case 'reminder':
      openReminderDialog();
      break;

    case 'history':
      await openHistoryDialog();
      break;

    case 'archive':
      await saveNote();
      await api.archiveNote(noteId);
      api.closeWindow();
      break;

    case 'delete': {
      // Check confirmDelete setting
      const confirmDelete = await api.getSetting('general.confirmDelete');
      if (confirmDelete !== false) {
        if (!confirm('Move this note to trash?')) {
          break;
        }
      }
      await api.deleteNote(noteId);
      api.closeWindow();
      break;
    }

    case 'copy-markdown':
      await copyToClipboard('markdown');
      break;

    case 'copy-html':
      await copyToClipboard('html');
      break;
  }
}

/**
 * Open tags dialog
 */
async function openTagsDialog() {
  tagsDialog.hidden = false;
  tagInput.value = '';
  tagInput.focus();
  await refreshTagsList();
}

/**
 * Refresh the tags list in the dialog
 */
async function refreshTagsList() {
  const tags = await api.getTagsForNote(noteId);

  if (tags.length === 0) {
    tagsList.innerHTML = '<p style="color: var(--text-muted); font-size: 13px;">No tags yet</p>';
    return;
  }

  tagsList.innerHTML = tags
    .map(
      (tag) => `
    <div class="tag-item" data-tag="${tag.name}">
      ${tag.name}
      <span class="remove-tag" data-remove="${tag.name}">&times;</span>
    </div>
  `
    )
    .join('');
}

/**
 * Add a tag to the note
 */
async function addTag() {
  const tagName = tagInput.value.trim();
  if (!tagName) return;

  await api.addTagToNote(noteId, tagName);
  tagInput.value = '';
  await refreshTagsList();
}

/**
 * Remove a tag from the note
 */
async function removeTag(tagName) {
  await api.removeTagFromNote(noteId, tagName);
  await refreshTagsList();
}

/**
 * Open reminder dialog
 */
function openReminderDialog() {
  reminderDialog.hidden = false;

  // Set default date/time to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  reminderDate.value = tomorrow.toISOString().split('T')[0];
  reminderTime.value = '09:00';

  // Show current reminder if exists
  if (note.reminder_at && !note.reminder_notified) {
    const reminderDt = new Date(note.reminder_at);
    currentReminderTime.textContent = reminderDt.toLocaleString();
    reminderCurrent.hidden = false;
  } else {
    reminderCurrent.hidden = true;
  }
}

/**
 * Set a reminder for the note
 */
async function setReminder() {
  const date = reminderDate.value;
  const time = reminderTime.value;

  if (!date || !time) {
    alert('Please select a date and time');
    return;
  }

  const datetime = new Date(`${date}T${time}`);
  if (datetime <= new Date()) {
    alert('Please select a future date and time');
    return;
  }

  await api.setReminder(noteId, datetime.toISOString());
  note.reminder_at = datetime.toISOString();
  reminderDialog.hidden = true;
}

/**
 * Clear the reminder
 */
async function clearReminder() {
  await api.clearReminder(noteId);
  note.reminder_at = null;
  reminderDialog.hidden = true;
}

/**
 * Handle quick reminder buttons
 */
function setQuickReminder(type) {
  const now = new Date();
  let target;

  switch (type) {
    case '1h':
      target = new Date(now.getTime() + 60 * 60 * 1000);
      break;
    case '3h':
      target = new Date(now.getTime() + 3 * 60 * 60 * 1000);
      break;
    case 'tomorrow':
      target = new Date(now);
      target.setDate(target.getDate() + 1);
      target.setHours(9, 0, 0, 0);
      break;
    case 'week':
      target = new Date(now);
      target.setDate(target.getDate() + 7);
      target.setHours(9, 0, 0, 0);
      break;
  }

  if (target) {
    reminderDate.value = target.toISOString().split('T')[0];
    reminderTime.value = target.toTimeString().slice(0, 5);
  }
}

/**
 * Open history dialog
 */
async function openHistoryDialog() {
  historyDialog.hidden = false;

  const history = await api.getNoteHistory(noteId);

  if (!history || history.length === 0) {
    historyList.innerHTML = '<p class="empty-history">No version history available</p>';
    return;
  }

  historyList.innerHTML = history
    .map(
      (entry) => `
    <div class="history-item">
      <div class="history-info">
        <div class="history-date">${new Date(entry.saved_at).toLocaleString()}</div>
        <div class="history-preview">${entry.title || 'Untitled'} - ${(entry.content || '').substring(0, 50)}...</div>
      </div>
      <button class="btn btn-sm btn-ghost" data-restore="${entry.id}">Restore</button>
    </div>
  `
    )
    .join('');
}

/**
 * Restore a version from history
 */
async function restoreVersion(historyId) {
  if (!confirm('Restore this version? Your current content will be saved to history.')) {
    return;
  }

  const entry = await api.revertToVersion(noteId, historyId);
  if (entry) {
    noteEditor.innerHTML = entry.content || '';
    titleInput.value = entry.title || '';
    lastSavedContent = entry.content || '';
    lastSavedTitle = entry.title || '';
    historyDialog.hidden = true;
  }
}

/**
 * Close all dialogs
 */
function closeAllDialogs() {
  tagsDialog.hidden = true;
  reminderDialog.hidden = true;
  historyDialog.hidden = true;
}

/**
 * Show locked overlay
 */
function showLockedOverlay() {
  lockedOverlay.hidden = false;
  passwordInput.focus();
}

/**
 * Attempt to unlock the note
 */
async function attemptUnlock() {
  const password = passwordInput.value;
  if (!password) return;

  const valid = await api.verifyNotePassword(noteId, password);
  if (valid) {
    lockedOverlay.hidden = true;
    // Render [[wiki links]] as clickable anchors
    const renderedContent = await api.renderLinks(note.content || '');
    noteEditor.innerHTML = renderedContent;
    lastSavedContent = renderedContent;
    noteEditor.focus();
  } else {
    passwordInput.classList.add('animate-shake');
    setTimeout(() => passwordInput.classList.remove('animate-shake'), 500);
    passwordInput.value = '';
  }
}

/**
 * Handle Markdown Auto-formatting
 */
function handleAutoFormatting() {
  const selection = window.getSelection();
  if (selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  const node = range.startContainer;

  // Only work with text nodes
  if (node.nodeType !== Node.TEXT_NODE) {
    return;
  }

  const text = node.textContent;
  const offset = range.startOffset;

  // Get text before cursor and normalize non-breaking spaces to regular spaces
  const textBefore = text.slice(0, offset).replace(/\u00A0/g, ' ');

  // Check for patterns
  // Note: patterns include the trailing space which triggered the event

  // Heading 1: "# "
  if (textBefore.endsWith('# ') && textBefore.trim() === '#') {
    deleteTriggerChars(node, offset, 2);
    document.execCommand('formatBlock', false, '<h1>');
    return;
  }

  // Heading 2: "## "
  if (textBefore.endsWith('## ') && textBefore.trim() === '##') {
    deleteTriggerChars(node, offset, 3);
    document.execCommand('formatBlock', false, '<h2>');
    return;
  }

  // Heading 3: "### "
  if (textBefore.endsWith('### ') && textBefore.trim() === '###') {
    deleteTriggerChars(node, offset, 4);
    document.execCommand('formatBlock', false, '<h3>');
    return;
  }

  // Bullet List: "* " or "- "
  if (
    (textBefore.endsWith('* ') || textBefore.endsWith('- ')) &&
    (textBefore.trim() === '*' || textBefore.trim() === '-')
  ) {
    deleteTriggerChars(node, offset, 2);
    document.execCommand('insertUnorderedList', false, null);
    return;
  }

  // Ordered List: "1. "
  if (textBefore.endsWith('1. ') && textBefore.trim() === '1.') {
    deleteTriggerChars(node, offset, 3);
    document.execCommand('insertOrderedList', false, null);
    return;
  }

  // Blockquote: "> "
  if (textBefore.endsWith('> ') && textBefore.trim() === '>') {
    deleteTriggerChars(node, offset, 2);
    document.execCommand('formatBlock', false, '<blockquote>');
    return;
  }

  // Horizontal Rule: "--- "
  if (textBefore.endsWith('--- ') && textBefore.trim() === '---') {
    deleteTriggerChars(node, offset, 4);
    document.execCommand('insertHorizontalRule', false, null);
    return;
  }

  // Checkbox: "[] " or "[ ] "
  if (textBefore.endsWith('[] ') && textBefore.trim() === '[]') {
    deleteTriggerChars(node, offset, 3);
    insertCheckbox();
    return;
  }
  if (textBefore.endsWith('[ ] ') && textBefore.trim() === '[ ]') {
    deleteTriggerChars(node, offset, 4);
    insertCheckbox();
    return;
  }

  // Code Block: "``` "
  if (textBefore.endsWith('``` ') && textBefore.trim() === '```') {
    deleteTriggerChars(node, offset, 4);
    insertCodeBlock();
    return;
  }

  // Inline Code: `text` + space
  if (textBefore.endsWith('` ')) {
    const content = textBefore.slice(0, -2);
    const lastBacktick = content.lastIndexOf('`');
    if (lastBacktick !== -1 && !(lastBacktick > 0 && content[lastBacktick - 1] === '`')) {
      const textToFormat = textBefore.slice(lastBacktick + 1, -2);
      if (textToFormat.trim()) {
        const newRange = document.createRange();
        newRange.setStart(node, lastBacktick);
        newRange.setEnd(node, offset);
        newRange.deleteContents();

        const codeSpan = document.createElement('code');
        codeSpan.textContent = textToFormat;
        newRange.insertNode(codeSpan);

        const space = document.createTextNode(' ');
        codeSpan.after(space);

        const sel = window.getSelection();
        sel.removeAllRanges();
        const cursorRange = document.createRange();
        cursorRange.setStartAfter(space);
        cursorRange.collapse(true);
        sel.addRange(cursorRange);
        return;
      }
    }
  }

  // Bold: **text** + space
  if (textBefore.endsWith('** ')) {
    const content = textBefore.slice(0, -3);
    const lastStars = content.lastIndexOf('**');
    if (lastStars !== -1) {
      const textToFormat = textBefore.slice(lastStars + 2, -3);
      if (textToFormat.trim()) {
        const newRange = document.createRange();
        newRange.setStart(node, lastStars);
        newRange.setEnd(node, offset);
        newRange.deleteContents();

        const boldSpan = document.createElement('b');
        boldSpan.textContent = textToFormat;
        newRange.insertNode(boldSpan);

        const space = document.createTextNode(' ');
        boldSpan.after(space);

        const sel = window.getSelection();
        sel.removeAllRanges();
        const cursorRange = document.createRange();
        cursorRange.setStartAfter(space);
        cursorRange.collapse(true);
        sel.addRange(cursorRange);
        return;
      }
    }
  }

  // Italic: *text* + space (but not **)
  if (textBefore.endsWith('* ') && !textBefore.endsWith('** ')) {
    const content = textBefore.slice(0, -2);
    const lastStar = content.lastIndexOf('*');
    if (lastStar !== -1 && !(lastStar > 0 && content[lastStar - 1] === '*')) {
      const textToFormat = textBefore.slice(lastStar + 1, -2);
      if (textToFormat.trim()) {
        const newRange = document.createRange();
        newRange.setStart(node, lastStar);
        newRange.setEnd(node, offset);
        newRange.deleteContents();

        const italicSpan = document.createElement('i');
        italicSpan.textContent = textToFormat;
        newRange.insertNode(italicSpan);

        const space = document.createTextNode(' ');
        italicSpan.after(space);

        const sel = window.getSelection();
        sel.removeAllRanges();
        const cursorRange = document.createRange();
        cursorRange.setStartAfter(space);
        cursorRange.collapse(true);
        sel.addRange(cursorRange);
        return;
      }
    }
  }
}

/**
 * Helper to delete trigger characters before cursor
 */
function deleteTriggerChars(node, currentOffset, charCount) {
  const range = document.createRange();
  range.setStart(node, currentOffset - charCount);
  range.setEnd(node, currentOffset);
  range.deleteContents();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);

/**
 * Copy note content to clipboard
 */
async function copyToClipboard(format) {
  const content = noteEditor.innerHTML;

  let textToCopy = '';
  let notification = '';

  if (format === 'html') {
    textToCopy = content;
    notification = 'Copied HTML to clipboard';
  } else if (format === 'markdown') {
    textToCopy = convertHtmlToMarkdown(content);
    notification = 'Copied Markdown to clipboard';
  }

  try {
    await navigator.clipboard.writeText(textToCopy);

    // Show brief toast/notification
    const originalStatus = statusText.textContent;
    statusText.textContent = notification;
    statusText.style.color = 'var(--accent-primary)';

    setTimeout(() => {
      statusText.textContent = originalStatus;
      statusText.style.color = '';
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
    statusText.textContent = 'Failed to copy';
    setTimeout(() => {
      statusText.textContent = 'Saved';
    }, 2000);
  }
}

/**
 * Convert HTML to Markdown (Basic Implementation)
 */
function convertHtmlToMarkdown(html) {
  // Create a temporary element to manipulate the HTML
  const temp = document.createElement('div');
  temp.innerHTML = html;

  // Helper to process nodes recursively
  function processNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    let content = '';

    // Process child nodes
    node.childNodes.forEach((child) => {
      content += processNode(child);
    });

    switch (node.tagName.toLowerCase()) {
      case 'h1':
        return `# ${content}\n\n`;
      case 'h2':
        return `## ${content}\n\n`;
      case 'strong':
      case 'b':
        return `**${content}**`;
      case 'em':
      case 'i':
        return `*${content}*`;
      case 'u':
        return `<u>${content}</u>`; // Markdown doesn't support underline standardly
      case 's':
      case 'strike':
        return `~~${content}~~`;
      case 'ul':
        return `${content}\n`;
      case 'ol':
        return `${content}\n`;
      case 'li': {
        // Determine parent type
        const parent = node.parentNode;
        if (parent && parent.tagName === 'OL') {
          // Find index
          const index = Array.from(parent.children).indexOf(node) + 1;
          return `${index}. ${content}\n`;
        }
        return `* ${content}\n`;
      }
      case 'br':
        return '\n';
      case 'div':
        if (node.classList.contains('checkbox')) {
          return `${content}\n`;
        }
        return `${content}\n`;
      case 'p':
        return `${content}\n\n`;
      case 'blockquote':
        return `> ${content}\n\n`;
      case 'code':
        return `\`${content}\``;
      case 'pre':
        return `\`\`\`\n${node.textContent}\n\`\`\`\n\n`;
      case 'a':
        return `[${content}](${node.getAttribute('href')})`;
      case 'img':
        return `![${node.getAttribute('alt') || ''}](${node.getAttribute('src')})`;
      case 'input':
        if (node.type === 'checkbox') {
          return node.checked ? '[x] ' : '[ ] ';
        }
        return '';
      case 'span':
        // Check for checkbox span
        if (node.parentElement && node.parentElement.classList.contains('checkbox')) {
          return content;
        }
        return content;
      default:
        return content;
    }
  }

  // Clean up result
  let markdown = processNode(temp);
  // Remove excessive newlines
  markdown = markdown.replace(/\n{3,}/g, '\n\n').trim();

  return markdown;
}
