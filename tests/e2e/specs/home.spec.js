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

async function findFirstDataCells(rows) {
  for (const row of rows) {
    const cells = await row.$$('.cell');
    if (!cells.length) {
      continue;
    }
    const serial = (await cells[0].text()).trim();
    if (/^[0-9]+$/.test(serial)) {
      return cells;
    }
  }
  return [];
}

describe('Excel 数据展示', () => {
  let miniProgram;

  beforeAll(async () => {
    miniProgram = await waitForConnection(config.reconnectTries, config.reconnectInterval);
  }, 120000);

  afterAll(async () => {
    if (miniProgram) {
      await miniProgram.disconnect();
    }
  });

  test('读取并展示 Excel 内容', async () => {
    const page = await miniProgram.reLaunch('/pages/index/index');
    await page.waitFor(1000);

    const headerCells = await waitForElements(page, '.row.header .cell', 1);
    expect(headerCells.length).toBeGreaterThan(0);
    const firstHeaderText = await headerCells[0].text();
    expect(firstHeaderText).toContain('序号');

    const rowNodes = await waitForElements(page, '.excel-table .row', 3);
    expect(rowNodes.length).toBeGreaterThan(2);

    const dataCells = await findFirstDataCells(rowNodes);
    expect(dataCells.length).toBeGreaterThan(1);

    const serialText = (await dataCells[0].text()).trim();
    expect(/^[0-9]+$/.test(serialText)).toBeTruthy();

    const nameText = (await dataCells[1].text()).trim();
    expect(nameText).not.toBe('-');
  }, 120000);
});
