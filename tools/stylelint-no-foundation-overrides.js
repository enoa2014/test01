const stylelint = require('stylelint');

const ruleName = 'project/no-foundation-overrides';

const messages = stylelint.utils.ruleMessages(ruleName, {
  rejected: selector => `Please reuse foundation styles instead of redefining ${selector}`,
});

const RESERVED_SELECTORS = new Set([
  '.h-display',
  '.h1',
  '.h2',
  '.h3',
  '.subtitle',
  '.body',
  '.caption',
  '.section',
  '.divider',
]);

function shouldAllow(filePath, allowList) {
  if (!filePath) {
    return false;
  }
  const normalized = filePath.replace(/\\/g, '/');
  return allowList.some(entry => normalized.endsWith(entry) || normalized.includes(entry));
}

const plugin = stylelint.createPlugin(ruleName, (primaryOption, secondaryOptions = {}) => {
  if (!primaryOption) {
    return () => {};
  }

  const allowList = Array.isArray(secondaryOptions.allow) ? secondaryOptions.allow : [];

  return (root, result) => {
    const filePath = root.source && root.source.input && root.source.input.file;
    if (shouldAllow(filePath, allowList)) {
      return;
    }

    root.walkRules(rule => {
      if (!rule.selectors || !rule.selectors.length) {
        return;
      }
      rule.selectors.forEach(selector => {
        const trimmed = selector.trim();
        if (RESERVED_SELECTORS.has(trimmed)) {
          stylelint.utils.report({
            message: messages.rejected(trimmed),
            node: rule,
            result,
            ruleName,
          });
        }
      });
    });
  };
});

module.exports = plugin;
module.exports.ruleName = ruleName;
module.exports.messages = messages;
