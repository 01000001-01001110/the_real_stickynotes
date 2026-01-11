#!/usr/bin/env node
/**
 * StickyNotes First-Time Setup Script
 * 
 * This script handles the initial setup for new developers/devices:
 * 1. Installs dependencies
 * 2. Rebuilds native modules for the correct Node.js version
 * 3. Runs tests to verify everything works
 * 4. Optionally downloads Whisper model for speech-to-text
 * 5. Provides instructions for next steps
 */

import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync, createWriteStream, unlinkSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  console.log(`\n${colors.cyan}[${step}]${colors.reset} ${colors.bright}${message}${colors.reset}`);
}

function logSuccess(message) {
  console.log(`${colors.green}✓${colors.reset} ${message}`);
}

function logError(message) {
  console.log(`${colors.red}✗${colors.reset} ${message}`);
}

function logWarning(message) {
  console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
}

function runCommand(command, options = {}) {
  try {
    execSync(command, { 
      cwd: projectRoot, 
      stdio: 'inherit',
      ...options 
    });
    return true;
  } catch (error) {
    return false;
  }
}

function checkNodeVersion() {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0], 10);
  
  if (major < 18) {
    logError(`Node.js ${version} is too old. Please use Node.js 18 or later.`);
    process.exit(1);
  }
  
  logSuccess(`Node.js ${version} detected`);
  return major;
}

function checkNpmVersion() {
  try {
    const version = execSync('npm --version', { encoding: 'utf8' }).trim();
    logSuccess(`npm ${version} detected`);
    return version;
  } catch {
    logError('npm not found. Please install Node.js with npm.');
    process.exit(1);
  }
}

/**
 * Get the models directory path
 */
function getModelsPath() {
  const appName = 'StickyNotes';
  let appDataPath;
  
  switch (process.platform) {
    case 'win32':
      appDataPath = join(process.env.APPDATA || join(os.homedir(), 'AppData', 'Roaming'), appName);
      break;
    case 'darwin':
      appDataPath = join(os.homedir(), 'Library', 'Application Support', appName);
      break;
    default:
      appDataPath = join(os.homedir(), '.config', appName.toLowerCase());
  }
  
  return join(appDataPath, 'models');
}

/**
 * Download Whisper model
 */
async function downloadWhisperModel(size) {
  const models = {
    tiny: {
      url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
      filename: 'ggml-tiny.bin',
      size: '75MB',
    },
    base: {
      url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
      filename: 'ggml-base.bin',
      size: '150MB',
    },
    small: {
      url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
      filename: 'ggml-small.bin',
      size: '500MB',
    },
  };
  
  const model = models[size];
  if (!model) {
    throw new Error(`Unknown model size: ${size}. Use tiny, base, or small.`);
  }
  
  const modelsDir = getModelsPath();
  if (!existsSync(modelsDir)) {
    mkdirSync(modelsDir, { recursive: true });
  }
  
  const destPath = join(modelsDir, model.filename);
  const tempPath = destPath + '.tmp';
  
  // Check if already downloaded
  if (existsSync(destPath)) {
    log(`Model already exists at ${destPath}`, 'green');
    return destPath;
  }
  
  log(`Downloading ${model.size} model from Hugging Face...`, 'yellow');
  log(`This may take a while depending on your connection.`, 'yellow');
  
  return new Promise((resolve, reject) => {
    const downloadFile = (url) => {
      https.get(url, { headers: { 'User-Agent': 'StickyNotes/2.0' } }, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          downloadFile(response.headers.location);
          return;
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }
        
        const totalSize = parseInt(response.headers['content-length'] || '0', 10);
        let downloadedSize = 0;
        let lastPercent = -1;
        
        const file = createWriteStream(tempPath);
        
        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          if (totalSize > 0) {
            const percent = Math.floor((downloadedSize / totalSize) * 100);
            if (percent !== lastPercent && percent % 10 === 0) {
              process.stdout.write(`\r  Progress: ${percent}%`);
              lastPercent = percent;
            }
          }
        });
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close(() => {
            process.stdout.write('\r  Progress: 100%\n');
            renameSync(tempPath, destPath);
            log(`Model saved to: ${destPath}`, 'cyan');
            resolve(destPath);
          });
        });
        
        file.on('error', (err) => {
          file.close();
          if (existsSync(tempPath)) unlinkSync(tempPath);
          reject(err);
        });
      }).on('error', (err) => {
        if (existsSync(tempPath)) unlinkSync(tempPath);
        reject(err);
      });
    };
    
    downloadFile(model.url);
  });
}

async function main() {
  console.log(`
${colors.bright}╔═══════════════════════════════════════════╗
║       StickyNotes 2.0 Setup Script        ║
╚═══════════════════════════════════════════╝${colors.reset}
`);

  // Parse arguments
  const args = process.argv.slice(2);
  const forElectron = args.includes('--electron');
  const skipTests = args.includes('--skip-tests');
  const setupWhisper = args.includes('--whisper');
  const modelArg = args.find(a => a.startsWith('--model='));
  const modelSize = modelArg ? modelArg.split('=')[1] : 'small';
  const help = args.includes('--help') || args.includes('-h');

  if (help) {
    console.log(`
Usage: node scripts/setup.mjs [options]

Options:
  --electron       Build native modules for Electron (for running the app)
  --whisper        Download Whisper speech-to-text model
  --model=SIZE     Model size: tiny (75MB), base (150MB), small (500MB)
  --skip-tests     Skip running tests after setup
  --help, -h       Show this help message

Examples:
  node scripts/setup.mjs                        # Setup for testing/CLI
  node scripts/setup.mjs --electron             # Setup for running Electron app
  node scripts/setup.mjs --electron --whisper   # Setup with transcription
  node scripts/setup.mjs --whisper --model=tiny # Download tiny model only
`);
    process.exit(0);
  }

  // Determine total steps
  const totalSteps = setupWhisper ? 6 : 5;
  let currentStep = 0;

  // Step 1: Check environment
  currentStep++;
  logStep(`${currentStep}/${totalSteps}`, 'Checking environment...');
  const nodeVersion = checkNodeVersion();
  checkNpmVersion();

  // Step 2: Install dependencies
  currentStep++;
  logStep(`${currentStep}/${totalSteps}`, 'Installing dependencies...');
  
  if (!existsSync(join(projectRoot, 'node_modules'))) {
    log('Running npm install...', 'yellow');
    if (!runCommand('npm install')) {
      logError('Failed to install dependencies');
      process.exit(1);
    }
  } else {
    logSuccess('node_modules already exists');
    log('Running npm install to ensure all dependencies are up to date...', 'yellow');
    runCommand('npm install');
  }
  logSuccess('Dependencies installed');

  // Step 3: Rebuild native modules
  currentStep++;
  logStep(`${currentStep}/${totalSteps}`, `Rebuilding native modules for ${forElectron ? 'Electron' : 'Node.js'}...`);
  
  if (forElectron) {
    log('Running electron-rebuild...', 'yellow');
    if (!runCommand('npm run rebuild:electron')) {
      logError('Failed to rebuild for Electron');
      logWarning('You may need to install build tools. See README.md for details.');
      process.exit(1);
    }
    logSuccess('Native modules rebuilt for Electron');
  } else {
    log('Running npm rebuild better-sqlite3...', 'yellow');
    if (!runCommand('npm run rebuild')) {
      logError('Failed to rebuild better-sqlite3');
      logWarning('You may need to install build tools (Python, C++ compiler).');
      process.exit(1);
    }
    logSuccess('Native modules rebuilt for Node.js');
  }

  // Step 4: Run tests (unless building for Electron or skipped)
  currentStep++;
  if (!forElectron && !skipTests) {
    logStep(`${currentStep}/${totalSteps}`, 'Running tests to verify setup...');
    log('This may take a minute...', 'yellow');
    
    if (!runCommand('npm test -- --silent')) {
      logError('Some tests failed. Check the output above for details.');
      logWarning('The app may still work, but some functionality might be broken.');
    } else {
      logSuccess('All tests passed!');
    }
  } else {
    logStep(`${currentStep}/${totalSteps}`, 'Skipping tests');
    if (forElectron) {
      logWarning('Tests skipped (Electron build - use Node.js build to run tests)');
    } else {
      logWarning('Tests skipped (--skip-tests flag)');
    }
  }

  // Step 5: Download Whisper model (if requested)
  if (setupWhisper) {
    currentStep++;
    logStep(`${currentStep}/${totalSteps}`, `Downloading Whisper ${modelSize} model...`);
    
    try {
      await downloadWhisperModel(modelSize);
      logSuccess(`Whisper ${modelSize} model downloaded`);
    } catch (error) {
      logError(`Failed to download Whisper model: ${error.message}`);
      logWarning('You can download the model later from Settings > Transcription');
    }
  }

  // Final Step: Done!
  currentStep++;
  logStep(`${currentStep}/${totalSteps}`, 'Setup complete!');

  console.log(`
${colors.bright}═══════════════════════════════════════════${colors.reset}

${colors.green}✓ Setup completed successfully!${colors.reset}

${colors.bright}Next steps:${colors.reset}
`);

  if (forElectron) {
    console.log(`  ${colors.cyan}npm start${colors.reset}          - Start the desktop application
  ${colors.cyan}npm run dev${colors.reset}        - Start in development mode (with DevTools)
`);
    if (!setupWhisper) {
      console.log(`  ${colors.yellow}To enable speech-to-text, download the Whisper model:${colors.reset}
  ${colors.cyan}node scripts/setup.mjs --whisper${colors.reset}
  Or download it later from Settings > Transcription
`);
    }
  } else {
    console.log(`  ${colors.cyan}npm test${colors.reset}           - Run tests
  ${colors.cyan}npm run cli${colors.reset}        - Use the CLI tool
  
  ${colors.yellow}To run the Electron app, first rebuild for Electron:${colors.reset}
  ${colors.cyan}node scripts/setup.mjs --electron${colors.reset}
`);
  }

  console.log(`${colors.bright}Other useful commands:${colors.reset}
  ${colors.cyan}npm run lint${colors.reset}       - Check code style
  ${colors.cyan}npm run build${colors.reset}      - Build for distribution
  ${colors.cyan}npm run build:win${colors.reset}  - Build Windows installer
  
${colors.bright}Transcription setup:${colors.reset}
  ${colors.cyan}npm run setup:whisper${colors.reset}       - Setup with small model (500MB, best quality)
  ${colors.cyan}npm run setup:whisper:tiny${colors.reset}  - Setup with tiny model (75MB, fastest)

${colors.bright}═══════════════════════════════════════════${colors.reset}
`);
}

main().catch(error => {
  logError(`Setup failed: ${error.message}`);
  process.exit(1);
});
