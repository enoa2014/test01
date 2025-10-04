# 住户详情页UI优化执行方案

> 基于列表页优化成功经验,结合详情页UX分析报告,制定可执行的优化方案

## 📋 执行摘要

**优化目标**: 降低信息密度、增强移动端体验、提升编辑效率

**参考成功案例**: 列表页优化实现了统计卡片交互、视觉层级优化、触摸热区扩大

**预期成果**:

- 首屏加载时间 3.2s → 1.5s (↓53%)
- 移动端触控成功率 78% → 95% (↑22%)
- 任务完成率 68% → 85% (↑25%)

---

## 🎯 优化原则

### 列表页成功经验提炼

1. **统计数据可视化** ✅
   - 列表页: 4格统计卡片 → 点击筛选
   - 详情页迁移: 住户关键指标卡片化

2. **视觉层级优化** ✅
   - 列表页: 头部渐变背景 + 品牌色圆点
   - 详情页迁移: 信息卡片权重分层

3. **触摸热区标准化** ✅
   - 列表页: 所有按钮 ≥88rpx
   - 详情页迁移: 编辑工具栏、操作按钮统一标准

4. **功能精简原则** ✅
   - 列表页: 移除重复的快速筛选器
   - 详情页迁移: 折叠次要信息模块

---

## 📐 优化方案详情

### P0 优先级 (2周内完成)

#### 1. 住户头部信息卡片化 🔥

**当前问题**:

```wxml
<!-- detail.wxml:8-24 - 平铺展示 -->
<view class="patient-header">
  <view class="patient-name-row">
    <text class="patient-name">{{patient.patientName}}</text>
  </view>
  <view class="patient-metrics">
    <text class="metric-item">入住 {{patient.admissionCount || 0}} 次</text>
    <text class="metric-item">最近 {{patient.daysSinceLatestAdmission || '--'}} 天</text>
  </view>
</view>
```

**优化方案** (参考列表页统计卡片):

```wxml
<!-- 关键指标卡片化 -->
<view class="patient-header-enhanced">
  <!-- 基本信息 -->
  <view class="header-main">
    <view class="avatar-badge" style="background: {{patient.avatarColor}}">
      <text class="avatar-text">{{patient.nameAbbr}}</text>
    </view>
    <view class="header-info">
      <text class="patient-name">{{patient.patientName}}</text>
      <text class="patient-meta">{{patient.genderLabel}} · {{patient.ageText}}</text>
    </view>
  </view>

  <!-- 统计卡片网格 -->
  <view class="metrics-grid">
    <view class="metric-card metric-card--primary">
      <text class="metric-value">{{patient.admissionCount || 0}}</text>
      <text class="metric-label">入住次数</text>
    </view>
    <view class="metric-card metric-card--{{patient.statusColor}}">
      <text class="metric-value">{{patient.statusLabel}}</text>
      <text class="metric-label">当前状态</text>
    </view>
    <view class="metric-card metric-card--warning" wx:if="{{patient.daysSinceLatestAdmission}}">
      <text class="metric-value">{{patient.daysSinceLatestAdmission}}</text>
      <text class="metric-label">天数</text>
    </view>
  </view>
</view>
```

**样式实现** (复用列表页token):

```css
/* 参考列表页.stat-card设计 */
.patient-header-enhanced {
  background: linear-gradient(180deg, var(--color-bg-primary) 0%, var(--color-bg-secondary) 100%);
  padding: var(--space-6) var(--space-4);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  margin: var(--space-3);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
  margin-top: var(--space-4);
}

.metric-card {
  background: var(--color-bg-primary);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  text-align: center;
  min-height: 120rpx; /* 符合触摸标准 */
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
}

.metric-card:active {
  transform: scale(0.96);
}

.metric-card--primary {
  background: rgba(99, 102, 241, 0.08);
}

.metric-card--success {
  background: rgba(34, 197, 94, 0.08);
}

.metric-value {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--color-text-primary);
  line-height: 1;
}

.metric-label {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  margin-top: var(--space-1);
}
```

**JS数据处理**:

```javascript
// detail.js - 计算卡片数据
function enhancePatientHeader(patient) {
  return {
    ...patient,
    nameAbbr: patient.patientName?.substring(0, 2) || '住户',
    avatarColor: getAvatarColor(patient.patientName),
    statusLabel: mapStatusLabel(patient.careStatus),
    statusColor: mapStatusColor(patient.careStatus),
  };
}

function mapStatusLabel(status) {
  const map = {
    in_care: '在住',
    pending: '待入住',
    discharged: '已离开',
  };
  return map[status] || '未知';
}

function mapStatusColor(status) {
  const map = {
    in_care: 'success',
    pending: 'warning',
    discharged: 'default',
  };
  return map[status] || 'default';
}
```

**工时估算**: 1天

---

#### 2. 编辑工具栏触摸优化 🔥

**当前问题** (参考UX分析2.1):

```css
/* detail.wxss:27-42 - 按钮过小 */
.edit-button {
  padding: var(--space-2) var(--space-4); /* 仅~60rpx高度 */
}
```

**优化方案** (应用列表页标准):

```wxml
<!-- 增强编辑工具栏 -->
<view class="edit-toolbar-enhanced">
  <view wx:if="{{!editMode}}"
        class="edit-action-button edit-action-button--primary"
        bindtap="onEditStart">
    <text class="button-icon">✏️</text>
    <text>编辑资料</text>
  </view>

  <block wx:else>
    <view class="edit-action-button edit-action-button--ghost"
          bindtap="onEditCancel">
      <text class="button-icon">✕</text>
      <text>取消</text>
    </view>
    <view class="edit-action-button edit-action-button--secondary {{!editDirty ? 'disabled' : ''}}"
          bindtap="onSaveDraft">
      <text class="button-icon">💾</text>
      <text>草稿</text>
    </view>
    <view class="edit-action-button edit-action-button--primary {{(!editCanSave || saving) ? 'disabled' : ''}}"
          bindtap="onSaveTap">
      <text class="button-icon" wx:if="{{!saving}}">✓</text>
      <text>{{saving ? '保存中…' : '保存'}}</text>
    </view>
  </block>
</view>
```

**样式实现**:

```css
.edit-toolbar-enhanced {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-primary);
  border-radius: var(--radius-lg);
  margin: var(--space-3);
  box-shadow: var(--shadow-sm);
}

.edit-action-button {
  flex: 1;
  min-height: 88rpx; /* ✅ 符合移动端标准 */
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border-radius: var(--radius-lg);
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  transition: all 0.2s ease;
  border: 2rpx solid transparent;
}

.edit-action-button--primary {
  background: var(--color-primary);
  color: var(--color-bg-primary);
}

.edit-action-button--secondary {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.edit-action-button--ghost {
  background: transparent;
  border-color: var(--color-border-primary);
  color: var(--color-text-primary);
}

.edit-action-button:active:not(.disabled) {
  transform: scale(0.96);
  box-shadow: var(--shadow-xs);
}

.edit-action-button.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.button-icon {
  font-size: var(--text-lg);
  line-height: 1;
}
```

**工时估算**: 0.5天

---

#### 3. 信息区域折叠优化 🔥

**当前问题**: 7个模块平铺,滚动距离过长

**优化方案** (新增折叠组件):

```wxml
<!-- 可折叠信息分组 -->
<collapse-panel
  title="住户基本信息"
  expanded="{{true}}"
  importance="high">
  <view class="info-section">
    <!-- 基本信息内容 -->
  </view>
</collapse-panel>

<collapse-panel
  title="联系信息"
  expanded="{{false}}"
  importance="medium">
  <view class="contact-section">
    <!-- 联系信息内容 -->
  </view>
</collapse-panel>

<collapse-panel
  title="入住记录"
  expanded="{{false}}"
  importance="medium"
  count="{{allIntakeRecords.length}}">
  <view class="records-section">
    <!-- 入住记录内容 -->
  </view>
</collapse-panel>

<collapse-panel
  title="操作日志"
  expanded="{{false}}"
  importance="low">
  <view class="log-section">
    <!-- 日志内容 -->
  </view>
</collapse-panel>
```

**组件实现** (`components/base/collapse-panel/`):

```javascript
// index.js
Component({
  properties: {
    title: String,
    expanded: {
      type: Boolean,
      value: false,
    },
    importance: {
      type: String,
      value: 'medium', // high | medium | low
    },
    count: Number,
  },

  data: {
    isExpanded: false,
  },

  lifetimes: {
    attached() {
      this.setData({ isExpanded: this.properties.expanded });
    },
  },

  methods: {
    onToggle() {
      this.setData({
        isExpanded: !this.data.isExpanded,
      });
      this.triggerEvent('toggle', {
        expanded: this.data.isExpanded,
      });
    },
  },
});
```

```wxml
<!-- index.wxml -->
<view class="collapse-panel collapse-panel--{{importance}}">
  <view class="collapse-header" bindtap="onToggle">
    <view class="header-left">
      <text class="collapse-icon {{isExpanded ? 'expanded' : ''}}">▶</text>
      <text class="collapse-title">{{title}}</text>
      <text wx:if="{{count !== undefined}}" class="collapse-count">{{count}}</text>
    </view>
    <text class="toggle-hint">{{isExpanded ? '收起' : '展开'}}</text>
  </view>

  <view class="collapse-content {{isExpanded ? 'expanded' : 'collapsed'}}">
    <slot></slot>
  </view>
</view>
```

```css
/* index.wxss */
.collapse-panel {
  margin-bottom: var(--space-3);
  background: var(--color-bg-primary);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: all 0.3s ease;
}

.collapse-panel--high {
  box-shadow: var(--shadow-md);
  border-left: 4rpx solid var(--color-primary);
}

.collapse-panel--medium {
  box-shadow: var(--shadow-sm);
}

.collapse-panel--low {
  background: var(--color-bg-secondary);
  box-shadow: var(--shadow-xs);
}

.collapse-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4);
  min-height: 88rpx; /* 触摸标准 */
  cursor: pointer;
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.collapse-icon {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  transition: transform 0.3s ease;
  display: inline-block;
}

.collapse-icon.expanded {
  transform: rotate(90deg);
}

.collapse-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.collapse-count {
  font-size: var(--text-xs);
  padding: 4rpx 12rpx;
  background: var(--color-info-light);
  color: var(--color-info);
  border-radius: var(--radius-full);
}

.toggle-hint {
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
}

.collapse-content {
  max-height: 0;
  overflow: hidden;
  transition:
    max-height 0.3s ease,
    padding 0.3s ease;
}

.collapse-content.expanded {
  max-height: 10000rpx;
  padding: 0 var(--space-4) var(--space-4);
}
```

**工时估算**: 2天 (含组件开发)

---

#### 4. 骨架屏加载优化 🔥

**当前问题**: 仅显示文字"正在加载..."

**优化方案** (复用列表页骨架屏设计):

```wxml
<!-- detail.wxml - 骨架屏 -->
<view wx:if="{{loading}}" class="skeleton-screen">
  <!-- 头部骨架 -->
  <view class="skeleton-header">
    <view class="skeleton-avatar skeleton-pulse"></view>
    <view class="skeleton-name-group">
      <view class="skeleton-name skeleton-pulse"></view>
      <view class="skeleton-meta skeleton-pulse"></view>
    </view>
  </view>

  <!-- 统计卡片骨架 -->
  <view class="skeleton-metrics">
    <view class="skeleton-metric skeleton-pulse" wx:for="{{[1,2,3]}}" wx:key="*this"></view>
  </view>

  <!-- 信息卡片骨架 -->
  <view class="skeleton-card" wx:for="{{[1,2,3]}}" wx:key="*this">
    <view class="skeleton-card-title skeleton-pulse"></view>
    <view class="skeleton-line skeleton-pulse"></view>
    <view class="skeleton-line skeleton-pulse"></view>
    <view class="skeleton-line skeleton-pulse" style="width: 70%;"></view>
  </view>
</view>
```

**样式实现**:

```css
.skeleton-screen {
  padding: var(--space-3);
}

.skeleton-header {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-bg-primary);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-3);
}

.skeleton-avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: var(--radius-full);
  background: var(--color-bg-tertiary);
}

.skeleton-name-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  justify-content: center;
}

.skeleton-name {
  width: 200rpx;
  height: 44rpx;
  border-radius: var(--radius-md);
  background: var(--color-bg-tertiary);
}

.skeleton-meta {
  width: 150rpx;
  height: 28rpx;
  border-radius: var(--radius-sm);
  background: var(--color-bg-tertiary);
}

.skeleton-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.skeleton-metric {
  height: 120rpx;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
}

.skeleton-card {
  background: var(--color-bg-primary);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-3);
}

.skeleton-card-title {
  width: 150rpx;
  height: 32rpx;
  border-radius: var(--radius-md);
  background: var(--color-bg-tertiary);
  margin-bottom: var(--space-3);
}

.skeleton-line {
  height: 28rpx;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-2);
}

/* 脉动动画 */
.skeleton-pulse {
  animation: skeleton-pulse 1.5s ease-in-out infinite;
  background: linear-gradient(
    90deg,
    var(--color-bg-tertiary) 25%,
    var(--color-bg-secondary) 50%,
    var(--color-bg-tertiary) 75%
  );
  background-size: 200% 100%;
}

@keyframes skeleton-pulse {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
```

**工时估算**: 1天

---

#### 5. 移动端表格卡片化 🔥

**当前问题**: 固定列宽表格在小屏幕不可用

**优化方案** (响应式布局):

```wxml
<!-- 媒体文件列表 - 响应式布局 -->
<view class="media-list-wrapper">
  <!-- 小屏幕: 卡片布局 -->
  <view wx:if="{{screenWidth < 375}}" class="media-card-list">
    <view class="media-card" wx:for="{{media.documents}}" wx:key="id">
      <view class="media-card-header">
        <text class="doc-name" bindtap="onDocNameTap" data-id="{{item.id}}">
          {{item.displayName}}
        </text>
        <view class="doc-type-badge">{{item.typeText}}</view>
      </view>
      <view class="media-card-meta">
        <text class="meta-item">{{item.sizeText}}</text>
        <text class="meta-item">{{item.uploadedAtText}}</text>
        <text class="meta-item">{{item.uploaderDisplay}}</text>
      </view>
      <view class="media-card-actions">
        <view class="action-btn action-btn--primary" bindtap="onDownload" data-id="{{item.id}}">
          <text class="btn-icon">⬇</text>
          <text>下载</text>
        </view>
        <view class="action-btn action-btn--danger" bindtap="onDelete" data-id="{{item.id}}">
          <text class="btn-icon">🗑</text>
          <text>删除</text>
        </view>
      </view>
    </view>
  </view>

  <!-- 大屏幕: 表格布局 (保留原实现) -->
  <view wx:else class="media-table">
    <!-- 原表格代码 -->
  </view>
</view>
```

**样式实现**:

```css
.media-card-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.media-card {
  background: var(--color-bg-primary);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  border: 2rpx solid var(--color-border-secondary);
  box-shadow: var(--shadow-sm);
}

.media-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.doc-name {
  flex: 1;
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--color-info);
  word-break: break-all;
}

.doc-type-badge {
  font-size: var(--text-xs);
  padding: 4rpx 12rpx;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-sm);
  white-space: nowrap;
}

.media-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-3);
}

.meta-item::after {
  content: '·';
  margin-left: var(--space-2);
}

.meta-item:last-child::after {
  content: '';
}

.media-card-actions {
  display: flex;
  gap: var(--space-2);
}

.action-btn {
  flex: 1;
  min-height: 88rpx; /* 触摸标准 */
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all 0.2s ease;
}

.action-btn--primary {
  background: var(--color-info-light);
  color: var(--color-info);
}

.action-btn--danger {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.action-btn:active {
  transform: scale(0.96);
}

.btn-icon {
  font-size: var(--text-base);
}
```

**JS实现**:

```javascript
// detail.js
data: {
  screenWidth: 375
},

onLoad(options) {
  // 获取屏幕宽度
  wx.getSystemInfo({
    success: (res) => {
      this.setData({ screenWidth: res.windowWidth });
    }
  });
}
```

**工时估算**: 1.5天

---

### P1 优先级 (1周内完成)

#### 6. 错误提示增强

**优化方案**:

```javascript
// 错误高亮 + 自动滚动
async showValidationErrors(errors) {
  const errorKeys = Object.keys(errors);

  // Toast简短提示
  wx.showToast({
    icon: 'none',
    title: `请修正 ${errorKeys.length} 个错误`,
    duration: 2000
  });

  // 滚动到第一个错误
  const firstKey = errorKeys[0];
  const selector = `.form-field[data-key="${firstKey}"]`;
  wx.createSelectorQuery()
    .select(selector)
    .boundingClientRect(rect => {
      if (rect) {
        wx.pageScrollTo({
          scrollTop: rect.top - 100,
          duration: 300
        });
      }
    })
    .exec();

  // 错误字段闪烁
  errorKeys.forEach(key => {
    this.setData({ [`errorHighlight.${key}`]: true });
    setTimeout(() => {
      this.setData({ [`errorHighlight.${key}`]: false });
    }, 3000);
  });
}
```

```css
/* 错误高亮动画 */
.form-field[data-error-highlight='true'] {
  animation: errorPulse 1s ease-in-out 3;
  border: 2rpx solid var(--color-danger);
  border-radius: var(--radius-md);
}

@keyframes errorPulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(255, 77, 79, 0.4);
  }
  50% {
    box-shadow: 0 0 0 16rpx rgba(255, 77, 79, 0);
  }
}
```

**工时估算**: 1天

---

#### 7. 删除操作撤销机制

**优化方案**:

```javascript
// 软删除 + 撤销Toast
async onDeleteMediaTap(event) {
  const { id, category, index } = event.currentTarget.dataset;
  const record = this.data.media[category][index];

  // 确认弹窗增强
  const confirmRes = await wx.showModal({
    title: '确认删除文件',
    content: `文件名: ${record.displayName}\n大小: ${record.sizeText}\n\n⚠️ 此操作不可恢复`,
    confirmText: '确认删除',
    cancelText: '取消',
    confirmColor: '#e64340'
  });

  if (!confirmRes.confirm) return;

  // 标记为待删除
  this.updateMediaRecord(category, index, {
    pendingDelete: true
  });

  // 显示撤销Toast
  this.setData({
    showUndoToast: true,
    undoDeleteData: { category, index, record }
  });

  // 5秒后真正删除
  this.undoTimer = setTimeout(() => {
    this.performDelete(id);
    this.setData({ showUndoToast: false });
  }, 5000);
}

onUndoDelete() {
  clearTimeout(this.undoTimer);
  const { category, index } = this.data.undoDeleteData;

  this.updateMediaRecord(category, index, {
    pendingDelete: false
  });

  this.setData({ showUndoToast: false });
  wx.showToast({
    icon: 'success',
    title: '已撤销删除'
  });
}
```

```wxml
<!-- 撤销Toast -->
<view wx:if="{{showUndoToast}}" class="undo-toast">
  <text>文件已删除</text>
  <view class="undo-btn" bindtap="onUndoDelete">撤销</view>
</view>
```

```css
.undo-toast {
  position: fixed;
  bottom: 100rpx;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-text-primary);
  color: var(--color-bg-primary);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  gap: var(--space-4);
  box-shadow: var(--shadow-floating);
  z-index: 1000;
  animation: slideUp 0.3s ease;
}

.undo-btn {
  color: var(--color-info-light);
  font-weight: var(--font-semibold);
  text-decoration: underline;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translate(-50%, 40rpx);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}
```

**工时估算**: 1.5天

---

#### 8. 分阶段数据加载

**优化方案**:

```javascript
// detail.js - 分阶段加载
async fetchPatientDetail() {
  // 阶段1: 核心信息(姓名、基本资料)
  this.setData({ loading: true });

  const profileRes = await wx.cloud.callFunction({
    name: 'patientProfile',
    data: { action: 'detail', key: this.profileKey }
  });

  this.setData({
    loading: false,
    patient: enhancePatientHeader(profileRes.result.patient),
    basicInfo: profileRes.result.basicInfo,
    contactInfo: profileRes.result.contactInfo
  });

  // 阶段2: 后台加载入住记录
  this.loadIntakeRecords();

  // 阶段3: 懒加载媒体文件
  this.setupLazyLoadMedia();
}

loadIntakeRecords() {
  wx.cloud.callFunction({
    name: 'patientIntake',
    data: { action: 'listByPatient', patientKey: this.profileKey }
  }).then(res => {
    this.setData({
      allIntakeRecords: res.result.records || [],
      recordsLoading: false
    });
  });
}

setupLazyLoadMedia() {
  const observer = wx.createIntersectionObserver(this);
  observer
    .relativeToViewport({ bottom: 100 })
    .observe('.media-section', (res) => {
      if (res.intersectionRatio > 0 && !this.mediaLoaded) {
        this.initMediaSection();
        this.mediaLoaded = true;
        observer.disconnect();
      }
    });
}
```

**工时估算**: 2天

---

### P2 优先级 (可选优化)

#### 9. 配额警告增强

- 添加"即将满"徽章
- 显示建议操作文案
- **工时**: 0.5天

#### 10. Tab切换动画

- 使用swiper实现滑动
- 添加过渡效果
- **工时**: 0.5天

#### 11. ARIA无障碍标签

- 为所有按钮添加aria-label
- 为图片添加alt描述
- **工时**: 1天

---

## 📊 实施时间线

### Week 1: 核心体验优化

```
Day 1-2: 住户头部卡片化 + 编辑工具栏优化
Day 3-4: 折叠面板组件开发与集成
Day 5:   骨架屏实现
```

### Week 2: 移动端适配

```
Day 1-2: 表格卡片化 + 响应式布局
Day 3:   错误提示增强
Day 4-5: 删除撤销机制 + 分阶段加载
```

### Week 3: 细节打磨 (可选)

```
Day 1: 配额警告 + Tab动画
Day 2: ARIA标签 + 测试验收
```

---

## ✅ 验收标准

### 功能验收

- [ ] 头部指标卡片正常显示并响应交互
- [ ] 所有按钮触摸热区 ≥88rpx
- [ ] 折叠面板展开/收起流畅
- [ ] 骨架屏在200ms内显示
- [ ] 小屏幕(<375px)表格切换为卡片
- [ ] 删除操作5秒内可撤销
- [ ] 首屏加载时间 <1.5s

### 性能验收

```javascript
// 性能测试脚本
const metrics = {
  首屏加载: { 当前: '3.2s', 目标: '<1.5s' },
  骨架屏显示: { 当前: 'N/A', 目标: '<200ms' },
  交互响应: { 当前: '~150ms', 目标: '<100ms' },
  触摸成功率: { 当前: '78%', 目标: '>95%' },
};
```

### 视觉验收

- [ ] 卡片层次清晰(高优先级阴影md、低优先级阴影xs)
- [ ] 色彩使用符合设计系统
- [ ] 动画过渡流畅(300ms标准)
- [ ] 错误提示醒目易读

---

## 📦 交付物清单

### 代码文件

1. `miniprogram/pages/patient-detail/detail.wxml` (优化)
2. `miniprogram/pages/patient-detail/detail.wxss` (优化)
3. `miniprogram/pages/patient-detail/detail.js` (优化)
4. `miniprogram/components/base/collapse-panel/` (新增)

### 文档

1. 本优化方案文档
2. 组件使用说明 (`collapse-panel/README.md`)
3. 性能测试报告

### 设计资源

1. 头部卡片设计规范
2. 折叠面板交互规范
3. 骨架屏样式规范

---

## 🔗 参考资源

### 列表页优化成功案例

- 统计卡片实现: `miniprogram/pages/index/index.wxml#L8-43`
- 触摸标准化: `miniprogram/pages/index/index.wxss#L347-360`
- 视觉层级: `miniprogram/pages/index/index.wxss#L195-269`

### 设计规范

- Design Tokens: `design-tokens.json`
- 组件规范: `docs/components/best-practices.md`
- UX分析: `docs/ux-analysis/patient-detail-ux-ui-analysis.md`

### 技术参考

- 微信小程序设计指南
- iOS HIG (触摸目标尺寸)
- Material Design 3 (动画标准)

---

**文档版本**: v1.0
**创建时间**: 2025-10-04
**维护人员**: Claude (SuperClaude Framework)
**下次审阅**: 2025-10-11
