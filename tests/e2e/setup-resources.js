const {
  bootstrapTestResources,
  teardownTestResources,
  listPatientRequirements,
} = require('./helpers/resource-manager');

const fs = require('fs');
const path = require('path');

const GLOBAL_FLAG = Symbol.for('E2E_RESOURCES_BOOTSTRAP');
const GLOBAL_COUNTER = Symbol.for('E2E_RESOURCE_USERS');

beforeAll(async () => {
  global[GLOBAL_COUNTER] = (global[GLOBAL_COUNTER] || 0) + 1;

  if (!listPatientRequirements().length) {
    return;
  }

  if (!global[GLOBAL_FLAG]) {
    global[GLOBAL_FLAG] = bootstrapTestResources(global.miniProgram);
  }

  await global[GLOBAL_FLAG];
}, 600000);

afterAll(async () => {
  global[GLOBAL_COUNTER] = Math.max((global[GLOBAL_COUNTER] || 1) - 1, 0);
  if (global[GLOBAL_COUNTER] === 0 && global[GLOBAL_FLAG]) {
    try {
      const guardFile = path.resolve(__dirname, '.cache/pending');
      if (fs.existsSync(guardFile)) {
        fs.unlinkSync(guardFile);
        console.log('[e2e] cleared guard file');
      }
    } catch (error) {
      console.warn('[e2e] failed to remove guard file', error.message);
    }
    await teardownTestResources(global.miniProgram);
    global[GLOBAL_FLAG] = null;
  }
}, 600000);
