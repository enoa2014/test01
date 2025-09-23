const path = require('path');

describe('pm-button component definition', () => {
  const componentPath = path.resolve(__dirname, '../../..', 'miniprogram/components/base/pm-button/index.js');

  beforeEach(() => {
    jest.resetModules();
    if (global.Component && typeof global.Component.mock === 'function') {
      global.Component.mockClear();
    }
  });

  it('registers default properties', () => {
    require(componentPath);
    expect(global.Component).toHaveBeenCalled();
    const config = global.Component.mock.calls[0][0];
    expect(config.properties.type.value).toBe('default');
    expect(config.properties.size.value).toBe('medium');
    expect(config.properties.loading.value).toBe(false);
  });

  it('emits tap event when enabled', () => {
    require(componentPath);
    const config = global.Component.mock.calls[0][0];
    const tapSpy = jest.fn();
    const instance = { data: { disabled: false, loading: false }, triggerEvent: tapSpy };
    config.methods.handleTap.call(instance);
    expect(tapSpy).toHaveBeenCalledWith('tap');
  });

  it('blocks tap when disabled or loading', () => {
    require(componentPath);
    const config = global.Component.mock.calls[0][0];
    const tapSpy = jest.fn();
    const disabledCtx = { data: { disabled: true, loading: false }, triggerEvent: tapSpy };
    const loadingCtx = { data: { disabled: false, loading: true }, triggerEvent: tapSpy };
    config.methods.handleTap.call(disabledCtx);
    config.methods.handleTap.call(loadingCtx);
    expect(tapSpy).not.toHaveBeenCalled();
  });
});
