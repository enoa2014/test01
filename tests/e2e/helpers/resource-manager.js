const { delay, waitForElement } = require('./miniapp');
const { createPatientViaWizard } = require('./patient-flow');

const patientRequirements = new Map();
const createdPatients = new Map();
const GLOBAL_PROMISE_SYMBOL = Symbol.for('E2E_RESOURCES_BOOTSTRAP');
let bootstrapPromise = null;

async function createPatientResource(miniProgram, key, overrides) {
  const payload = await createPatientViaWizard(miniProgram, {
    __cacheKey: key,
    ...overrides,
  });

  if (payload && payload.successPage) {
    try {
      if (typeof payload.successPage.callMethod === 'function') {
        await payload.successPage.callMethod('onBackToHome');
        await delay(500);
      } else {
        const homeBtn = await waitForElement(payload.successPage, '.bottom-actions pm-button', {
          timeout: 8000,
        });
        if (homeBtn && typeof homeBtn.tap === 'function') {
          await homeBtn.tap();
          await delay(500);
        }
      }
    } catch (error) {
      try {
        await miniProgram.reLaunch('/pages/index/index');
        await delay(500);
      } catch (launchError) {
        // ignore fallback failure
      }
    }
  }

  createdPatients.set(key, payload);
  return payload;
}

function registerPatientRequirement(key, overrides = {}) {
  if (!key || typeof key !== 'string') {
    throw new Error('registerPatientRequirement: key is required');
  }
  const existing = patientRequirements.get(key) || {};
  patientRequirements.set(key, { ...existing, ...overrides });

  if (bootstrapPromise && global.miniProgram) {
    bootstrapPromise = bootstrapPromise.then(async () => {
      if (!createdPatients.has(key)) {
        await createPatientResource(global.miniProgram, key, patientRequirements.get(key));
      }
      return createdPatients;
    });
    global[GLOBAL_PROMISE_SYMBOL] = bootstrapPromise;
  }
}

async function bootstrapTestResources(miniProgram) {
  if (!miniProgram || typeof miniProgram.reLaunch !== 'function') {
    throw new Error('bootstrapTestResources: miniProgram instance is required');
  }
  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  bootstrapPromise = (async () => {
    for (const [key, overrides] of patientRequirements.entries()) {
      if (createdPatients.has(key)) {
        continue;
      }
      await createPatientResource(miniProgram, key, overrides);
    }

    return createdPatients;
  })();

  global[GLOBAL_PROMISE_SYMBOL] = bootstrapPromise;

  return bootstrapPromise;
}

async function ensureTestResourcesReady() {
  if (!bootstrapPromise) {
    if (!global.miniProgram) {
      throw new Error('ensureTestResourcesReady: global miniProgram unavailable');
    }
    await bootstrapTestResources(global.miniProgram);
  }
  await bootstrapPromise;
}

async function getPatientResource(key) {
  if (!patientRequirements.has(key)) {
    throw new Error(`Patient resource "${key}" is not registered`);
  }
  await ensureTestResourcesReady();
  const payload = createdPatients.get(key);
  if (!payload) {
    throw new Error(`Patient resource "${key}" was not prepared`);
  }
  return payload;
}

async function teardownTestResources(miniProgram) {
  if (miniProgram && typeof miniProgram.reLaunch === 'function') {
    try {
      await miniProgram.reLaunch('/pages/index/index');
      await delay(500);
    } catch (error) {
      // ignore teardown errors
    }
  }
}

function listPatientRequirements() {
  return Array.from(patientRequirements.keys());
}

module.exports = {
  registerPatientRequirement,
  bootstrapTestResources,
  getPatientResource,
  teardownTestResources,
  listPatientRequirements,
};
