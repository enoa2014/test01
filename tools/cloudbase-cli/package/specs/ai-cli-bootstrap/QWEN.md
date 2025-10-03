# Qwen Code 使用指南

## 简介

Qwen Code 是一个基于 Qwen3-Coder 模型的命令行 AI 工作流工具，专门为代码理解和编辑优化。

## 安装

```bash
npm install -g @qwen-code/qwen-code
```

## 配置

### 环境变量

在 `.env` 文件中配置以下环境变量：

```bash
# Qwen API 配置
OPENAI_API_KEY=your_qwen_api_key_here
OPENAI_BASE_URL=https://dashscope.aliyuncs.com
OPENAI_MODEL=qwen-turbo
```

### 获取 API Key

1. 访问 [阿里云 DashScope](https://dashscope.aliyun.com/)
2. 注册并登录账户
3. 创建 API Key
4. 将 API Key 配置到环境变量中

## 使用方法

### 基本命令

```bash
# 启动 Qwen Code
qwen

# 指定项目目录
cd your-project/
qwen
```

### 常用任务

#### 代码理解

```
> 描述这个系统的主要架构组件
> 这个模块的数据流是如何工作的？
> 有哪些安全机制？
```

#### 代码重构

```
> 重构这个函数以提高可读性和性能
> 帮助我重构这个类以遵循更好的设计模式
> 添加适当的错误处理和日志记录
```

#### 文档和测试

```
> 为这个函数生成全面的 JSDoc 注释
> 为这个组件编写单元测试
> 创建 API 文档
```

#### 工作流自动化

```
> 分析过去 7 天的 git 提交，按功能和团队成员分组
> 将此目录中的所有图像转换为 PNG 格式
```

## 与 CloudBase 集成

### 云开发项目

Qwen Code 可以与 CloudBase 项目完美集成：

```bash
# 在 CloudBase 项目中使用
cd my-cloudbase-project/
qwen

# 询问云开发相关问题
> 如何优化这个云函数的性能？
> 这个数据库集合的权限配置是否正确？
> 如何添加新的云函数触发器？
```

### 最佳实践

1. **项目结构分析**：让 Qwen Code 理解你的 CloudBase 项目结构
2. **代码审查**：使用 AI 进行代码质量检查
3. **文档生成**：自动生成 API 文档和部署说明
4. **问题诊断**：快速定位和解决代码问题

## 高级功能

### 代码编辑

Qwen Code 支持直接编辑代码文件：

```
> 优化这个云函数的错误处理
> 添加 TypeScript 类型定义
> 重构数据库查询以提高性能
```

### 工作流自动化

```
> 创建部署脚本
> 生成测试用例
> 设置 CI/CD 配置
```

## 故障排除

### 常见问题

1. **API Key 错误**
    - 检查 API Key 是否正确
    - 确认账户余额充足

2. **模型不可用**
    - 确认模型名称正确
    - 检查 API 端点配置

3. **权限问题**
    - 确认 API Key 有足够权限
    - 检查网络连接

### 调试模式

```bash
# 启用详细日志
DEBUG=* qwen
```

## 性能优化

### 上下文管理

- 使用 `.qwenignore` 文件排除不必要的文件
- 合理设置上下文窗口大小
- 定期清理缓存

### 模型选择

- `qwen-turbo`: 快速响应，适合简单任务
- `qwen-plus`: 平衡性能和准确性
- `qwen-max`: 最高准确性，适合复杂任务

## 示例项目

### 云函数优化

```bash
cd cloudfunctions/
qwen

> 分析这个云函数的性能瓶颈
> 添加适当的日志记录
> 优化数据库查询
```

### 前端应用

```bash
cd miniprogram/
qwen

> 检查小程序代码规范
> 优化页面加载性能
> 添加错误处理
```

## 相关资源

- [Qwen Code GitHub](https://github.com/QwenLM/qwen-code)
- [阿里云 DashScope](https://dashscope.aliyun.com/)
- [CloudBase 文档](https://cloud.tencent.com/document/product/876)
- [Qwen 模型介绍](https://qwen.readthedocs.io/)

## 更新日志

### v1.0.0

- 初始版本发布
- 支持基本的代码理解和编辑功能
- 集成 CloudBase 项目支持
