#!/usr/bin/env node

/**
 * ForgeDB Schema Validation Script
 *
 * Validates YAML manifests (devices, images, vendors, modules) against their
 * corresponding Draft 2020-12 JSON schemas using Ajv.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const FORGEDB_ROOT = path.resolve(__dirname, '..');
const SCHEMAS_DIR = path.join(FORGEDB_ROOT, 'schemas');
const DEVICES_DIR = path.join(FORGEDB_ROOT, 'devices');
const VENDORS_DIR = path.join(FORGEDB_ROOT, 'vendors');
const MODULES_DIR = path.join(FORGEDB_ROOT, 'modules');

// Initialize Ajv with Draft 2020-12 support
const ajv = new Ajv2020({
  allErrors: true,
  verbose: true,
  strict: false
});
addFormats(ajv);

// Load schema helper
function loadSchema(schemaName) {
  const schemaPath = path.join(SCHEMAS_DIR, schemaName);
  if (!fs.existsSync(schemaPath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(schemaPath, 'utf8');
    const schema = JSON.parse(raw);
    return ajv.compile(schema);
  } catch (err) {
    console.error(`[ERROR] Failed to compile schema ${schemaName}: ${err.message}`);
    process.exit(1);
  }
}

// Pre-load validators
const validators = {
  device: loadSchema('device.schema.json'),
  image: loadSchema('images.schema.json') || loadSchema('image.schema.json'),
  vendor: loadSchema('vendor.schema.json'),
  module: loadSchema('module.schema.json')
};

// Recursive file scanner
function findFiles(dir, matchFn) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist') {
          walk(fullPath);
        }
      } else if (entry.isFile() && matchFn(entry.name, fullPath)) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let targetType = 'all';
  let targetFile = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--type' && i + 1 < args.length) {
      targetType = args[++i].toLowerCase();
    } else if (args[i] === '--file' && i + 1 < args.length) {
      targetFile = args[++i];
    } else if (args[i].startsWith('--type=')) {
      targetType = args[i].split('=')[1].toLowerCase();
    } else if (args[i].startsWith('--file=')) {
      targetFile = args[i].split('=')[1];
    }
  }

  return { targetType, targetFile };
}

// Format Ajv errors
function formatErrors(errors) {
  if (!errors || errors.length === 0) return '  (No error details available)';
  return errors
    .map(e => {
      const field = e.instancePath ? `Property '${e.instancePath}'` : 'Root document';
      return `    • ${field} ${e.message} (params: ${JSON.stringify(e.params)})`;
    })
    .join('\n');
}

// Validate a single file
function validateFile(filePath, type) {
  const relativePath = path.relative(FORGEDB_ROOT, filePath).replace(/\\/g, '/');
  const validator = validators[type];

  if (!validator) {
    return {
      filePath,
      relativePath,
      type,
      valid: false,
      error: `No validator available for type '${type}'`
    };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = yaml.load(content, { filename: filePath });

    if (data === null || typeof data !== 'object') {
      return {
        filePath,
        relativePath,
        type,
        valid: false,
        error: 'YAML document must parse to an object'
      };
    }

    const isValid = validator(data);
    if (!isValid) {
      return {
        filePath,
        relativePath,
        type,
        valid: false,
        errors: validator.errors
      };
    }

    return {
      filePath,
      relativePath,
      type,
      valid: true
    };
  } catch (err) {
    return {
      filePath,
      relativePath,
      type,
      valid: false,
      error: `YAML Parse Error: ${err.message}`
    };
  }
}

// Main execution
function main() {
  const { targetType, targetFile } = parseArgs();

  console.log('='.repeat(60));
  console.log(' ForgeDB YAML Validator');
  console.log('='.repeat(60));
  console.log(`Target Type: ${targetType}`);
  if (targetFile) console.log(`Target File: ${targetFile}`);
  console.log('');

  const filesToValidate = [];

  if (targetFile) {
    const absPath = path.resolve(process.cwd(), targetFile);
    let type = targetType;
    if (type === 'all') {
      const base = path.basename(absPath).toLowerCase();
      if (base === 'device.yaml' || base === 'device.yml') type = 'device';
      else if (base === 'images.yaml' || base === 'images.yml') type = 'image';
      else if (base === 'module.yaml' || base === 'module.yml') type = 'module';
      else if (absPath.includes(path.sep + 'vendors' + path.sep)) type = 'vendor';
      else type = 'device';
    }
    filesToValidate.push({ path: absPath, type });
  } else {
    // Scan devices
    if (targetType === 'all' || targetType === 'device' || targetType === 'devices') {
      const deviceFiles = findFiles(DEVICES_DIR, name => name === 'device.yaml' || name === 'device.yml');
      deviceFiles.forEach(f => filesToValidate.push({ path: f, type: 'device' }));
    }

    // Scan images
    if (targetType === 'all' || targetType === 'image' || targetType === 'images') {
      const imageFiles = findFiles(DEVICES_DIR, name => name === 'images.yaml' || name === 'images.yml');
      imageFiles.forEach(f => filesToValidate.push({ path: f, type: 'image' }));
    }

    // Scan vendors
    if (targetType === 'all' || targetType === 'vendor' || targetType === 'vendors') {
      const vendorFiles = findFiles(VENDORS_DIR, name => name.endsWith('.yaml') || name.endsWith('.yml'));
      vendorFiles.forEach(f => filesToValidate.push({ path: f, type: 'vendor' }));
    }

    // Scan modules
    if (targetType === 'all' || targetType === 'module' || targetType === 'modules') {
      const moduleFiles = findFiles(MODULES_DIR, name => name === 'module.yaml' || name === 'module.yml');
      moduleFiles.forEach(f => filesToValidate.push({ path: f, type: 'module' }));
    }
  }

  if (filesToValidate.length === 0) {
    console.log('[WARN] No YAML files found matching the criteria.');
    process.exit(0);
  }

  console.log(`Found ${filesToValidate.length} file(s) to validate...\n`);

  let totalValid = 0;
  let totalInvalid = 0;
  const failures = [];

  for (const item of filesToValidate) {
    const result = validateFile(item.path, item.type);
    if (result.valid) {
      console.log(`  ✓ [${item.type.toUpperCase()}] ${result.relativePath}`);
      totalValid++;
    } else {
      console.log(`  ✗ [${item.type.toUpperCase()}] ${result.relativePath}`);
      totalInvalid++;
      failures.push(result);
    }
  }

  console.log('\n' + '-'.repeat(60));
  if (totalInvalid > 0) {
    console.error(`\nValidation FAILED (${totalInvalid} error(s) in ${filesToValidate.length} files):\n`);
    for (const failure of failures) {
      console.error(`[FILE] ${failure.relativePath} (${failure.type})`);
      if (failure.error) {
        console.error(`  Error: ${failure.error}`);
      }
      if (failure.errors) {
        console.error(formatErrors(failure.errors));
      }
      console.error('');
    }
    process.exit(1);
  } else {
    console.log(`\n✓ Validation PASSED: All ${totalValid} file(s) are valid according to schema.`);
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = { validateFile, findFiles, validators };
