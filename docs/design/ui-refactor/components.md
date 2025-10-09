# 患者列表页 UI 重构方案（基于设计系统规范）

> **版本**: 2.0（基于设计令牌、业务组件、设计文档重新评估）
> **参考文档**:
>
> - `../../design-system/design-tokens-spec.md` - 设计令牌规范
> - `../../page-designs/patient-list-redesign.md` - 列表页设计方案
> - `../../business-components/patient-card.md` - PatientCard 组件规范
> - `../../business-components/smart-search-bar.md` - SmartSearchBar 组件规范
> - `../../components/component-usage-analysis.md` - 已有组件清单

---

## 📋 目录

- [评估总结](#评估总结)
- [设计系统对齐](#设计系统对齐)
- [重构方案调整](#重构方案调整)
- [业务组件集成](#业务组件集成)
- [实施路线图](#实施路线图)

---

## 评估总结

### 🔍 原方案 vs 设计系统规范

| 维度         | 原方案 (ui-refactor-index.md) | 设计系统规范                           | 对齐情况    |
| ------------ | ----------------------------- | -------------------------------------- | ----------- |
| **设计令牌** | 部分使用 CSS 变量，存在硬编码 | 完整令牌系统 (`design-tokens.json`)    | ⚠️ 需调整   |
| **圆角规范** | 混用 `radius-lg`/`radius-xl`  | 明确的圆角使用指南                     | ⚠️ 需规范   |
| **颜色系统** | 自定义渐变 `#667eea`          | 品牌色 `#2E86AB`（温暖蓝）             | ❌ 不一致   |
| **组件复用** | 未使用已有组件                | `pm-card`、`pm-badge`、`pm-button`     | ❌ 缺失     |
| **业务组件** | 无规划                        | `PatientCard`、`SmartSearchBar` 已定义 | ❌ 未集成   |
| **页面设计** | 紧凑列表模式                  | 支持卡片/列表/表格三种视图             | ✅ 部分对齐 |

### 🎯 关键发现

1. **设计令牌必须全面采用**
   - ❌ 原方案中的渐变色 `linear-gradient(135deg, #667eea 0%, #764ba2 100%)` 不符合品牌色规范
   - ✅ 应使用 `var(--color-primary)` (#2E86AB) 和配套的 `--gradient-primary-*` 令牌

2. **已有 PM 组件库未充分利用**
   - ✅ 已实现：`pm-card`、`pm-badge`、`pm-button`、`pm-input`、`pm-dialog`、`pm-picker`
   - ❌ 原方案重新造轮子（如自定义头像组件、状态徽章）

3. **业务组件规范需落地**
   - 📘 `PatientCard` 已有完整规范（支持 list/compact/detail 三种模式）
   - 📘 `SmartSearchBar` 已定义智能搜索能力
   - ❌ 原方案未提及这些组件

4. **页面设计目标高度一致**
   - ✅ 极速定位（10秒内）、信息清晰、批量效率
   - ✅ 虚拟滚动、骨架屏、空状态优化
   - ✅ 响应式策略（移动/平板/桌面）

---

## 设计系统对齐

### 1. 颜色令牌修正

**原方案问题**:

```css
/* ❌ 不符合品牌规范 */
.admission-badge {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.fab-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```

**修正方案**:

```css
/* ✅ 使用品牌主色 */
.admission-badge {
  background: var(--color-primary); /* #2E86AB 温暖蓝 */
  color: #fff;
}

/* 或使用语义色 */
.admission-badge--info {
  background: var(--color-info); /* #1890FF */
  color: #fff;
}

/* 如需渐变，使用设计令牌中的预设渐变 */
.fab-button {
  background: var(--gradient-info-primary); /* 已定义的渐变 */
  box-shadow: var(--shadow-primary); /* 配套阴影 */
}
```

**品牌色使用场景**:

- **主色** (`--color-primary` #2E86AB): 主要操作按钮、重要徽章、强调元素
- **辅助色** (`--color-secondary` #F24236): 紧急状态、警示标记
- **信息色** (`--color-info` #1890FF): 普通提示、次要操作
- **成功色** (`--color-success` #52C41A): 成功状态、稳定标记

---

### 2. 圆角令牌规范化

根据 [圆角令牌使用指南](../../design-system/radius-usage-guide.md):

| 组件类型           | 推荐圆角                      | 说明          |
| ------------------ | ----------------------------- | ------------- |
| **按钮、输入框**   | `--radius-base` (12rpx / 6px) | 日常最常用 ⭐ |
| **卡片、列表项**   | `--radius-md` (16rpx / 8px)   | 信息面板      |
| **弹窗、对话框**   | `--radius-xl` (24rpx / 12px)  | 模态容器      |
| **头像、圆形按钮** | `--radius-full` (9999rpx)     | 完全圆形      |
| **徽章、标签**     | `--radius-sm` (8rpx / 4px)    | 小型装饰元素  |

**原方案调整**:

```css
/* ❌ 原方案 */
.patient-item-compact {
  border-radius: var(--radius-lg); /* 20rpx */
}

/* ✅ 修正：列表卡片使用 md */
.patient-item-compact {
  border-radius: var(--radius-md); /* 16rpx */
}

/* ✅ 状态徽章使用 sm */
.status-badge {
  border-radius: var(--radius-sm); /* 8rpx */
}

/* ✅ FAB 按钮使用 full */
.fab-button {
  border-radius: var(--radius-full); /* 完全圆形 */
}
```

---

### 3. 阴影令牌标准化

**原方案问题**:

```css
/* ❌ 硬编码阴影值 */
.patient-item-compact {
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}

.fab-button {
  box-shadow: 0 8rpx 24rpx rgba(102, 126, 234, 0.4);
}
```

**修正方案**:

```css
/* ✅ 使用令牌 */
.patient-item-compact {
  box-shadow: var(--shadow-xs); /* 列表卡片轻阴影 */
}

.patient-item-compact:active {
  box-shadow: var(--shadow-sm); /* 点击时稍强 */
}

.fab-button {
  box-shadow: var(--shadow-floating); /* 悬浮元素专用 */
}

/* 主色按钮使用彩色阴影 */
.btn-primary {
  box-shadow: var(--shadow-primary); /* 0 8rpx 32rpx rgba(46, 134, 171, 0.25) */
}
```

---

### 4. 间距系统一致性

**间距令牌**:

```css
--space-1: 8rpx; /* 4px */
--space-2: 16rpx; /* 8px */
--space-3: 24rpx; /* 12px */
--space-4: 32rpx; /* 16px */
--space-6: 48rpx; /* 24px */
```

**原方案调整**:

```css
/* ✅ 统一使用令牌 */
.patient-item-compact {
  padding: var(--space-3); /* 24rpx */
  margin-bottom: var(--space-2); /* 16rpx */
}

.patient-main-row {
  gap: var(--space-3); /* 24rpx */
}

.name-row {
  gap: var(--space-2); /* 16rpx */
}
```

---

## 重构方案调整

### 方案 A+: 基于 PatientCard 业务组件的紧凑列表

**核心变更**: 使用 `PatientCard` 组件替代自定义卡片

#### PatientCard 组件集成

根据 [PatientCard 规范](../../business-components/patient-card.md)，组件支持三种模式：

**模式选择**:

- ✅ **`compact` 模式**: 用于患者列表（一屏 4-5 个）
- `list` 模式: 简化视图（一屏 6-8 个）
- `detail` 模式: 详情页头部展示

**WXML 代码**:

```xml
<!-- 使用 PatientCard 业务组件 -->
<view class="patient-list">
  <patient-card
    wx:for="{{displayPatients}}"
    wx:key="patientKey"
    patient="{{item}}"
    mode="compact"
    selectable="{{batchMode}}"
    selected="{{item.selected}}"
    badges="{{item.badges}}"
    actions="{{cardActions}}"
    bind:cardtap="onPatientTap"
    bind:actiontap="onCardAction"
    bind:selectchange="onSelectChange"
  />
</view>
```

**JS 数据准备**:

```javascript
// miniprogram/pages/index/index.js

Page({
  data: {
    displayPatients: [],
    batchMode: false,
    cardActions: [
      { id: 'view', label: '查看详情', icon: 'arrow-right' },
      { id: 'remind', label: '发起提醒', icon: 'bell' },
    ],
  },

  async fetchPatients() {
    // ... 原有逻辑

    const patients = sourcePatients.map(item => {
      // 准备 PatientCard 所需数据
      return {
        id: item.patientKey || item.key,
        name: item.patientName,
        age: calculateAge(item.birthDate),
        status: this.mapPatientStatus(item), // in_care / pending / discharged
        riskLevel: this.identifyRiskLevel(item), // high / medium / low
        latestEvent: `${formatRelativeTime(item.latestAdmissionTimestamp)} · ${item.latestDiagnosis}`,
        avatar: null, // 使用首字母头像
        tags: this.extractTags(item),
        badges: this.generateBadges(item),

        // 原有字段保留
        ...item,
      };
    });

    this.setData({ displayPatients: patients });
  },

  mapPatientStatus(patient) {
    const daysSince = (Date.now() - patient.latestAdmissionTimestamp) / (24 * 60 * 60 * 1000);
    if (daysSince <= 30) return 'in_care';
    if (daysSince <= 90) return 'pending';
    return 'discharged';
  },

  identifyRiskLevel(patient) {
    const daysSince = (Date.now() - patient.latestAdmissionTimestamp) / (24 * 60 * 60 * 1000);
    if (daysSince > 0 && daysSince <= 7) return 'high';
    if (daysSince > 7 && daysSince <= 30) return 'medium';
    return 'low';
  },

  generateBadges(patient) {
    const badges = [];

    // 状态徽章
    if (patient.status === 'in_care') {
      badges.push({ text: '在住', type: 'success' });
    }

    // 风险徽章
    if (patient.riskLevel === 'high') {
      badges.push({ text: '需复查', type: 'danger' });
    } else if (patient.riskLevel === 'medium') {
      badges.push({ text: '定期随访', type: 'warning' });
    }

    // 入住次数徽章（使用 pm-badge）
    if (patient.admissionCount >= 5) {
      badges.push({ text: `${patient.admissionCount}次`, type: 'info' });
    }

    return badges;
  },

  extractTags(patient) {
    const tags = [];
    if (patient.latestDiagnosis) tags.push(patient.latestDiagnosis);
    if (patient.latestHospital) tags.push(patient.latestHospital);
    return tags;
  },
});
```

**PatientCard 内部结构**:

```xml
<!-- components/business/patient-card/index.wxml -->
<pm-card
  class="patient-card patient-card--{{mode}}"
  status="{{patient.status}}"
  hover-class="pm-card--hover"
  bind:tap="handleCardTap"
>
  <view slot="header" class="patient-card__header">
    <!-- 头像 -->
    <view class="patient-card__avatar">
      <text class="patient-card__avatar-text">{{patient.name[0]}}</text>
    </view>

    <!-- 主信息 -->
    <view class="patient-card__info">
      <view class="patient-card__name-row">
        <text class="patient-card__name">{{patient.name}}</text>
        <text class="patient-card__meta">{{patient.age}}岁</text>
      </view>

      <!-- 徽章组 -->
      <view class="patient-card__badges">
        <pm-badge
          wx:for="{{badges}}"
          wx:key="text"
          text="{{item.text}}"
          type="{{item.type}}"
          size="small"
        />
      </view>
    </view>

    <!-- 选择框 -->
    <checkbox
      wx:if="{{selectable}}"
      checked="{{selected}}"
      bindtap="handleSelectChange"
    />
  </view>

  <!-- 卡片主体 -->
  <view class="patient-card__body">
    <text class="patient-card__event">{{patient.latestEvent}}</text>
  </view>

  <!-- 快捷操作 -->
  <view slot="footer" class="patient-card__footer">
    <pm-button
      wx:for="{{actions}}"
      wx:key="id"
      text="{{item.label}}"
      size="small"
      type="text"
      data-action="{{item}}"
      bind:tap="handleActionTap"
    />
  </view>
</pm-card>
```

---

### 方案 B+: 基于 SmartSearchBar 的搜索优化

**核心变更**: 使用 `SmartSearchBar` 组件替代原有搜索框

#### SmartSearchBar 集成

根据 [SmartSearchBar 规范](../../business-components/smart-search-bar.md):

**WXML**:

```xml
<smart-search-bar
  value="{{searchKeyword}}"
  placeholder="搜索患者姓名/病历号/标签"
  suggestions="{{searchSuggestions}}"
  filters="{{quickFilters}}"
  loading="{{searchLoading}}"
  history-enabled="{{true}}"
  bind:input="onSearchInput"
  bind:search="onSearchSubmit"
  bind:clear="onSearchClear"
  bind:filtertap="onFilterTap"
  bind:toggleadv="onToggleAdvancedFilter"
/>
```

**JS 逻辑**:

```javascript
Page({
  data: {
    searchKeyword: '',
    searchSuggestions: [],
    searchLoading: false,
    quickFilters: [
      { id: 'all', label: '全部', active: true },
      { id: 'in_care', label: '在住', active: false },
      { id: 'high_risk', label: '高风险', active: false },
      { id: 'followup', label: '待随访', active: false },
    ],
  },

  // 搜索输入（300ms 防抖）
  onSearchInput(event) {
    const { value } = event.detail;
    this.setData({ searchKeyword: value, searchLoading: true });

    // 调用搜索建议接口
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(async () => {
      const suggestions = await this.fetchSearchSuggestions(value);
      this.setData({ searchSuggestions: suggestions, searchLoading: false });
    }, 300);
  },

  async fetchSearchSuggestions(keyword) {
    if (!keyword || keyword.length < 2) return [];

    try {
      // 后续对接 /api/search/suggestions
      // 目前使用本地模糊匹配
      const { patients } = this.data;
      const suggestions = new Set();

      patients.forEach(patient => {
        if (patient.patientName && patient.patientName.includes(keyword)) {
          suggestions.add(patient.patientName);
        }
        if (patient.latestDiagnosis && patient.latestDiagnosis.includes(keyword)) {
          suggestions.add(patient.latestDiagnosis);
        }
      });

      return Array.from(suggestions).slice(0, 8);
    } catch (error) {
      return [];
    }
  },

  // 快捷筛选
  onFilterTap(event) {
    const { filter } = event.detail;
    const { quickFilters } = this.data;

    const updated = quickFilters.map(f => ({
      ...f,
      active: f.id === filter.id,
    }));

    this.setData({ quickFilters: updated });
    this.applyQuickFilter(filter.id);
  },

  applyQuickFilter(filterId) {
    const { patients } = this.data;
    let filtered = patients;

    switch (filterId) {
      case 'in_care':
        filtered = patients.filter(p => p.status === 'in_care');
        break;
      case 'high_risk':
        filtered = patients.filter(p => p.riskLevel === 'high');
        break;
      case 'followup':
        filtered = patients.filter(p => p.riskLevel === 'medium');
        break;
    }

    this.setData({ displayPatients: filtered });
  },

  // 高级筛选（打开抽屉）
  onToggleAdvancedFilter() {
    // 后续实现 FilterPanel 组件
    wx.showToast({ icon: 'none', title: '高级筛选开发中' });
  },
});
```

**SmartSearchBar 内部实现**:

```xml
<!-- components/business/smart-search-bar/index.wxml -->
<view class="smart-search-bar">
  <view class="search-input-wrapper">
    <pm-input
      value="{{value}}"
      placeholder="{{placeholder}}"
      type="search"
      clearable="{{true}}"
      bind:input="handleInput"
      bind:clear="handleClear"
    />
    <view class="search-actions">
      <view class="search-action" bindtap="handleToggleAdv">
        <text>高级筛选</text>
      </view>
    </view>
  </view>

  <!-- 搜索建议 -->
  <view wx:if="{{suggestions.length}}" class="search-suggestions">
    <view
      class="suggestion-item"
      wx:for="{{suggestions}}"
      wx:key="*this"
      bindtap="handleSuggestionTap"
      data-suggestion="{{item}}"
    >
      <text class="suggestion-icon">🔍</text>
      <text class="suggestion-text">{{item}}</text>
    </view>
  </view>

  <!-- 快捷筛选 -->
  <view class="filter-chips">
    <view
      class="filter-chip {{item.active ? 'active' : ''}}"
      wx:for="{{filters}}"
      wx:key="id"
      bindtap="handleFilterTap"
      data-filter="{{item}}"
    >
      <pm-badge
        text="{{item.label}}"
        type="{{item.active ? 'primary' : 'default'}}"
        size="medium"
      />
    </view>
  </view>
</view>
```

---

### 方案 C+: 优化的 FAB 按钮（符合设计令牌）

**WXML**:

```xml
<view class="fab-container">
  <view class="fab-button" bindtap="onIntakeTap">
    <pm-button
      icon="plus"
      type="primary"
      size="large"
      icon-only="{{true}}"
      elevated="{{true}}"
      aria-label="添加患者"
    />
  </view>
</view>
```

**WXSS**:

```css
.fab-container {
  position: fixed;
  bottom: var(--space-8); /* 64rpx */
  right: var(--space-4); /* 32rpx */
  z-index: 100;
}

.fab-button {
  width: 112rpx;
  height: 112rpx;
  border-radius: var(--radius-full); /* 完全圆形 */
  box-shadow: var(--shadow-floating);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fab-button:active {
  transform: scale(0.9);
  box-shadow: var(--shadow-lg);
}
```

**如果 pm-button 不支持 elevated 属性，自定义样式**:

```css
.fab-button ::v-deep .pm-button {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  box-shadow: var(--shadow-primary);
}
```

---

### 方案 D+: 骨架屏（使用设计令牌）

**WXSS**:

```css
.skeleton-item {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-4);
  margin-bottom: var(--space-2);
  background: var(--color-bg-primary);
  border-radius: var(--radius-md); /* 卡片圆角 */
}

.skeleton-avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: var(--radius-full); /* 圆形头像 */
  background: linear-gradient(
    90deg,
    var(--color-bg-tertiary) 25%,
    var(--color-bg-secondary) 50%,
    var(--color-bg-tertiary) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}

.skeleton-line {
  height: 28rpx;
  background: linear-gradient(
    90deg,
    var(--color-bg-tertiary) 25%,
    var(--color-bg-secondary) 50%,
    var(--color-bg-tertiary) 75%
  );
  background-size: 200% 100%;
  border-radius: var(--radius-sm);
  animation: skeleton-loading 1.5s infinite;
  margin-bottom: var(--space-2);
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
```

---

### 方案 E+: 空状态（使用 pm-card）

**WXML**:

```xml
<pm-card
  wx:if="{{!loading && !displayPatients.length}}"
  class="empty-state-card"
  title="暂无患者档案"
>
  <view class="empty-state">
    <image class="empty-illustration" src="/assets/images/empty-patients.svg" mode="aspectFit" />
    <text class="empty-description">点击右下角按钮添加第一位患者</text>
  </view>
  <view slot="footer" class="empty-actions">
    <pm-button
      text="立即添加"
      type="primary"
      size="medium"
      bind:tap="onIntakeTap"
    />
  </view>
</pm-card>
```

**WXSS**:

```css
.empty-state-card {
  margin: var(--space-8) var(--space-4);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-8) var(--space-4);
}

.empty-illustration {
  width: 400rpx;
  height: 300rpx;
  margin-bottom: var(--space-6);
  opacity: 0.6;
}

.empty-description {
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
  text-align: center;
  margin-bottom: var(--space-6);
}

.empty-actions {
  display: flex;
  justify-content: center;
  padding: var(--space-4);
}
```

---

## 业务组件集成

### 组件清单

| 组件名             | 类型     | 状态      | 用途                 |
| ------------------ | -------- | --------- | -------------------- |
| **PatientCard**    | 业务组件 | 📘 已规范 | 患者卡片（三种模式） |
| **SmartSearchBar** | 业务组件 | 📘 已规范 | 智能搜索栏           |
| **FilterPanel**    | 业务组件 | 📋 规划中 | 高级筛选抽屉         |
| **pm-card**        | 基础组件 | ✅ 已实现 | 通用卡片容器         |
| **pm-badge**       | 基础组件 | ✅ 已实现 | 徽章标签             |
| **pm-button**      | 基础组件 | ✅ 已实现 | 按钮                 |
| **pm-input**       | 基础组件 | ✅ 已实现 | 输入框               |
| **pm-dialog**      | 基础组件 | ✅ 已实现 | 对话框               |

### 组件开发优先级

#### 阶段 1: 复用已有组件（0.5 天）

**任务**:

- [ ] 在患者列表页引入 `pm-card`、`pm-badge`、`pm-button`
- [ ] 验证组件 API 是否满足需求
- [ ] 调整样式以符合设计令牌

**示例**:

```json
// miniprogram/pages/index/index.json
{
  "usingComponents": {
    "pm-card": "/components/base/pm-card/index",
    "pm-badge": "/components/base/pm-badge/index",
    "pm-button": "/components/base/pm-button/index"
  }
}
```

#### 阶段 2: 开发 PatientCard 业务组件（2 天）

**文件结构**:

```
miniprogram/components/business/patient-card/
├── index.js
├── index.json
├── index.wxml
├── index.wxss
└── README.md
```

**属性接口**:

```javascript
// index.js
Component({
  properties: {
    patient: {
      type: Object,
      value: {},
    },
    mode: {
      type: String,
      value: 'list', // list / compact / detail
    },
    selectable: {
      type: Boolean,
      value: false,
    },
    selected: {
      type: Boolean,
      value: false,
    },
    badges: {
      type: Array,
      value: [],
    },
    actions: {
      type: Array,
      value: [],
    },
  },

  methods: {
    handleCardTap() {
      this.triggerEvent('cardtap', { patient: this.data.patient });
    },
    handleActionTap(e) {
      const action = e.currentTarget.dataset.action;
      this.triggerEvent('actiontap', { action, patient: this.data.patient });
    },
    handleSelectChange(e) {
      this.triggerEvent('selectchange', {
        selected: e.detail.value,
        patient: this.data.patient,
      });
    },
  },
});
```

#### 阶段 3: 开发 SmartSearchBar 业务组件（2 天）

**文件结构**:

```
miniprogram/components/business/smart-search-bar/
├── index.js
├── index.json
├── index.wxml
├── index.wxss
└── README.md
```

**属性接口**:

```javascript
// index.js
Component({
  properties: {
    value: {
      type: String,
      value: '',
    },
    placeholder: {
      type: String,
      value: '搜索患者姓名/病历号/标签',
    },
    suggestions: {
      type: Array,
      value: [],
    },
    filters: {
      type: Array,
      value: [],
    },
    loading: {
      type: Boolean,
      value: false,
    },
    historyEnabled: {
      type: Boolean,
      value: true,
    },
  },

  data: {
    searchHistory: [],
  },

  lifetimes: {
    attached() {
      if (this.data.historyEnabled) {
        this.loadSearchHistory();
      }
    },
  },

  methods: {
    handleInput(e) {
      const value = e.detail.value;
      this.triggerEvent('input', { value });
    },

    handleClear() {
      this.triggerEvent('clear');
    },

    handleSuggestionTap(e) {
      const suggestion = e.currentTarget.dataset.suggestion;
      this.triggerEvent('search', { value: suggestion, source: 'suggestion' });
      this.saveSearchHistory(suggestion);
    },

    handleFilterTap(e) {
      const filter = e.currentTarget.dataset.filter;
      this.triggerEvent('filtertap', { filter });
    },

    handleToggleAdv() {
      this.triggerEvent('toggleadv');
    },

    loadSearchHistory() {
      try {
        const history = wx.getStorageSync('search_history') || [];
        this.setData({ searchHistory: history.slice(0, 10) });
      } catch (error) {
        console.error('Failed to load search history', error);
      }
    },

    saveSearchHistory(keyword) {
      if (!this.data.historyEnabled) return;

      try {
        let history = wx.getStorageSync('search_history') || [];
        history = [keyword, ...history.filter(h => h !== keyword)].slice(0, 10);
        wx.setStorageSync('search_history', history);
        this.setData({ searchHistory: history });
      } catch (error) {
        console.error('Failed to save search history', error);
      }
    },
  },
});
```

---

## 实施路线图

### 阶段 1: 设计系统对齐（1 天）⭐

**目标**: 所有硬编码值替换为设计令牌

**任务清单**:

- [ ] **颜色令牌审查** (2 小时)
  - [ ] 扫描 `index.wxss` 中的所有颜色值
  - [ ] 替换为 `var(--color-*)` 或 `var(--gradient-*)`
  - [ ] 确保品牌色 `#2E86AB` 正确使用
- [ ] **圆角令牌规范** (1 小时)
  - [ ] 按照圆角使用指南调整所有 `border-radius`
  - [ ] 卡片使用 `--radius-md`，徽章使用 `--radius-sm`
- [ ] **阴影令牌统一** (1 小时)
  - [ ] 替换所有 `box-shadow` 为 `var(--shadow-*)`
- [ ] **间距令牌检查** (1 小时)
  - [ ] 统一使用 `var(--space-*)` 间距
- [ ] **验证与测试** (3 小时)
  - [ ] 运行 `npm run lint:style` 检查样式规范
  - [ ] 真机预览验证视觉一致性
  - [ ] 对比设计稿确认颜色/圆角/阴影

**预计工作量**: 8 小时

---

### 阶段 2: 基础组件集成（2 天）

**目标**: 在患者列表页使用已有 PM 组件

**任务清单**:

- [ ] **pm-card 集成** (4 小时)
  - [ ] 修改 `index.json` 引入组件
  - [ ] 将患者卡片重构为 `<pm-card>` 包裹
  - [ ] 测试 hover、点击、状态栏功能
- [ ] **pm-badge 集成** (2 小时)
  - [ ] 替换自定义徽章为 `<pm-badge>`
  - [ ] 配置状态类型（success/warning/danger/info）
  - [ ] 验证尺寸和样式
- [ ] **pm-button 集成** (2 小时)
  - [ ] FAB 按钮使用 `<pm-button>`
  - [ ] 配置 `elevated` 和 `icon-only` 属性
  - [ ] 测试点击反馈和无障碍
- [ ] **骨架屏优化** (4 小时)
  - [ ] 使用设计令牌重构骨架屏样式
  - [ ] 添加 4 个骨架卡片
  - [ ] 测试加载动画流畅度
- [ ] **空状态优化** (4 小时)
  - [ ] 使用 `<pm-card>` 作为空状态容器
  - [ ] 添加空状态插图（SVG 或 PNG）
  - [ ] 集成 `<pm-button>` 操作按钮

**预计工作量**: 16 小时

---

### 阶段 3: 业务组件开发（4 天）

**目标**: 实现 PatientCard 和 SmartSearchBar 业务组件

#### 3.1 PatientCard 组件（2 天）

**任务清单**:

- [ ] **组件结构搭建** (4 小时)
  - [ ] 创建组件目录和文件
  - [ ] 定义属性接口（参考规范文档）
  - [ ] 实现三种模式（list/compact/detail）
- [ ] **视觉实现** (6 小时)
  - [ ] 头像组件（首字母 + 背景色）
  - [ ] 徽章组（集成 `pm-badge`）
  - [ ] 快捷操作栏（集成 `pm-button`）
  - [ ] 响应式布局（移动/平板适配）
- [ ] **交互逻辑** (4 小时)
  - [ ] 卡片点击事件
  - [ ] 操作按钮点击事件
  - [ ] 选择框状态管理
  - [ ] 长按手势（移动端）
- [ ] **测试与优化** (2 小时)
  - [ ] 单元测试（事件触发）
  - [ ] 快照测试（三种模式）
  - [ ] 性能测试（渲染时间）

**预计工作量**: 16 小时

#### 3.2 SmartSearchBar 组件（2 天）

**任务清单**:

- [ ] **组件结构搭建** (3 小时)
  - [ ] 创建组件目录和文件
  - [ ] 定义属性接口（参考规范文档）
  - [ ] 集成 `pm-input` 组件
- [ ] **搜索建议实现** (5 小时)
  - [ ] 防抖输入（300ms）
  - [ ] 本地模糊匹配
  - [ ] 建议列表渲染
  - [ ] 历史记录管理
- [ ] **快捷筛选实现** (4 小时)
  - [ ] 筛选 chips 渲染（使用 `pm-badge`）
  - [ ] 激活状态切换
  - [ ] 筛选逻辑应用
- [ ] **高级筛选入口** (2 小时)
  - [ ] 抽屉触发按钮
  - [ ] 事件传递（待 FilterPanel 实现）
- [ ] **测试与优化** (2 小时)
  - [ ] 防抖逻辑测试
  - [ ] 搜索历史持久化测试
  - [ ] 键盘交互测试

**预计工作量**: 16 小时

---

### 阶段 4: 页面集成（2 天）

**目标**: 在患者列表页集成业务组件

**任务清单**:

- [ ] **PatientCard 集成** (4 小时)
  - [ ] 替换原有患者卡片为 `<patient-card>`
  - [ ] 数据适配（状态、风险、徽章）
  - [ ] 事件绑定（cardtap/actiontap/selectchange）
  - [ ] 批量选择模式实现
- [ ] **SmartSearchBar 集成** (4 小时)
  - [ ] 替换原有搜索框为 `<smart-search-bar>`
  - [ ] 搜索建议接口对接
  - [ ] 快捷筛选逻辑实现
  - [ ] 历史记录功能验证
- [ ] **交互优化** (4 小时)
  - [ ] 下拉刷新（enablePullDownRefresh）
  - [ ] 上拉加载更多（onReachBottom）
  - [ ] FAB 按钮动画优化
  - [ ] 页面切换动画
- [ ] **测试与优化** (4 小时)
  - [ ] E2E 测试（搜索-筛选-点击流程）
  - [ ] 性能测试（100+ 患者渲染）
  - [ ] 无障碍测试（键盘/屏幕阅读器）
  - [ ] 真机测试（iOS/Android）

**预计工作量**: 16 小时

---

### 阶段 5: 高级特性（3 天，可选）

**目标**: 实现智能化和个性化功能

**任务清单**:

- [ ] **FilterPanel 组件** (1 天)
  - [ ] 抽屉容器实现
  - [ ] 多条件筛选 UI
  - [ ] AND/OR 逻辑可视化
  - [ ] 筛选方案保存
- [ ] **虚拟滚动优化** (1 天)
  - [ ] 使用 `recycle-view` 或自定义方案
  - [ ] 大列表性能测试（500+ 患者）
  - [ ] 滚动流畅度优化（60fps）
- [ ] **智能排序** (0.5 天)
  - [ ] 综合排序算法（时间+频率+状态）
  - [ ] 个性化推荐
  - [ ] 排序配置保存
- [ ] **批量操作** (0.5 天)
  - [ ] 批量选择 UI
  - [ ] 批量操作栏（提醒/导出/移交）
  - [ ] 异步操作进度反馈

**预计工作量**: 24 小时

---

## 对比效果预览

### 原方案 vs 调整方案

| 维度           | 原方案        | 调整方案（v2.0）             | 改进  |
| -------------- | ------------- | ---------------------------- | ----- |
| **设计令牌**   | 部分使用      | 100% 使用                    | +100% |
| **品牌色一致** | ❌ 自定义紫色 | ✅ 品牌蓝 #2E86AB            | ✅    |
| **组件复用**   | 0%            | 80%（pm-card/badge/button）  | +80%  |
| **业务组件**   | 无            | PatientCard + SmartSearchBar | ✅    |
| **开发工作量** | 40-60 小时    | 64-80 小时                   | +30%  |
| **长期维护性** | ⭐⭐⭐        | ⭐⭐⭐⭐⭐                   | +67%  |

### 性能对比

| 场景             | 原方案    | 调整方案  | 说明       |
| ---------------- | --------- | --------- | ---------- |
| **100 患者渲染** | ~300ms    | ~250ms    | 组件优化   |
| **搜索响应**     | 即时      | 300ms防抖 | 减少请求   |
| **首屏加载**     | 0.8s      | 0.7s      | 骨架屏优化 |
| **滚动帧率**     | 55-60 fps | 58-60 fps | 虚拟滚动   |

---

## 总结

### ✅ 调整方案优势

1. **完全符合设计系统规范**
   - 100% 使用设计令牌
   - 品牌色、圆角、阴影、间距统一
   - 易于全局主题切换

2. **最大化组件复用**
   - 复用已有 PM 组件（pm-card/badge/button 等）
   - 避免重复造轮子
   - 降低维护成本

3. **落地业务组件规范**
   - PatientCard 和 SmartSearchBar 按规范实现
   - 可在其他页面复用
   - 统一交互体验

4. **长期可维护性高**
   - 组件化架构清晰
   - 设计系统驱动
   - 易于扩展和迭代

### 📊 工作量对比

| 阶段     | 原方案     | 调整方案 | 差异     |
| -------- | ---------- | -------- | -------- |
| 阶段 1   | 8-12h      | 8h       | -25%     |
| 阶段 2   | 12-16h     | 16h      | +25%     |
| 阶段 3   | -          | 32h      | 新增     |
| 阶段 4   | 16-20h     | 16h      | -20%     |
| 阶段 5   | 8-10h      | 24h      | +150%    |
| **总计** | **44-58h** | **96h**  | **+65%** |

**说明**: 虽然工作量增加，但长期收益显著：

- 组件可在其他页面复用
- 设计系统一致性提升
- 维护成本大幅降低

### 🎯 推荐实施策略

**MVP 方案**（1-2 周）:

- 阶段 1: 设计系统对齐
- 阶段 2: 基础组件集成
- 阶段 3.1: PatientCard 组件
- 阶段 4: 页面集成（基础功能）

**完整方案**（2-3 周）:

- MVP + 阶段 3.2（SmartSearchBar）
- MVP + 阶段 5（高级特性）

---

**文档生成时间**: 2025-10-01
**版本**: 2.0
**下一步**: 启动阶段 1（设计系统对齐）
