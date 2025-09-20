# Excel 上传与展示流程

## 目标

将本地 `prepare/b.xlsx` 上传至微信云开发存储，通过云函数按行读取并在小程序页面展示，同时补充端到端测试覆盖。

## 步骤总览

1. 准备云端文件
2. 编写并部署云函数
3. 更新小程序页面展示
4. 扩展端到端测试
5. 运维与文档记录

---

## 1. 准备云端文件

- 安装必要依赖：
  ```powershell
  npm install --save-dev @cloudbase/cli
  npm install xlsx
  ```
- 登录腾讯云 CLI：
  ```powershell
  tcb login
  ```
- 将 `prepare/b.xlsx` 上传至云存储（示例路径 `data/b.xlsx`）：
  ```powershell
  tcb storage:upload prepare/b.xlsx -r data/b.xlsx --env cloud1-6g2fzr5f7cf51e38
  ```
  也可在微信开发者工具的「云开发 → 存储」界面手动上传。

## 2. 云函数读取逻辑

- 在 `cloudfunctions/readExcel` 目录中创建云函数：
  - `index.js` 使用 `tcb-admin-node` 和 `xlsx` 下载并解析存储中的 `data/b.xlsx`：
    ```javascript
    const cloud = require('wx-server-sdk');
    const XLSX = require('xlsx');

    cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

    exports.main = async () => {
      const filePath = 'data/b.xlsx';
      const { fileContent } = await cloud.downloadFile({ fileID: filePath });
      const workbook = XLSX.read(fileContent, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
      return { rows };
    };
    ```
  - `package.json` 增加依赖：
    ```json
    {
      "dependencies": {
        "wx-server-sdk": "~3",
        "xlsx": "^0.18.5"
      }
    }
    ```
- 在微信开发者工具中部署云函数（选择环境 `cloud1-6g2fzr5f7cf51e38`）。

## 3. 小程序页面展示

- 在目标页面（例如 `pages/index/index`）调用云函数并渲染：
  ```javascript
  Page({
    data: { rows: [], loading: true, error: '' },
    async onLoad() {
      try {
        const res = await wx.cloud.callFunction({ name: 'readExcel' });
        this.setData({ rows: res.result.rows || [], loading: false });
      } catch (err) {
        this.setData({ error: err.errMsg || '读取失败', loading: false });
      }
    }
  });
  ```
- 对应 `index.wxml` 使用 `wx:for` 渲染行：
  ```xml
  <view wx:if="{{loading}}">加载中…</view>
  <view wx:elif="{{error}}">{{error}}</view>
  <view wx:else>
    <view wx:for="{{rows}}" wx:key="index" class="row">
      <text wx:for="{{item}}" wx:key="inner">{{item}}</text>
    </view>
  </view>
  ```

## 4. 端到端测试扩展

- 在 `tests/e2e/specs/home.spec.js` 增加对行数据的断言：
  ```javascript
  const rows = await waitForElement(page, '.row', 20, 500);
  expect(rows).not.toBeNull();
  ```
- 测试执行前确保 `data/b.xlsx` 已上传并最新。
- 运行：
  ```powershell
  set WX_DEVTOOLS_WS=ws://127.0.0.1:9421
  npm run test:e2e
  ```

## 5. 运维与记录

- 建议把上传和部署动作写成脚本（如 `npm run upload-excel`、`npm run deploy:read-excel`）。
- 将本流程添加到团队文档（例如 `docs/e2e-debug-notes.md`），说明：
  - 云存储路径与更新时间；
  - 云函数名称及返回数据格式；
  - 小程序页面位置与展示格式；
  - 端到端测试命令及需注意的环境变量。

---

执行过程中如遇 `wx.cloud.callFunction` 权限问题，确认当前账号对云环境和存储拥有访问权限，并在微信开发者工具中登陆相同微信号。

### 6. 同步至云数据库\n\n- 小程序首页提供“同步到云数据库”按钮，调用 `readExcel` 云函数的 `action=import` 将最新 Excel 数据导入云数据库 `excel_records` 集合。\n- 同步完成后会刷新患者列表；失败时提示错误信息，可在云开发控制台检查日志。

- 小程序首页新增“同步到云数据库”按钮，点击后会调用 `readExcel` 云函数并传入 `action=import`，云函数会：
  1. 重新下载并解析 `data/b.xlsx`；
  2. 将历史 `excel_records` 集合清空；
  3. 按列头生成字段名并批量写入所有数据行。
- 同步完成后界面会提示“已同步 N 条记录”，并刷新前端展示；同步失败则会显示错误信息。
- 若需核对云端数据，可在云开发控制台打开 `excel_records` 集合查看记录。

