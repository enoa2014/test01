# 微信小程序患者档案管理系统 - 信息架构文档

<!-- renamed to kebab-case (information-architecture-doc.md) -->

## 文档概述

### 文档目的

本文档旨在定义微信小程序患者档案管理系统的完整信息架构，包括页面层级结构、导航体系、信息组织方式和内容分类，为设计和开发提供清晰的架构指导。

### 适用范围

- 产品经理：理解产品架构和功能组织
- UI/UX设计师：指导界面设计和用户体验设计
- 前端开发工程师：指导页面结构和组件架构
- 测试工程师：理解功能模块和测试范围

### 版本信息

- **文档版本**: v1.0
- **创建日期**: 2025年9月
- **最后更新**: 2025年9月
- **维护人员**: 产品设计团队

---

## 一、整体信息架构

### 1.1 系统信息架构层级

```
微信小程序患者档案管理系统
│
├── L0 应用层 (Application Layer)
│   ├── 应用配置 (App Config)
│   ├── 全局状态管理 (Global State)
│   └── 权限控制 (Permission Control)
│
├── L1 主功能模块 (Primary Modules)
│   ├── 📊 首页概览 (Dashboard)
│   ├── 👥 患者档案 (Patient Records)
│   ├── ➕ 入住管理 (Admission Management)
│   ├── 📈 数据分析 (Analytics)
│   └── 👤 个人中心 (Personal Center)
│
├── L2 子功能模块 (Secondary Modules)
│   ├── 搜索功能 (Search)
│   ├── 通知消息 (Notifications)
│   ├── 文件管理 (File Management)
│   └── 系统设置 (System Settings)
│
└── L3 辅助功能 (Supporting Features)
    ├── 帮助中心 (Help Center)
    ├── 意见反馈 (Feedback)
    └── 关于我们 (About Us)
```

### 1.2 信息分类体系

#### 核心数据实体

```
患者信息 (Patient Information)
├── 基本信息 (Basic Info)
│   ├── 个人身份信息 (Personal Identity)
│   ├── 联系方式 (Contact Info)
│   └── 紧急联系人 (Emergency Contact)
├── 医疗信息 (Medical Info)
│   ├── 诊断信息 (Diagnosis)
│   ├── 治疗记录 (Treatment Records)
│   └── 用药信息 (Medication)
├── 入住信息 (Admission Info)
│   ├── 入住记录 (Admission Records)
│   ├── 住宿信息 (Accommodation)
│   └── 服务记录 (Service Records)
└── 附件资料 (Documents)
    ├── 医疗文档 (Medical Documents)
    ├── 身份证明 (ID Documents)
    └── 其他资料 (Other Files)
```

#### 业务流程分类

```
业务流程 (Business Processes)
├── 入住流程 (Admission Process)
│   ├── 预约申请 (Application)
│   ├── 资格审核 (Eligibility Review)
│   ├── 信息录入 (Data Entry)
│   └── 入住确认 (Confirmation)
├── 日常管理 (Daily Management)
│   ├── 信息更新 (Information Update)
│   ├── 服务记录 (Service Logging)
│   └── 状态跟踪 (Status Tracking)
└── 数据分析 (Data Analysis)
    ├── 统计报告 (Statistical Reports)
    ├── 趋势分析 (Trend Analysis)
    └── 数据导出 (Data Export)
```

---

## 二、页面层级架构

### 2.1 主导航架构

```
底部导航栏 (Tab Bar Navigation)
┌─────────────────────────────────────────────────────────┐
│  🏠首页   👥患者   ➕入住   📊分析   👤我的  │
└─────────────────────────────────────────────────────────┘
```

#### 导航层级定义

| 导航项  | 功能描述           | 用户角色    | 使用频率 |
| ------- | ------------------ | ----------- | -------- |
| 🏠 首页 | 数据概览、快捷操作 | 所有用户    | 极高     |
| 👥 患者 | 患者档案管理       | 所有用户    | 极高     |
| ➕ 入住 | 新患者入住流程     | 管理员/护士 | 高       |
| 📊 分析 | 数据统计分析       | 管理员      | 中       |
| 👤 我的 | 个人设置、帮助     | 所有用户    | 低       |

### 2.2 页面层级结构

#### 2.2.1 首页模块 (Dashboard)

```
🏠 首页 (L1)
├── 📋 今日概览 (L2)
│   ├── 在住人数统计
│   ├── 今日入住数量
│   ├── 待处理事项提醒
│   └── 床位使用情况
├── ⚡ 快捷操作 (L2)
│   ├── 新患者入住
│   ├── 查找患者
│   ├── 扫码查看
│   └── 紧急联系
├── 📈 数据卡片 (L2)
│   ├── 本月入住统计
│   ├── 平均住院时长
│   ├── 服务满意度
│   └── 资源利用率
└── 📰 最新动态 (L2)
    ├── 最新入住患者
    ├── 即将出院提醒
    ├── 系统通知消息
    └── 重要事项提醒
```

#### 2.2.2 患者档案模块 (Patient Records)

```
👥 患者档案 (L1)
├── 🔍 搜索筛选 (L2)
│   ├── 搜索框 (关键词搜索)
│   ├── 筛选器 (状态、年龄、性别)
│   ├── 排序选项 (入住时间、姓名、年龄)
│   └── 高级搜索 (多条件组合)
├── 📋 患者列表 (L2)
│   ├── 患者卡片视图
│   │   ├── 基本信息展示
│   │   ├── 状态标识
│   │   ├── 快捷操作按钮
│   │   └── 关键信息预览
│   ├── 列表视图选项
│   ├── 批量操作功能
│   └── 分页加载
└── 👤 患者详情 (L2)
    ├── 🏷️ 基本信息 (L3)
    │   ├── 个人身份信息
    │   ├── 联系方式信息
    │   ├── 紧急联系人
    │   └── 快捷编辑功能
    ├── 🏥 医疗信息 (L3)
    │   ├── 诊断信息
    │   ├── 治疗方案
    │   ├── 用药记录
    │   └── 医疗团队
    ├── 🏠 入住记录 (L3)
    │   ├── 入住历史列表
    │   ├── 住宿房间信息
    │   ├── 服务记录时间轴
    │   └── 费用结算信息
    ├── 📎 附件资料 (L3)
    │   ├── 医疗文档
    │   ├── 身份证明
    │   ├── 照片资料
    │   └── 其他文件
    └── ⚙️ 操作记录 (L3)
        ├── 编辑历史
        ├── 操作日志
        └── 权限记录
```

#### 2.2.3 入住管理模块 (Admission Management)

```
➕ 入住管理 (L1)
├── 🚀 快速入住 (L2) - 已有患者
│   ├── 患者选择
│   │   ├── 搜索现有患者
│   │   ├── 患者信息预览
│   │   └── 确认选择
│   ├── 入住信息录入
│   │   ├── 入住日期选择
│   │   ├── 房间分配
│   │   ├── 陪护人员信息
│   │   └── 特殊需求说明
│   └── 确认提交
│       ├── 信息确认页面
│       ├── 提交处理
│       └── 成功反馈
├── 📝 新建档案 (L2) - 新患者
│   ├── 基本信息 (L3)
│   │   ├── 个人身份信息录入
│   │   ├── 联系方式录入
│   │   ├── 紧急联系人录入
│   │   └── 实时数据验证
│   ├── 医疗信息 (L3)
│   │   ├── 诊断信息录入
│   │   ├── 治疗方案录入
│   │   ├── 用药信息录入
│   │   └── 医疗团队指定
│   ├── 附件上传 (L3)
│   │   ├── 医疗文档上传
│   │   ├── 身份证明上传
│   │   ├── 照片上传
│   │   └── 文件管理
│   ├── 入住安排 (L3)
│   │   ├── 房间选择
│   │   ├── 床位分配
│   │   ├── 服务项目选择
│   │   └── 费用预估
│   └── 确认完成 (L3)
│       ├── 信息汇总确认
│       ├── 数字签名
│       ├── 协议确认
│       └── 成功页面
└── 📊 入住统计 (L2)
    ├── 入住趋势图表
    ├── 房间占用情况
    ├── 入住来源分析
    └── 平均住院时长
```

#### 2.2.4 数据分析模块 (Analytics)

```
📊 数据分析 (L1)
├── 📈 概览统计 (L2)
│   ├── 关键指标仪表盘
│   │   ├── 总患者数量
│   │   ├── 在住患者数
│   │   ├── 本月新增
│   │   └── 床位使用率
│   ├── 趋势图表
│   │   ├── 入住趋势
│   │   ├── 出院趋势
│   │   ├── 平均住院时长
│   │   └── 满意度变化
│   └── 对比分析
│       ├── 同比分析
│       ├── 环比分析
│       └── 目标达成率
├── 👥 患者分析 (L2)
│   ├── 人口统计学分析
│   │   ├── 年龄分布
│   │   ├── 性别比例
│   │   ├── 地区分布
│   │   └── 疾病类型分布
│   ├── 服务分析
│   │   ├── 服务使用情况
│   │   ├── 满意度分析
│   │   ├── 投诉建议统计
│   │   └── 服务效果评估
│   └── 费用分析
│       ├── 费用结构分析
│       ├── 平均费用趋势
│       └── 支付方式分布
├── 🏥 运营分析 (L2)
│   ├── 资源利用分析
│   │   ├── 床位使用率
│   │   ├── 房间周转率
│   │   ├── 设备使用情况
│   │   └── 人员工作量
│   ├── 效率分析
│   │   ├── 入住流程耗时
│   │   ├── 信息录入效率
│   │   ├── 响应时间分析
│   │   └── 错误率统计
│   └── 成本分析
│       ├── 运营成本分布
│       ├── 人员成本分析
│       └── 设施维护成本
└── 📋 报告导出 (L2)
    ├── 预定义报告模板
    ├── 自定义报告生成
    ├── 数据导出功能
    └── 报告分享功能
```

#### 2.2.5 个人中心模块 (Personal Center)

```
👤 个人中心 (L1)
├── 👨‍💼 个人信息 (L2)
│   ├── 基本信息展示
│   ├── 角色权限信息
│   ├── 工作统计
│   └── 个人设置
├── ⚙️ 系统设置 (L2)
│   ├── 通知设置
│   │   ├── 消息推送开关
│   │   ├── 提醒时间设置
│   │   └── 消息类型选择
│   ├── 界面设置
│   │   ├── 主题模式选择
│   │   ├── 字体大小调节
│   │   └── 语言设置
│   ├── 隐私设置
│   │   ├── 数据权限管理
│   │   ├── 访问记录查看
│   │   └── 隐私保护选项
│   └── 安全设置
│       ├── 密码修改
│       ├── 登录设备管理
│       └── 操作权限设置
├── 📚 帮助中心 (L2)
│   ├── 使用指南
│   │   ├── 快速入门
│   │   ├── 功能介绍
│   │   ├── 操作视频
│   │   └── 常见问题
│   ├── 联系支持
│   │   ├── 在线客服
│   │   ├── 技术支持
│   │   ├── 意见反馈
│   │   └── 问题报告
│   └── 系统信息
│       ├── 版本信息
│       ├── 更新日志
│       ├── 服务条款
│       └── 隐私政策
└── 🔐 账户管理 (L2)
    ├── 登录历史
    ├── 权限申请
    ├── 数据备份
    └── 账户注销
```

---

## 三、导航体系设计

### 3.1 主导航系统

#### 底部Tab导航 (Primary Navigation)

```
┌─────┬─────┬─────┬─────┬─────┐
│ 🏠  │ 👥  │ ➕  │ 📊  │ 👤  │
│首页 │患者 │入住 │分析 │我的 │
└─────┴─────┴─────┴─────┴─────┘
```

**设计原则**:

- **5+2原则**: 5个主要功能 + 搜索和通知2个辅助功能
- **高频前置**: 最常用功能位于左侧
- **角色区分**: 不同角色看到不同的导航选项
- **状态指示**: 通过角标显示未读消息和待处理事项

#### 导航状态管理

```javascript
// 导航状态配置
const navigationConfig = {
  tabs: [
    {
      name: 'dashboard',
      title: '首页',
      icon: '🏠',
      roles: ['all'],
      badge: () => getPendingTasksCount(),
    },
    {
      name: 'patients',
      title: '患者',
      icon: '👥',
      roles: ['all'],
      badge: () => getNewPatientsCount(),
    },
    {
      name: 'admission',
      title: '入住',
      icon: '➕',
      roles: ['admin', 'nurse'],
      badge: () => getPendingAdmissionsCount(),
    },
    {
      name: 'analytics',
      title: '分析',
      icon: '📊',
      roles: ['admin', 'manager'],
      badge: null,
    },
    {
      name: 'profile',
      title: '我的',
      icon: '👤',
      roles: ['all'],
      badge: null,
    },
  ],
};
```

### 3.2 次级导航系统

#### 顶部导航栏 (Secondary Navigation)

```
┌───────────────────────────────────────────────────┐
│ ← 返回  │    页面标题    │  🔍搜索  ⚙️设置  │
└───────────────────────────────────────────────────┘
```

**组件构成**:

- **返回按钮**: 层级导航返回
- **页面标题**: 当前页面名称
- **搜索入口**: 全局/局部搜索
- **功能按钮**: 页面相关操作(筛选、排序、设置等)

#### 面包屑导航 (Breadcrumb Navigation)

```
首页 > 患者档案 > 张小明
首页 > 入住管理 > 新建档案 > 基本信息
首页 > 数据分析 > 患者分析 > 年龄分布
```

**使用场景**:

- 深层级页面导航
- 复杂流程中的位置指示
- 快速返回上级页面

### 3.3 操作导航系统

#### 浮动操作按钮 (FAB)

```
页面右下角: ➕ 快速操作
├── 新增患者
├── 快速入住
└── 紧急联系
```

#### 上下文菜单 (Context Menu)

```
长按患者卡片:
├── 查看详情
├── 编辑信息
├── 联系家属
├── 标记重要
└── 归档患者
```

#### 手势导航

- **左右滑动**: 切换Tab页面
- **下拉刷新**: 更新页面数据
- **上拉加载**: 加载更多内容
- **长按**: 激活上下文菜单

---

## 四、信息层级设计

### 4.1 信息优先级矩阵

#### 首页信息层级

```
L1 - 关键信息 (立即可见)
├── 当前在住人数
├── 今日新增入住
├── 紧急待处理事项
└── 床位使用状态

L2 - 重要信息 (首屏下方)
├── 本周/本月统计
├── 即将到期提醒
├── 资源利用情况
└── 快捷操作入口

L3 - 辅助信息 (需要滚动)
├── 历史趋势图表
├── 最新动态列表
├── 系统通知消息
└── 帮助快捷链接
```

#### 患者列表信息层级

```
L1 - 核心信息 (卡片主体)
├── 患者姓名 (最大字号)
├── 年龄性别 (次要信息)
├── 入住状态 (状态标识)
└── 入住时间 (时间信息)

L2 - 关键信息 (卡片次要区域)
├── 主要诊断
├── 床位号码
├── 陪护信息
└── 联系方式

L3 - 详细信息 (点击展开)
├── 完整医疗信息
├── 详细联系信息
├── 入住历史记录
└── 附件文档列表
```

#### 患者详情信息层级

```
L1 - 基础信息头部 (固定显示)
├── 患者照片/头像
├── 姓名和基本信息
├── 当前状态标识
└── 核心联系方式

L2 - 主要信息模块 (Tab切换)
├── 基本信息 Tab
├── 医疗信息 Tab
├── 入住记录 Tab
└── 附件资料 Tab

L3 - 详细内容 (模块内部)
├── 具体字段信息
├── 历史记录列表
├── 相关文档链接
└── 操作按钮组
```

### 4.2 信息密度控制

#### 信息密度等级

| 等级   | 信息量 | 适用场景   | 设计原则           |
| ------ | ------ | ---------- | ------------------ |
| 高密度 | 8-12项 | 管理员概览 | 紧凑布局，小字体   |
| 中密度 | 4-6项  | 日常操作   | 平衡布局，标准字体 |
| 低密度 | 2-3项  | 移动端首页 | 宽松布局，大字体   |

#### 响应式信息层级

```css
/* 不同屏幕尺寸的信息显示策略 */
@media (max-width: 320px) {
  /* 超小屏幕：只显示L1信息 */
  .info-level-2,
  .info-level-3 {
    display: none;
  }
}

@media (min-width: 321px) and (max-width: 375px) {
  /* 小屏幕：显示L1+L2信息 */
  .info-level-3 {
    display: none;
  }
}

@media (min-width: 376px) {
  /* 大屏幕：显示所有信息 */
  .info-level-1,
  .info-level-2,
  .info-level-3 {
    display: block;
  }
}
```

---

## 五、内容组织策略

### 5.1 内容分类系统

#### 按功能分类

```
核心功能内容 (Core Content)
├── 患者基础数据
├── 医疗关键信息
├── 入住核心流程
└── 关键统计指标

支持功能内容 (Supporting Content)
├── 系统配置信息
├── 帮助文档内容
├── 历史记录数据
└── 附加说明文本

管理功能内容 (Administrative Content)
├── 用户权限信息
├── 系统日志数据
├── 审计跟踪记录
└── 合规性文档
```

#### 按使用频率分类

```
高频内容 (Daily Use - 80% 时间)
├── 患者基本信息查看
├── 入住状态更新
├── 联系方式查询
└── 快速搜索功能

中频内容 (Weekly Use - 15% 时间)
├── 新患者档案创建
├── 详细医疗信息录入
├── 统计报告查看
└── 系统设置调整

低频内容 (Monthly Use - 5% 时间)
├── 数据分析深度挖掘
├── 系统管理功能
├── 帮助文档查阅
└── 反馈问题报告
```

### 5.2 内容优先级策略

#### 内容重要性评估矩阵

| 重要性 | 紧急性 | 显示策略           | 交互方式 |
| ------ | ------ | ------------------ | -------- |
| 高     | 高     | 首屏显示，突出样式 | 一键直达 |
| 高     | 低     | 首屏显示，标准样式 | 点击查看 |
| 低     | 高     | 折叠显示，提醒标识 | 展开查看 |
| 低     | 低     | 隐藏显示，入口保留 | 多级导航 |

#### 动态内容优先级

```javascript
// 内容优先级动态计算
const calculateContentPriority = content => {
  let priority = 0;

  // 基于用户角色
  priority += getRolePriority(content.type, user.role);

  // 基于使用频率
  priority += getUsageFrequency(content.id, user.id);

  // 基于时间敏感性
  priority += getTimeSensitivity(content.timestamp);

  // 基于个人偏好
  priority += getPersonalPreference(content.category, user.preferences);

  return priority;
};
```

### 5.3 内容呈现模式

#### 卡片式布局 (Card Layout)

```
┌─────────────────────────────┐
│ 🏷️ 标题                    │
│ ───────────────────────── │
│ 📝 主要内容                │
│ 📊 关键数据                │
│ ───────────────────────── │
│ 🔗 操作按钮   📅 时间戳    │
└─────────────────────────────┘
```

#### 列表式布局 (List Layout)

```
👤 姓名         📞 联系方式    🏥 状态
📅 入住时间     🏠 房间号      ⚡ 操作
─────────────────────────────────────
👤 姓名         📞 联系方式    🏥 状态
📅 入住时间     🏠 房间号      ⚡ 操作
```

#### 表格式布局 (Table Layout)

```
| 姓名   | 年龄 | 性别 | 入住时间   | 状态 | 操作     |
|--------|------|------|------------|------|----------|
| 张小明 | 8岁  | 男   | 2024-01-15 | 在住 | 查看编辑 |
| 李小红 | 6岁  | 女   | 2024-01-10 | 在住 | 查看编辑 |
```

#### 时间轴布局 (Timeline Layout)

```
⭕ 2024-01-15 入住登记
│  └── 完成基本信息录入
│
⭕ 2024-01-16 医疗评估
│  └── 完成健康状况评估
│
⭕ 2024-01-17 治疗开始
│  └── 开始康复治疗计划
```

---

## 六、搜索架构设计

### 6.1 搜索功能层级

#### 全局搜索 (Global Search)

```
搜索范围: 全系统内容
├── 患者姓名搜索
├── 联系方式搜索
├── 诊断信息搜索
├── 房间号搜索
└── 文档内容搜索

搜索类型:
├── 精确匹配
├── 模糊匹配
├── 拼音搜索
└── 同音字搜索

搜索结果呈现:
├── 按相关性排序
├── 按时间排序
├── 按类型分组
└── 高亮关键词
```

#### 局部搜索 (Local Search)

```
患者列表搜索:
├── 姓名搜索
├── 年龄范围筛选
├── 性别筛选
├── 入住状态筛选
├── 入住时间范围
└── 诊断类型筛选

医疗信息搜索:
├── 诊断关键词
├── 用药信息
├── 治疗方案
└── 医生姓名

文档搜索:
├── 文件名搜索
├── 文件类型筛选
├── 上传时间筛选
└── 文件大小筛选
```

### 6.2 搜索体验设计

#### 搜索输入体验

```
搜索框设计:
┌─────────────────────────────────────┐
│ 🔍 搜索患者姓名、电话、诊断...    ×  │
└─────────────────────────────────────┘
   ↓ (输入时)
┌─────────────────────────────────────┐
│ 🔍 张                           ×   │
├─────────────────────────────────────┤
│ 🔥 热门搜索                        │
│ 👤 张小明 (白血病, 在住)           │
│ 👤 张小红 (心脏病, 已出院)         │
├─────────────────────────────────────┤
│ 📚 搜索历史                        │
│ 👤 李小华                          │
│ 👤 王小明                          │
└─────────────────────────────────────┘
```

#### 搜索结果展示

```
搜索结果页面结构:
┌─────────────────────────────────────┐
│ 🔍 "张小明" 的搜索结果 (共3条)      │
├─────────────────────────────────────┤
│ 📂 患者档案 (2条)                   │
│ ┌─────────────────────────────────┐ │
│ │ 👤 张小明 8岁 男               │ │
│ │ 🏥 急性白血病 在住             │ │
│ │ 📅 2024-01-15 入住             │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ 👤 张小明华 10岁 女            │ │
│ │ 🏥 先天性心脏病 已出院         │ │
│ │ 📅 2023-12-20 出院             │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ 📄 相关文档 (1条)                   │
│ ┌─────────────────────────────────┐ │
│ │ 📋 张小明_入住协议.pdf          │ │
│ │ 📅 2024-01-15 上传             │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 6.3 智能搜索功能

#### 搜索建议与联想

```javascript
// 搜索建议算法
const generateSearchSuggestions = (query) => {
  return {
    autoComplete: getAutoCompleteResults(query),
    relatedPatients: getRelatedPatients(query),
    historicalSearches: getUserSearchHistory(query),
    popularSearches: getPopularSearches(query),
    smartSuggestions: getAISuggestions(query)
  };
};

// 示例输出
输入: "白血"
建议:
├── 自动补全: "白血病"
├── 相关患者: "张小明(急性白血病)"
├── 历史搜索: "白血病治疗方案"
├── 热门搜索: "白血病康复"
└── 智能建议: "白血病患者护理"
```

#### 搜索过滤器

```
高级搜索过滤器:
┌─────────────────────────────────────┐
│ 🔍 高级搜索                         │
├─────────────────────────────────────┤
│ 👤 患者信息                         │
│ • 年龄范围: [0] - [18] 岁          │
│ • 性别: ☑️男 ☑️女                  │
│ • 状态: ☑️在住 ☐已出院 ☐转院      │
├─────────────────────────────────────┤
│ 🏥 医疗信息                         │
│ • 疾病类型: [选择疾病类型]          │
│ • 治疗阶段: [选择治疗阶段]          │
│ • 主治医生: [选择医生]              │
├─────────────────────────────────────┤
│ 📅 时间范围                         │
│ • 入住时间: [开始日期] - [结束日期] │
│ • 更新时间: [开始日期] - [结束日期] │
├─────────────────────────────────────┤
│        [重置]    [搜索]             │
└─────────────────────────────────────┘
```

---

## 七、用户权限架构

### 7.1 角色权限模型

#### 角色定义

```
角色层级 (Role Hierarchy):
├── 🔵 超级管理员 (Super Admin)
│   ├── 系统配置权限
│   ├── 用户管理权限
│   ├── 数据导入导出
│   └── 所有功能访问
├── 🟢 管理员 (Admin)
│   ├── 患者信息管理
│   ├── 入住流程管理
│   ├── 数据分析查看
│   └── 基础设置配置
├── 🟡 护士长 (Head Nurse)
│   ├── 患者信息编辑
│   ├── 入住审核权限
│   ├── 团队工作安排
│   └── 报告查看权限
├── 🟠 护士 (Nurse)
│   ├── 患者信息查看
│   ├── 基础信息更新
│   ├── 日常记录维护
│   └── 有限编辑权限
└── 🔴 志愿者 (Volunteer)
    ├── 基础信息查看
    ├── 有限搜索功能
    └── 协助录入权限
```

#### 权限矩阵

| 功能模块     | 超级管理员 | 管理员 | 护士长 | 护士 | 志愿者 |
| ------------ | ---------- | ------ | ------ | ---- | ------ |
| 患者档案查看 | ✅         | ✅     | ✅     | ✅   | ✅     |
| 患者信息编辑 | ✅         | ✅     | ✅     | ⚠️   | ❌     |
| 新患者入住   | ✅         | ✅     | ✅     | ⚠️   | ❌     |
| 数据分析     | ✅         | ✅     | ⚠️     | ❌   | ❌     |
| 系统设置     | ✅         | ⚠️     | ❌     | ❌   | ❌     |
| 用户管理     | ✅         | ❌     | ❌     | ❌   | ❌     |

_说明: ✅ 完全权限, ⚠️ 有限权限, ❌ 无权限_

### 7.2 权限控制策略

#### 页面级权限控制

```javascript
// 页面权限配置
const pagePermissions = {
  '/dashboard': {
    roles: ['all'],
    permissions: ['read'],
  },
  '/patients': {
    roles: ['admin', 'nurse', 'volunteer'],
    permissions: ['read', 'search'],
  },
  '/patients/edit': {
    roles: ['admin', 'head_nurse', 'nurse'],
    permissions: ['read', 'write'],
    conditions: {
      nurse: 'own_patients_only', // 护士只能编辑自己负责的患者
    },
  },
  '/admission': {
    roles: ['admin', 'head_nurse'],
    permissions: ['read', 'write', 'create'],
  },
  '/analytics': {
    roles: ['admin', 'head_nurse'],
    permissions: ['read'],
    conditions: {
      head_nurse: 'department_data_only', // 护士长只能看科室数据
    },
  },
  '/system': {
    roles: ['super_admin'],
    permissions: ['read', 'write', 'delete', 'configure'],
  },
};
```

#### 数据级权限控制

```javascript
// 数据访问权限
const dataPermissions = {
  patient_data: {
    super_admin: 'all_data',
    admin: 'all_data',
    head_nurse: 'department_data',
    nurse: 'assigned_patients',
    volunteer: 'basic_info_only',
  },
  medical_records: {
    super_admin: 'full_access',
    admin: 'full_access',
    head_nurse: 'department_records',
    nurse: 'assigned_patients_records',
    volunteer: 'no_access',
  },
  sensitive_data: {
    super_admin: 'full_access',
    admin: 'masked_access', // 敏感信息脱敏
    head_nurse: 'masked_access',
    nurse: 'masked_access',
    volunteer: 'no_access',
  },
};
```

#### 操作权限控制

```javascript
// 操作权限配置
const operationPermissions = {
  create_patient: {
    roles: ['admin', 'head_nurse'],
    workflow: 'approval_required', // 需要审批流程
  },
  edit_medical_info: {
    roles: ['admin', 'head_nurse', 'nurse'],
    conditions: {
      nurse: 'supervisor_approval_required',
    },
  },
  delete_patient: {
    roles: ['super_admin'],
    workflow: 'multi_level_approval',
  },
  export_data: {
    roles: ['super_admin', 'admin'],
    audit: 'required', // 需要审计日志
    approval: 'required',
  },
};
```

### 7.3 权限验证流程

#### 权限验证中间件

```javascript
// 权限验证流程
const permissionMiddleware = async (req, res, next) => {
  try {
    // 1. 验证用户身份
    const user = await authenticateUser(req.token);

    // 2. 获取用户角色
    const userRole = await getUserRole(user.id);

    // 3. 检查页面访问权限
    const pagePermission = checkPagePermission(req.path, userRole);
    if (!pagePermission.allowed) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // 4. 检查数据访问权限
    if (req.params.patientId) {
      const dataPermission = await checkDataPermission(req.params.patientId, userRole, user.id);
      if (!dataPermission.allowed) {
        return res.status(403).json({ error: 'Data access denied' });
      }
    }

    // 5. 检查操作权限
    const operationPermission = checkOperationPermission(req.method, req.path, userRole);
    if (!operationPermission.allowed) {
      return res.status(403).json({ error: 'Operation not permitted' });
    }

    // 6. 记录访问日志
    await logAccess(user.id, req.path, req.method);

    req.user = user;
    req.permissions = {
      page: pagePermission,
      data: dataPermission,
      operation: operationPermission,
    };

    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};
```

---

## 八、状态管理架构

### 8.1 应用状态分层

#### 全局状态 (Global State)

```javascript
// 全局状态结构
const globalState = {
  // 用户状态
  user: {
    profile: userProfile,
    permissions: userPermissions,
    preferences: userPreferences,
    session: sessionInfo,
  },

  // 应用状态
  app: {
    theme: 'light', // light | dark | auto
    language: 'zh-CN',
    networkStatus: 'online', // online | offline | slow
    loading: false,
    notifications: [],
  },

  // 系统配置
  config: {
    apiBaseUrl: configData.apiUrl,
    features: enabledFeatures,
    limits: systemLimits,
    version: appVersion,
  },
};
```

#### 页面状态 (Page State)

```javascript
// 患者列表页状态
const patientListState = {
  // 数据状态
  data: {
    patients: [],
    totalCount: 0,
    currentPage: 1,
    pageSize: 20,
  },

  // UI状态
  ui: {
    loading: false,
    error: null,
    selectedIds: [],
    viewMode: 'card', // card | list | table
    sortBy: 'admissionDate',
    sortOrder: 'desc',
  },

  // 搜索状态
  search: {
    keyword: '',
    filters: {
      status: 'all',
      ageRange: [0, 18],
      gender: 'all',
      dateRange: null,
    },
    suggestions: [],
    history: [],
  },
};

// 患者详情页状态
const patientDetailState = {
  // 患者数据
  patient: {
    basicInfo: {},
    medicalInfo: {},
    admissionHistory: [],
    documents: [],
  },

  // 编辑状态
  editing: {
    isEditing: false,
    editingSection: null, // basic | medical | documents
    hasChanges: false,
    validationErrors: {},
  },

  // UI状态
  ui: {
    activeTab: 'basic',
    loading: false,
    saving: false,
    error: null,
  },
};
```

#### 组件状态 (Component State)

```javascript
// 组件内部状态示例
const componentState = {
  // 表单组件状态
  formState: {
    values: {},
    errors: {},
    touched: {},
    isValid: false,
    isSubmitting: false,
  },

  // 模态框状态
  modalState: {
    isOpen: false,
    type: null, // confirm | info | error
    title: '',
    content: '',
    onConfirm: null,
    onCancel: null,
  },

  // 文件上传状态
  uploadState: {
    files: [],
    uploading: false,
    progress: 0,
    error: null,
  },
};
```

### 8.2 状态更新流程

#### 状态变更流水线

```javascript
// 状态更新流程
const stateUpdatePipeline = {
  // 1. 动作派发 (Action Dispatch)
  dispatch: action => {
    // 记录动作日志
    logger.debug('Action dispatched:', action);

    // 验证动作格式
    validateAction(action);

    // 派发到对应的处理器
    return actionHandler.handle(action);
  },

  // 2. 状态变更 (State Mutation)
  mutate: (state, payload) => {
    // 创建新状态对象
    const newState = { ...state };

    // 应用变更
    applyMutation(newState, payload);

    // 验证状态有效性
    validateState(newState);

    return newState;
  },

  // 3. 副作用处理 (Side Effects)
  effects: async (action, state) => {
    // API调用
    if (action.type.includes('_REQUEST')) {
      await handleApiCall(action);
    }

    // 本地存储同步
    if (action.type.includes('_UPDATE')) {
      await syncToLocalStorage(state);
    }

    // 通知推送
    if (action.type.includes('_NOTIFY')) {
      await sendNotification(action.payload);
    }
  },

  // 4. 视图更新 (View Update)
  update: (component, newState) => {
    // 比较状态差异
    const diff = compareState(component.state, newState);

    // 只更新有变化的部分
    if (diff.hasChanges) {
      component.setState(newState);
    }
  },
};
```

#### 状态持久化策略

```javascript
// 状态持久化配置
const persistenceConfig = {
  // 需要持久化的状态
  persist: {
    user: {
      storage: 'secure', // 安全存储
      keys: ['preferences', 'session'],
      encryption: true,
    },
    search: {
      storage: 'local',
      keys: ['history', 'filters'],
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7天
    },
    cache: {
      storage: 'memory',
      keys: ['patients', 'config'],
      maxSize: 50 * 1024 * 1024, // 50MB
    },
  },

  // 不持久化的状态
  transient: ['loading', 'error', 'networkStatus', 'notifications'],

  // 持久化策略
  strategies: {
    immediate: ['user.session'], // 立即持久化
    debounced: ['search.filters'], // 防抖持久化
    periodic: ['cache.patients'], // 定期持久化
  },
};
```

---

## 九、错误处理架构

### 9.1 错误分类体系

#### 错误类型分类

```javascript
// 错误类型定义
const ErrorTypes = {
  // 网络错误
  NETWORK: {
    CONNECTION_FAILED: 'network.connection_failed',
    TIMEOUT: 'network.timeout',
    SERVER_ERROR: 'network.server_error',
    NO_INTERNET: 'network.no_internet',
  },

  // 验证错误
  VALIDATION: {
    REQUIRED_FIELD: 'validation.required_field',
    INVALID_FORMAT: 'validation.invalid_format',
    OUT_OF_RANGE: 'validation.out_of_range',
    DUPLICATE_VALUE: 'validation.duplicate_value',
  },

  // 权限错误
  PERMISSION: {
    ACCESS_DENIED: 'permission.access_denied',
    INSUFFICIENT_PRIVILEGES: 'permission.insufficient_privileges',
    SESSION_EXPIRED: 'permission.session_expired',
    ACCOUNT_DISABLED: 'permission.account_disabled',
  },

  // 业务错误
  BUSINESS: {
    PATIENT_NOT_FOUND: 'business.patient_not_found',
    ADMISSION_CONFLICT: 'business.admission_conflict',
    INVALID_OPERATION: 'business.invalid_operation',
    DATA_INCONSISTENCY: 'business.data_inconsistency',
  },

  // 系统错误
  SYSTEM: {
    UNEXPECTED_ERROR: 'system.unexpected_error',
    SERVICE_UNAVAILABLE: 'system.service_unavailable',
    MAINTENANCE_MODE: 'system.maintenance_mode',
    VERSION_MISMATCH: 'system.version_mismatch',
  },
};
```

#### 错误严重性等级

```javascript
// 错误严重性分级
const ErrorSeverity = {
  CRITICAL: {
    level: 5,
    description: '系统崩溃，无法继续使用',
    action: 'immediate_attention',
    recovery: 'restart_required',
  },
  HIGH: {
    level: 4,
    description: '核心功能受影响',
    action: 'urgent_fix',
    recovery: 'alternative_path',
  },
  MEDIUM: {
    level: 3,
    description: '部分功能受影响',
    action: 'scheduled_fix',
    recovery: 'retry_available',
  },
  LOW: {
    level: 2,
    description: '轻微影响用户体验',
    action: 'enhancement',
    recovery: 'auto_recovery',
  },
  INFO: {
    level: 1,
    description: '信息提示，无需处理',
    action: 'log_only',
    recovery: 'none_required',
  },
};
```

### 9.2 错误处理策略

#### 错误处理流程

```javascript
// 统一错误处理器
class ErrorHandler {
  static handle(error, context = {}) {
    // 1. 错误分类
    const errorType = this.classifyError(error);

    // 2. 严重性评估
    const severity = this.assessSeverity(errorType, context);

    // 3. 用户提示
    const userMessage = this.generateUserMessage(errorType, severity);

    // 4. 恢复策略
    const recovery = this.getRecoveryStrategy(errorType, severity);

    // 5. 日志记录
    this.logError(error, errorType, severity, context);

    // 6. 错误上报
    if (severity.level >= 3) {
      this.reportError(error, context);
    }

    return {
      type: errorType,
      severity,
      message: userMessage,
      recovery,
      timestamp: new Date().toISOString(),
    };
  }

  static generateUserMessage(errorType, severity) {
    const messages = {
      [ErrorTypes.NETWORK.CONNECTION_FAILED]: {
        title: '网络连接失败',
        description: '请检查网络连接后重试',
        action: '重试',
      },
      [ErrorTypes.VALIDATION.REQUIRED_FIELD]: {
        title: '信息填写不完整',
        description: '请填写必填项后提交',
        action: '检查',
      },
      [ErrorTypes.PERMISSION.ACCESS_DENIED]: {
        title: '访问被拒绝',
        description: '您没有权限执行此操作',
        action: '联系管理员',
      },
      [ErrorTypes.BUSINESS.PATIENT_NOT_FOUND]: {
        title: '患者信息未找到',
        description: '该患者可能已被删除或转移',
        action: '刷新页面',
      },
    };

    return (
      messages[errorType] || {
        title: '操作失败',
        description: '请稍后重试或联系技术支持',
        action: '重试',
      }
    );
  }
}
```

#### 错误恢复机制

```javascript
// 错误恢复策略
const RecoveryStrategies = {
  // 自动重试
  AUTO_RETRY: {
    maxAttempts: 3,
    backoffStrategy: 'exponential', // linear | exponential
    baseDelay: 1000,
    maxDelay: 10000,
    shouldRetry: error => {
      return error.type.startsWith('network.') && error.status >= 500;
    },
  },

  // 降级服务
  FALLBACK: {
    strategies: {
      'network.connection_failed': () => {
        // 启用离线模式
        return switchToOfflineMode();
      },
      'service.unavailable': () => {
        // 使用缓存数据
        return useCachedData();
      },
      'feature.disabled': () => {
        // 隐藏功能入口
        return hideFeature();
      },
    },
  },

  // 用户引导
  USER_GUIDANCE: {
    'validation.required_field': () => {
      return highlightRequiredFields();
    },
    'permission.access_denied': () => {
      return showPermissionHelp();
    },
    'network.no_internet': () => {
      return showNetworkTroubleshooting();
    },
  },

  // 数据修复
  DATA_REPAIR: {
    'data.inconsistency': async () => {
      const repair = await attemptDataRepair();
      if (repair.success) {
        return { strategy: 'repaired', data: repair.data };
      }
      return { strategy: 'manual_intervention_required' };
    },
  },
};
```

### 9.3 用户错误反馈界面

#### 错误提示组件设计

```vue
<!-- 错误提示组件 -->
<template>
  <view class="error-container" v-if="error">
    <!-- 轻微错误 - Toast提示 -->
    <Toast
      v-if="error.severity.level <= 2"
      :type="error.type"
      :message="error.message.description"
      :duration="3000"
      @close="handleErrorDismiss"
    />

    <!-- 中等错误 - 卡片提示 -->
    <ErrorCard
      v-else-if="error.severity.level === 3"
      :title="error.message.title"
      :description="error.message.description"
      :action="error.message.action"
      @retry="handleRetry"
      @dismiss="handleErrorDismiss"
    />

    <!-- 严重错误 - 全屏提示 -->
    <ErrorPage
      v-else
      :title="error.message.title"
      :description="error.message.description"
      :illustration="getErrorIllustration(error.type)"
      :actions="getErrorActions(error)"
      @action="handleErrorAction"
    />
  </view>
</template>

<script>
export default {
  props: {
    error: {
      type: Object,
      default: null,
    },
  },

  methods: {
    handleRetry() {
      this.$emit('retry');
    },

    handleErrorDismiss() {
      this.$emit('dismiss');
    },

    handleErrorAction(action) {
      this.$emit('action', action);
    },

    getErrorIllustration(errorType) {
      const illustrations = {
        'network.': '🌐',
        'permission.': '🔒',
        'validation.': '📝',
        'business.': '💼',
        'system.': '⚙️',
      };

      for (const [prefix, icon] of Object.entries(illustrations)) {
        if (errorType.startsWith(prefix)) {
          return icon;
        }
      }

      return '❌';
    },

    getErrorActions(error) {
      const actions = [];

      if (error.recovery.canRetry) {
        actions.push({ type: 'retry', text: '重试', primary: true });
      }

      if (error.recovery.hasFallback) {
        actions.push({ type: 'fallback', text: '使用备用方案' });
      }

      if (error.severity.level >= 4) {
        actions.push({ type: 'contact', text: '联系技术支持' });
      }

      actions.push({ type: 'dismiss', text: '知道了' });

      return actions;
    },
  },
};
</script>
```

---

## 十、性能优化架构

### 10.1 加载性能优化

#### 分层加载策略

```javascript
// 分层加载配置
const LoadingStrategy = {
  // L1: 关键内容优先加载
  critical: {
    priority: 1,
    timeout: 2000,
    resources: ['app-shell', 'navigation', 'user-info', 'critical-css'],
  },

  // L2: 重要内容延迟加载
  important: {
    priority: 2,
    timeout: 5000,
    resources: ['patient-list', 'dashboard-cards', 'search-functionality'],
  },

  // L3: 辅助内容按需加载
  optional: {
    priority: 3,
    timeout: 10000,
    resources: ['analytics-charts', 'help-content', 'advanced-features'],
  },
};

// 渐进式加载实现
class ProgressiveLoader {
  constructor(strategy) {
    this.strategy = strategy;
    this.loadedResources = new Set();
    this.loadingPromises = new Map();
  }

  async loadLevel(level) {
    const config = this.strategy[level];
    const promises = [];

    for (const resource of config.resources) {
      if (!this.loadedResources.has(resource)) {
        const promise = this.loadResource(resource, config.timeout);
        promises.push(promise);
        this.loadingPromises.set(resource, promise);
      }
    }

    try {
      await Promise.allSettled(promises);
    } catch (error) {
      console.warn(`Failed to load ${level} resources:`, error);
    }
  }

  async loadResource(resource, timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Resource ${resource} loading timeout`));
      }, timeout);

      // 模拟资源加载
      this.fetchResource(resource)
        .then(() => {
          clearTimeout(timer);
          this.loadedResources.add(resource);
          resolve(resource);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
}
```

#### 代码分割策略

```javascript
// 路由级代码分割
const routes = [
  {
    path: '/dashboard',
    component: () => import(/* webpackChunkName: "dashboard" */ '@/pages/Dashboard.vue'),
  },
  {
    path: '/patients',
    component: () => import(/* webpackChunkName: "patients" */ '@/pages/PatientList.vue'),
  },
  {
    path: '/patients/:id',
    component: () => import(/* webpackChunkName: "patient-detail" */ '@/pages/PatientDetail.vue'),
  },
  {
    path: '/admission',
    component: () => import(/* webpackChunkName: "admission" */ '@/pages/Admission.vue'),
  },
  {
    path: '/analytics',
    component: () => import(/* webpackChunkName: "analytics" */ '@/pages/Analytics.vue'),
  },
];

// 组件级代码分割
const AsyncComponents = {
  // 按需加载的重型组件
  DataVisualization: () => import('@/components/DataVisualization.vue'),
  PatientTimeline: () => import('@/components/PatientTimeline.vue'),
  FileUploader: () => import('@/components/FileUploader.vue'),

  // 条件加载的组件
  AdminPanel: () => {
    if (userRole.includes('admin')) {
      return import('@/components/AdminPanel.vue');
    }
    return Promise.resolve(null);
  },
};

// 第三方库按需加载
const LazyLibraries = {
  chartjs: () => import('chart.js'),
  excel: () => import('xlsx'),
  pdf: () => import('jspdf'),

  loadChart: async () => {
    if (!window.Chart) {
      const { Chart } = await LazyLibraries.chartjs();
      window.Chart = Chart;
    }
    return window.Chart;
  },
};
```

### 10.2 运行时性能优化

#### 虚拟滚动实现

```vue
<!-- 虚拟滚动列表组件 -->
<template>
  <view class="virtual-list" @scroll="handleScroll">
    <view class="virtual-list-phantom" :style="{ height: phantomHeight + 'px' }"></view>
    <view class="virtual-list-content" :style="{ transform: `translateY(${offsetY}px)` }">
      <view
        v-for="item in visibleItems"
        :key="item.id"
        class="virtual-list-item"
        :style="{ height: itemHeight + 'px' }"
      >
        <PatientCard :patient="item" />
      </view>
    </view>
  </view>
</template>

<script>
export default {
  props: {
    items: Array,
    itemHeight: {
      type: Number,
      default: 120,
    },
    containerHeight: {
      type: Number,
      default: 600,
    },
  },

  data() {
    return {
      scrollTop: 0,
      visibleItemCount: Math.ceil(this.containerHeight / this.itemHeight) + 2,
    };
  },

  computed: {
    phantomHeight() {
      return this.items.length * this.itemHeight;
    },

    startIndex() {
      return Math.floor(this.scrollTop / this.itemHeight);
    },

    endIndex() {
      return Math.min(this.startIndex + this.visibleItemCount, this.items.length);
    },

    visibleItems() {
      return this.items.slice(this.startIndex, this.endIndex).map((item, index) => ({
        ...item,
        _index: this.startIndex + index,
      }));
    },

    offsetY() {
      return this.startIndex * this.itemHeight;
    },
  },

  methods: {
    handleScroll(e) {
      this.scrollTop = e.detail.scrollTop;
    },
  },
};
</script>
```

#### 数据缓存策略

```javascript
// 多级缓存系统
class CacheManager {
  constructor() {
    this.memoryCache = new Map(); // L1: 内存缓存
    this.localCache = new LocalStorageCache(); // L2: 本地存储缓存
    this.networkCache = new NetworkCache(); // L3: 网络缓存
  }

  async get(key, options = {}) {
    // L1: 检查内存缓存
    if (this.memoryCache.has(key)) {
      const cached = this.memoryCache.get(key);
      if (!this.isExpired(cached, options.ttl)) {
        return cached.data;
      }
    }

    // L2: 检查本地存储缓存
    const localData = await this.localCache.get(key);
    if (localData && !this.isExpired(localData, options.ttl)) {
      // 回填内存缓存
      this.memoryCache.set(key, localData);
      return localData.data;
    }

    // L3: 检查网络缓存
    const networkData = await this.networkCache.get(key);
    if (networkData && !this.isExpired(networkData, options.ttl)) {
      // 回填上级缓存
      this.memoryCache.set(key, networkData);
      await this.localCache.set(key, networkData);
      return networkData.data;
    }

    return null;
  }

  async set(key, data, options = {}) {
    const cacheItem = {
      data,
      timestamp: Date.now(),
      ttl: options.ttl || 300000, // 默认5分钟
      tags: options.tags || [],
    };

    // 写入所有缓存层级
    this.memoryCache.set(key, cacheItem);
    await this.localCache.set(key, cacheItem);

    if (options.persistent) {
      await this.networkCache.set(key, cacheItem);
    }
  }

  isExpired(cacheItem, ttl) {
    if (!ttl) ttl = cacheItem.ttl;
    return Date.now() - cacheItem.timestamp > ttl;
  }

  // 标签化缓存失效
  invalidateByTag(tag) {
    for (const [key, item] of this.memoryCache.entries()) {
      if (item.tags && item.tags.includes(tag)) {
        this.memoryCache.delete(key);
        this.localCache.delete(key);
      }
    }
  }
}

// 缓存使用示例
const cacheManager = new CacheManager();

// 患者数据缓存
async function getPatientData(patientId) {
  const cacheKey = `patient:${patientId}`;

  // 尝试从缓存获取
  let patientData = await cacheManager.get(cacheKey, { ttl: 300000 }); // 5分钟TTL

  if (!patientData) {
    // 缓存未命中，从API获取
    patientData = await api.getPatient(patientId);

    // 写入缓存
    await cacheManager.set(cacheKey, patientData, {
      ttl: 300000,
      tags: ['patient', `patient:${patientId}`],
      persistent: true,
    });
  }

  return patientData;
}

// 缓存失效策略
function invalidatePatientCache(patientId) {
  cacheManager.invalidateByTag(`patient:${patientId}`);
}
```

### 10.3 资源优化策略

#### 图片优化方案

```javascript
// 图片优化配置
const ImageOptimization = {
  // 自适应图片格式
  formats: {
    webp: {
      quality: 80,
      support: () => supportsWebP(),
    },
    jpeg: {
      quality: 85,
      fallback: true,
    },
    png: {
      compression: 6,
      useFor: ['icons', 'transparent'],
    },
  },

  // 响应式图片尺寸
  sizes: {
    thumbnail: { width: 120, height: 120 },
    small: { width: 300, height: 200 },
    medium: { width: 600, height: 400 },
    large: { width: 1200, height: 800 },
  },

  // 懒加载配置
  lazyLoading: {
    threshold: 100, // 提前100px开始加载
    placeholder: 'data:image/svg+xml;base64,...', // base64占位图
    errorFallback: '/images/error-placeholder.png',
  },
};

// 图片组件实现
const OptimizedImage = {
  props: {
    src: String,
    alt: String,
    size: {
      type: String,
      default: 'medium',
    },
    lazy: {
      type: Boolean,
      default: true,
    },
  },

  data() {
    return {
      loaded: false,
      error: false,
      inView: false,
    };
  },

  computed: {
    optimizedSrc() {
      if (!this.src) return ImageOptimization.lazyLoading.placeholder;

      const sizeConfig = ImageOptimization.sizes[this.size];
      const format = this.getBestFormat();

      return this.buildImageUrl(this.src, sizeConfig, format);
    },
  },

  methods: {
    getBestFormat() {
      for (const [format, config] of Object.entries(ImageOptimization.formats)) {
        if (config.support && config.support()) {
          return format;
        }
      }
      return 'jpeg'; // 默认格式
    },

    buildImageUrl(src, size, format) {
      // 构建优化后的图片URL
      return `${src}?w=${size.width}&h=${size.height}&f=${format}&q=80`;
    },
  },
};
```

#### 网络请求优化

```javascript
// 请求优化管理器
class RequestOptimizer {
  constructor() {
    this.requestQueue = new Map();
    this.retryConfig = {
      maxRetries: 3,
      backoffFactor: 2,
      initialDelay: 1000,
    };
  }

  // 请求去重
  async deduplicate(url, options = {}) {
    const key = this.generateRequestKey(url, options);

    if (this.requestQueue.has(key)) {
      // 返回正在进行的请求
      return this.requestQueue.get(key);
    }

    const promise = this.makeRequest(url, options);
    this.requestQueue.set(key, promise);

    // 请求完成后清理
    promise.finally(() => {
      this.requestQueue.delete(key);
    });

    return promise;
  }

  // 批量请求合并
  async batchRequest(requests) {
    const batchSize = 5;
    const results = [];

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchPromises = batch.map(req => this.deduplicate(req.url, req.options));

      try {
        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        console.error('Batch request failed:', error);
      }
    }

    return results;
  }

  // 智能重试
  async retryWithBackoff(fn, retryCount = 0) {
    try {
      return await fn();
    } catch (error) {
      if (retryCount >= this.retryConfig.maxRetries) {
        throw error;
      }

      if (this.shouldRetry(error)) {
        const delay =
          this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffFactor, retryCount);

        await this.sleep(delay);
        return this.retryWithBackoff(fn, retryCount + 1);
      }

      throw error;
    }
  }

  shouldRetry(error) {
    // 重试条件判断
    const retryableErrors = [500, 502, 503, 504];
    return retryableErrors.includes(error.status) || error.code === 'NETWORK_ERROR';
  }

  generateRequestKey(url, options) {
    return `${options.method || 'GET'}:${url}:${JSON.stringify(options.data || {})}`;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## 十一、无障碍设计架构

### 11.1 无障碍设计原则

#### WCAG 2.1 合规性

```javascript
// 无障碍设计检查清单
const AccessibilityChecklist = {
  // 感知性 (Perceivable)
  perceivable: {
    textAlternatives: {
      // 为所有非文本内容提供替代文本
      rules: [
        'All images must have alt text',
        'Decorative images should have empty alt=""',
        'Complex images need detailed descriptions',
      ],
      implementation: {
        images: 'Use semantic alt attributes',
        icons: 'Use aria-label for icon buttons',
        charts: 'Provide data tables as alternatives',
      },
    },

    colorContrast: {
      // 确保足够的颜色对比度
      minimumRatio: {
        normalText: 4.5, // AA级标准
        largeText: 3.0, // 18pt或14pt粗体
        enhanced: 7.0, // AAA级标准
      },
      tools: [
        'Use contrast checking tools',
        'Test with different lighting conditions',
        'Consider color blindness',
      ],
    },

    resizeText: {
      // 文本可缩放至200%而不影响功能
      requirements: [
        'Text scales up to 200% without horizontal scrolling',
        'UI components remain functional when scaled',
        'No content is cut off or overlapped',
      ],
    },
  },

  // 可操作性 (Operable)
  operable: {
    keyboardAccessible: {
      // 所有功能可通过键盘访问
      requirements: [
        'All interactive elements are keyboard accessible',
        'Tab order is logical and predictable',
        'Focus indicators are clearly visible',
        'No keyboard traps exist',
      ],
      keyBindings: {
        navigation: {
          Tab: 'Move to next focusable element',
          'Shift+Tab': 'Move to previous focusable element',
          'Enter/Space': 'Activate button or link',
          Escape: 'Close modal or cancel action',
        },
        lists: {
          'Arrow Keys': 'Navigate through list items',
          'Home/End': 'Jump to first/last item',
          'Page Up/Down': 'Navigate by page',
        },
      },
    },

    seizuresPrevention: {
      // 避免引起癫痫发作的内容
      guidelines: [
        'No more than 3 flashes per second',
        'Avoid large flashing areas',
        'Provide option to disable animations',
      ],
    },

    navigable: {
      // 帮助用户导航和查找内容
      requirements: [
        'Skip links for main content',
        'Descriptive page titles',
        'Clear heading structure',
        'Breadcrumb navigation',
      ],
    },
  },

  // 可理解性 (Understandable)
  understandable: {
    readable: {
      // 文本内容可读且可理解
      guidelines: [
        'Use clear and simple language',
        'Define unusual words and jargon',
        'Use consistent terminology',
        'Provide language attributes',
      ],
    },

    predictable: {
      // 界面功能以可预测的方式运行
      requirements: [
        'Consistent navigation across pages',
        'Consistent component behavior',
        'Context changes are user-initiated',
        'Clear error messages and help text',
      ],
    },
  },

  // 健壮性 (Robust)
  robust: {
    compatible: {
      // 与辅助技术兼容
      requirements: [
        'Valid HTML markup',
        'Proper ARIA attributes',
        'Compatible with screen readers',
        'Works across different browsers',
      ],
    },
  },
};
```

#### ARIA 属性使用规范

```vue
<!-- 语义化HTML和ARIA示例 -->
<template>
  <!-- 页面主要结构 -->
  <view role="main" aria-labelledby="page-title">
    <text id="page-title" class="sr-only">患者档案管理</text>

    <!-- 导航区域 -->
    <nav role="navigation" aria-label="主导航">
      <view class="tab-bar" role="tablist">
        <button
          v-for="tab in tabs"
          :key="tab.name"
          role="tab"
          :aria-selected="currentTab === tab.name"
          :aria-controls="`panel-${tab.name}`"
          :id="`tab-${tab.name}`"
          @click="switchTab(tab.name)"
        >
          {{ tab.title }}
        </button>
      </view>
    </nav>

    <!-- 搜索区域 -->
    <view role="search" aria-label="患者搜索">
      <label for="patient-search" class="sr-only">搜索患者</label>
      <input
        id="patient-search"
        type="search"
        v-model="searchQuery"
        placeholder="输入患者姓名或电话"
        :aria-describedby="searchQuery ? 'search-results-count' : 'search-help'"
        @input="onSearchInput"
      />
      <text id="search-help" class="sr-only"> 可以通过姓名、电话号码或诊断信息搜索患者 </text>
      <text id="search-results-count" v-if="searchResults.length" class="sr-only">
        找到 {{ searchResults.length }} 条结果
      </text>
    </view>

    <!-- 患者列表 -->
    <view role="region" aria-label="患者列表" :aria-describedby="listDescription">
      <text id="list-description" class="sr-only">
        当前显示 {{ patients.length }} 名患者，按入住时间排序
      </text>

      <view role="list" class="patient-list">
        <PatientCard
          v-for="patient in patients"
          :key="patient.id"
          :patient="patient"
          role="listitem"
          :aria-label="`患者: ${patient.name}, ${patient.age}岁, ${patient.diagnosis}`"
          @click="viewPatient(patient.id)"
        />
      </view>
    </view>

    <!-- 模态框 -->
    <Modal
      v-if="showModal"
      role="dialog"
      :aria-labelledby="modalTitleId"
      :aria-describedby="modalDescId"
      aria-modal="true"
      @close="closeModal"
    >
      <template #title>
        <text :id="modalTitleId">{{ modalTitle }}</text>
      </template>
      <template #content>
        <text :id="modalDescId">{{ modalDescription }}</text>
      </template>
    </Modal>
  </view>
</template>

<script>
export default {
  data() {
    return {
      currentTab: 'dashboard',
      searchQuery: '',
      modalTitleId: 'modal-title-' + Date.now(),
      modalDescId: 'modal-desc-' + Date.now(),
    };
  },

  methods: {
    // 键盘导航支持
    onKeyDown(event) {
      switch (event.key) {
        case 'Escape':
          if (this.showModal) {
            this.closeModal();
          }
          break;
        case 'Tab':
          this.manageFocusOrder(event);
          break;
      }
    },

    // 焦点管理
    manageFocusOrder(event) {
      const focusableElements = this.getFocusableElements();
      const currentIndex = focusableElements.indexOf(document.activeElement);

      if (event.shiftKey) {
        // Shift+Tab - 向前导航
        const nextIndex = currentIndex > 0 ? currentIndex - 1 : focusableElements.length - 1;
        focusableElements[nextIndex].focus();
      } else {
        // Tab - 向后导航
        const nextIndex = currentIndex < focusableElements.length - 1 ? currentIndex + 1 : 0;
        focusableElements[nextIndex].focus();
      }

      event.preventDefault();
    },

    getFocusableElements() {
      return Array.from(
        this.$el.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => !el.disabled && this.isVisible(el));
    },
  },
};
</script>

<style>
/* 屏幕阅读器专用文本 */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* 焦点指示器 */
button:focus,
input:focus,
select:focus,
textarea:focus,
[tabindex]:focus {
  outline: 2px solid #007aff;
  outline-offset: 2px;
}

/* 高对比度模式支持 */
@media (prefers-contrast: high) {
  .patient-card {
    border: 2px solid;
  }

  .button-primary {
    background: ButtonFace;
    color: ButtonText;
    border: 2px solid ButtonText;
  }
}

/* 动画禁用支持 */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
```

### 11.2 辅助技术支持

#### 屏幕阅读器优化

```javascript
// 屏幕阅读器公告管理
class ScreenReaderAnnouncer {
  constructor() {
    this.announceEl = this.createAnnounceElement();
    this.queue = [];
    this.isAnnouncing = false;
  }

  createAnnounceElement() {
    const el = document.createElement('div');
```
