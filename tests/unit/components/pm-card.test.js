const path = require('path');

describe('pm-card component definition', () => {
  const componentPath = path.resolve(__dirname, '../../..', 'miniprogram/components/base/pm-card/index.js');

  beforeEach(() => {
    jest.resetModules();
    if (global.Component && typeof global.Component.mock === 'function') {
      global.Component.mockClear();
    }
  });

  it('registers default properties', () => {
    require(componentPath);
    const config = global.Component.mock.calls[0][0];
    expect(config.properties.status.value).toBe('default');
    expect(config.properties.useSlot.value).toBe(false);
    expect(config.properties.useHeaderSlot.value).toBe(false);
    expect(config.properties.useFooterSlot.value).toBe(false);
  });

  it('prevents tap when not clickable', () => {
    require(componentPath);
    const config = global.Component.mock.calls[0][0];
    const tapSpy = jest.fn();
    const ctx = { data: { clickable: false }, triggerEvent: tapSpy };
    config.methods.handleTap.call(ctx);
    expect(tapSpy).not.toHaveBeenCalled();
  });

  it('emits tap when clickable', () => {
    require(componentPath);
    const config = global.Component.mock.calls[0][0];
    const tapSpy = jest.fn();
    const ctx = { data: { clickable: true }, triggerEvent: tapSpy };
    config.methods.handleTap.call(ctx);
    expect(tapSpy).toHaveBeenCalledWith('tap');
  });
});
