# 基础组件最佳实践示例库（2025-10）

本文档汇总 `pm-button`、`pm-card`、`pm-input` 等基础组件在实际项目中的推荐使用方式，便于研发、测试与设计统一认知。示例覆盖常见布局、状态切换与交互注意事项，可作为 Component Lab 配置和页面开发的参考。

## 1. pm-button

### 1.1 语义与尺寸

| 场景             | 推荐配置                            | 说明                                               |
| ---------------- | ----------------------------------- | -------------------------------------------------- |
| 主操作           | `type="primary" size="large" block` | 关键 CTA 使用主色、块级按钮，保证触摸目标 ≥ 44px。 |
| 次要操作         | `type="secondary" size="medium"`    | 文字颜色与边框使用语义变量，避免与主按钮竞争视觉。 |
| 危险操作（删除） | `type="danger" size="medium" block` | 强调语义并结合 `pm-dialog` 二次确认。              |
| 文本按钮         | `type="ghost" size="small"`         | 辅助操作减少背景干扰，兼容白底/灰底场景。          |

```wxml
<pm-button type="primary" size="large" block text="提交申请" bindtap="handleSubmit" />
```

### 1.2 图标与加载态

- 小尺寸主按钮不建议同时使用图标与长文案，长度超过 12 字改为块级或换行。
- `loading` 状态会自动禁用点击，确保接口结束后及时复原。
- 使用 `icon="plus"` 时仍应保留文本，兼顾无障碍与可读性。

## 2. pm-card

### 2.1 结构组合

```wxml
<pm-card variant="elevated" status="info" clickable bind:tap="handleNavigate">
  <view slot="header" class="card-header">
    <text class="card-title">今日待办</text>
    <pm-button type="ghost" size="small" text="查看更多" bindtap="handleMore" />
  </view>
  <view>
    <text>• 跟进随访患者 3 人</text>
    <text>• 审核待办申请 2 条</text>
  </view>
  <view slot="footer" class="card-footer">
    <text class="footer-hint">最新更新时间：{{updatedAtText}}</text>
  </view>
</pm-card>
```

- `variant="outlined"` 适合嵌入列表的轻量信息，`elevated` 用于首页主模块。
- `status` 会影响描边和标题颜色，避免与主按钮色冲突。
- 点击区域默认覆盖整个卡片，若需局部交互，可在子元素上使用 `catchtap` 阻止事件冒泡。

### 2.2 媒体卡片参考

患者详情的资料卡片示例：

```wxml
<pm-card
  variant="outlined"
  clickable="{{true}}"
  padding="0"
  use-slot="{{true}}"
  use-header-slot="{{true}}"
  use-footer-slot="{{true}}"
  bind:tap="onPreview"
>
  <view slot="header" class="media-card__image">
    <image src="{{item.thumbnailUrl}}" mode="aspectFill" />
  </view>
  <view class="media-card__content">
    <text class="media-card__name">{{item.displayName}}</text>
    <text class="media-card__meta">{{item.sizeText}} · {{item.uploadedAtText}}</text>
  </view>
  <view slot="footer" class="media-card__footer">
    <pm-button type="ghost" size="small" text="下载" data-id="{{item.id}}" bindtap="onDownload" />
    <pm-button type="danger" size="small" text="删除" data-id="{{item.id}}" bindtap="onDelete" />
  </view>
</pm-card>
```

## 3. pm-input

### 3.1 基础用法

```wxml
<pm-input
  label="患者姓名"
  value="{{form.patientName}}"
  placeholder="请输入"
  required
  clearable
  data-field="patientName"
  bindinput="onFieldChange"
  error="{{errors.patientName || ''}}"
/>
```

- 统一使用 `label-position="top"`，左侧模式仅在表单宽度固定时启用。
- `error` 与 `hint` 会在下方区域显示，避免自定义错误文案与组件冲突。

### 3.2 文本域（textarea）

```wxml
<pm-input
  label="情况说明"
  type="textarea"
  value="{{form.situation}}"
  maxlength="500"
  textarea-auto-height="{{true}}"
  show-confirm-bar="{{false}}"
  data-field="situation"
  bindinput="onFieldChange"
/>
```

注意事项：

- 默认开启自动高度，若业务需要固定高度，可传 `textarea-auto-height="false"` 并自定义容器样式。
- 文本域失焦时会触发 `bind:change`，用于阻止频繁同步。

## 4. pm-dialog

### 4.1 基础确认对话框

```wxml
<pm-dialog
  visible="{{dialogVisible}}"
  title="删除提醒"
  content="删除后数据将无法恢复，是否继续？"
  confirm-text="删除"
  confirm-type="danger"
  cancel-text="取消"
  bind:confirm="handleDeleteConfirm"
  bind:cancel="handleDeleteCancel"
  bind:close="handleDialogClose"
/>
```

使用建议：

- 危险操作使用 `confirm-type="danger"`，与 `pm-card` 或列表项按钮搭配。
- 设置 `close-on-overlay="false"` 防止误触遮罩关闭关键流程。
- 自定义底部按钮：

```wxml
<pm-dialog visible="{{visible}}" show-close="false" >
  <view slot="footer" class="u-flex u-gap-2 u-justify-end">
    <pm-button type="ghost" text="暂不处理" bindtap="handleCancel" />
    <pm-button type="primary" text="立即处理" bindtap="handleConfirm" />
  </view>
</pm-dialog>
```

- 打开弹窗时应禁止背景滚动，可在遮罩容器添加 `catchtouchmove`。
- Loading 态与确认按钮联动，提交中禁止二次点击。

## 5. pm-badge

### 5.1 角标与状态点

```wxml
<view class="u-flex u-gap-3 u-items-center">
  <pm-badge count="8"></pm-badge>
  <pm-badge count="120" max="99" type="danger"></pm-badge>
  <pm-badge dotted type="success"></pm-badge>
  <pm-badge block text="待审核" type="warning"></pm-badge>
</view>
```

使用建议：

- `count` 支持数字或字符串；超过 `max` 时自动显示 `max+`。
- `dotted` 模式适合表示实时状态，可叠加在头像或图标右上角。
- `block` 模式用于标签或胶囊提示，可与 `u-inline-flex` 结合保持居中。
- 自定义内容可通过插槽传入，如“VIP”“优先”等文本。

## 6. 组合模式

### 6.1 表单段落（pm-input + pm-picker）

```wxml
<view class="form-section">
  <pm-input
    label="证件号码"
    placeholder="请输入"
    value="{{form.idNumber}}"
    data-field="idNumber"
    bindinput="onFieldChange"
  />
  <pm-picker
    label="证件类型"
    value="{{form.idType}}"
    options="{{idTypeOptions}}"
    bind:change="onIdTypeChange"
  />
</view>
```

- 表单容器可使用 `utilities` 中的 `u-gap-y-4` 控制垂直间距。
- `pm-picker` 仍在规划中，上例展示最终目标形态。

### 6.2 卡片与按钮组合

```wxml
<pm-card variant="default" status="warning">
  <view class="u-flex u-gap-2 u-items-center">
    <text>本周康复计划尚未上传。</text>
    <pm-button type="primary" size="small" text="立即上传" bindtap="handleUpload" />
  </view>
</pm-card>
```

## 7. 样式与工具类

- 基础间距：使用 `utilities` 的 `u-gap-*`、`u-mt-*`、`u-flex` 等类，禁止在页面重新定义 `.card`、`.section`。
- 圆角：遵循 `radius-usage-guide.md`，按钮/输入框使用 `--radius-base`，卡片使用 `--radius-md`。
- 阴影：卡片优先使用 `--shadow-sm` 或 `--shadow-md`，悬浮元素使用 `--shadow-floating`。

## 8. 测试 Checklist

| 项目       | 检查点                                                                 |
| ---------- | ---------------------------------------------------------------------- |
| 交互       | 按钮禁用/加载态是否阻止重复提交；卡片点击范围是否符合预期。            |
| 无障碍     | 文本按钮保留描述文字；必要时配置 `ariaLabel`。                         |
| 设计一致性 | 色彩引用令牌；圆角/阴影符合规范，未出现裸色值。                        |
| 响应式表现 | 小屏幕下按钮和输入框宽度是否自适应；卡片是否保持最小宽度。             |
| 自动化配合 | E2E 脚本选择器与 `.lab__` class 保持同步，组件属性改动时更新对应脚本。 |

## 9. 后续维护

1. 新增组件（如 `pm-picker`、`pm-radio`）上线后，补充示例与注意事项。
2. Component Lab 增设“最佳实践”预设分组，跑通演示场景。
3. 每次设计令牌更新时，回溯本列表确认文档示例仍然符合最新规范。

## 附录：常见注意事项

- **属性受控**：所有组件均为受控模式（由父级传入值），在页面中务必通过事件回调更新数据，避免直接操作 `setData` 引发状态不同步。
- **组合布局**：角标、Badge 与按钮/卡片组合时，注意使用 `position: relative` + `position: absolute` 控制定位，并遵循 `utilities` 中的间距工具类，避免硬编码。
- **无障碍支持**：按钮、弹窗必须提供明确文案；纯图标按钮需设置 `ariaLabel` 或辅助文本；对话框关闭时应恢复焦点至触发按钮。
- **事件节流**：多次触发的变更事件（如输入、搜索）需要在业务层做节流或防抖，防止频繁请求影响性能。
- **E2E 保障**：对组件核心交互编写独立的 Component Lab 用例，并在 `tests/e2e/component-lab.test.js` 中维护烟雾测试，保证 API 调整后仍可执行。
