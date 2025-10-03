const delay = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

async function waitForCondition(
  checker,
  { timeout = 15000, interval = 300, message = 'Condition not met' } = {}
) {
  const start = Date.now();
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

async function waitForElement(page, selector, { timeout = 15000, interval = 300 } = {}) {
  let node = null;
  await waitForCondition(
    async () => {
      node = await page.$(selector);
      return !!node;
    },
    { timeout, interval, message: `Element '${selector}' not found` }
  );
  return node;
}

async function waitForElements(page, selector, { min = 1, timeout = 15000, interval = 300 } = {}) {
  let nodes = [];
  await waitForCondition(
    async () => {
      nodes = await page.$$(selector);
      return Array.isArray(nodes) && nodes.length >= min;
    },
    { timeout, interval, message: `Elements '${selector}' not found` }
  );
  return nodes;
}

async function waitForPage(miniProgram, expectedRoute, { timeout = 15000, interval = 300 } = {}) {
  const normalize = (route = '') => route.replace(/^\//, '');
  const target = normalize(expectedRoute);
  let page = await miniProgram.currentPage();
  if (page) {
    const currentRoute = normalize(page.route || page.path || '');
    if (currentRoute === target) {
      return page;
    }
  }

  await waitForCondition(
    async () => {
      page = await miniProgram.currentPage();
      if (!page) {
        return false;
      }
      const currentRoute = normalize(page.route || page.path || '');
      return currentRoute === target;
    },
    { timeout, interval, message: `Route '${expectedRoute}' not reached` }
  );

  return page;
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

module.exports = {
  delay,
  waitForCondition,
  waitForElement,
  waitForElements,
  waitForPage,
  inputValue,
};
