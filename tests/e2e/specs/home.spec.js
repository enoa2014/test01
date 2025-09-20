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

async function waitForElements(page, selector, minCount = 1, retries = 20, delay = 500, refreshPage) {
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
  }, 120000);

  afterAll(async () => {
    if (miniProgram) {
      await miniProgram.disconnect();
    }
  });

  test('displays list and detail', async () => {
    let page = await miniProgram.reLaunch('/pages/index/index');
    await page.waitFor(1000);

    const listResult = await waitForElements(page, '.patient-item', 1);
    const patientItems = listResult.nodes;
    page = listResult.page;
    expect(patientItems.length).toBeGreaterThan(0);

    const nameNode = await patientItems[0].$('.patient-name');
    const patientName = nameNode ? (await nameNode.text()).trim() : '';
    expect(patientName.length).toBeGreaterThan(0);

    await patientItems[0].tap();
    await page.waitFor(500);

    const detailResult = await waitForElements(page, '.patient-detail-name', 1, 40, 500, () => miniProgram.currentPage());
    page = detailResult.page;
    const detailNameNode = detailResult.nodes;
    const detailName = detailNameNode.length ? (await detailNameNode[0].text()).trim() : '';
    expect(detailName.length).toBeGreaterThan(0);

    const detailData = await page.data();
    expect(Array.isArray(detailData.records)).toBe(true);
    expect(detailData.records.length).toBeGreaterThan(0);
  }, 120000);
});
