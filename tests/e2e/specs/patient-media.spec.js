const automator = require('miniprogram-automator');
const config = require('../config/devtools');

async function connectDevtools() {
  let lastError;
  for (let attempt = 0; attempt < config.reconnectTries; attempt += 1) {
    try {
      return await automator.connect({ wsEndpoint: config.wsEndpoint });
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, config.reconnectInterval));
    }
  }
  throw lastError || new Error('Unable to connect to DevTools');
}

async function waitForElement(page, selector, retries = 60, delay = 500) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const node = await page.$(selector);
    if (node) {
      return node;
    }
    await page.waitFor(delay);
  }
  return null;
}

async function waitForElements(page, selector, minCount = 1, retries = 60, delay = 500) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const elements = await page.$$(selector);
    if (elements.length >= minCount) {
      return elements;
    }
    await page.waitFor(delay);
  }
  return [];
}

async function openAutomationPatientDetail(miniProgram) {
  let page = await miniProgram.reLaunch('/pages/index/index');
  await page.waitFor(1000);

  const items = await waitForElements(page, '.patient-item', 1, 200, 500);
  let targetIndex = -1;
  for (let i = 0; i < items.length; i += 1) {
    const keyAttr = await items[i].attribute('data-key');
    // 优先使用测试数据，如果没有则使用任何可用的患者数据
    if (keyAttr && (keyAttr.startsWith('TEST_AUTOMATION_') || keyAttr)) {
      targetIndex = i;
      if (keyAttr.startsWith('TEST_AUTOMATION_')) {
        break; // 如果找到测试数据，优先使用
      }
    }
  }
  if (targetIndex === -1) {
    throw new Error('No patient record found for testing');
  }

  await items[targetIndex].tap();
  await page.waitFor(2000);
  const detailPage = await miniProgram.currentPage();
  await waitForElement(detailPage, '.media-section', 200, 500);
  return detailPage;
}

describe('patient media management', () => {
  let miniProgram;

  beforeAll(async () => {
    miniProgram = await connectDevtools();
  }, 300000);

  afterAll(async () => {
    if (miniProgram) {
      await miniProgram.disconnect();
    }
  });

  test('renders media management section in patient detail', async () => {
    const page = await openAutomationPatientDetail(miniProgram);

    const sectionTitleNode = await page.$('.media-section .section-title');
    expect(sectionTitleNode).toBeTruthy();
    const title = (await sectionTitleNode.text()).trim();
    expect(title).toBe('资料管理');

    let mediaState = null;
    for (let attempt = 0; attempt < 240; attempt += 1) {
      const current = await page.data();
      mediaState = current.media || null;
      if (mediaState && mediaState.accessChecked) {
        break;
      }
      await page.waitFor(500);
    }
    expect(mediaState).toBeTruthy();
    expect(mediaState.accessChecked).toBe(true);

    expect(Array.isArray(mediaState.images)).toBe(true);
    expect(Array.isArray(mediaState.documents)).toBe(true);
  }, 300000);
});

