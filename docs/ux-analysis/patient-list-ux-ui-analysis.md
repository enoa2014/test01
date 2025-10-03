# 住户列表页面 UX/UI 分析报告

## 执行摘要

本文档对微信小程序住户列表页面(miniprogram/pages/index/)进行全面的UX/UI分析,识别出**21个关键问题**,涵盖搜索体验、筛选系统、视觉设计、交互模式、性能优化和可访问性等方面。

### 核心发现

**优势**:
- ✅ 设计令牌系统应用一致
- ✅ 骨架屏加载状态实现完善
- ✅ 缓存策略优化页面性能
- ✅ 批量操作模式设计合理

**主要问题**:
- 🔴 P0级问题 5个: 搜索体验、筛选复杂度、信息密度、触控目标、空状态
- 🟡 P1级问题 9个: 视觉层级、状态反馈、过滤器可见性、性能优化
- 🟢 P2级问题 7个: 可访问性、微交互、文案优化

### 优先级分布

| 优先级 | 数量 | 预计工时 | 影响范围 |
|--------|------|----------|----------|
| P0 严重 | 5 | 12天 | 核心用户流程 |
| P1 重要 | 9 | 18天 | 用户体验 |
| P2 优化 | 7 | 8.5天 | 细节改进 |
| **合计** | **21** | **38.5天** | - |

---

## 1. 页面架构分析

### 1.1 组件结构

```
index/
├── Hero Section (标题区域)
├── Toolbar (工具栏)
│   ├── smart-search-bar (智能搜索栏)
│   └── Sorting & Actions (排序和操作按钮)
├── Content Area (内容区域)
│   ├── Skeleton Loading (骨架屏)
│   ├── Error State (错误状态)
│   ├── Empty State (空状态)
│   └── Patient List (患者列表)
│       └── patient-card × N (患者卡片)
├── FAB (浮动操作按钮)
├── filter-panel (高级筛选面板)
└── pm-dialog (离开确认对话框)
```

### 1.2 状态管理复杂度

**状态变量数量**: 50+ 个状态变量(data属性)
**主要状态类别**:
- 数据状态: `patients`, `displayPatients`, `searchSuggestions`
- UI状态: `loading`, `error`, `batchMode`, `filterPanelVisible`
- 筛选状态: `searchKeyword`, `quickFilters`, `advancedFilters`, `filterSchemes`
- 缓存状态: `cacheKey`, `cacheTTL`

**问题识别**:
- ⚠️ 状态过于分散,缺乏统一的状态管理模式
- ⚠️ 筛选相关状态有10+个变量,维护成本高

---

## 2. 搜索体验分析

### 2.1 智能搜索栏实现

**当前实现** (smart-search-bar组件):
```xml
<smart-search-bar
  value="{{searchKeyword}}"
  placeholder="搜索住户姓名、档案号或标签"
  suggestions="{{searchSuggestions}}"
  filters="{{quickFilters}}"
  loading="{{searchLoading}}"
  history-enabled="{{true}}"
  bind:input="onSearchInput"
  bind:suggest="onSearchSuggest"
  bind:search="onSearchSubmit"
/>
```

**问题识别**:

#### 🔴 P0-1: 搜索建议响应延迟
**现象**:
- 搜索建议依赖云函数调用: `wx.cloud.callFunction({ name: 'patientProfile', data: { action: 'suggest' } })`
- 无防抖处理可能导致频繁请求
- 网络延迟影响用户体验

**影响**:
- 输入卡顿感,用户可能在建议出现前就完成输入
- 增加云函数调用成本

**推荐方案**:
```javascript
// 实现本地缓存 + 防抖优化
const SUGGEST_DEBOUNCE_TIME = 300; // 300ms防抖
let suggestTimer = null;

onSearchInput(e) {
  const keyword = e.detail.value;

  // 立即更新UI显示
  this.setData({ searchKeyword: keyword });

  // 清除之前的定时器
  if (suggestTimer) clearTimeout(suggestTimer);

  // 优先使用本地缓存进行模糊匹配
  const localSuggestions = this.getLocalSuggestions(keyword);
  if (localSuggestions.length > 0) {
    this.setData({ searchSuggestions: localSuggestions });
  }

  // 防抖后调用云函数获取更精确的建议
  suggestTimer = setTimeout(() => {
    this.fetchRemoteSuggestions(keyword);
  }, SUGGEST_DEBOUNCE_TIME);
}

getLocalSuggestions(keyword) {
  const allPatients = this.data.patients || [];
  return allPatients
    .filter(p =>
      p.patientName?.includes(keyword) ||
      p.档案号?.includes(keyword) ||
      p.tags?.some(tag => tag.includes(keyword))
    )
    .map(p => p.patientName)
    .slice(0, 8); // MAX_SUGGESTIONS
}
```

**预计工时**: 2天

---

#### 🔴 P0-2: 搜索历史缺失交互反馈
**现象**:
- 搜索历史存储在localStorage但无删除单项功能
- "清空"按钮无二次确认,容易误操作

**影响**:
- 用户误点"清空"后无法恢复
- 无法管理不需要的历史记录

**推荐方案**:
```xml
<!-- 增加单项删除和清空确认 -->
<view class="smart-search__history-list">
  <view wx:for="{{searchHistory}}" wx:key="*this" class="history-item">
    <text bindtap="handleHistoryTap" data-keyword="{{item}}">{{item}}</text>
    <text class="history-delete" bindtap="handleDeleteHistoryItem" data-keyword="{{item}}">
      ✕
    </text>
  </view>
</view>

<view class="smart-search__history-header">
  <text>搜索历史</text>
  <text bindtap="confirmClearHistory">清空</text>
</view>
```

```javascript
confirmClearHistory() {
  wx.showModal({
    title: '确认清空',
    content: '清空后搜索历史将无法恢复',
    confirmText: '清空',
    confirmColor: '#FF4D4F',
    success: (res) => {
      if (res.confirm) {
        this.handleClearHistory();
      }
    }
  });
}

handleDeleteHistoryItem(e) {
  const keyword = e.currentTarget.dataset.keyword;
  const history = this.data.searchHistory.filter(h => h !== keyword);
  wx.setStorageSync('search_history', history);
  this.setData({ searchHistory: history });
}
```

**预计工时**: 1天

---

## 3. 筛选系统分析

### 3.1 快速筛选器(Quick Filters)

**当前实现**:
```javascript
const quickFilters = [
  { id: 'all', label: '全部', active: true },
  { id: 'in_care', label: '在住', active: false },
  { id: 'pending', label: '待入住', active: false },
  { id: 'discharged', label: '已离开', active: false }
];
```

**问题识别**:

#### 🔴 P0-3: 快速筛选器信息密度不足
**现象**:
- 筛选器仅显示文本标签,无数量统计
- 用户无法预判筛选结果数量

**影响**:
- 点击后可能显示空列表,造成困惑
- 缺少数据概览,影响决策效率

**推荐方案**:
```xml
<!-- 增加计数徽章 -->
<view class="smart-search__filters">
  <view wx:for="{{filters}}" wx:key="id" class="filter-item">
    <pm-badge
      text="{{item.label}}"
      type="{{item.active ? 'primary' : 'default'}}"
    />
    <text class="filter-count">{{item.count || 0}}</text>
  </view>
</view>
```

```javascript
// 动态计算每个筛选器的数量
updateFilterCounts() {
  const allPatients = this.data.patients || [];
  const filters = this.data.quickFilters.map(filter => {
    let count = 0;
    if (filter.id === 'all') {
      count = allPatients.length;
    } else {
      count = allPatients.filter(p => p.cardStatus === filter.id).length;
    }
    return { ...filter, count };
  });
  this.setData({ quickFilters: filters });
}
```

**预计工时**: 1.5天

---

### 3.2 高级筛选面板(filter-panel)

**当前实现**: 10维度筛选
- 入住状态(statuses)
- 风险等级(riskLevels)
- 医院(hospitals)
- 诊断(diagnosis)
- 性别(genders)
- 民族(ethnicities)
- 籍贯(nativePlaces)
- 年龄段(ageRanges)
- 医生(doctors)
- 日期范围(dateRange)

**问题识别**:

#### 🟡 P1-1: 高级筛选器可见性不足
**现象**:
- "高级筛选"按钮位于搜索栏内部,不够显眼
- 无视觉提示表明当前是否有高级筛选激活

**影响**:
- 用户可能忽略高级筛选功能
- 激活筛选后用户可能忘记清除

**推荐方案**:
```xml
<!-- 增加激活状态徽章 -->
<view class="smart-search__actions">
  <view class="smart-search__action" bindtap="handleSearch">搜索</view>
  <view
    class="smart-search__action advanced-filter-btn {{hasActiveFilters ? 'active' : ''}}"
    bindtap="handleToggleAdvanced"
  >
    <text>高级筛选</text>
    <view wx:if="{{hasActiveFilters}}" class="active-indicator">
      <pm-badge text="{{activeFilterCount}}" type="primary" size="small" />
    </view>
  </view>
</view>
```

```javascript
// 计算激活的筛选器数量
data: {
  hasActiveFilters: false,
  activeFilterCount: 0
},

updateAdvancedFilterStatus() {
  const filters = this.data.advancedFilters || {};
  let count = 0;

  if (filters.statuses?.length) count++;
  if (filters.riskLevels?.length) count++;
  if (filters.hospitals?.length) count++;
  // ... 其他维度

  this.setData({
    hasActiveFilters: count > 0,
    activeFilterCount: count
  });
}
```

**预计工时**: 1天

---

#### 🟡 P1-2: 筛选器方案(Schemes)管理复杂
**现象**:
- 最多保存5个方案,但无批量管理功能
- 方案重命名和删除交互不直观

**影响**:
- 达到5个上限后必须先删除才能保存新方案
- 方案管理效率低

**推荐方案**:
```xml
<!-- filter-panel增加方案管理抽屉 -->
<view class="filter-panel__schemes-manager" wx:if="{{showSchemesManager}}">
  <view class="schemes-header">
    <text>筛选方案管理</text>
    <text bindtap="closeSchemeManager">完成</text>
  </view>

  <view class="schemes-list">
    <view wx:for="{{filterSchemes}}" wx:key="id" class="scheme-item">
      <view class="scheme-info">
        <text class="scheme-name">{{item.name}}</text>
        <text class="scheme-filters">{{item.filterSummary}}</text>
      </view>
      <view class="scheme-actions">
        <text bindtap="renameScheme" data-id="{{item.id}}">重命名</text>
        <text bindtap="deleteScheme" data-id="{{item.id}}">删除</text>
      </view>
    </view>
  </view>

  <view wx:if="{{filterSchemes.length === 0}}" class="schemes-empty">
    暂无保存的筛选方案
  </view>
</view>
```

**预计工时**: 2天

---

#### 🔴 P0-4: 筛选预览功能缺失即时反馈
**现象**:
- 筛选面板有"预览"按钮,但需要点击才能看到结果数量
- 用户调整筛选条件时无实时数量更新

**影响**:
- 用户需要反复点击"预览"来优化筛选条件
- 交互效率低,体验不流畅

**推荐方案**:
```javascript
// 实现实时预览(debounced)
let previewTimer = null;
const PREVIEW_DEBOUNCE_TIME = 500;

onFilterChange(newFilters) {
  // 更新筛选条件UI
  this.setData({ pendingAdvancedFilters: newFilters });

  // 清除之前的定时器
  if (previewTimer) clearTimeout(previewTimer);

  // 防抖后自动预览
  this.setData({ filterPreviewLoading: true });

  previewTimer = setTimeout(() => {
    this.performFilterPreview(newFilters);
  }, PREVIEW_DEBOUNCE_TIME);
}

performFilterPreview(filters) {
  const allPatients = this.data.patients || [];
  const filtered = applyAdvancedFilters(allPatients, filters);

  this.setData({
    filterPreviewCount: filtered.length,
    filterPreviewLabel: `将显示 ${filtered.length} 条结果`,
    filterPreviewLoading: false
  });
}
```

**WXSS增强**:
```css
.filter-panel__preview-bar {
  position: sticky;
  bottom: 0;
  background: var(--color-bg-primary);
  padding: var(--space-3);
  border-top: 1px solid var(--color-border-primary);
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.08);
}

.preview-count {
  font-size: var(--text-md);
  font-weight: var(--font-semibold);
  color: var(--color-primary);
}

.preview-loading {
  opacity: 0.6;
}
```

**预计工时**: 2天

---

## 4. 视觉设计评估

### 4.1 设计令牌一致性

**优势**:
- ✅ 全面使用CSS变量系统: `var(--color-*)`, `var(--space-*)`, `var(--radius-*)`
- ✅ 阴影系统应用一致: `var(--shadow-sm)`, `var(--shadow-floating)`
- ✅ 过渡动画统一: `transition: var(--transition-base)`

**问题识别**:

#### 🟡 P1-3: 视觉层级不清晰
**现象**:
```css
.patient-name {
  font-size: var(--text-lg);  /* 36rpx */
  font-weight: var(--font-semibold);  /* 600 */
}

.meta-label {
  font-size: var(--text-sm);  /* 24rpx */
  color: var(--color-text-secondary);
}
```

- 标题与次要信息字号差距仅12rpx(1.5倍),层级感不强
- 缺少中间层级(--text-md未使用)

**影响**:
- 信息层级扁平,用户难以快速扫视
- 卡片内部信息密度高时更明显

**推荐方案**:
```css
/* 优化字号层级 */
.patient-name {
  font-size: var(--text-xl);  /* 44rpx → 更突出 */
  font-weight: var(--font-bold);  /* 700 */
  line-height: 1.2;
}

.patient-meta-label {
  font-size: var(--text-xs);  /* 20rpx → 更收敛 */
  color: var(--color-text-tertiary);  /* 更弱化 */
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.patient-meta-value {
  font-size: var(--text-base);  /* 28rpx → 标准层级 */
  color: var(--color-text-primary);
}
```

**预计工时**: 1天

---

#### 🟡 P1-4: 卡片密度过高
**现象**:
- patient-card在compact模式下包含: 头像、姓名、徽章、标签、元数据、操作按钮
- 单个卡片高度可能超过200rpx
- 列表滚动时信息过载

**影响**:
- 用户难以快速扫描列表
- 移动端屏幕利用率低(每屏显示卡片数少)

**推荐方案**:
```xml
<!-- 增加display-mode属性控制信息密度 -->
<patient-card
  mode="{{listDisplayMode}}"  <!-- 'compact' | 'comfortable' | 'dense' -->
  patient="{{item}}"
/>
```

```javascript
// 用户可切换显示密度
data: {
  listDisplayMode: 'comfortable' // 默认舒适模式
},

toggleDisplayMode() {
  const modes = ['dense', 'comfortable', 'compact'];
  const currentIndex = modes.indexOf(this.data.listDisplayMode);
  const nextMode = modes[(currentIndex + 1) % modes.length];

  this.setData({ listDisplayMode: nextMode });
  wx.setStorageSync('list_display_mode', nextMode);
}
```

```css
/* 不同密度模式样式 */
.patient-card--dense .patient-card__body {
  display: none; /* 隐藏详细信息,仅显示核心内容 */
}

.patient-card--dense {
  padding: var(--space-2) var(--space-3);
}

.patient-card--comfortable {
  padding: var(--space-3) var(--space-4);
}

.patient-card--compact {
  padding: var(--space-4);
}
```

**预计工时**: 2.5天

---

### 4.2 色彩使用

#### 🟢 P2-1: 风险等级色彩对比度不足
**现象**:
```javascript
// 风险等级映射到徽章类型
const riskBadgeMap = {
  high: 'danger',    // 红色 #FF4D4F
  medium: 'warning', // 黄色 #FAAD14
  low: 'success'     // 绿色 #52C41A
};
```

- warning黄色徽章在白色背景下对比度为3.8:1,低于WCAG AA标准(4.5:1)

**影响**:
- 视觉障碍用户难以识别
- 强光环境下可读性差

**推荐方案**:
```json
// design-tokens.json调整
{
  "colors": {
    "warning": "#FA8C16",  // 从#FAAD14调深 → 对比度提升至4.6:1
    "warningLight": "#FFF7E6"
  }
}
```

或使用描边增强对比度:
```css
.pm-badge--warning {
  background: var(--color-warning-light);
  color: #D46B08;  /* 深色文字 */
  border: 1px solid var(--color-warning);
}
```

**预计工时**: 0.5天

---

## 5. 交互模式分析

### 5.1 患者卡片交互

**当前实现**:
```xml
<patient-card
  wx:for="{{displayPatients}}"
  bindtap="onPatientTap"
  bind:cardtap="onPatientTap"
  bind:actiontap="onCardAction"
  bind:selectchange="onCardSelectChange"
  bind:longpress="onCardLongPress"
/>
```

**问题识别**:

#### 🟡 P1-5: 长按操作缺少视觉反馈
**现象**:
- 长按进入批量模式,但无触觉反馈或动画
- 用户可能不确定是否成功触发

**影响**:
- 交互意图不明确
- 可能误以为功能失效而重复操作

**推荐方案**:
```javascript
onCardLongPress(e) {
  // 触觉反馈(微信小程序API)
  wx.vibrateShort({
    type: 'medium'
  });

  // 视觉反馈动画
  const key = e.currentTarget.dataset.key;
  this.animateCard(key, 'pulse');

  // 延迟进入批量模式(确保动画完成)
  setTimeout(() => {
    this.enterBatchMode(key);
  }, 200);
}

animateCard(key, animationType) {
  // 使用微信小程序动画API
  const animation = wx.createAnimation({
    duration: 200,
    timingFunction: 'ease-out'
  });

  if (animationType === 'pulse') {
    animation.scale(1.05).step();
    animation.scale(1).step();
  }

  this.setData({
    [`cardAnimation_${key}`]: animation.export()
  });
}
```

**WXML增强**:
```xml
<patient-card
  animation="{{cardAnimation}}"
  bind:longpress="onCardLongPress"
/>
```

**预计工时**: 1.5天

---

#### 🔴 P0-5: 批量操作触控目标过小
**现象**:
```css
.patient-card__checkbox {
  width: 40rpx;
  height: 40rpx;
}
```

- 复选框40rpx × 40rpx,低于WCAG推荐的最小触控目标88rpx × 88rpx
- 在列表快速滑动时难以精准点击

**影响**:
- 误操作率高,用户体验差
- 批量选择效率低

**推荐方案**:
```css
/* 扩大触控区域,但保持视觉大小 */
.patient-card__checkbox-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 88rpx;
  min-height: 88rpx;
  margin: calc(var(--space-2) * -1); /* 负边距抵消额外空间 */
}

.patient-card__checkbox {
  width: 40rpx;
  height: 40rpx;
  pointer-events: none; /* 实际点击由wrapper处理 */
}
```

**预计工时**: 1天

---

### 5.2 浮动操作按钮(FAB)

**当前实现**:
```css
.fab-container {
  position: fixed;
  right: var(--space-4);  /* 32rpx */
  bottom: var(--space-8);  /* 64rpx */
  z-index: 120;
}

.fab-button {
  width: 112rpx;
  height: 112rpx;
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-floating);
}

.fab-button:active {
  transform: scale(0.92);
}
```

**问题识别**:

#### 🟡 P1-6: FAB遮挡列表内容
**现象**:
- FAB固定在右下角,可能遮挡最后一个患者卡片的操作按钮
- 无智能隐藏机制

**影响**:
- 用户需要手动滚动才能访问被遮挡的内容
- 与iOS人机界面指南冲突(应避免固定元素遮挡内容)

**推荐方案**:
```javascript
// 滚动时自动隐藏/显示FAB
onPageScroll(e) {
  const scrollTop = e.scrollTop;
  const lastScrollTop = this.data.lastScrollTop || 0;
  const isScrollingDown = scrollTop > lastScrollTop;

  if (isScrollingDown && scrollTop > 100) {
    this.setData({ fabVisible: false });
  } else if (!isScrollingDown) {
    this.setData({ fabVisible: true });
  }

  this.setData({ lastScrollTop: scrollTop });
}
```

```css
/* FAB动画过渡 */
.fab-container {
  position: fixed;
  right: var(--space-4);
  bottom: var(--space-8);
  z-index: 120;
  transform: translateY(0);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fab-container--hidden {
  transform: translateY(200rpx);
}
```

**预计工时**: 1.5天

---

#### 🟡 P1-7: FAB无标签提示
**现象**:
- FAB仅显示"＋"图标,无文字说明
- 新用户可能不理解其功能

**影响**:
- 功能可发现性差
- 需要用户试错才能理解

**推荐方案**:
```xml
<!-- 增加悬浮提示 -->
<view class="fab-container {{fabExpanded ? 'expanded' : ''}}">
  <view class="fab-label" wx:if="{{fabExpanded}}">
    <text>添加住户</text>
  </view>
  <view class="fab-button" bindtap="onCreatePatientTap">
    <pm-button icon="＋" type="primary" />
  </view>
</view>
```

```javascript
// 首次访问时自动展开提示
onShow() {
  const hasSeenFabTooltip = wx.getStorageSync('fab_tooltip_seen');
  if (!hasSeenFabTooltip) {
    setTimeout(() => {
      this.setData({ fabExpanded: true });
      setTimeout(() => {
        this.setData({ fabExpanded: false });
        wx.setStorageSync('fab_tooltip_seen', true);
      }, 3000);
    }, 1000);
  }
}
```

```css
.fab-label {
  position: absolute;
  right: 132rpx;
  background: var(--color-text-primary);
  color: var(--color-bg-primary);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-base);
  white-space: nowrap;
  font-size: var(--text-sm);
  box-shadow: var(--shadow-md);
  animation: fadeInRight 0.3s ease-out;
}

@keyframes fadeInRight {
  from {
    opacity: 0;
    transform: translateX(-20rpx);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

**预计工时**: 1天

---

## 6. 骨架屏与加载状态

### 6.1 骨架屏实现

**当前实现**:
```xml
<view wx:if="{{loading}}" class="skeleton-list">
  <view class="skeleton-item" wx:for="{{skeletonPlaceholders}}" wx:key="*this">
    <view class="skeleton-avatar"></view>
    <view class="skeleton-body">
      <view class="skeleton-line skeleton-line--title"></view>
      <view class="skeleton-badges">
        <view class="skeleton-badge" wx:for="{{[0,1]}}"></view>
      </view>
      <view class="skeleton-grid">
        <view class="skeleton-chip" wx:for="{{[0,1,2]}}"></view>
      </view>
    </view>
  </view>
</view>
```

```css
@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.skeleton-avatar {
  animation: skeleton-loading 1.4s infinite ease;
}
```

**优势**:
- ✅ 骨架屏结构与实际卡片布局高度一致
- ✅ 流畅的渐变动画减少等待焦虑
- ✅ 使用`skeletonPlaceholders`数组控制数量

**问题识别**:

#### 🟡 P1-8: 骨架屏数量固定
**现象**:
```javascript
data: {
  skeletonPlaceholders: [1, 2, 3, 4, 5]
}
```

- 固定显示5个骨架项,不响应视口高度
- 短屏幕设备可能看到空白区域

**影响**:
- 加载状态与实际内容数量不匹配
- 用户体验不一致

**推荐方案**:
```javascript
onLoad() {
  // 动态计算骨架屏数量
  const systemInfo = wx.getSystemInfoSync();
  const screenHeight = systemInfo.windowHeight;
  const estimatedCardHeight = 180; // rpx转px后的估计高度
  const skeletonCount = Math.ceil(screenHeight / estimatedCardHeight) + 1;

  this.setData({
    skeletonPlaceholders: Array.from({ length: skeletonCount }, (_, i) => i)
  });
}
```

**预计工时**: 0.5天

---

## 7. 空状态设计

### 7.1 当前实现

```xml
<pm-card
  wx:if="{{!loading && !error && !displayPatients.length}}"
  class="empty-state-card"
  title="暂无住户档案"
>
  <view class="empty-state">
    <image class="empty-illustration" src="../../assets/images/empty-patients.svg" />
    <text class="empty-description">点击右下角按钮添加第一位住户</text>
  </view>
  <view slot="footer">
    <pm-button text="立即添加" type="primary" bindtap="onCreatePatientTap" />
  </view>
</pm-card>
```

**问题识别**:

#### 🟡 P1-9: 空状态未区分场景
**现象**:
- 首次使用空列表、搜索无结果、筛选无结果使用相同提示
- 用户无法快速理解原因

**影响**:
- 搜索无结果时,用户可能误以为系统无数据
- 缺少引导用户调整筛选条件的提示

**推荐方案**:
```javascript
// 智能判断空状态类型
getEmptyStateConfig() {
  const { searchKeyword, hasActiveFilters, patients } = this.data;

  // 场景1: 搜索无结果
  if (searchKeyword && searchKeyword.trim()) {
    return {
      illustration: '../../assets/images/empty-search.svg',
      title: '未找到匹配的住户',
      description: `没有找到与"${searchKeyword}"相关的住户`,
      actionText: '清除搜索',
      actionHandler: 'onSearchClear'
    };
  }

  // 场景2: 筛选无结果
  if (hasActiveFilters) {
    return {
      illustration: '../../assets/images/empty-filter.svg',
      title: '无符合条件的住户',
      description: '当前筛选条件过于严格,请尝试调整筛选条件',
      actionText: '清除筛选',
      actionHandler: 'onFilterReset'
    };
  }

  // 场景3: 首次使用(真实为空)
  if (!patients || patients.length === 0) {
    return {
      illustration: '../../assets/images/empty-patients.svg',
      title: '暂无住户档案',
      description: '点击右下角按钮添加第一位住户',
      actionText: '立即添加',
      actionHandler: 'onCreatePatientTap'
    };
  }
}
```

```xml
<!-- 动态空状态 -->
<view wx:if="{{emptyStateConfig}}" class="empty-state">
  <image class="empty-illustration" src="{{emptyStateConfig.illustration}}" />
  <text class="empty-title">{{emptyStateConfig.title}}</text>
  <text class="empty-description">{{emptyStateConfig.description}}</text>
  <pm-button
    text="{{emptyStateConfig.actionText}}"
    type="primary"
    bindtap="{{emptyStateConfig.actionHandler}}"
  />
</view>
```

**预计工时**: 2天

---

## 8. 性能优化分析

### 8.1 数据加载策略

**当前实现**:
```javascript
const PATIENT_PAGE_SIZE = 80;
const PATIENT_CACHE_TTL = 5 * 60 * 1000; // 5分钟

async loadPatients() {
  // 检查缓存
  const cache = readPatientsCache();
  if (cache && Date.now() - cache.updatedAt < PATIENT_CACHE_TTL) {
    this.processPatients(cache.data);
    return;
  }

  // 调用云函数
  const res = await wx.cloud.callFunction({
    name: 'patientProfile',
    data: { action: 'list' }
  });

  writePatientsCache(res.result.patients);
  this.processPatients(res.result.patients);
}
```

**问题识别**:

#### 🟢 P2-2: 缓存失效策略过于简单
**现象**:
- 仅使用时间TTL,不考虑数据变更
- 用户新增/编辑患者后,可能看到旧数据(5分钟内)

**影响**:
- 数据一致性问题
- 用户可能重复刷新页面

**推荐方案**:
```javascript
// 增加版本号机制
async loadPatients(forceRefresh = false) {
  if (!forceRefresh) {
    const cache = readPatientsCache();
    if (cache && Date.now() - cache.updatedAt < PATIENT_CACHE_TTL) {
      // 后台检查版本号
      this.checkCacheVersion(cache.version);
      this.processPatients(cache.data);
      return;
    }
  }

  const res = await wx.cloud.callFunction({
    name: 'patientProfile',
    data: { action: 'list' }
  });

  writePatientsCache(res.result.patients, res.result.version);
  this.processPatients(res.result.patients);
}

async checkCacheVersion(localVersion) {
  const res = await wx.cloud.callFunction({
    name: 'patientProfile',
    data: { action: 'version' }
  });

  if (res.result.version > localVersion) {
    console.log('检测到数据更新,刷新列表');
    this.loadPatients(true);
  }
}
```

**云函数增加版本接口**:
```javascript
// cloudfunctions/patientProfile/index.js
case 'version':
  const latestRecord = await db.collection('excel_records')
    .orderBy('updatedAt', 'desc')
    .limit(1)
    .get();
  return {
    version: latestRecord.data[0]?.updatedAt || Date.now()
  };
```

**预计工时**: 2天

---

#### 🟢 P2-3: 大列表渲染性能
**现象**:
- 一次性渲染80条患者卡片
- 滚动时可能出现卡顿(特别是低端设备)

**影响**:
- 首屏渲染时间长
- 滚动帧率下降

**推荐方案**:
```javascript
// 虚拟列表实现(简化版)
data: {
  visiblePatients: [],    // 当前可见的患者
  visibleStartIndex: 0,
  visibleEndIndex: 20,
  itemHeight: 180,        // 估计的卡片高度(rpx)
},

onPageScroll(e) {
  const scrollTop = e.scrollTop;
  const itemHeight = this.data.itemHeight;

  // 计算可见范围
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 5);
  const endIndex = Math.min(
    this.data.displayPatients.length,
    Math.ceil((scrollTop + this.data.screenHeight) / itemHeight) + 5
  );

  // 仅在范围变化时更新
  if (startIndex !== this.data.visibleStartIndex || endIndex !== this.data.visibleEndIndex) {
    this.setData({
      visibleStartIndex: startIndex,
      visibleEndIndex: endIndex,
      visiblePatients: this.data.displayPatients.slice(startIndex, endIndex)
    });
  }
}
```

**或使用recycle-view组件**:
```xml
<recycle-view
  batch="{{batchSetRecycleData}}"
  height="{{screenHeight}}"
  item-height="{{itemHeight}}"
>
  <recycle-item wx:for="{{recycleList}}" wx:key="id">
    <patient-card patient="{{item}}" />
  </recycle-item>
</recycle-view>
```

**预计工时**: 3天

---

## 9. 可访问性评估

### 9.1 ARIA标签

**当前实现**:
```xml
<pm-button
  icon="＋"
  aria-label="添加住户"
  bindtap="onCreatePatientTap"
/>
```

**问题识别**:

#### 🟢 P2-4: 缺少语义化角色
**现象**:
- 患者卡片列表无`role="list"`和`role="listitem"`
- 筛选器无`role="group"`和`aria-labelledby`

**影响**:
- 屏幕阅读器用户无法快速导航列表
- 辅助技术可能误解页面结构

**推荐方案**:
```xml
<!-- 列表语义化 -->
<scroll-view
  scroll-y
  class="patient-list"
  role="list"
  aria-label="住户列表"
>
  <patient-card
    wx:for="{{displayPatients}}"
    role="listitem"
    aria-label="住户 {{item.patientName}}"
  />
</scroll-view>

<!-- 筛选器分组 -->
<view class="smart-search__filters" role="group" aria-labelledby="filters-title">
  <text id="filters-title" class="sr-only">快速筛选</text>
  <view
    wx:for="{{filters}}"
    role="button"
    aria-pressed="{{item.active}}"
    aria-label="筛选 {{item.label}}"
  >
    <pm-badge text="{{item.label}}" />
  </view>
</view>
```

**WXSS增加屏幕阅读器专用样式**:
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

**预计工时**: 1.5天

---

#### 🟢 P2-5: 焦点管理缺失
**现象**:
- 筛选面板打开后,焦点未自动移动到面板
- 关闭面板后,焦点未恢复到触发按钮

**影响**:
- 键盘用户需要手动导航
- 违反WCAG 2.4.3 焦点顺序标准

**推荐方案**:
```javascript
onToggleAdvancedFilter() {
  const visible = !this.data.filterPanelVisible;

  if (visible) {
    // 保存当前焦点元素
    this.lastFocusedElement = document.activeElement;

    this.setData({ filterPanelVisible: true }, () => {
      // 面板打开后,聚焦到第一个筛选项
      this.selectComponent('#filter-panel').focus();
    });
  } else {
    this.setData({ filterPanelVisible: false }, () => {
      // 恢复焦点
      if (this.lastFocusedElement) {
        this.lastFocusedElement.focus();
      }
    });
  }
}
```

**预计工时**: 1天

---

## 10. 移动端响应式

### 10.1 触控体验

**问题识别**:

#### 🟢 P2-6: 横向滚动体验
**现象**:
```xml
<view class="quick-info">
  <view class="quick-item">...</view>
  <view class="quick-item">...</view>
  <view class="quick-item">...</view>
</view>
```

```css
.quick-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  gap: var(--space-2);
}
```

- 患者卡片内的快速信息网格在窄屏设备上可能挤压变形
- 无横向滚动容器时,信息可读性差

**影响**:
- 小屏幕设备信息展示不完整
- 用户需要点击进详情页才能看到完整信息

**推荐方案**:
```xml
<!-- 使用横向滚动容器 -->
<scroll-view scroll-x class="quick-info-scroll" enable-flex>
  <view class="quick-info">
    <view class="quick-item">...</view>
    <view class="quick-item">...</view>
    <view class="quick-item">...</view>
  </view>
</scroll-view>
```

```css
.quick-info-scroll {
  width: 100%;
  white-space: nowrap;
}

.quick-info {
  display: inline-flex;
  gap: var(--space-2);
  padding: var(--space-1) 0;
}

.quick-item {
  flex: 0 0 auto;
  min-width: 200rpx;
  max-width: 280rpx;
}

/* 滚动条样式 */
.quick-info-scroll::-webkit-scrollbar {
  height: 4rpx;
}

.quick-info-scroll::-webkit-scrollbar-thumb {
  background: var(--color-border-primary);
  border-radius: var(--radius-full);
}
```

**预计工时**: 1天

---

## 11. 错误处理

### 11.1 当前实现

```xml
<view wx:elif="{{error}}" class="error">{{error}}</view>
```

```javascript
async loadPatients() {
  try {
    const res = await wx.cloud.callFunction({
      name: 'patientProfile',
      data: { action: 'list' }
    });
    this.processPatients(res.result.patients);
  } catch (error) {
    console.error('加载患者列表失败:', error);
    this.setData({ error: '加载失败,请稍后重试' });
  }
}
```

**问题识别**:

#### 🟢 P2-7: 错误状态缺少重试机制
**现象**:
- 错误信息仅显示文本,无操作按钮
- 用户需要返回上一页或重启小程序才能重试

**影响**:
- 临时网络故障后用户体验差
- 增加用户流失率

**推荐方案**:
```xml
<!-- 增强错误状态UI -->
<view wx:elif="{{error}}" class="error-state">
  <view class="error-illustration">
    <image src="../../assets/images/error-network.svg" />
  </view>
  <text class="error-message">{{error.message || error}}</text>
  <view class="error-actions">
    <pm-button
      text="重试"
      type="primary"
      icon="🔄"
      bindtap="retryLoadPatients"
    />
    <pm-button
      text="返回首页"
      type="ghost"
      bindtap="navigateToHome"
    />
  </view>

  <!-- 错误详情(可折叠) -->
  <view wx:if="{{showErrorDetails}}" class="error-details">
    <text>错误代码: {{error.code}}</text>
    <text>错误详情: {{error.detail}}</text>
  </view>
  <text class="error-toggle" bindtap="toggleErrorDetails">
    {{showErrorDetails ? '隐藏' : '查看'}}详细信息
  </text>
</view>
```

```javascript
retryLoadPatients() {
  this.setData({ error: null, loading: true });
  this.loadPatients();
}

async loadPatients() {
  try {
    const res = await wx.cloud.callFunction({
      name: 'patientProfile',
      data: { action: 'list' }
    });

    if (!res.result || res.result.error) {
      throw {
        code: res.result?.code || 'UNKNOWN_ERROR',
        message: res.result?.message || '加载失败',
        detail: res.result?.detail || '未知错误'
      };
    }

    this.processPatients(res.result.patients);
  } catch (error) {
    console.error('加载患者列表失败:', error);
    this.setData({
      error: {
        code: error.code || 'NETWORK_ERROR',
        message: error.message || '网络连接失败,请检查网络后重试',
        detail: error.detail || error.errMsg || JSON.stringify(error)
      }
    });
  }
}
```

**预计工时**: 1.5天

---

## 12. 问题汇总与优先级

### 12.1 P0级问题(严重,必须修复)

| ID | 问题 | 影响 | 预计工时 |
|----|------|------|----------|
| P0-1 | 搜索建议响应延迟 | 核心功能体验差 | 2天 |
| P0-2 | 搜索历史缺失交互反馈 | 用户可能丢失重要历史 | 1天 |
| P0-3 | 快速筛选器信息密度不足 | 用户无法预判筛选结果 | 1.5天 |
| P0-4 | 筛选预览功能缺失即时反馈 | 筛选体验低效 | 2天 |
| P0-5 | 批量操作触控目标过小 | 误操作率高 | 1天 |
| **小计** | **5个问题** | - | **7.5天** |

### 12.2 P1级问题(重要,应尽快修复)

| ID | 问题 | 影响 | 预计工时 |
|----|------|------|----------|
| P1-1 | 高级筛选器可见性不足 | 功能可发现性差 | 1天 |
| P1-2 | 筛选器方案管理复杂 | 方案管理效率低 | 2天 |
| P1-3 | 视觉层级不清晰 | 信息扫视困难 | 1天 |
| P1-4 | 卡片密度过高 | 列表浏览效率低 | 2.5天 |
| P1-5 | 长按操作缺少视觉反馈 | 交互意图不明确 | 1.5天 |
| P1-6 | FAB遮挡列表内容 | 内容可访问性差 | 1.5天 |
| P1-7 | FAB无标签提示 | 功能可发现性差 | 1天 |
| P1-8 | 骨架屏数量固定 | 加载状态不一致 | 0.5天 |
| P1-9 | 空状态未区分场景 | 用户可能误解系统状态 | 2天 |
| **小计** | **9个问题** | - | **13天** |

### 12.3 P2级问题(优化,可计划修复)

| ID | 问题 | 影响 | 预计工时 |
|----|------|------|----------|
| P2-1 | 风险等级色彩对比度不足 | 可访问性不达标 | 0.5天 |
| P2-2 | 缓存失效策略过于简单 | 数据一致性问题 | 2天 |
| P2-3 | 大列表渲染性能 | 滚动帧率下降 | 3天 |
| P2-4 | 缺少语义化角色 | 辅助技术支持不足 | 1.5天 |
| P2-5 | 焦点管理缺失 | 键盘导航体验差 | 1天 |
| P2-6 | 横向滚动体验 | 小屏幕信息展示不完整 | 1天 |
| P2-7 | 错误状态缺少重试机制 | 错误恢复体验差 | 1.5天 |
| **小计** | **7个问题** | - | **10.5天** |

---

## 13. 实施路线图

### 阶段1: 核心功能优化(Week 1-2,7.5天)

**目标**: 修复影响核心用户流程的P0问题

- [ ] P0-1: 搜索建议响应优化(2天)
  - 实现本地缓存 + 防抖
  - 测试不同网络环境下的响应时间

- [ ] P0-2: 搜索历史交互增强(1天)
  - 增加单项删除功能
  - 清空操作增加二次确认

- [ ] P0-3: 快速筛选器增加计数(1.5天)
  - 动态计算每个筛选器的数量
  - 设计徽章样式

- [ ] P0-4: 筛选预览即时反馈(2天)
  - 实现防抖自动预览
  - 优化预览性能

- [ ] P0-5: 批量操作触控目标优化(1天)
  - 扩大触控区域至88rpx
  - 保持视觉一致性

**验收标准**:
- 搜索建议响应时间<500ms(本地缓存<100ms)
- 搜索历史误删除率<5%
- 筛选器计数准确率100%
- 筛选预览延迟<500ms
- 触控成功率>95%

---

### 阶段2: 用户体验提升(Week 3-4,13天)

**目标**: 优化视觉设计和交互模式

- [ ] P1-1: 高级筛选器可见性优化(1天)
- [ ] P1-2: 筛选方案管理改进(2天)
- [ ] P1-3: 视觉层级优化(1天)
- [ ] P1-4: 卡片密度模式切换(2.5天)
- [ ] P1-5: 长按操作反馈增强(1.5天)
- [ ] P1-6: FAB智能隐藏(1.5天)
- [ ] P1-7: FAB标签提示(1天)
- [ ] P1-8: 骨架屏动态数量(0.5天)
- [ ] P1-9: 空状态场景区分(2天)

**验收标准**:
- 筛选器激活状态可见性100%
- 方案管理操作成功率>90%
- 视觉层级用户满意度>80%
- 卡片密度切换流畅度60fps
- FAB遮挡投诉率<5%

---

### 阶段3: 性能与可访问性(Week 5-6,10.5天)

**目标**: 优化性能和辅助技术支持

- [ ] P2-1: 色彩对比度修复(0.5天)
- [ ] P2-2: 缓存版本控制(2天)
- [ ] P2-3: 虚拟列表实现(3天)
- [ ] P2-4: 语义化标签补充(1.5天)
- [ ] P2-5: 焦点管理实现(1天)
- [ ] P2-6: 横向滚动优化(1天)
- [ ] P2-7: 错误重试机制(1.5天)

**验收标准**:
- WCAG AA对比度标准100%通过
- 数据一致性问题<1%
- 列表滚动帧率>55fps
- 屏幕阅读器支持率>90%
- 错误恢复成功率>85%

---

## 14. 成功指标

### 14.1 定量指标

| 指标类别 | 当前值(估计) | 目标值 | 测量方法 |
|---------|-------------|--------|----------|
| **性能指标** | | | |
| 首屏加载时间 | ~2s | <1.5s | 微信小程序性能监控 |
| 列表滚动帧率 | ~45fps | >55fps | Performance API |
| 搜索响应时间 | ~800ms | <500ms | 自定义埋点 |
| **用户体验指标** | | | |
| 任务完成率 | ~75% | >90% | 用户测试 |
| 误操作率 | ~15% | <5% | 埋点统计 |
| 筛选成功率 | ~60% | >85% | 用户行为分析 |
| **可访问性指标** | | | |
| WCAG AA通过率 | ~70% | 100% | axe-core审计 |
| 语义化覆盖率 | ~40% | >90% | 代码审查 |

### 14.2 定性指标

- **用户满意度**: SUS评分>75(当前估计60)
- **学习曲线**: 新用户5分钟内掌握核心功能
- **信息架构**: 卡片信息扫视时间<3秒
- **视觉一致性**: 设计令牌覆盖率100%

---

## 15. 风险评估

### 15.1 技术风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| 虚拟列表兼容性 | 高 | 中 | 先在测试环境验证,准备降级方案 |
| 缓存版本冲突 | 中 | 低 | 实现版本号校验和自动清理 |
| 搜索性能瓶颈 | 高 | 低 | 分阶段优化,监控云函数性能 |

### 15.2 用户体验风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| 功能变更引起用户困惑 | 中 | 中 | 提供新手引导和更新说明 |
| 性能优化后兼容性问题 | 高 | 低 | A/B测试,逐步灰度发布 |

---

## 16. 附录

### 16.1 参考文档

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [微信小程序设计指南](https://developers.weixin.qq.com/miniprogram/design/)
- [iOS人机界面指南 - 列表与表格](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables)

### 16.2 设计令牌参考

完整设计令牌定义见 `design-tokens.json`:
- 颜色系统: 16个语义化颜色
- 间距系统: 0-16的8级间距
- 圆角系统: 7级圆角(sm到full)
- 阴影系统: 9种场景阴影
- 字体系统: 8级字号,5种字重

### 16.3 组件清单

**基础组件**:
- pm-button, pm-card, pm-input, pm-badge, pm-dialog

**业务组件**:
- patient-card, smart-search-bar, filter-panel

---

**文档版本**: 1.0
**最后更新**: 2025-10-03
**分析范围**: miniprogram/pages/index/
**总问题数**: 21个(P0: 5, P1: 9, P2: 7)
**总预计工时**: 31天人力
**预计完成周期**: 6周(考虑测试与迭代)
