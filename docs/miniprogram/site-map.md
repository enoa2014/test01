# 公益小家患者档案管理系统 - 站点地图

状态：本文件为信息架构草案用于导航与规划；当前实际已实现的页面包含：
- `/pages/index`（主页/住户列表）
- `/pages/patient-detail`（患者详情）
- `/pages/patient-intake/*`（创建向导/成功页）
- `/pages/analysis`（分析/演示页面）
其余页面为规划项，后续按迭代补齐。

基于设计文档的信息架构，本文档描述了微信小程序的完整页面结构和导航关系。

## 🏠 应用结构概览

```
公益小家管理系统 (App)
├── 底部导航 (TabBar Navigation)
│   ├── 首页 (Dashboard) 🏠
│   ├── 家庭档案 (Families) 👨‍👩‍👧‍👦
│   ├── 入住管理 (Check-in) 🏨
│   ├── 数据分析 (Analytics) 📊
│   └── 我的 (Profile) 👤
│
├── 通用页面 (Common Pages)
│   ├── 登录页面 (Login) 🔐
│   ├── 注册页面 (Register) ✍️
│   ├── 设置页面 (Settings) ⚙️
│   └── 关于页面 (About) ℹ️
│
└── 功能页面 (Feature Pages)
    ├── 搜索页面 (Search) 🔍
    ├── 通知页面 (Notifications) 🔔
    └── 帮助页面 (Help) ❓
```

## 📱 详细页面结构

### 1. 首页模块 (Dashboard)

**路径**: `/pages/index/index`

```
首页 (Dashboard)
├── 页面组件
│   ├── 欢迎横幅 (Welcome Banner)
│   ├── 快速统计卡片组 (Quick Stats Cards)
│   │   ├── 当前在住人数
│   │   ├── 本月新增入住
│   │   ├── 康复出院人数
│   │   └── 活跃志愿者数量
│   ├── 最近动态列表 (Recent Activities)
│   └── 快捷操作区 (Quick Actions)
│       ├── 新增住户档案
│       ├── 安排入住
│       ├── 查看报告
│       └── 紧急联系
│
└── 导航目标
    ├── → 住户档案列表
    ├── → 入住申请表单
    ├── → 数据分析页面
    └── → 各功能详情页
```

### 2. 住户档案模块 (Residents)

**路径**: `/pages/index/`

```
住户档案 (Residents)
├── 列表主页 (index/index)
│   ├── 智能搜索栏 (SmartSearchBar)
│   ├── 高级筛选面板 (FilterPanel)
│   ├── 状态统计条 (StatusTag Summary)
│   ├── 住户卡片列表 (PatientCard)
│   └── 悬浮操作按钮（新建住户）
│
├── 住户详情页 (patient-detail/detail)
│   ├── 顶部概览卡
│   ├── 基础信息与联系方式
│   ├── 入住与关怀记录时间轴
│   ├── 附件与媒体管理
│   └── 操作日志
│
└── 入住办理向导 (patient-intake/wizard)
    ├── 基础信息录入
    ├── 联系人与情况说明
    ├── 附件上传与核对
    ├── 提交确认
    └── 成功反馈 (patient-intake/success)
```

### 3. 入住管理模块 (Check-in)

**路径**: `/pages/checkin/`

```
入住管理 (Check-in)
├── 主页面 (checkin/index)
│   ├── 状态概览卡片
│   │   ├── 待审核申请
│   │   ├── 当前在住
│   │   ├── 即将离院
│   │   └── 房间使用率
│   ├── 快捷操作
│   └── 最近申请列表
│
├── 申请流程 (checkin/apply)
│   ├── 步骤指示器 (Step Indicator)
│   ├── 第一步：选择家庭 (apply/select-family)
│   ├── 第二步：填写申请信息 (apply/basic-info)
│   ├── 第三步：上传医疗证明 (apply/medical-docs)
│   ├── 第四步：特殊需求说明 (apply/special-needs)
│   └── 第五步：确认提交 (apply/confirm)
│
├── 申请管理 (checkin/applications)
│   ├── 申请列表 (applications/list)
│   ├── 申请详情 (applications/detail)
│   ├── 审核页面 (applications/review)
│   └── 审核历史 (applications/history)
│
├── 在住管理 (checkin/residents)
│   ├── 在住列表 (residents/list)
│   ├── 住户详情 (residents/detail)
│   ├── 房间分配 (residents/room-assignment)
│   └── 日常检查 (residents/daily-check)
│
├── 离院办理 (checkin/checkout)
│   ├── 离院申请 (checkout/apply)
│   ├── 费用结算 (checkout/billing)
│   ├── 满意度调查 (checkout/survey)
│   └── 离院确认 (checkout/confirm)
│
└── 房间管理 (checkin/rooms)
    ├── 房间状态概览 (rooms/overview)
    ├── 房间详情 (rooms/detail)
    ├── 房间分配 (rooms/assignment)
    └── 维护记录 (rooms/maintenance)
```

### 4. 数据分析模块 (Analytics)

**路径**: `/pages/analytics/`

```
数据分析 (Analytics)
├── 主页面 (analytics/index)
│   ├── 数据概览仪表板
│   ├── 关键指标卡片
│   └── 快速报告入口
│
├── 服务统计 (analytics/service-stats)
│   ├── 入住统计图表
│   ├── 服务时长分析
│   ├── 满意度统计
│   └── 志愿者活跃度
│
├── 疾病分析 (analytics/disease-analysis)
│   ├── 疾病类型分布
│   ├── 年龄段分析
│   ├── 治疗周期统计
│   └── 康复率分析
│
├── 地区分析 (analytics/region-analysis)
│   ├── 来源地区分布
│   ├── 地区需求热力图
│   ├── 交通成本分析
│   └── 区域合作状况
│
├── 时间趋势 (analytics/time-trends)
│   ├── 月度趋势分析
│   ├── 季节性规律
│   ├── 年度对比报告
│   └── 预测分析
│
├── 报告中心 (analytics/reports)
│   ├── 报告列表 (reports/list)
│   ├── 报告详情 (reports/detail)
│   ├── 自定义报告 (reports/custom)
│   └── 报告导出 (reports/export)
│
└── 数据导出 (analytics/export)
    ├── 导出配置
    ├── 导出历史
    └── 导出管理
```

### 5. 个人中心模块 (Profile)

**路径**: `/pages/profile/`

```
个人中心 (Profile)
├── 主页面 (profile/index)
│   ├── 用户信息卡片
│   ├── 功能菜单列表
│   └── 系统信息
│
├── 用户信息 (profile/user-info)
│   ├── 个人资料编辑
│   ├── 头像更换
│   └── 密码修改
│
├── 系统设置 (profile/settings)
│   ├── 通知设置
│   ├── 隐私设置
│   ├── 语言设置
│   └── 主题设置
│
├── 权限管理 (profile/permissions)
│   ├── 角色信息
│   ├── 权限列表
│   └── 权限申请
│
├── 操作日志 (profile/logs)
│   ├── 登录记录
│   ├── 操作历史
│   └── 安全日志
│
├── 帮助中心 (profile/help)
│   ├── 使用指南
│   ├── 常见问题
│   ├── 联系支持
│   └── 意见反馈
│
└── 关于系统 (profile/about)
    ├── 版本信息
    ├── 隐私政策
    ├── 使用条款
    └── 开发团队
```

## 🔗 页面间导航关系

### 主要导航流程

```
1. 用户注册/登录流程
登录页 → 首页 → 各功能模块

2. 家庭档案管理流程
首页 → 家庭档案列表 → 详情页 → 编辑页 → 返回列表

3. 入住申请流程
首页/家庭档案 → 入住申请 → 逐步填写 → 提交成功 → 申请管理

4. 数据查看流程
首页统计 → 数据分析 → 具体分析页 → 报告详情 → 导出/分享

5. 用户管理流程
个人中心 → 各设置页面 → 保存返回
```

### 深层链接支持

```
住户档案直接访问：
/pages/patient-detail/detail?key=resident_123&tab=medical

入住申请直接跳转：
/pages/checkin/apply?familyId=123&step=2

数据报告直接分享：
/pages/analytics/reports/detail?reportId=456

搜索结果直接访问：
/pages/index/index?search=李小明
```

## 📋 页面状态管理

### 数据流向

```
全局状态 (Global State)
├── 用户认证信息 (Auth)
├── 用户权限信息 (Permissions)
├── 系统配置信息 (Config)
└── 消息通知状态 (Notifications)

页面级状态 (Page State)
├── 列表页面状态 (List State)
│   ├── 筛选条件
│   ├── 分页信息
│   ├── 排序方式
│   └── 搜索关键词
│
├── 表单页面状态 (Form State)
│   ├── 表单数据
│   ├── 验证状态
│   ├── 提交状态
│   └── 错误信息
│
└── 详情页面状态 (Detail State)
    ├── Tab激活状态
    ├── 编辑模式状态
    ├── 加载状态
    └── 缓存数据
```

### 页面缓存策略

```
热点页面 (Always Cache)
├── 首页统计数据
├── 用户基本信息
└── 系统配置信息

动态页面 (Conditional Cache)
├── 家庭档案列表 (5分钟缓存)
├── 入住状态信息 (1分钟缓存)
└── 通知消息列表 (实时更新)

实时页面 (No Cache)
├── 表单提交页面
├── 支付相关页面
└── 敏感操作页面
```

## 🎯 用户角色访问控制

### 权限级别定义

```
管理员 (Admin) - 完整访问权限
├── ✅ 所有页面和功能
├── ✅ 用户管理功能
├── ✅ 系统设置功能
├── ✅ 数据导出功能
└── ✅ 敏感信息访问

工作人员 (Staff) - 业务操作权限
├── ✅ 家庭档案管理
├── ✅ 入住管理功能
├── ✅ 基础数据分析
├── ❌ 用户管理功能
└── ❌ 系统设置功能

志愿者 (Volunteer) - 基础查看权限
├── ✅ 家庭档案查看
├── ✅ 关怀记录添加
├── ❌ 敏感信息访问
├── ❌ 数据分析功能
└── ❌ 管理功能
```

### 页面访问矩阵

| 页面模块          | 管理员 | 工作人员 | 志愿者 |
| ----------------- | ------ | -------- | ------ |
| 首页统计          | ✅     | ✅       | ✅     |
| 家庭档案列表      | ✅     | ✅       | ✅     |
| 家庭详情-基本信息 | ✅     | ✅       | ✅     |
| 家庭详情-医疗信息 | ✅     | ✅       | ❌     |
| 家庭详情-关怀记录 | ✅     | ✅       | ✅     |
| 家庭档案编辑      | ✅     | ✅       | ❌     |
| 入住管理          | ✅     | ✅       | ❌     |
| 数据分析          | ✅     | ✅       | ❌     |
| 用户管理          | ✅     | ❌       | ❌     |
| 系统设置          | ✅     | ❌       | ❌     |

## 🚀 性能优化策略

### 页面加载优化

```
首屏优化
├── 关键路径优化 (Critical Path)
├── 资源预加载 (Preload)
├── 图片懒加载 (Lazy Loading)
└── 骨架屏显示 (Skeleton)

代码分割
├── 路由级别分割
├── 组件级别分割
├── 功能模块分割
└── 第三方库分割

缓存策略
├── 页面数据缓存
├── 图片资源缓存
├── API响应缓存
└── 静态资源缓存
```

### 用户体验优化

```
交互反馈
├── 加载状态提示
├── 操作成功反馈
├── 错误信息指导
└── 网络状态提示

导航体验
├── 页面转场动画
├── 返回栈管理
├── 深层链接支持
└── 搜索历史记录

离线体验
├── 关键数据离线缓存
├── 离线操作队列
├── 网络恢复同步
└── 离线状态提示
```

## 📊 数据埋点规划

### 用户行为埋点

```
页面访问埋点
├── 页面浏览时长
├── 页面跳转路径
├── 页面退出点
└── 错误页面统计

功能使用埋点
├── 搜索关键词统计
├── 筛选条件使用
├── 功能点击率
└── 表单完成率

性能监控埋点
├── 页面加载时间
├── API响应时间
├── 错误发生率
└── 崩溃统计
```

## 🔧 开发规范

### 文件命名规范

```
页面文件结构
/pages/[module]/[page]/
├── index.wxml (页面结构)
├── index.wxss (页面样式)
├── index.js (页面逻辑)
└── index.json (页面配置)

组件文件结构
/components/[component-name]/
├── index.wxml
├── index.wxss
├── index.js
└── index.json
```

### 路由命名规范

```
模块路由
/pages/[module]/index - 模块首页
/pages/[module]/list - 列表页面
/pages/[module]/detail - 详情页面
/pages/[module]/add - 新增页面
/pages/[module]/edit - 编辑页面

功能路由
/pages/[module]/[feature]/index - 功能首页
/pages/[module]/[feature]/[subpage] - 子页面
```

## 📝 维护说明

### 页面维护清单

```
定期检查项目
├── 页面加载性能
├── 用户访问路径
├── 错误页面统计
├── 用户反馈收集
└── 功能使用率分析

更新维护流程
├── 页面结构变更评估
├── 导航路径影响分析
├── 权限控制更新
├── 缓存策略调整
└── 埋点数据验证
```

---

**文档版本**: v1.0
**创建日期**: 2024年12月
**更新日期**: 2024年12月
**维护人员**: 前端开发团队

**说明**: 本站点地图基于公益小家患者档案管理系统的信息架构设计，涵盖了完整的页面结构、导航关系、权限控制和性能优化策略。开发过程中请严格按照此文档进行页面开发和路由配置。
