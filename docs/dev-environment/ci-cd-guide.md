# CI / CD 流水线指南

## 目标
- 在每次提交和合并前执行自动化校验，保障质量。
- 提供可复用的 GitHub Actions 工作流示例，并预留扩展空间。
- 定义代码评审、发布与回滚流程。

## 流水线阶段
| 阶段 | 触发 | 目的 |
|------|------|------|
| Lint & Test | PR、push main/develop | 代码风格、单元测试、覆盖率 |
| Build | 合并至 main / release | 确保小程序可编译，通过微信 CLI |
| Preview | 手动触发 | 构建预览包供产品/测试体验 |
| Release | 打 Tag / 发布分支 | 上传体验版 or 正式版 |

## GitHub Actions 示例
```yaml
name: ci

on:
  pull_request:
    branches: [develop, main]
  push:
    branches: [develop, main]

jobs:
  lint-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test:coverage
      - uses: codecov/codecov-action@v4
        if: always()
        with:
          token: ${{ secrets.CODECOV_TOKEN }}

  build:
    needs: lint-test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm run build:miniprogram   # 自定义脚本，调用微信 CLI
      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: miniprogram-preview
          path: dist/
```

### 微信 CLI 构建脚本
1. 安装微信 CLI：`npm install -g @wechat-miniprogram/cli`。
2. 在 `scripts/build-miniprogram.js` 中调用：
   ```js
   const { execSync } = require('child_process');
   execSync('miniprogram-cli build --project ./miniprogram --output ./dist', { stdio: 'inherit' });
   ```
3. 在 CI 中调用 `node scripts/build-miniprogram.js`。

## 代码评审流程
1. 提交 PR → 自检（lint/test） → 标注关联故事。
2. 指定至少 1 名前端与 1 名 QA/设计 Reviewer。
3. Reviewer 检查：
   - 组件是否复用设计系统令牌。
   - 是否补充/更新测试、文档。
   - 性能与可访问性风险。
4. 所有 Review 通过后合并，留下简洁的合并说明。

## 发布策略
- 分支策略：
  - `main`：可随时部署，保持稳定。
  - `develop`：集成环境。
  - `feature/*`：单一需求或修复。
  - `release/*`：针对发布准备。
- Tag 命名：`v<major>.<minor>.<patch>`。
- 体验版发布：通过微信 CLI 执行 `upload --version <tag>`，并在企业微信或飞书同步二维码。

## 回滚方案
1. 遇到重大问题时，直接回滚至上一个稳定 Tag `git revert <commit>` 或 `git checkout <tag>`。
2. 重新触发 CI，确认构建通过。
3. 通知相关团队并记录 Postmortem。

## 安全与权限
- 机密信息通过 GitHub Secrets 管理（微信 AppID、密钥等）。
- 对构建产物上传权限进行最小化控制。
- 定期轮换 CI Token，记录使用情况。

## 指标追踪
- 构建成功率。
- 平均合并时长（PR 打开到合并）。
- 回滚次数。
- Codecov 覆盖率是否满足门槛。

## 模板与清单
- PR 模板：
  - 变更摘要、关联任务、截图/GIF、测试清单、风险评估。
- 发布清单：
  - 版本号、主要功能、影响范围、回滚计划、验证负责人。
- 值班表：
  - 明确发布窗口与紧急联系人。

## 未来拓展
- 引入微信云构建以加速体验版上传。
- 接入 SonarQube 或 DeepScan 进行静态分析。
- 使用 Lighthouse CI 对 H5 扩展端进行性能监测。
