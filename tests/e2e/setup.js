const fs = require('fs');
const path = require('path');

const cacheDir = path.resolve(__dirname, '.cache');
const cacheFile = path.join(cacheDir, 'patients.json');

try {
  if (fs.existsSync(cacheFile)) {
    fs.unlinkSync(cacheFile);
    console.log('[e2e] removed cached patient data');
  }
} catch (error) {
  console.warn('[e2e] failed to remove cache', error.message);
}

try {
  const guardFile = path.join(cacheDir, 'pending');
  fs.writeFileSync(guardFile, String(Date.now()), 'utf8');
} catch (error) {
  console.warn('[e2e] failed to create guard file', error.message);
}
