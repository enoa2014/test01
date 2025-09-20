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

async function waitForElement(page, selector, retries = 15, delay = 500) {
  for (let i = 0; i < retries; i += 1) {
    const node = await page.$(selector);
    if (node) {
      return node;
    }
    await page.waitFor(delay);
  }
  return null;
}

describe('首页端到端', () => {
  let miniProgram;

  beforeAll(async () => {
    miniProgram = await waitForConnection(config.reconnectTries, config.reconnectInterval);
  }, 120000);

  afterAll(async () => {
    if (miniProgram) {
      await miniProgram.disconnect();
    }
  });

  test('展示云环境信息并可调用云函数', async () => {
    const page = await miniProgram.reLaunch('/pages/index/index');
    await page.waitFor(1500);

    const subtitle = await waitForElement(page, '.subtitle');
    expect(subtitle).not.toBeNull();

    const envText = await subtitle.text();
    expect(envText).toContain('当前云环境');

    const button = await waitForElement(page, '.primary');
    expect(button).not.toBeNull();

    await button.tap();

    const result = await waitForElement(page, '.result-body', 20, 500);
    expect(result).not.toBeNull();

    const resultText = await result.text();
    expect(resultText.length).toBeGreaterThan(0);
  });
});