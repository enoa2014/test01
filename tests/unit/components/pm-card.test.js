const path = require('path');

describe('pm-card component definition', () => {
  const componentPath = path.resolve(__dirname, '../../..', 'miniprogram/components/base/pm-card/index.js');

  beforeEach(() => {
    jest.resetModules();
    if (global.Component && typeof global.Component.mock === 'function') {
      global.Component.mockClear();
    }
  });

  it('registers default props', () => {
    require(componentPath);
    const config = global.Component.mock.calls[0][0];
    expect(config.properties.status.value).toBe('default');
    expect(config.properties.clickable.value).toBe(false);
  });

  it('emits tap when clickable', () => {
    require(componentPath);
    const config = global.Component.mock.calls[0][0];
    const tapSpy = jest.fn();
    const context = { data: { clickable: true }, triggerEvent: tapSpy };
    config.methods.handleTap.call(context);
    expect(tapSpy).toHaveBeenCalledWith('tap');
  });

  it('ignores tap when not clickable', () => {
    require(componentPath);
    const config = global.Component.mock.calls[0][0];
    const tapSpy = jest.fn();
    const context = { data: { clickable: false }, triggerEvent: tapSpy };
    config.methods.handleTap.call(context);
    expect(tapSpy).not.toHaveBeenCalled();
  });
});
