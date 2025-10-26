# Source Tree Baseline

以下目录概览与说明反映当前仓库主要结构，帮助团队快速定位代码、文档与脚本。在整合或新增模块时请同步更新本文件。

```
root
├── docs/                        # 项目文档与规范
│   ├── architecture/            # 架构基线（本目录）
│   ├── business-components/     # Story 001.4 业务组件规范
│   ├── design-system/           # Story 001.1 设计系统文档
│   ├── dev-environment/         # 开发环境、CI、测试指南
│   ├── page-designs/            # 核心页面重构方案
│   └── ux-research/             # 用户研究与旅程分析
├── wx-project/                  # 微信小程序主工程
│   ├── app.js / app.json        # 小程序入口配置
│   ├── components/              # 基础 & 业务组件（pm-button、pm-card、pm-input 等）
│   ├── pages/                   # 页面模块（dashboard、patient-detail、component-lab 等）
│   ├── styles/                  # 全局样式、设计令牌、响应式辅助
│   ├── config/                  # 常量/环境配置（预留）
│   └── utils/                   # 工具函数
├── cloudfunctions/              # 腾讯云函数代码
│   ├── patientProfile/         # 患者档案业务查询（新增，2025-09-25）
│   ├── readExcel/              # Excel数据初始化（重构，专注数据处理）
│   ├── patientIntake/          # 患者入住管理
│   ├── patientMedia/           # 患者媒体文件管理
│   ├── patientService/         # 聚合/代理服务（委派到 patientProfile）
│   └── helloWorld/             # 测试云函数
├── scripts/                     # 工程脚本（创建组件、同步配置、构建等）
├── tests/                       # 测试目录
│   ├── unit/                    # Jest 单元测试及配置
│   ├── service/                 # 服务层测试（示例）
│   └── e2e/                     # Mpflow 端到端测试入口
├── styles/                      # 旧版样式资源（保留兼容/迁移）
├── pages/                       # 兼容旧 H5/静态页面（迁移阶段）
├── .husky/                      # Git hooks（pre-commit、commit-msg）
├── .bmad-core/                  # BMAD 工作流配置
├── package.json                 # 项目依赖与脚本
├── mpflow.config.js             # 小程序工程构建配置
├── jest.e2e.config.js           # E2E 测试配置
├── README.md                    # 项目概览
└── ...                          # 其他根级配置文件（.eslintrc.js、.prettierrc 等）
```

## 结构说明

- **docs/**：所有规范、设计与研究资料集中于此，按照主题分目录，便于跨团队协作。
- **wx-project/**：核心产品代码，遵循微信小程序文件组织；`component-lab` 页面仅在开发态启用。
- **cloudfunctions/**：与小程序共享数据的后端逻辑，职责分离架构：
  - `patientProfile`: 专门处理前端业务查询（患者列表、详情）
  - `readExcel`: 专注Excel数据初始化和同步
  - 其他云函数各司其职，遵循统一返回结构与日志规范。
- **tests/**：单元、服务、端到端测试集中于此，`jest.config` 在 `tests/unit/` 下维护。
- **scripts/**：封装常用命令行工具，例如创建组件、运行 mpflow 构建、同步配置。
- **根配置文件**：包括 ESLint/Prettier/Commitlint、babel、mpflow 等，用于统一工程流程。

## 维护建议

1. 新增模块或页面时，先在本文件中登记目录与职责，再在 README/相关文档中链接说明。
2. 对旧目录（如 `pages/`、`styles/` 兼容层）逐步迁移后清理，以保持结构清晰。
3. 持续与设计/后端对齐，确保 `docs/` 与 `wx-project/` 内的目录保持一致命名（如 pm-\* 组件）。
4. 在发布前检查 `wx-project/app.json`，移除仅限开发的页面（如 `component-lab`）。

如目录结构发生重大变化，请及时更新本基线以避免信息滞后。
