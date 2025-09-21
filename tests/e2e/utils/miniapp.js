const automator = require('miniprogram-automator');
const config = require('../config/devtools');

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectDevtools() {
  let lastError;
  const tries = Math.max(Number(config.reconnectTries) || 10, 5);
  const interval = Number(config.reconnectInterval) || 1000;
  for (let attempt = 0; attempt < tries; attempt += 1) {
    try {
      return await automator.connect({ wsEndpoint: config.wsEndpoint });
    } catch (error) {
      lastError = error;
      await delay(interval);
    }
  }
  throw lastError || new Error('Unable to connect to DevTools');
}

async function waitForCondition(checker, {
  timeout = 15000,
  interval = 250,
  message = 'Condition not met'
} = {}) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (await checker()) {
      return true;
    }
    if (Date.now() - start > timeout) {
      throw new Error(message);
    }
    await delay(interval);
  }
}

async function waitForElement(page, selector, options = {}) {
  const { timeout = 15000, interval = 250 } = options;
  let found = null;
  await waitForCondition(async () => {
    found = await page.$(selector);
    return !!found;
  }, { timeout, interval, message: `Element '${selector}' not found` });
  return found;
}

async function waitForElements(page, selector, options = {}) {
  const { min = 1, timeout = 15000, interval = 250 } = options;
  let elements = [];
  await waitForCondition(async () => {
    elements = await page.$$(selector);
    return Array.isArray(elements) && elements.length >= min;
  }, { timeout, interval, message: `Elements '${selector}' not found` });
  return elements;
}

async function inputValue(node, value) {
  if (typeof node.input === 'function') {
    await node.input(value);
  } else {
    await node.trigger('input', { detail: { value } });
  }
  try {
    await node.trigger('blur', { detail: { value } });
  } catch (error) {
    // ignore when component does not support blur
  }
}

async function setPickerIndex(node, index) {
  await node.trigger('change', { detail: { value: String(index) } });
}

async function setDatePicker(node, value) {
  await node.trigger('change', { detail: { value } });
}

async function tapRadioByIndex(groupNode, index = 0) {
  const radios = await groupNode.$$('radio');
  if (!Array.isArray(radios) || !radios[index]) {
    throw new Error(`Radio index ${index} not found`);
  }
  await radios[index].tap();
}

function randomString(prefix = 'TEST_AUTOMATION') {
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}_${now}_${rand}`;
}

function generateIdNumber() {
  const now = Date.now().toString();
  const seed = `${now}1234567890`;
  const body = seed.slice(0, 17);
  const checksum = '0';
  return `1${body.slice(1)}${checksum}`;
}

function generateMobile() {
  const secondDigit = Math.floor(Math.random() * 5) + 3; // range 3-7
  const tail = Math.floor(100000000 + Math.random() * 900000000).toString(); // nine digits
  return `1${secondDigit}${tail}`;
}

function situationText() {
  return '\u60a3\u8005\u5f53\u524d\u75c5\u60c5\u9700\u8981\u6301\u7eed\u62a4\u7406\u652f\u6301\uff0c\u5b58\u5728\u529f\u80fd\u969c\u788d\uff0c\u9700\u62a4\u58eb\u56e2\u961f\u63d0\u4f9b\u5eb7\u590d\u62a4\u7406\u8ba1\u5212\u4fdd\u969c\u3002';
}

async function waitForPage(miniProgram, expectedRoute, {
  timeout = 15000,
  interval = 300
} = {}) {
  let page = await miniProgram.currentPage();
  if (page && (page.route === expectedRoute || page.path === expectedRoute)) {
    return page;
  }
  await waitForCondition(async () => {
    page = await miniProgram.currentPage();
    const route = page?.route || page?.path || '';
    return route === expectedRoute;
  }, { timeout, interval, message: `Route '${expectedRoute}' not reached` });
  return page;
}

module.exports = {
  connectDevtools,
  delay,
  waitForCondition,
  waitForElement,
  waitForElements,
  inputValue,
  setPickerIndex,
  setDatePicker,
  tapRadioByIndex,
  randomString,
  generateIdNumber,
  generateMobile,
  situationText,
  waitForPage
};
