#!/usr/bin/env node
/**
 * Create or verify recommended indexes for qrLoginSessions collection.
 * Tries CloudBase Manager SDK if available; otherwise prints guidance.
 */

const dotenv = require('dotenv');
const path = require('path');

// Load env from repo root
try { dotenv.config({ path: path.resolve(__dirname, '../.env') }); } catch {}
try { dotenv.config({ path: path.resolve(__dirname, '../.env.local') }); } catch {}
try { dotenv.config({ path: path.resolve(__dirname, '..', '.env') }); } catch {}

async function main() {
  const envId = process.env.TCB_ENV || process.env.VITE_TCB_ENV_ID || process.env.CLOUDBASE_ENV_ID || '';
  const secretId = process.env.TENCENTCLOUD_SECRETID || '';
  const secretKey = process.env.TENCENTCLOUD_SECRETKEY || '';

  console.log('[qr-indexes] Using env:', envId || '(missing)');

  if (!envId || !secretId || !secretKey) {
    console.warn('[qr-indexes] Missing env or credentials. Please set TCB_ENV and TENCENTCLOUD_SECRETID/TENCENTCLOUD_SECRETKEY.');
    printGuidance();
    process.exit(2);
  }

  let manager;
  try {
    const { CloudBase } = require('@cloudbase/manager-node');
    manager = new CloudBase({ secretId, secretKey, envId });
  } catch (e) {
    console.warn('[qr-indexes] @cloudbase/manager-node not available.');
    printGuidance();
    process.exit(3);
  }

  try {
    // CloudBase Manager API does not officially expose createIndex per collection in all versions.
    // Attempt to call internal api; otherwise print guidance.
    const rec = [
      { collectionName: 'qrLoginSessions', indexKey: { status: 1, expiresAt: 1 }, options: {} },
      { collectionName: 'qrLoginSessions', indexKey: { expiresAt: 1 }, options: { expireAfterSeconds: 0 } },
      { collectionName: 'qrLoginSessions', indexKey: { 'approvedBy.principalId': 1 }, options: {} },
      { collectionName: 'qrLoginSessions', indexKey: { status: 1, createdAt: -1 }, options: {} },
    ];

    // Try to create collection if missing
    await safeCreateCollection(manager, 'qrLoginSessions');

    let created = 0;
    for (const it of rec) {
      const ok = await tryCreateIndex(manager, it.collectionName, it.indexKey, it.options);
      if (ok) created++;
    }
    console.log(`[qr-indexes] Index creation attempted. Created/ensured: ${created}/${rec.length}.`);
    if (created < rec.length) {
      console.log('[qr-indexes] Some indexes may require console to create. See guidance below.');
      printGuidance();
    }
  } catch (e) {
    console.error('[qr-indexes] Failed to create indexes:', e.message || e);
    printGuidance();
    process.exit(4);
  }
}

async function safeCreateCollection(manager, name) {
  try {
    await manager.database.createCollection(name);
    console.log(`[qr-indexes] Created collection: ${name}`);
  } catch (e) {
    // Ignore if exists
  }
}

async function tryCreateIndex(manager, collection, keys, options = {}) {
  try {
    if (typeof manager.database.createCollectionIndex !== 'function') {
      return false;
    }
    await manager.database.createCollectionIndex({
      collectionName: collection,
      indexes: [{
        name: indexName(keys),
        keys,
        options
      }]
    });
    console.log('[qr-indexes] Created index on', collection, keys, options);
    return true;
  } catch (e) {
    // Fall back
    return false;
  }
}

function indexName(keys) {
  return 'idx_' + Object.entries(keys).map(([k, v]) => `${k}_${v}`).join('_');
}

function printGuidance() {
  console.log('\n[Guidance] Please create indexes in CloudBase console for collection qrLoginSessions:');
  console.log('- { status: 1, expiresAt: 1 }');
  console.log('- { expiresAt: 1 } with TTL (expireAfterSeconds=0)');
  console.log('- { approvedBy.principalId: 1 }');
  console.log('- { status: 1, createdAt: -1 }');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

