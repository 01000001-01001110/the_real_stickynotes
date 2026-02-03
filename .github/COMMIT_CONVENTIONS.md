# Commit Message Conventions

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for automatic semantic versioning and changelog generation.

## Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

## Types

- **feat**: A new feature (triggers MINOR version bump, e.g., 0.1.0 → 0.2.0)
- **fix**: A bug fix (triggers PATCH version bump, e.g., 0.1.0 → 0.1.1)
- **docs**: Documentation only changes
- **style**: Code style changes (formatting, missing semi-colons, etc.)
- **refactor**: Code changes that neither fix a bug nor add a feature
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **build**: Changes to build system or dependencies
- **ci**: Changes to CI configuration files and scripts
- **chore**: Other changes that don't modify src or test files
- **revert**: Reverts a previous commit

## Breaking Changes

Add `BREAKING CHANGE:` in the footer or `!` after the type to trigger a MAJOR version bump (e.g., 0.1.0 → 1.0.0):

```
feat!: remove whisper transcription feature

BREAKING CHANGE: Voice transcription has been removed. Users relying on this feature will need to find alternatives.
```

## Examples

### Feature (Minor bump)

```
feat(cli): add support for exporting notes to PDF

Added new `stickynotes export --format pdf` command that exports all notes to a PDF document.
```

### Bug Fix (Patch bump)

```
fix(panel): prevent delete button from appearing in note previews

The image delete button was incorrectly showing in the note list preview. Updated sanitizePreviewHtml to remove .image-delete-btn elements.
```

### Documentation (Patch bump)

```
docs: add CLI usage examples to README

Added comprehensive examples for all CLI commands including search, tags, and export functionality.
```

### Breaking Change (Major bump)

```
feat!: migrate to new settings storage format

BREAKING CHANGE: Settings are now stored in SQLite instead of YAML. Users will need to reconfigure their settings on first launch.
```

## Footer Format

All commits MUST include this footer:

```
Orchestrated, and Developed by 01000001-01001110 with help from Claude Code, and Claude Opus 4.5 orchestrating 30+ subagents.

Orchestration Agent: Claude Opus 4.5 <noreply@anthropic.com>
```

## Complete Example

```
feat(settings): add CLI PATH toggle in settings

Users can now enable/disable CLI PATH integration from the settings window without reinstalling.

- Added general.enableCLI setting to schema
- Created shared/utils/cli-path.js for PATH manipulation
- Updated installer to auto-add CLI to PATH

Closes #42

Orchestrated, and Developed by 01000001-01001110 with help from Claude Code, and Claude Opus 4.5 orchestrating 30+ subagents.

Orchestration Agent: Claude Opus 4.5 <noreply@anthropic.com>
```

## Version Bumping

- **Major (1.0.0)**: Breaking changes (add `!` or `BREAKING CHANGE:`)
- **Minor (0.1.0)**: New features (`feat:`)
- **Patch (0.0.1)**: Bug fixes, docs, refactoring, performance (`fix:`, `docs:`, `perf:`, `refactor:`)

## Automatic Releases

When you push to `main`:

1. Semantic Release analyzes commit messages since last release
2. Determines version bump based on commit types
3. Updates `package.json` and `README.md`
4. Generates `CHANGELOG.md`
5. Creates git tag
6. Creates GitHub release with notes

## Skip CI

To skip the release process (e.g., for trivial changes):

```
chore: update .gitignore [skip ci]
```
