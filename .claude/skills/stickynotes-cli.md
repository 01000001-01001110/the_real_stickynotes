# StickyNotes CLI Skill

> Use StickyNotes as persistent storage for notes, tasks, and information via CLI.

## Overview

StickyNotes provides a command-line interface that AI agents can use to:

- Save notes, research findings, and important information
- Create task lists and track progress
- Organize information with folders and tags
- Search and retrieve previously saved content
- Maintain persistent memory across sessions

**Requirement**: The StickyNotes desktop app must be running.

## Quick Start

```bash
# Check if StickyNotes is running
stickynotes app status

# Create a note
stickynotes note create --title "Meeting Notes" --content "Discussion points..."

# Search notes
stickynotes search "meeting" --json

# List all notes
stickynotes note list --json
```

## Core Commands

### Create Notes

```bash
# Simple note
stickynotes note create --title "Title" --content "Content here"

# Note with tags for organization
stickynotes note create --title "Research" --content "Findings..." --tags "research,project-x"

# Note in a specific folder
stickynotes note create --title "Task" --content "Todo item" --folder "Tasks"

# Note with color
stickynotes note create --title "Urgent" --content "Important!" --color red
```

**Colors**: yellow, pink, blue, green, purple, orange, gray, charcoal

### Read Notes

```bash
# Get specific note by ID
stickynotes note show <note-id> --json

# List all notes
stickynotes note list --json

# List notes with specific tag
stickynotes note list --tag "research" --json

# List notes in folder
stickynotes note list --folder "Tasks" --json
```

### Update Notes

```bash
# Update content
stickynotes note edit <note-id> --content "New content"

# Update title
stickynotes note edit <note-id> --title "New Title"

# Append to existing content
stickynotes note edit <note-id> --append "Additional info..."

# Change color
stickynotes note edit <note-id> --color blue
```

### Search Notes

```bash
# Full-text search
stickynotes search "keyword" --json

# Search with limit
stickynotes search "meeting" --limit 10 --json

# Search in specific folder
stickynotes search "task" --folder "Work" --json
```

### Organize with Tags

```bash
# Add tag to note
stickynotes tag add <note-id> "important"

# Remove tag
stickynotes tag remove <note-id> "old-tag"

# List all tags
stickynotes tag list --json
```

### Organize with Folders

```bash
# Create folder
stickynotes folder create "Projects"

# List folders
stickynotes folder list --json

# Move note to folder
stickynotes note edit <note-id> --folder "Projects"
```

### Delete & Archive

```bash
# Move to trash (recoverable)
stickynotes note delete <note-id>

# Permanent delete
stickynotes note delete <note-id> --force

# Archive (hide but keep)
stickynotes note archive <note-id>

# Restore from archive
stickynotes note unarchive <note-id>
```

## JSON Output

Always use `--json` flag for programmatic access. Output format:

```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "title": "Note Title",
    "content": "Note content...",
    "color": "yellow",
    "tags": ["tag1", "tag2"],
    "folder_id": null,
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T12:00:00Z"
  }
}
```

## Use Cases for AI Agents

### 1. Save Research Findings

```bash
stickynotes note create \
  --title "Research: Topic X" \
  --content "Key findings:
- Point 1
- Point 2
- Source: URL" \
  --tags "research,topic-x"
```

### 2. Track Task Progress

```bash
# Create task note
stickynotes note create \
  --title "Task: Implement Feature" \
  --content "[ ] Step 1
[ ] Step 2
[ ] Step 3" \
  --tags "task,in-progress" \
  --color blue

# Update progress
stickynotes note edit <id> --content "[x] Step 1
[ ] Step 2
[ ] Step 3"
```

### 3. Store Session Memory

```bash
# Save conversation context
stickynotes note create \
  --title "Session: 2024-01-15" \
  --content "User preferences:
- Prefers concise answers
- Working on Project X
- Key decisions made: ..." \
  --tags "session,context"
```

### 4. Create Knowledge Base

```bash
# Save reusable information
stickynotes note create \
  --title "Reference: API Endpoints" \
  --content "GET /api/users - List users
POST /api/users - Create user
..." \
  --tags "reference,api" \
  --folder "Documentation"
```

### 5. Log Important Events

```bash
stickynotes note create \
  --title "Log: $(date +%Y-%m-%d)" \
  --content "Events:
- 10:00 - Started task X
- 11:30 - Completed milestone" \
  --tags "log,daily"
```

## Best Practices

1. **Always use --json** for reliable parsing
2. **Use tags** for easy retrieval (e.g., `research`, `task`, `reference`)
3. **Use folders** for project organization
4. **Use colors** to indicate priority (red=urgent, blue=in-progress, green=done)
5. **Include timestamps** in content for context
6. **Search before creating** to avoid duplicates

## Error Handling

```bash
# Check if app is running first
if ! stickynotes app status --json | grep -q '"running":true'; then
  echo "StickyNotes is not running"
  exit 1
fi
```

## Common Patterns

### Find and Update

```bash
# Find note by search, get ID, then update
NOTE_ID=$(stickynotes search "meeting notes" --json | jq -r '.data[0].id')
stickynotes note edit "$NOTE_ID" --append "New information added"
```

### Batch Tag

```bash
# Add tag to multiple notes
for id in $(stickynotes note list --json | jq -r '.data[].id'); do
  stickynotes tag add "$id" "reviewed"
done
```

### Daily Note

```bash
# Create or update daily note
TODAY=$(date +%Y-%m-%d)
EXISTING=$(stickynotes search "Daily: $TODAY" --json | jq -r '.data[0].id')

if [ "$EXISTING" != "null" ]; then
  stickynotes note edit "$EXISTING" --append "New entry..."
else
  stickynotes note create --title "Daily: $TODAY" --content "Entry 1..." --tags "daily"
fi
```

## Quick Reference

| Action       | Command                                             |
| ------------ | --------------------------------------------------- |
| Create note  | `stickynotes note create --title "X" --content "Y"` |
| List notes   | `stickynotes note list --json`                      |
| Search       | `stickynotes search "query" --json`                 |
| Get note     | `stickynotes note show <id> --json`                 |
| Update note  | `stickynotes note edit <id> --content "new"`        |
| Add tag      | `stickynotes tag add <id> "tag"`                    |
| Delete       | `stickynotes note delete <id>`                      |
| Check status | `stickynotes app status`                            |
