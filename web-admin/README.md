# 慈善小家 Web 管理端

本目录提供一个基于 **Vite + React + TypeScript** 的现代化 Web 管理后台，与微信小程序共用同一套云数据库与云函数。采用共享领域库架构，实现了与小程序功能对齐的完整管理界面。

## 核心特性

### 用户认证
- 管理员账号口令登录（复用 `cloudfunctions/auth` 自定义登录云函数）
- 安全的会话管理和权限控制

### 患者管理
- **智能列表**：
  - 统计卡片（全部/在住/待入住/已退住）
  - 实时搜索建议（300ms 防抖）
  - 高级筛选（状态/风险/医院/诊断/性别/民族/籍贯/年龄段/医生/日期范围）
  - 筛选逻辑切换（AND/OR）
  - 本地缓存策略（5分钟 TTL）
  - 批量操作（删除/导出）
- **详情页面**：
  - 状态徽章可视化
  - 衍生标签展示
  - 分组信息展示（基础/家庭/经济/入住记录）
  - 完整的入住记录详情
- **表单录入**：
  - 完整的患者资料表单
  - 实时校验（身份证/手机号/日期）
  - 创建/编辑模式
- **Excel 导入**：
  - 批量导入患者数据
  - 文件类型验证
  - 导入进度提示

### 媒资管理
- Tab 切换界面（图片/文档）
- 批量上传（最多5个文件）
- 文件类型图标
- TXT 文件内联预览
- 配额管理（20个文件/30MB）
- 图片预览、文档下载、删除功能

## 技术栈

- **前端框架**：React 18 + TypeScript
- **构建工具**：Vite 5
- **路由**：React Router 6
- **云服务**：Tencent CloudBase (TCB)
- **状态管理**：React Hooks
- **类型系统**：完整的 TypeScript 类型定义

## 项目结构

```
web-admin/
├── src/
│   ├── api/              # API 调用层
│   │   ├── patient.ts    # 患者相关 API
│   │   ├── media.ts      # 媒资管理 API
│   │   └── excel.ts      # Excel 导入 API
│   ├── components/       # 通用组件
│   │   ├── AdvancedFilterPanel.tsx  # 高级筛选面板
│   │   └── MediaManager.tsx         # 媒资管理组件
│   ├── hooks/            # 自定义 Hooks
│   │   └── useCloudbase.tsx  # CloudBase 连接管理
│   ├── pages/            # 页面组件
│   │   ├── LoginPage.tsx           # 登录页
│   │   ├── PatientListPage.tsx     # 患者列表（主页）
│   │   ├── PatientDetailPage.tsx   # 患者详情
│   │   ├── PatientFormPage.tsx     # 患者表单
│   │   └── ...
│   ├── shared/           # 共享领域库（与小程序对齐）
│   │   ├── types.ts      # TypeScript 类型定义
│   │   ├── filters.ts    # 高级筛选逻辑
│   │   ├── date.ts       # 日期工具函数
│   │   └── validators.ts # 校验工具函数
│   ├── App.tsx           # 应用主组件
│   └── main.tsx          # 应用入口
├── .env.example          # 环境变量示例
└── README.md             # 本文档
```

## 环境要求

- **Node.js** 18+
- **云开发控制台配置**：
  - 自定义登录（上传私钥，配置 `TCB_CUSTOM_LOGIN_PRIVATE_KEY_ID`、`TCB_CUSTOM_LOGIN_PRIVATE_KEY`）
  - `cloudfunctions/auth` 完成部署并初始化管理员
- **Web 端域名**：CloudBase Hosting 或自有域名，用于访问云资源

## 快速开始

1. 复制示例环境变量：

   ```bash
   cp .env.example .env.local
   ```

2. 在 `.env.local` 中填写：

   ```bash
   VITE_TCB_ENV_ID=cloud1-xxxx
   VITE_AUTH_FUNCTION_NAME=auth
   ```

3. 安装依赖并启动开发服务：

   ```bash
   npm install
   npm run dev
   ```

4. 浏览器访问 `http://localhost:5173`，使用管理员账号口令登录。

## 部署到 CloudBase Hosting

1. 构建产物：

   ```bash
   npm run build
   ```

2. 将 `dist/` 上传至 CloudBase Hosting（或自建静态服务器）。

3. 确保 Hosting 环境变量与本地一致，尤其是 `VITE_TCB_ENV_ID`。

## 核心功能详解

### 登录认证流程
1. 前端执行匿名登录
2. 调用 `auth` 云函数校验账号口令
3. 获取 ticket 并通过 `signInWithTicket` 建立管理员会话
4. 会话信息存储在 CloudBase Context 中

### 患者管理功能

#### 列表页面 (`PatientListPage`)
- **统计仪表板**：实时显示患者状态分布，支持点击快速筛选
- **智能搜索**：
  - 支持姓名、证件号、电话、医院、诊断多字段搜索
  - 300ms 防抖优化，最多显示 8 条建议
  - 点击建议自动填充搜索框
- **高级筛选**：
  - 10+ 维度筛选条件
  - 实时预览筛选结果数量
  - AND/OR 逻辑模式切换
  - 筛选条件摘要显示
- **本地缓存**：列表数据缓存 5 分钟，减少 API 调用
- **批量操作**：支持批量删除和导出选中患者

#### 详情页面 (`PatientDetailPage`)
- **患者信息**：姓名旁显示状态徽章（在住/待入住/已离开/随访）
- **衍生标签**：展示患者的标签和徽章（支持多种类型）
- **分组展示**：
  - 基础信息（姓名/性别/出生日期/身份证号/籍贯/民族）
  - 家庭信息（家庭地址/父亲/母亲/监护人联系方式）
  - 经济情况（家庭经济情况）
- **入住记录**：
  - 卡片式布局展示所有入住记录
  - 包含入住/离开时间、医院、诊断、医生、住院时长
  - 展示症状、治疗过程、随访计划等详细信息

#### 表单录入 (`PatientFormPage`)
- **基础信息录入**：姓名、性别、出生日期、证件信息、联系方式
- **家庭信息录入**：地址、家庭成员联系方式
- **实时校验**：
  - 身份证号格式验证
  - 手机号格式验证
  - 出生日期合法性检查
- **创建/编辑模式**：自动识别新建或编辑操作

#### Excel 批量导入
1. 点击"导入Excel"按钮选择文件
2. 文件类型验证（仅接受 .xls/.xlsx）
3. 上传到云存储
4. 调用 `readExcel` 云函数解析数据
5. 自动同步到数据库
6. 显示导入结果并刷新列表

### 媒资管理功能 (`MediaManager`)

#### 图片管理
- 支持 JPG/PNG/WebP 格式
- 批量上传最多 5 张
- 缩略图展示
- 点击预览原图
- 下载和删除操作

#### 文档管理
- 支持 TXT/PDF/Word/Excel 格式
- 批量上传最多 5 个
- 文件类型图标识别
- TXT 文件内联预览（弹窗显示）
- PDF/Word/Excel 新窗口预览
- 下载和删除操作

#### 配额管理
- 最多 20 个文件
- 总容量限制 30MB
- 实时显示剩余配额
- 配额不足时禁用上传

### 云函数调用说明

- **patientProfile**：患者档案查询
  - `action: 'list'` - 获取患者列表
  - `action: 'detail'` - 获取患者详情
  - `action: 'delete'` - 删除患者
  - `action: 'export'` - 导出患者数据

- **patientMedia**：媒资管理
  - `action: 'prepareUpload'` - 准备上传
  - `action: 'completeUpload'` - 完成上传
  - `action: 'list'` - 获取文件列表
  - `action: 'delete'` - 删除文件
  - `action: 'download'` - 生成下载链接
  - `action: 'preview'` - 生成预览链接
  - `action: 'previewTxt'` - 获取 TXT 文件内容

- **readExcel**：Excel 数据导入
  - `action: 'import'` - 导入 Excel 文件

- **auth**：用户认证
  - 管理员账号口令验证

## 开发指南

### 本地开发
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

### 代码规范
- 使用 TypeScript 严格模式
- 遵循 React Hooks 最佳实践
- 组件使用函数式编程风格
- API 调用封装在 `src/api/` 目录
- 共享逻辑放在 `src/shared/` 目录

### 调试技巧
1. **查看网络请求**：使用浏览器开发者工具查看云函数调用
2. **检查本地缓存**：localStorage 中查看 `patient_list_cache_web` 键
3. **CloudBase 日志**：在云开发控制台查看函数调用日志
4. **React DevTools**：安装 React DevTools 浏览器扩展调试组件状态

## 安全注意事项

### 生产环境配置
- **媒资管理**：在 `patientMedia` 云函数设置 `PATIENT_MEDIA_ALLOW_DEV_BYPASS=false`，确保所有调用都需要 `sessionToken`
- **HTTPS**：生产环境必须启用 HTTPS
- **域名白名单**：在 CloudBase Hosting 中配置允许访问的域名
- **CSP 策略**：配置内容安全策略防止 XSS 攻击

### 权限管理
- 管理员口令定期更换
- 启用操作审计日志
- 定期检查云函数访问日志
- 限制管理员数量

### 数据安全
- 患者敏感信息加密存储
- 定期备份数据库
- 导出数据时注意脱敏处理
- 文件上传前进行病毒扫描（建议）

## 常见问题

### Q: 登录后提示"未初始化管理员"？
A: 需要在云函数 `auth` 中初始化至少一个管理员账号。参考项目主 README 的初始化步骤。

### Q: 列表数据不更新？
A: 检查本地缓存是否过期（TTL 5分钟）。可以点击"刷新列表"按钮强制刷新，或清除浏览器 localStorage。

### Q: Excel 导入失败？
A: 确认：
1. 文件格式为 .xls 或 .xlsx
2. `readExcel` 云函数已正确部署
3. Excel 文件格式符合要求（参考模板）
4. 云存储配额充足

### Q: 媒资上传失败？
A: 检查：
1. 文件大小是否超过 10MB
2. 是否超过配额限制（20个文件/30MB）
3. `patientMedia` 云函数是否正确配置
4. 网络连接是否稳定

### Q: 筛选功能不生效？
A: 确认：
1. 已点击"应用筛选"按钮
2. 筛选条件与数据匹配
3. 逻辑模式（AND/OR）是否正确
4. 没有其他筛选条件冲突

## 版本历史

### v2.0 (2025-01)
- ✨ 完整重构，对齐微信小程序功能
- ✨ 新增统计卡片和智能搜索
- ✨ 新增高级筛选系统
- ✨ 新增 Excel 批量导入
- ✨ 增强媒资管理（Tab切换、批量上传、TXT预览）
- ✨ 完善患者详情展示（状态徽章、标签、入住记录）
- 🔧 采用 TypeScript 重构
- 🔧 提取共享领域库
- 🔧 优化本地缓存策略
- 📝 完善文档

### v1.0 (Initial)
- 基础患者管理功能
- 简单的列表和详情展示
- 媒资基础上传下载

## 相关文档

- [项目主 README](../README.md)
- [云函数文档](../cloudfunctions/README.md)
- [小程序文档](../miniprogram/README.md)
- [数据库初始化指南](../docs/database-reinit-guide.md)

## 技术支持

如有问题或建议，请参考项目 Issues 或联系项目维护者。

