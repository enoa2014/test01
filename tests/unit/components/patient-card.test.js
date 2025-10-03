const path = require('path');

describe('patient-card component', () => {
  const componentPath = path.resolve(
    __dirname,
    '../../..',
    'miniprogram/components/business/patient-card/index.js'
  );

  beforeEach(() => {
    jest.resetModules();
    if (global.Component && typeof global.Component.mock === 'function') {
      global.Component.mockClear();
    }
  });

  const loadComponent = () => {
    require(componentPath);
    return global.Component.mock.calls[0][0];
  };

  it('registers default properties and data', () => {
    const config = loadComponent();
    expect(config.properties.patient.value).toEqual({});
    expect(config.properties.mode.value).toBe('compact');
    expect(config.properties.selectable.value).toBe(false);
    expect(config.properties.selected.value).toBe(false);
    expect(config.properties.badges.value).toEqual([]);
    expect(config.properties.actions.value).toEqual([]);
    expect(config.data.avatarText).toBe('—');
    expect(config.data.cardVariant).toBe('default');
  });

  it('computes avatar, badges and tags in updateComputedState', () => {
    const config = loadComponent();
    const ctx = {
      data: {
        patient: {
          patientName: '张三',
          ageYears: 36,
          latestAdmissionDateFormatted: '2025-10-01',
          latestEvent: '2025-10-01 · 随访复查',
          latestDiagnosis: '术后复诊',
          firstDiagnosis: '初诊',
          firstHospital: '协和医院',
          latestHospital: '北医三院',
          latestDoctor: '王主任',
          tags: ['肿瘤科', '王主任', '康复'],
        },
        mode: 'compact',
        badges: [
          { text: '在院', type: 'success' },
          { text: '需复查', type: 'danger' },
          { text: '入住 3 次', type: 'default' },
          { text: '超出', type: 'info' },
        ],
        actions: [{ id: 'view', label: '查看详情' }],
      },
      setData(update) {
        this.data = { ...this.data, ...update };
      },
    };

    config.methods.updateComputedState.call(ctx);

    expect(ctx.data.avatarText).toBe('张');
    expect(ctx.data.badges).toHaveLength(4);
    expect(ctx.data.tags).toEqual(['肿瘤科', '王主任', '康复']);
    expect(ctx.data.hasActions).toBe(true);
    expect(ctx.data.cardVariant).toBe('elevated');
    expect(ctx.data.cardPadding).toBe('var(--space-4)');
    expect(ctx.data.primaryLine).toContain('2025-10-01');
    expect(ctx.data.infoItems).toEqual([{ label: '最近入住', value: '2025-10-01', priority: 0 }]);
  });

  it('emits cardtap when clickable', () => {
    const config = loadComponent();
    const tapSpy = jest.fn();
    const ctx = { data: { clickable: true, patient: { id: 'p-1' } }, triggerEvent: tapSpy };

    config.methods.handleCardTap.call(ctx);
    expect(tapSpy).toHaveBeenCalledWith('cardtap', { patient: { id: 'p-1' } });
  });

  it('emits actiontap without requiring stopPropagation', () => {
    const config = loadComponent();
    const actionSpy = jest.fn();
    const ctx = {
      data: { patient: { id: 'p-2' } },
      triggerEvent: actionSpy,
    };

    config.methods.handleActionTap.call(ctx, {
      currentTarget: { dataset: { action: { id: 'view' } } },
    });

    expect(actionSpy).toHaveBeenCalledWith('actiontap', {
      action: { id: 'view' },
      patient: { id: 'p-2' },
    });
  });

  it('toggles selection state and emits event', () => {
    const config = loadComponent();
    const selectSpy = jest.fn();
    const ctx = {
      data: { patient: { id: 'p-3' }, selected: false },
      triggerEvent: selectSpy,
    };

    config.methods.handleSelectChange.call(ctx, {});
    expect(selectSpy).toHaveBeenCalledWith('selectchange', {
      selected: true,
      patient: { id: 'p-3' },
    });
  });

  it('emits longpress event', () => {
    const config = loadComponent();
    const longPressSpy = jest.fn();
    const ctx = {
      data: { patient: { id: 'p-4' } },
      triggerEvent: longPressSpy,
    };

    config.methods.handleLongPress.call(ctx);
    expect(longPressSpy).toHaveBeenCalledWith('longpress', { patient: { id: 'p-4' } });
  });
});
