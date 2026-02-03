/**
 * Reminder scheduler and notifications
 */
const { Notification, dialog } = require('electron');
const { getNotes, updateNote } = require('../shared/database/notes');
const { getSetting } = require('../shared/database/settings');

let checkInterval = null;
let windowManager = null;
let isFirstCheck = true;
const MAX_STARTUP_NOTIFICATIONS = 5; // Max notifications to show at once on startup
const NOTIFICATION_INTERVAL_MS = 2000; // Delay between notifications

/**
 * Setup the reminder scheduler
 */
function setupReminders(wm) {
  windowManager = wm;

  // Check reminders every minute
  checkInterval = setInterval(checkReminders, 60000);

  // Also check immediately on startup (with rate limiting)
  checkReminders();

  // Subscribe to config changes for hot reload
  try {
    const { onConfigChange } = require('../shared/config');
    onConfigChange((changedKeys) => {
      if (changedKeys.some((k) => k.startsWith('reminders.'))) {
        // Reminder settings are read on each check, so no action needed
      }
    });
  } catch (error) {
    // Config system not available
  }
}

/**
 * Check for due reminders
 */
function checkReminders() {
  const enabled = getSetting('reminders.enabled');
  if (!enabled) return;

  const now = new Date().toISOString();
  const notes = getNotes({ withReminder: true });

  // Filter to get overdue notes
  const overdueNotes = notes.filter(
    (note) => note.reminder_at && note.reminder_at <= now && !note.reminder_notified
  );

  // On startup, if there are many missed reminders, show a summary instead
  if (isFirstCheck && overdueNotes.length > MAX_STARTUP_NOTIFICATIONS) {
    isFirstCheck = false;
    showMissedRemindersSummary(overdueNotes);
    return;
  }

  isFirstCheck = false;

  // Rate limit notifications - stagger them if multiple
  overdueNotes.forEach((note, index) => {
    setTimeout(() => {
      triggerReminder(note);
    }, index * NOTIFICATION_INTERVAL_MS);
  });
}

/**
 * Show a summary dialog for many missed reminders
 */
function showMissedRemindersSummary(notes) {
  const titles = notes
    .slice(0, 10)
    .map((n) => `• ${n.title || 'Untitled'}`)
    .join('\n');
  const moreCount = notes.length > 10 ? `\n...and ${notes.length - 10} more` : '';

  dialog
    .showMessageBox({
      type: 'info',
      title: 'Missed Reminders',
      message: `You have ${notes.length} missed reminders`,
      detail: `${titles}${moreCount}\n\nWould you like to snooze all or dismiss all?`,
      buttons: ['Show All', 'Snooze All (1 hour)', 'Dismiss All'],
      defaultId: 0,
    })
    .then(({ response }) => {
      if (response === 0) {
        // Show all - trigger notifications one by one with delay
        notes.forEach((note, index) => {
          setTimeout(() => {
            triggerReminder(note);
          }, index * NOTIFICATION_INTERVAL_MS);
        });
      } else if (response === 1) {
        // Snooze all for 1 hour
        const snoozeTime = new Date();
        snoozeTime.setHours(snoozeTime.getHours() + 1);
        notes.forEach((note) => {
          updateNote(note.id, {
            reminder_at: snoozeTime.toISOString(),
            reminder_notified: 0,
          });
        });
      } else {
        // Dismiss all
        notes.forEach((note) => {
          updateNote(note.id, { reminder_notified: 1 });
        });
      }
    });
}

/**
 * Trigger a reminder notification
 */
function triggerReminder(note) {
  const playSound = getSetting('reminders.sound');

  // Create notification
  const notification = new Notification({
    title: note.title || 'StickyNotes Reminder',
    body: note.content_plain ? note.content_plain.substring(0, 100) : 'You have a reminder!',
    icon: undefined, // Uses app icon
    silent: !playSound,
    urgency: 'critical',
    timeoutType: getSetting('reminders.persistUntilDismissed') ? 'never' : 'default',
  });

  notification.on('click', () => {
    // Open the note
    if (windowManager) {
      windowManager.openNote(note.id);
    }
  });

  notification.show();

  // Mark as notified
  updateNote(note.id, { reminder_notified: 1 });

  // Broadcast to windows
  if (windowManager) {
    windowManager.broadcast('reminder:triggered', note);
  }
}

/**
 * Set a reminder for a note
 */
function setReminder(noteId, datetime) {
  const reminderAt = typeof datetime === 'string' ? datetime : datetime.toISOString();
  return updateNote(noteId, {
    reminder_at: reminderAt,
    reminder_notified: 0,
  });
}

/**
 * Clear a reminder
 */
function clearReminder(noteId) {
  return updateNote(noteId, {
    reminder_at: null,
    reminder_notified: 0,
  });
}

/**
 * Snooze a reminder
 */
function snoozeReminder(noteId, minutes) {
  const snoozeMinutes = minutes || getSetting('reminders.snoozeMinutes');
  const newTime = new Date();
  newTime.setMinutes(newTime.getMinutes() + snoozeMinutes);

  return updateNote(noteId, {
    reminder_at: newTime.toISOString(),
    reminder_notified: 0,
  });
}

/**
 * Get pending reminders
 */
function getPendingReminders() {
  const now = new Date().toISOString();
  return getNotes({ withReminder: true }).filter(
    (note) => note.reminder_at && note.reminder_at <= now && !note.reminder_notified
  );
}

/**
 * Stop the reminder scheduler
 */
function stopReminders() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

module.exports = {
  setupReminders,
  checkReminders,
  setReminder,
  clearReminder,
  snoozeReminder,
  getPendingReminders,
  stopReminders,
};
