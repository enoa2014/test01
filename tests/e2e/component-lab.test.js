const {
  waitForPage,
  waitForElement,
  waitForCondition
} = require('./helpers/miniapp');

const openLab = async (id) => {
  await miniProgram.reLaunch(`/pages/component-lab/index?id=${id}`);
  return waitForPage(miniProgram, 'pages/component-lab/index', { timeout: 20000 });
};

describe('component lab demos', () => {
  test('pm-picker single select updates value', async () => {
    const labPage = await openLab('pm-picker');
    const control = await waitForElement(labPage, '.pm-picker__control');
    await control.tap();

    const option = await waitForElement(labPage, '.pm-picker__option');
    await option.tap();

    await waitForCondition(async () => {
      const data = await labPage.data();
      const value = data?.propsState?.value;
      return value === 'idcard' || (Array.isArray(value) && value.includes('idcard'));
    }, { timeout: 5000, message: 'pm-picker value did not update' });

    await waitForCondition(async () => {
      const control = await labPage.$('.pm-picker__placeholder');
      if (!control) {
        const clearBtn = await labPage.$('.pm-picker__icon--clear');
        if (clearBtn) {
          await clearBtn.tap();
        }
      }
      const data = await labPage.data();
      const value = data?.propsState?.value;
      return value === '' || (Array.isArray(value) && value.length === 0);
    }, { timeout: 5000, message: 'pm-picker value did not clear' });
  }, 30000);

  test('pm-dialog confirm toggles visibility and reopen', async () => {
    const labPage = await openLab('pm-dialog');
    await labPage.callMethod('handleDialogConfirm');

    await waitForCondition(async () => {
      const container = await labPage.$('.pm-dialog__container');
      return !container;
    }, { timeout: 5000, message: 'dialog did not close on confirm' });

    await waitForCondition(async () => {
      await labPage.setData({ 'propsState.visible': true });
      const container = await labPage.$('.pm-dialog__container');
      return !!container;
    }, { timeout: 5000, message: 'dialog did not reopen after toggle' });
  }, 30000);

  test('pm-badge renders pill and dotted modes', async () => {
    const labPage = await openLab('pm-badge');
    const badgeText = await waitForElement(labPage, '.pm-badge text');
    const textValue = await badgeText.text();
    expect(textValue).toBe('新');

    const dottedSwitch = await waitForElement(labPage, 'switch[data-prop="dotted"]');
    await dottedSwitch.tap();

    await waitForCondition(async () => {
      const badge = await labPage.$('.pm-badge--dotted');
      return !!badge;
    }, { timeout: 5000, message: 'badge did not enter dotted mode' });

    const blockSwitch = await waitForElement(labPage, 'switch[data-prop="block"]');
    await blockSwitch.tap();

    await waitForCondition(async () => {
      const badge = await labPage.$('.pm-badge--block');
      return !!badge;
    }, { timeout: 5000, message: 'badge did not enter block mode' });
  }, 30000);
});
