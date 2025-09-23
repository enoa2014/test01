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
    expect(global.Component).toHaveBeenCalled();
    const config = global.Component.mock.calls[0][0];
    expect(config.properties.type.value).toBe('text');
    expect(config.properties.placeholder.value).toContain('请输入');
    expect(config.properties.clearable.value).toBe(true);
  });

  it('emits change on input', () => {
    require(componentPath);
    const config = global.Component.mock.calls[0][0];
    const changeSpy = jest.fn();
    const context = { triggerEvent: changeSpy };
    config.methods.handleInput.call(context, { detail: { value: '王小明' } });
    expect(changeSpy).toHaveBeenCalledWith('change', '王小明');
  });

  it('clears value when clearable', () => {
    require(componentPath);
    const config = global.Component.mock.calls[0][0];
    const changeSpy = jest.fn();
    const context = { data: { clearable: true, disabled: false }, triggerEvent: changeSpy };
    config.methods.handleClear.call(context);
    expect(changeSpy).toHaveBeenCalledWith('change', '');
  });
});
