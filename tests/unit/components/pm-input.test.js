const path = require('path');

describe('pm-input component definition', () => {
  const componentPath = path.resolve(__dirname, '../../..', 'miniprogram/components/base/pm-input/index.js');

  beforeEach(() => {
    jest.resetModules();
    if (global.Component && typeof global.Component.mock === 'function') {
      global.Component.mockClear();
    }
  });

  it('registers default properties', () => {
    require(componentPath);
    const config = global.Component.mock.calls[0][0];
    expect(config.properties.helper.value).toBe('');
    expect(config.properties.error.value).toBe('');
    expect(config.properties.block.value).toBe(false);
    expect(config.properties.usePrefixSlot.value).toBe(false);
    expect(config.properties.useSuffixSlot.value).toBe(false);
  });

  it('triggers events correctly', () => {
    require(componentPath);
    const config = global.Component.mock.calls[0][0];
    const changeSpy = jest.fn();
    const blurSpy = jest.fn();
    const ctx = {
      triggerEvent: (event, payload) => {
        if (event === 'change') changeSpy(payload);
        if (event === 'blur') blurSpy(payload);
      },
      data: { clearable: true, disabled: false }
    };
    config.methods.handleInput.call(ctx, { detail: { value: 'abc' } });
    config.methods.handleBlur.call(ctx, { detail: { value: 'abc' } });
    config.methods.handleClear.call(ctx);
    expect(changeSpy).toHaveBeenCalledWith('');
    expect(blurSpy).toHaveBeenCalledWith('abc');
  });

  it('does not clear when disabled', () => {
    require(componentPath);
    const config = global.Component.mock.calls[0][0];
    const spy = jest.fn();
    const ctx = { data: { clearable: true, disabled: true }, triggerEvent: spy };
    config.methods.handleClear.call(ctx);
    expect(spy).not.toHaveBeenCalled();
  });
});
