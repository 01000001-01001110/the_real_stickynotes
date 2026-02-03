// Get dialog data from query params
const params = new URLSearchParams(window.location.search);
const title = params.get('title') || 'Confirm';
const message = params.get('message') || 'Are you sure?';
const confirmText = params.get('confirmText') || 'Delete';

document.getElementById('dialogTitle').textContent = title;
document.getElementById('dialogMessage').textContent = message;
document.getElementById('confirmBtn').textContent = confirmText;

// Apply theme
const theme = params.get('theme') || 'light';
if (theme === 'dark') {
  document.documentElement.setAttribute('data-theme', 'dark');
}

// Button handlers
document.getElementById('cancelBtn').addEventListener('click', () => {
  window.dialogApi.sendResponse(false);
});

document.getElementById('confirmBtn').addEventListener('click', () => {
  window.dialogApi.sendResponse(true);
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.dialogApi.sendResponse(false);
  } else if (e.key === 'Enter') {
    window.dialogApi.sendResponse(true);
  }
});

// Focus confirm button
document.getElementById('confirmBtn').focus();
