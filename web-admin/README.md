# 慈善小家 Web 管理端

本目录提供一个基于 Vite + React 的桌面/浏览器管理后台，可与现有微信小程序共用同一套云数据库与云函数。主要功能：

- 管理员账号口令登录（复用 `cloudfunctions/auth` 自定义登录云函数）
- 患者列表、详情、删除、导出
- Excel 数据导入（调用 `readExcel` 云函数）
- 附件图库与文档管理（调用 `patientMedia` 云函数，支持上传/预览/下载/删除）

## 环境要求

- Node.js 18+
- 已在云开发控制台配置：
  - 自定义登录（上传私钥，配置 `TCB_CUSTOM_LOGIN_PRIVATE_KEY_ID`、`TCB_CUSTOM_LOGIN_PRIVATE_KEY`）
  - `cloudfunctions/auth` 完成部署并初始化管理员
- Web 端需具备访问 WX 云资源的域名（CloudBase Hosting 或自有域名）

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

## 功能说明

- **登录**：前端先执行匿名登录，再调用 `auth` 云函数校验账号口令并获取 ticket，最终通过 `signInWithTicket` 建立管理员会话。
- **患者列表/详情**：`patientProfile` 云函数分别提供 `list`、`detail`、`delete`、`export` 动作。
- **Excel 导入**：先把文件上传到云存储，再调用 `readExcel` 的 `import` 动作完成解析与同步。
- **媒资管理**：调用 `patientMedia` 的 `prepareUpload`、`completeUpload`、`list`、`delete`、`download`、`preview` 动作，沿用函数内配额限制与重复校验。

## 安全提示

- 生产环境请在 `patientMedia` 云函数配置 `PATIENT_MEDIA_ALLOW_DEV_BYPASS=false`，确保所有调用都带上自定义登录后的 `sessionToken`。
- 建议在浏览器端启用 HTTPS，并在 Hosting 中设置允许访问的域名白名单。
- 管理员口令建议定期更换，并配合审计功能记录操作日志。

