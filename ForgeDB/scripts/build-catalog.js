#!/usr/bin/env node

/**
 * ForgeDB Catalog Compiler
 *
 * Compiles modular YAML device descriptors, images, vendors, and fingerprints
 * into unified JSON catalog distributions (dist/catalog.json, dist/boards.json, etc.).
 */

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const yaml = require('js-yaml');

const FORGEDB_ROOT = path.resolve(__dirname, '..');
const DEVICES_DIR = path.join(FORGEDB_ROOT, 'devices');
const VENDORS_DIR = path.join(FORGEDB_ROOT, 'vendors');
const DIST_DIR = path.join(FORGEDB_ROOT, 'dist');

// Read Git Commit SHA
function getCommitSha() {
  if (process.env.GITHUB_SHA) {
    return process.env.GITHUB_SHA;
  }
  try {
    const sha = child_process.execSync('git rev-parse HEAD', {
      cwd: FORGEDB_ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8'
    }).trim();
    if (sha) return sha;
  } catch (_) {
    // ignore git error in non-git or bare environments
  }
  return 'local-dev';
}

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

// Resolve photo URL (jsDelivr CDN)
function resolvePhotoUrl(deviceDir) {
  const relFromForgeDB = path.relative(FORGEDB_ROOT, deviceDir).replace(/\\/g, '/');
  const candidates = [
    'photo.png',
    'photo.jpg',
    'photo.jpeg',
    'photo.webp',
    'photos/photo.png',
    'photos/photo.jpg',
    'photos/btve10.png',
    'photos/btv.png'
  ];

  for (const candidate of candidates) {
    const fullPath = path.join(deviceDir, candidate);
    if (fs.existsSync(fullPath)) {
      return `https://cdn.jsdelivr.net/gh/multi-forge/multi-forge@main/ForgeDB/${relFromForgeDB}/${candidate}`;
    }
  }

  // Check photos directory
  const photosDir = path.join(deviceDir, 'photos');
  if (fs.existsSync(photosDir)) {
    const files = fs.readdirSync(photosDir).filter(f => /\.(png|jpe?g|webp)$/i.test(f));
    if (files.length > 0) {
      return `https://cdn.jsdelivr.net/gh/multi-forge/multi-forge@main/ForgeDB/${relFromForgeDB}/photos/${files[0]}`;
    }
  }

  // Default fallback URL
  return `https://cdn.jsdelivr.net/gh/multi-forge/multi-forge@main/ForgeDB/${relFromForgeDB}/photo.png`;
}

// Normalize category name
function normalizeCategory(cat) {
  if (!cat) return 'other';
  return cat.toLowerCase().trim().replace(/\s+/g, '-');
}

// Normalize single image object
function normalizeImage(rawImg, deviceId, defaultBootMedia) {
  const imgId = rawImg.id;
  const distribution = rawImg.distribution || 'ForgeOS';

  let variant = rawImg.variant;
  if (!variant) {
    const lowerId = (imgId || '').toLowerCase();
    const lowerDist = distribution.toLowerCase();
    if (lowerId.includes('desktop') || lowerDist.includes('desktop')) variant = 'desktop';
    else if (lowerId.includes('server') || lowerDist.includes('server')) variant = 'server';
    else if (lowerId.includes('iot') || lowerDist.includes('iot')) variant = 'iot';
    else variant = 'standard';
  }

  let kernelObj = { branch: 'current', version: '6.1.y' };
  if (typeof rawImg.kernel === 'object' && rawImg.kernel !== null) {
    kernelObj = {
      branch: rawImg.kernel.branch || 'current',
      version: rawImg.kernel.version || '6.1.y'
    };
  } else if (typeof rawImg.kernel === 'string') {
    kernelObj = {
      branch: 'current',
      version: rawImg.kernel
    };
  }

  let downloadObj;
  if (rawImg.download && typeof rawImg.download === 'object') {
    downloadObj = {
      url: rawImg.download.url || rawImg.url || '',
      sha256_url: rawImg.download.sha256_url !== undefined ? rawImg.download.sha256_url : (rawImg.sha256_url || null),
      size_bytes: rawImg.download.size_bytes !== undefined ? rawImg.download.size_bytes : (rawImg.size_bytes || null),
      format: rawImg.download.format || rawImg.format || 'img.xz'
    };
  } else {
    downloadObj = {
      url: rawImg.url || '',
      sha256_url: rawImg.sha256_url || null,
      size_bytes: rawImg.size_bytes || null,
      format: rawImg.format || (rawImg.url && rawImg.url.endsWith('.iso') ? 'iso' : 'img.xz')
    };
  }

  return {
    id: imgId,
    device_id: rawImg.device_id || deviceId,
    distribution: distribution,
    variant: variant,
    version: rawImg.version ? String(rawImg.version) : '1.0.0',
    kernel: kernelObj,
    stability: rawImg.stability || 'stable',
    recommended: Boolean(rawImg.recommended),
    download: downloadObj,
    flash_target: rawImg.flash_target || defaultBootMedia || ['sd', 'emmc']
  };
}

// Build catalog
function buildCatalog() {
  console.log('='.repeat(60));
  console.log(' ForgeDB Catalog Compiler');
  console.log('='.repeat(60));
  console.log(`Source root: ${FORGEDB_ROOT}`);
  console.log(`Output directory: ${DIST_DIR}\n`);

  const boards = [];
  const images = [];
  const vendors = [];
  const fingerprints = [];

  // 1. Scan devices
  const deviceYamlFiles = findFiles(DEVICES_DIR, name => name === 'device.yaml' || name === 'device.yml');
  console.log(`Found ${deviceYamlFiles.length} device descriptor(s)...`);

  for (const devPath of deviceYamlFiles) {
    const deviceDir = path.dirname(devPath);
    let deviceData;
    try {
      deviceData = yaml.load(fs.readFileSync(devPath, 'utf8'), { filename: devPath });
    } catch (err) {
      console.error(`[ERROR] Failed to parse ${devPath}: ${err.message}`);
      continue;
    }

    if (!deviceData || typeof deviceData !== 'object') continue;

    const deviceId = deviceData.id || deviceData.slug || path.basename(deviceDir);
    const deviceSlug = deviceData.slug || deviceData.id || path.basename(deviceDir);

    // Boot media
    const bootMedia = deviceData.boot_media ||
      deviceData.boot?.boot_media ||
      (deviceData.boot?.preferred_flash_tool?.includes('aml') ? ['sd', 'emmc'] : ['sd', 'emmc']);

    // 2. Scan images for this device
    const deviceImages = [];
    const imagesYamlPath = path.join(deviceDir, 'images.yaml');
    const imagesYmlPath = path.join(deviceDir, 'images.yml');
    let loadedImagesFile = null;

    if (fs.existsSync(imagesYamlPath)) loadedImagesFile = imagesYamlPath;
    else if (fs.existsSync(imagesYmlPath)) loadedImagesFile = imagesYmlPath;

    if (loadedImagesFile) {
      try {
        const rawImagesData = yaml.load(fs.readFileSync(loadedImagesFile, 'utf8'), { filename: loadedImagesFile });
        const list = Array.isArray(rawImagesData) ? rawImagesData : (rawImagesData?.images || []);
        for (const item of list) {
          const normalized = normalizeImage(item, deviceId, bootMedia);
          deviceImages.push(normalized);
          images.push(normalized);
        }
      } catch (err) {
        console.error(`[ERROR] Failed to parse ${loadedImagesFile}: ${err.message}`);
      }
    } else if (Array.isArray(deviceData.images)) {
      // Fallback: images defined inside device.yaml
      for (const item of deviceData.images) {
        const normalized = normalizeImage(item, deviceId, bootMedia);
        deviceImages.push(normalized);
        images.push(normalized);
      }
    }

    // Has desktop check
    const hasDesktop = deviceImages.some(img => {
      const v = (img.variant || '').toLowerCase();
      const d = (img.distribution || '').toLowerCase();
      const id = (img.id || '').toLowerCase();
      return v === 'desktop' || d.includes('desktop') || id.includes('desktop');
    });

    // SoC specs
    const soc = {
      vendor: deviceData.hardware?.soc?.vendor || deviceData.soc?.vendor || 'Unknown',
      model: deviceData.hardware?.soc?.model || deviceData.soc?.model || 'Unknown',
      family: deviceData.hardware?.soc?.family || deviceData.soc?.family || (deviceData.boot?.dtb ? deviceData.boot.dtb.split('-').slice(0, 2).join('-') : 'unknown'),
      architecture: (deviceData.hardware?.soc?.architecture || deviceData.soc?.architecture || 'arm64').toLowerCase()
    };

    // Memory specs
    const memory = {
      ram: deviceData.hardware?.memory?.ram || deviceData.memory?.ram || '',
      storage: deviceData.hardware?.memory?.storage || deviceData.memory?.storage || '',
      storage_type: deviceData.hardware?.memory?.storage_type || deviceData.memory?.storage_type || 'emmc'
    };

    // Summary board object
    const boardSummary = {
      id: deviceId,
      slug: deviceSlug,
      name: deviceData.name || deviceId,
      manufacturer: (deviceData.manufacturer || deviceData.vendor || '').toLowerCase(),
      category: normalizeCategory(deviceData.category),
      status: deviceData.status || 'supported',
      description: deviceData.description || '',
      soc: soc,
      memory: memory,
      boot_media: bootMedia,
      image_count: deviceImages.length,
      has_desktop: hasDesktop,
      photo_url: resolvePhotoUrl(deviceDir)
    };

    boards.push(boardSummary);

    // 3. Extract Fingerprints
    if (deviceData.fingerprints && typeof deviceData.fingerprints === 'object') {
      fingerprints.push({
        device_id: deviceId,
        cpuinfo: deviceData.fingerprints.cpuinfo || {},
        device_tree: deviceData.fingerprints.device_tree || {},
        usb: deviceData.fingerprints.usb || [],
        storage_model: deviceData.fingerprints.storage_model || {}
      });
    }
  }

  // 4. Scan vendors
  const vendorYamlFiles = findFiles(VENDORS_DIR, name => name.endsWith('.yaml') || name.endsWith('.yml'));
  console.log(`Found ${vendorYamlFiles.length} vendor descriptor(s)...`);

  for (const vPath of vendorYamlFiles) {
    try {
      const vData = yaml.load(fs.readFileSync(vPath, 'utf8'), { filename: vPath });
      if (vData && typeof vData === 'object') {
        vendors.push({
          id: vData.id || path.basename(vPath, path.extname(vPath)),
          name: vData.name || vData.id,
          website: vData.website || null,
          country: vData.country || null,
          description: vData.description || '',
          logo_url: vData.logo_url || vData.logo || null
        });
      }
    } catch (err) {
      console.error(`[ERROR] Failed to parse ${vPath}: ${err.message}`);
    }
  }

  // 5. Assemble Catalog
  const commitSha = getCommitSha();
  const timestamp = new Date().toISOString();

  const catalog = {
    version: '2.0.0',
    generated_at: timestamp,
    commit_sha: commitSha,
    board_count: boards.length,
    image_count: images.length,
    boards: boards,
    images: images,
    vendors: vendors,
    fingerprints: fingerprints
  };

  const versionData = {
    version: catalog.version,
    generated_at: catalog.generated_at,
    commit_sha: catalog.commit_sha,
    board_count: catalog.board_count,
    image_count: catalog.image_count
  };

  // 6. Write distribution files
  fs.mkdirSync(DIST_DIR, { recursive: true });

  fs.writeFileSync(path.join(DIST_DIR, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(DIST_DIR, 'catalog.min.json'), JSON.stringify(catalog), 'utf8');
  fs.writeFileSync(path.join(DIST_DIR, 'boards.json'), JSON.stringify(boards, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(DIST_DIR, 'images.json'), JSON.stringify(images, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(DIST_DIR, 'vendors.json'), JSON.stringify(vendors, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(DIST_DIR, 'fingerprints.json'), JSON.stringify(fingerprints, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(DIST_DIR, 'version.json'), JSON.stringify(versionData, null, 2) + '\n', 'utf8');

  console.log('\n' + '-'.repeat(60));
  console.log(' Compilation Summary:');
  console.log(`  • Boards:        ${boards.length}`);
  console.log(`  • Images:        ${images.length}`);
  console.log(`  • Vendors:       ${vendors.length}`);
  console.log(`  • Fingerprints:  ${fingerprints.length}`);
  console.log(`  • Commit SHA:    ${commitSha}`);
  console.log(`  • Generated at:  ${timestamp}`);
  console.log('-'.repeat(60));
  console.log(' Output Artifacts written to dist/:');
  console.log('  ✓ dist/catalog.json');
  console.log('  ✓ dist/catalog.min.json');
  console.log('  ✓ dist/boards.json');
  console.log('  ✓ dist/images.json');
  console.log('  ✓ dist/vendors.json');
  console.log('  ✓ dist/fingerprints.json');
  console.log('  ✓ dist/version.json');
  console.log('='.repeat(60));
  console.log('✓ Catalog build completed successfully.\n');
}

if (require.main === module) {
  buildCatalog();
}

module.exports = { buildCatalog };
