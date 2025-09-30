module.exports = {
  extends: ['stylelint-config-standard'],
  plugins: ['./tools/stylelint-no-foundation-overrides.js'],
  rules: {
    'color-no-hex': true,
    'color-named': 'never',
    'function-disallowed-list': ['rgb', 'rgba', 'hsl', 'hsla'],
    'unit-no-unknown': [true, { ignoreUnits: ['rpx'] }],
    'selector-type-no-unknown': [true, { ignoreTypes: ['page'] }],
    'import-notation': null,
    'comment-empty-line-before': null,
    'declaration-block-single-line-max-declarations': null,
    'declaration-block-no-redundant-longhand-properties': null,
    'media-feature-range-notation': null,
    'keyframes-name-pattern': null,
    'rule-empty-line-before': null,
    'selector-class-pattern': null,
    'project/no-foundation-overrides': [true, {
      allow: [
        'miniprogram/styles/foundation.wxss',
        'miniprogram/styles/utilities.wxss'
      ]
    }]
  }
};
