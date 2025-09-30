const path = require('path');

describe('pm-card component definition', () => {
  const componentPath = path.resolve(
    __dirname,
    '../../..',
    'miniprogram/components/base/pm-card/index.js'
  );

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
    expect(config.properties.variant.value).toBe('default');
    expect(config.properties.useSlot.value).toBe(false);
    expect(config.properties.useHeaderSlot.value).toBe(false);
    expect(config.properties.useFooterSlot.value).toBe(false);
    expect(config.properties.padding.value).toBe('');
    expect(config.data.cardClass).toBe('pm-card--variant-default');
    expect(config.data.cardStyle).toBe('--pm-card-padding: var(--space-5);');
    expect(config.data.hoverClass).toBe('');
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

  it('computes classes and hover state via _applyClasses', () => {
    require(componentPath);
    const config = global.Component.mock.calls[0][0];
    const ctx = {
      data: {},
      setData(update) {
        this.data = { ...this.data, ...update };
      },
    };

    config.methods._applyClasses.call(ctx, 'elevated', 'success', true);
    expect(ctx.data.cardClass).toContain('pm-card--variant-elevated');
    expect(ctx.data.cardClass).toContain('pm-card--status-success');
    expect(ctx.data.cardClass).toContain('pm-card--interactive');
    expect(ctx.data.hoverClass).toBe('pm-card--hover');
    expect(ctx.data.hasStatusAccent).toBe(true);
    expect(ctx.data.normalizedStatus).toBe('success');
  });

  it('normalizes padding style via _applyPadding', () => {
    require(componentPath);
    const config = global.Component.mock.calls[0][0];
    const ctx = {
      data: {},
      setData(update) {
        this.data = { ...this.data, ...update };
      },
    };

    config.methods._applyPadding.call(ctx, 'var(--space-4)');
    expect(ctx.data.cardStyle).toBe('--pm-card-padding: var(--space-4);');

    config.methods._applyPadding.call(ctx, '');
    expect(ctx.data.cardStyle).toBe('--pm-card-padding: var(--space-5);');
  });
});
