# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

1. **Do NOT** open a public GitHub issue for security vulnerabilities
2. Email security concerns to: 48245017+01000001-01001110@users.noreply.github.com
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested fixes (optional)

### What to Expect

- **Response time**: Within 48 hours
- **Updates**: Every 5 business days until resolved
- **Credit**: Security researchers will be credited in release notes (unless anonymity is requested)

### Scope

The following are in scope:

- StickyNotes desktop application (Windows, macOS, Linux)
- CLI tool
- Local data storage and encryption
- IPC communication

The following are out of scope:

- Third-party dependencies (report to upstream maintainers)
- Social engineering attacks
- Physical attacks

## Security Features

StickyNotes includes several security features:

- **Local-first storage**: Data stays on your device by default
- **AES-256 encryption**: Optional password protection for sensitive notes
- **No telemetry**: No data collection or tracking
- **Named pipe IPC**: Secure local communication (no network exposure)

## Best Practices

- Keep StickyNotes updated to the latest version
- Use strong passwords for encrypted notes
- Store your data folder in an encrypted volume for additional security
