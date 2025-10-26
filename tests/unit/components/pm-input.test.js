const path = require('path');

describe('pm-input component definition', () => {
  const componentPath = path.resolve(
    __dirname,
    '../../..',
    'wx-project/components/base/pm-input/index.js'
  );

  beforeEach(() => {
    jest.resetModules();
    if (!global.Component) {
      global.Component = jest.fn();
    }
    if (global.Component && typeof global.Component.mock === 'function') {
      global.Component.mockClear();
    }
  });

  it('registers default properties', () => {
    require(componentPath);
    const config = global.Component.mock.calls[0][0];
    expect(config.properties.helper.value).toBe('');
    expect(config.properties.error.value).toBe('');
    expect(config.properties.block.value).toBe(true);
    expect(config.properties.usePrefixSlot.value).toBe(false);
    expect(config.properties.useSuffixSlot.value).toBe(false);
    expect(config.properties.size.value).toBe('medium');
    expect(config.properties.labelPosition.value).toBe('top');
    expect(config.properties.prefixIcon.value).toBe('');
    expect(config.properties.suffixIcon.value).toBe('');
    expect(config.properties.maxlength.value).toBe(-1);
    expect(config.properties.textareaAutoHeight.value).toBe(true);
    expect(config.properties.showConfirmBar.value).toBe(true);
    expect(config.data.rootClass).toContain('pm-input--size-medium');
    expect(config.data.controlClass).toBe('pm-input__control');
    expect(config.data.isTextarea).toBe(false);
  });

  it('triggers events correctly', () => {
    require(componentPath);
    const config = global.Component.mock.calls[0][0];
    const eventLog = [];
    const ctx = {
      triggerEvent: (event, payload) => {
        eventLog.push([event, payload]);
      },
      setData(update) {
        this.data = { ...this.data, ...update };
      },
      data: { clearable: true, disabled: false },
    };
    ctx._updateClearVisibility = config.methods._updateClearVisibility;

    config.methods.handleInput.call(ctx, { detail: { value: 'abc' } });
    config.methods.handleChange.call(ctx, { detail: { value: 'abc' } });
    config.methods.handleBlur.call(ctx, { detail: { value: 'abc' } });
    config.methods.handleClear.call(ctx);

    expect(eventLog).toEqual([
      ['input', { value: 'abc' }],
      ['change', { value: 'abc' }],
      ['blur', { value: 'abc' }],
      ['input', { value: '' }],
      ['change', { value: '' }],
      ['clear', undefined],
    ]);
  });

  it('emits change on textarea blur', () => {
    require(componentPath);
    const config = global.Component.mock.calls[0][0];
    const eventLog = [];
    const ctx = {
      triggerEvent: (event, payload) => {
        eventLog.push([event, payload]);
      },
      setData(update) {
        this.data = { ...this.data, ...update };
      },
      data: { clearable: true, disabled: false, type: 'textarea' },
    };
    ctx._updateClearVisibility = config.methods._updateClearVisibility;

    config.methods.handleBlur.call(ctx, { detail: { value: 'long text' } });

    expect(eventLog).toEqual([
      ['blur', { value: 'long text' }],
      ['change', { value: 'long text' }],
    ]);
  });

  it('does not clear when disabled', () => {
    require(componentPath);
    const config = global.Component.mock.calls[0][0];
    const spy = jest.fn();
    const ctx = { data: { clearable: true, disabled: true }, triggerEvent: spy };
    config.methods.handleClear.call(ctx);
    expect(spy).not.toHaveBeenCalled();
  });

  it('computes classes via _applyRootClasses', () => {
    require(componentPath);
    const config = global.Component.mock.calls[0][0];
    const ctx = {
      setData(update) {
        this.data = { ...this.data, ...update };
      },
    };

    config.methods._applyRootClasses.call(
      ctx,
      'large',
      'left',
      true,
      true,
      '错误',
      true,
      false,
      '',
      'kg',
      'text'
    );
    expect(ctx.data.rootClass).toContain('pm-input--size-large');
    expect(ctx.data.rootClass).toContain('pm-input--layout-left');
    expect(ctx.data.rootClass).toContain('pm-input--block');
    expect(ctx.data.rootClass).toContain('pm-input--disabled');
    expect(ctx.data.rootClass).toContain('pm-input--error');
    expect(ctx.data.rootClass).toContain('pm-input--has-suffix');
    expect(ctx.data.hasPrefix).toBe(true);
    expect(ctx.data.hasSuffix).toBe(true);
  });

  it('applies textarea specific classes', () => {
    require(componentPath);
    const config = global.Component.mock.calls[0][0];
    const ctx = {
      setData(update) {
        this.data = { ...this.data, ...update };
      },
    };

    config.methods._applyRootClasses.call(
      ctx,
      'medium',
      'top',
      true,
      false,
      '',
      false,
      false,
      '',
      '',
      'textarea'
    );
    expect(ctx.data.rootClass).toContain('pm-input--textarea');
    expect(ctx.data.isTextarea).toBe(true);

    config.methods._applyControlClasses.call(ctx, false, '', 'textarea');
    expect(ctx.data.controlClass).toContain('pm-input__control--textarea');
  });

  it('toggles clear button visibility', () => {
    require(componentPath);
    const config = global.Component.mock.calls[0][0];
    const ctx = {
      setData(update) {
        this.data = { ...this.data, ...update };
      },
    };

    config.methods._updateClearVisibility.call(ctx, 'abc', true, false);
    expect(ctx.data.showClear).toBe(true);
    config.methods._updateClearVisibility.call(ctx, '', true, false);
    expect(ctx.data.showClear).toBe(false);
  });
});
