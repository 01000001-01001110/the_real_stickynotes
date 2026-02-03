# Contributing to StickyNotes

Thank you for your interest in contributing to StickyNotes! This document provides guidelines and information for contributors.

## Getting Started

1. **Fork the repository** and clone it locally
2. **Install dependencies**: `npm install`
3. **Run in development mode**: `npm run dev`

## Development Setup

```bash
# Install dependencies
npm install

# Run in development mode (with hot reload)
npm run dev

# Run tests
npm test

# Build for your platform
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

## Project Structure

```
├── electron/       # Main process (Node.js/Electron)
│   ├── main.js     # Entry point
│   ├── ipc/        # IPC handlers
│   └── windows/    # Window management
├── src/            # Renderer process (HTML/CSS/JS)
│   ├── panel/      # Main notes panel
│   ├── note/       # Note windows
│   └── settings/   # Settings page
├── shared/         # Shared between processes
├── cli/            # Command-line interface
└── test/           # Jest tests
```

## How to Contribute

### Reporting Bugs

1. Check if the issue already exists
2. Create a new issue using the bug report template
3. Include steps to reproduce, expected behavior, and actual behavior
4. Add screenshots if applicable

**Tip:** Add the `claude-fix` label to your issue and our AI assistant will attempt to create a fix!

### Suggesting Features

1. Create a new issue using the feature request template
2. Describe the feature and why it would be useful
3. Include mockups or examples if possible

### Submitting Pull Requests

1. Create a branch from `main`: `git checkout -b feature/your-feature`
2. Make your changes
3. Write or update tests as needed
4. Run tests: `npm test`
5. Commit with a clear message
6. Push and create a pull request

**Note:** Our Claude AI assistant automatically reviews PRs and can help with code suggestions!

## Code Style

- **No TypeScript** - This is a JavaScript project
- **Settings** - Add new settings to `shared/constants/settings.js`
- **CSS Variables** - Define custom properties in `:root` blocks
- **IPC** - Follow existing patterns in `electron/ipc/`

## Testing

```bash
npm test              # Run all tests
npm run test:unit     # Unit tests only
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

## Getting Help

- **Ask Claude**: Comment `@claude` on any issue or PR for AI assistance
- **Issues**: Open an issue for bugs or questions
- **Discussions**: Use GitHub Discussions for general questions

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
