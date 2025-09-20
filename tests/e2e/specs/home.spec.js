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

async function waitForElements(page, selector, minCount = 1, retries = 20, delay = 500) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const errorNode = await page.$('.error');
    if (errorNode) {
      const errorText = (await errorNode.text()).trim();
      throw new Error(`Page reported error: ${errorText}`);
    }

    const nodes = await page.$$(selector);
    if (nodes.length >= minCount) {
      return nodes;
    }
    await page.waitFor(delay);
  }
  return [];
}

describe('患者入住档案', () => {
  let miniProgram;

  beforeAll(async () => {
    miniProgram = await waitForConnection(config.reconnectTries, config.reconnectInterval);
  }, 120000);

  afterAll(async () => {
    if (miniProgram) {
      await miniProgram.disconnect();
    }
  });

  test('列表展示患者并能查看详情', async () => {
    let page = await miniProgram.reLaunch('/pages/index/index');
    await page.waitFor(1000);

    const patientItems = await waitForElements(page, '.patient-item', 1);
    expect(patientItems.length).toBeGreaterThan(0);

    const nameNode = await patientItems[0].$('.patient-name');
    const patientName = nameNode ? (await nameNode.text()).trim() : '';
    expect(patientName.length).toBeGreaterThan(0);

    await patientItems[0].tap();
    await page.waitFor(500);

    page = await miniProgram.currentPage();
    const detailNameNode = await waitForElements(page, '.patient-detail-name', 1);
    const detailName = detailNameNode.length ? (await detailNameNode[0].text()).trim() : '';
    expect(detailName.length).toBeGreaterThan(0);

    const recordItems = await waitForElements(page, '.record-item', 1);
    expect(recordItems.length).toBeGreaterThan(0);
  }, 120000);
});
