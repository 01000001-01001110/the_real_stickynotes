/**
 * CLI pkg Configuration Tests
 *
 * Tests the yao-pkg configuration in package.json
 * for building standalone CLI executables.
 */

const path = require('path');
const fs = require('fs');

describe('CLI pkg Configuration', () => {
  let packageJson;

  beforeAll(() => {
    const packageJsonPath = path.join(__dirname, '..', '..', '..', 'package.json');
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  });

  describe('pkg Configuration', () => {
    it('should have pkg configuration in package.json', () => {
      expect(packageJson.pkg).toBeDefined();
    });

    it('should include CLI scripts in pkg configuration', () => {
      expect(packageJson.pkg.scripts).toBeDefined();
      expect(Array.isArray(packageJson.pkg.scripts)).toBe(true);
      expect(packageJson.pkg.scripts).toContain('cli/**/*.js');
    });

    it('should include electron/cli scripts for shared parser', () => {
      expect(packageJson.pkg.scripts).toContain('electron/cli/**/*.js');
    });

    it('should have defined targets', () => {
      expect(packageJson.pkg.targets).toBeDefined();
      expect(Array.isArray(packageJson.pkg.targets)).toBe(true);
    });

    it('should target Node.js 20 for all platforms', () => {
      const targets = packageJson.pkg.targets;
      expect(targets.some((t) => t.includes('node20'))).toBe(true);
    });

    it('should include Windows target', () => {
      const targets = packageJson.pkg.targets;
      expect(targets.some((t) => t.includes('win'))).toBe(true);
    });

    it('should include macOS target', () => {
      const targets = packageJson.pkg.targets;
      expect(targets.some((t) => t.includes('macos'))).toBe(true);
    });

    it('should include Linux target', () => {
      const targets = packageJson.pkg.targets;
      expect(targets.some((t) => t.includes('linux'))).toBe(true);
    });
  });

  describe('Build Scripts', () => {
    it('should have build:cli script', () => {
      expect(packageJson.scripts['build:cli']).toBeDefined();
    });

    it('should have build:cli:win script', () => {
      expect(packageJson.scripts['build:cli:win']).toBeDefined();
    });

    it('build:cli:win should target Windows x64', () => {
      const script = packageJson.scripts['build:cli:win'];
      expect(script).toContain('win-x64');
    });

    it('build:cli:win should use GZip compression', () => {
      const script = packageJson.scripts['build:cli:win'];
      expect(script).toContain('--compress GZip');
    });

    it('build:cli:win should output to dist/cli/', () => {
      const script = packageJson.scripts['build:cli:win'];
      expect(script).toContain('dist/cli/stickynotes.exe');
    });

    it('build:cli should target multiple platforms', () => {
      const script = packageJson.scripts['build:cli'];
      expect(script).toContain('win-x64');
      expect(script).toContain('macos-x64');
      expect(script).toContain('linux-x64');
    });
  });

  describe('Dependencies', () => {
    it('should have @yao-pkg/pkg as devDependency', () => {
      expect(packageJson.devDependencies['@yao-pkg/pkg']).toBeDefined();
    });
  });

  describe('CLI Entry Point', () => {
    it('should have bin configuration', () => {
      expect(packageJson.bin).toBeDefined();
      expect(packageJson.bin.stickynotes).toBeDefined();
    });

    it('should point to correct CLI entry', () => {
      expect(packageJson.bin.stickynotes).toBe('./cli/bin/stickynotes.js');
    });

    it('CLI entry point should exist', () => {
      const cliPath = path.join(__dirname, '..', '..', '..', 'cli', 'bin', 'stickynotes.js');
      expect(fs.existsSync(cliPath)).toBe(true);
    });
  });

  describe('CLI Dependencies', () => {
    it('should have all required CLI dependencies available', () => {
      // CLI uses these from cli/lib/
      const clientPath = path.join(__dirname, '..', '..', '..', 'cli', 'lib', 'client.js');
      const mapperPath = path.join(__dirname, '..', '..', '..', 'cli', 'lib', 'method-mapper.js');

      expect(fs.existsSync(clientPath)).toBe(true);
      expect(fs.existsSync(mapperPath)).toBe(true);
    });

    it('should have parser available', () => {
      const parserPath = path.join(__dirname, '..', '..', '..', 'electron', 'cli', 'parser.js');
      expect(fs.existsSync(parserPath)).toBe(true);
    });
  });
});

describe('asarUnpack Configuration', () => {
  let electronBuilderConfig;

  beforeAll(() => {
    const configPath = path.join(__dirname, '..', '..', '..', 'electron-builder.yml');
    const yaml = require('yaml');
    electronBuilderConfig = yaml.parse(fs.readFileSync(configPath, 'utf8'));
  });

  it('should have asarUnpack configuration', () => {
    expect(electronBuilderConfig.asarUnpack).toBeDefined();
    expect(Array.isArray(electronBuilderConfig.asarUnpack)).toBe(true);
  });

  it('should unpack CLI directory', () => {
    expect(electronBuilderConfig.asarUnpack).toContain('cli/**/*');
  });

  it('should unpack electron/cli directory for shared parser', () => {
    expect(electronBuilderConfig.asarUnpack).toContain('electron/cli/**/*');
  });
});
