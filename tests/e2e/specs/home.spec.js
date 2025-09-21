const automator = require('miniprogram-automator');
const config = require('../config/devtools');

async function waitForConnection(tries, interval) {
  let lastError;
  for (let attempt = 0; attempt < tries; attempt += 1) {
    try {
      return await automator.connect({ wsEndpoint: config.wsEndpoint });
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }
  throw lastError || new Error('Unable to connect to DevTools');
}

async function waitForElements(page, selector, minCount = 1, retries = 60, delay = 500, refreshPage) {
  let currentPage = page;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const errorNode = await currentPage.$('.error');
    if (errorNode) {
      const errorText = (await errorNode.text()).trim();
      throw new Error(`Page reported error: ${errorText}`);
    }

    const nodes = await currentPage.$$(selector);
    if (nodes.length >= minCount) {
      return { nodes, page: currentPage };
    }
    await currentPage.waitFor(delay);
    if (refreshPage) {
      currentPage = await refreshPage();
    }
  }
  return { nodes: [], page: currentPage };
}

describe('patient admissions', () => {
  let miniProgram;

  beforeAll(async () => {
    miniProgram = await waitForConnection(config.reconnectTries, config.reconnectInterval);
  }, 300000);

  afterAll(async () => {
    if (miniProgram) {
      await miniProgram.disconnect();
    }
  });

  test('displays list and detail', async () => {
    let page = await miniProgram.reLaunch('/pages/index/index');
    await page.waitFor(3000);

    let targetKey = '';
    let targetName = '';
    for (let attempt = 0; attempt < 300; attempt += 1) {
      const state = await page.data();
      if (state && state.error) {
        await page.callMethod('onRetry');
        await page.waitFor(1500);
        continue;
      }
      const patients = Array.isArray(state.displayPatients) ? state.displayPatients : [];
      const match = patients.find((item) => item && item.key && item.key.startsWith('TEST_AUTOMATION_'));
      const candidate = match || patients[0];
      if (candidate) {
        targetKey = candidate.key || '';
        targetName = candidate.patientName || '';
        break;
      }
      if ((attempt + 1) % 60 === 0) {
        page = await miniProgram.reLaunch('/pages/index/index');
        await page.waitFor(3000);
      } else {
        await page.waitFor(500);
      }
    }

    if (!targetKey) {
      throw new Error('Test automation patient record not found in data.');
    }

    expect(targetName.length).toBeGreaterThan(0);

    await miniProgram.navigateTo(`/pages/patient-detail/detail?key=${encodeURIComponent(targetKey)}`);
    await page.waitFor(2000);

    let detailPage = await miniProgram.currentPage();
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const detailState = await detailPage.data();
      if (detailState && detailState.error) {
        await detailPage.callMethod('fetchPatientDetail');
        await detailPage.waitFor(1500);
        continue;
      }
      const detailNode = await detailPage.$('.patient-detail-name');
      if (detailNode) {
        const name = (await detailNode.text()).trim();
        if (name) {
          targetName = targetName || name;
          break;
        }
      }
      if ((attempt + 1) % 50 === 0) {
        detailPage = await miniProgram.currentPage();
      }
      await detailPage.waitFor(500);
    }

    const detailNameNode = await detailPage.$('.patient-detail-name');
    const detailName = detailNameNode ? (await detailNameNode.text()).trim() : '';
    expect(detailName.length).toBeGreaterThan(0);
    if (targetName) {
      expect(detailName).toBe(targetName);
    }

    const detailData = await detailPage.data();
    expect(Array.isArray(detailData.records)).toBe(true);
    expect(detailData.records.length).toBeGreaterThan(0);
  }, 300000);
});

