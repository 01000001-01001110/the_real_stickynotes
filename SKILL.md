# StickyNotes CLI Reference

> A comprehensive guide for using the StickyNotes CLI for automation and scripting.

## Overview

StickyNotes is a local desktop sticky notes application with a powerful CLI for automation and scripting. The CLI provides full CRUD operations for notes, folders, tags, and settings with JSON output support.

**Database Location**: `%APPDATA%/StickyNotes/stickynotes.db` (Windows) | `~/Library/Application Support/StickyNotes/stickynotes.db` (macOS) | `~/.config/stickynotes/stickynotes.db` (Linux)

## Quick Reference

```bash
# Always use --json flag for programmatic output
stickynotes note list --json
stickynotes note create --title "Title" --content "Content" --json
stickynotes note show <id> --json
```

## Commands

### Notes

#### List Notes

```bash
stickynotes note list [options]
```

| Option | Description |
|--------|-------------|
| `--folder <id>` | Filter by folder ID |
| `--tag <name>` | Filter by tag name |
| `--color <color>` | Filter by color (yellow, pink, blue, green, purple, orange, gray, charcoal) |
| `--archived` | Show archived notes |
| `--trash` | Show deleted notes (trash) |
| `--with-reminder` | Only notes with reminders |
| `--json` | Output as JSON |

#### Create Note

```bash
stickynotes note create [options]
```

| Option | Description |
|--------|-------------|
| `--title <title>` | Note title |
| `--content <content>` | Note content (supports Markdown) |
| `--color <color>` | Note color |
| `--folder <id>` | Folder ID to place note in |
| `--tags <tags>` | Comma-separated tag names |
| `--reminder <datetime>` | ISO 8601 reminder datetime |
| `--open` | Open note in app after creation |
| `--transcribe` | Start transcription after opening (requires --open) |
| `--source <src>` | Audio source for transcription: mic, system, both |
| `--json` | Output as JSON |

**Example:**

```bash
stickynotes note create --title "Meeting Notes" --content "# Agenda\n- Item 1\n- Item 2" --color blue --tags "work,meetings" --json
```

**Create note with transcription:**

```bash
stickynotes note create --title "Voice Note" --transcribe --source mic --open
```

#### Show Note

```bash
stickynotes note show <id> [--json]
```

#### Edit Note

```bash
stickynotes note edit <id> [options]
```

| Option | Description |
|--------|-------------|
| `--title <title>` | New title |
| `--content <content>` | New content (replaces existing) |
| `--append <text>` | Append to existing content |
| `--color <color>` | New color |
| `--folder <id>` | Move to folder |
| `--json` | Output as JSON |

#### Delete Note

```bash
stickynotes note delete <id> [--force]
```

- Without `--force`: Soft delete (moves to trash)
- With `--force`: Permanent deletion

#### Restore Note

```bash
stickynotes note restore <id>
```

Restores a note from trash.

#### Archive/Unarchive

```bash
stickynotes note archive <id>
stickynotes note unarchive <id>
```

#### Pin/Unpin

```bash
stickynotes note pin <id>
stickynotes note unpin <id>
```

#### Duplicate Note

```bash
stickynotes note duplicate <id> [--json]
```

#### Lock/Unlock (Encryption)

```bash
# Lock with password (encrypts content with AES-256-GCM)
stickynotes note lock <id> --password <password>

# Unlock with password (decrypts content)
stickynotes note unlock <id> --password <password>
```

**Warning**: If the password is forgotten, encrypted content cannot be recovered.

#### Tags on Notes

```bash
stickynotes note tag <id> <tagname>      # Add tag
stickynotes note untag <id> <tagname>    # Remove tag
```

#### Version History

```bash
stickynotes note history <id> [--json]   # Show history
stickynotes note revert <id> <version>   # Revert to version
```

#### Purge Trash

```bash
stickynotes note purge [--days <n>]      # Delete notes in trash older than n days
```

---

### Folders

#### List Folders

```bash
stickynotes folder list [--json]
stickynotes folder tree [--json]         # Hierarchical view
```

#### Create Folder

```bash
stickynotes folder create --name <name> [--parent <id>] [--color <color>] [--json]
```

#### Rename Folder

```bash
stickynotes folder rename <id> --name <newname>
```

#### Delete Folder

```bash
stickynotes folder delete <id> [--force]
```

- Without `--force`: Notes moved to root
- With `--force`: Notes also deleted

---

### Tags

#### List Tags

```bash
stickynotes tag list [--json]
```

#### Create Tag

```bash
stickynotes tag create --name <name> [--color <color>] [--json]
```

#### Rename Tag

```bash
stickynotes tag rename <id> --name <newname>
```

#### Delete Tag

```bash
stickynotes tag delete <id>
```

---

### Search

```bash
stickynotes search <query> [options]
```

| Option | Description |
|--------|-------------|
| `--folder <id>` | Search within folder |
| `--tag <name>` | Search notes with tag |
| `--limit <n>` | Limit results |
| `--json` | Output as JSON |

**Example:**

```bash
stickynotes search "meeting notes" --tag work --json
```

---

### Transcription (Voice Notes)

#### Quick Voice Note

```bash
stickynotes voice [options]
```

| Option | Description |
|--------|-------------|
| `--source <src>` | Audio source: mic, system, both (default: mic) |
| `--title <title>` | Note title |
| `--json` | Output as JSON |

**Examples:**

```bash
# Quick voice note with microphone
stickynotes voice --source mic

# Voice note with title
stickynotes voice --title "Meeting Notes" --source mic

# Voice note capturing system audio
stickynotes voice --source system
```

#### Whisper Model Management

```bash
stickynotes whisper status [--json]           # Check model status
stickynotes whisper download [--model <size>] # Download model (tiny/base/small)
stickynotes whisper delete [--model <size>]   # Delete model
stickynotes whisper list [--json]             # List available models
```

| Command | Description |
|---------|-------------|
| `status` | Check current model status (loaded, downloaded, path) |
| `download` | Download a Whisper model (default: small) |
| `delete` | Delete the current or specified model |
| `list` | List all available models with download status |

| Option | Description |
|--------|-------------|
| `--model <size>` | Model size: tiny (75MB), base (150MB), small (500MB) |
| `--json` | Output as JSON |

**Examples:**

```bash
# Check if model is downloaded and loaded
stickynotes whisper status

# Download the small model (best accuracy)
stickynotes whisper download --model small

# Download tiny model for faster transcription
stickynotes whisper download --model tiny

# List all models with download status
stickynotes whisper list --json

# Delete current model
stickynotes whisper delete
```

---

### Settings

#### List Settings

```bash
stickynotes settings list [--json]
```

#### Get Setting

```bash
stickynotes settings get <key>
```

#### Set Setting

```bash
stickynotes settings set <key> <value>
```

**Available Settings:**

| Key | Description | Default |
|-----|-------------|---------|
| `theme` | UI theme (light/dark/system) | system |
| `defaultColor` | Default note color | yellow |
| `defaultWidth` | Default note width | 300 |
| `defaultHeight` | Default note height | 350 |
| `fontSize` | Default font size | 14 |
| `opacity` | Default opacity (50-100) | 100 |
| `spellcheck` | Enable spellcheck | true |
| `autoSave` | Auto-save interval (ms) | 1000 |
| `maxHistory` | Max history versions per note | 10 |
| `trashRetention` | Days to keep trash | 30 |
| `whisper.enabled` | Enable transcription | true |
| `whisper.modelSize` | Model size (tiny/base/small) | small |
| `whisper.language` | Transcription language | en |
| `whisper.insertMode` | Text insertion mode | cursor |
| `whisper.defaultSource` | Default audio source | microphone |

---

### Database Operations

```bash
stickynotes db stats [--json]      # Database statistics
stickynotes db backup [--path]     # Create backup
stickynotes db vacuum              # Optimize database
```

---

## JSON Output Schema

### Note Object

```json
{
  "id": "abc123xyz789",
  "title": "Note Title",
  "content": "# Markdown content",
  "content_plain": "Plain text version",
  "color": "yellow",
  "folder_id": "folder-id-or-null",
  "is_pinned": 0,
  "is_locked": 0,
  "is_archived": 0,
  "is_deleted": 0,
  "reminder_at": "2024-12-25T10:00:00Z",
  "reminder_notified": 0,
  "created_at": "2024-01-15T10:00:00Z",
  "updated_at": "2024-01-15T12:00:00Z",
  "tags": ["tag1", "tag2"]
}
```

### Folder Object

```json
{
  "id": "folder-abc123",
  "name": "Folder Name",
  "parent_id": null,
  "color": "blue",
  "note_count": 5,
  "created_at": "2024-01-15T10:00:00Z"
}
```

### Tag Object

```json
{
  "id": 1,
  "name": "tag-name",
  "color": "red",
  "note_count": 3
}
```

### Error Response

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

---

## Common Workflows

### Create a Note with Full Context

```bash
# Create a work note in a specific folder with tags and reminder
stickynotes note create \
  --title "Project Planning" \
  --content "## Tasks\n- [ ] Task 1\n- [ ] Task 2" \
  --color blue \
  --folder "folder-work-123" \
  --tags "project,planning" \
  --reminder "2024-12-20T09:00:00Z" \
  --json
```

### Search and Update

```bash
# Find notes, then update
NOTES=$(stickynotes search "meeting" --json)
# Parse JSON and update specific note
stickynotes note edit "note-id" --append "\n\n## Follow-up\n- Action item"
```

### Organize Notes

```bash
# Create folder structure
stickynotes folder create --name "Work" --json
stickynotes folder create --name "Projects" --parent "folder-work-id" --json

# Move note to folder
stickynotes note edit "note-id" --folder "folder-projects-id"

# Tag for cross-cutting concerns
stickynotes note tag "note-id" "urgent"
```

### Secure Sensitive Notes

```bash
# Lock with password
stickynotes note lock "note-id" --password "mySecurePassword123"

# Content is now encrypted - show will display encrypted blob
stickynotes note show "note-id" --json

# Unlock to read/edit
stickynotes note unlock "note-id" --password "mySecurePassword123"
```

### Cleanup and Maintenance

```bash
# View trash
stickynotes note list --trash --json

# Restore accidentally deleted
stickynotes note restore "note-id"

# Purge old trash (older than 7 days)
stickynotes note purge --days 7

# Optimize database
stickynotes db vacuum
```

### Voice Notes Workflow

```bash
# Start a quick voice note from CLI
stickynotes voice --title "Meeting Notes" --source mic

# Or create with transcription flag
stickynotes note create --title "Ideas" --transcribe --source mic --open

# Capture system audio (e.g., from a video)
stickynotes voice --source system

# Capture both mic and system audio (useful for meetings)
stickynotes voice --source both --title "Team Call"

# Check whisper model status before transcribing
stickynotes whisper status

# Download a smaller model for faster transcription
stickynotes whisper download --model tiny
```

---

## Integration Tips

### For Scripting

1. **Always use `--json` flag** for reliable parsing
2. **Check exit codes**: 0 = success, non-zero = error
3. **IDs are nanoid format**: 21 characters, alphanumeric with `-_`
4. **Dates are ISO 8601**: `2024-01-15T10:00:00Z`
5. **Content supports Markdown**: Use `\n` for newlines in CLI

### Error Handling

```bash
# Check if note exists before operating
if stickynotes note show "note-id" --json > /dev/null 2>&1; then
  # Note exists
else
  # Note not found
fi
```

### Batch Operations

```bash
# Get all note IDs
stickynotes note list --json | jq -r '.[].id'

# Archive all notes with specific tag
for id in $(stickynotes note list --tag "old" --json | jq -r '.[].id'); do
  stickynotes note archive "$id"
done
```

---

## Limitations

- **No real-time sync**: CLI operates on local database
- **Single user**: No multi-user or cloud sync
- **Locked notes**: Cannot search encrypted content
- **Attachment paths**: Stored as references, not embedded

---

## Version

CLI Version: 2.0.0
Database Schema: v2 (with FTS5 search)
