# Excel �ϴ���չʾ����

## Ŀ��

������ `prepare/b.xlsx` �ϴ���΢���ƿ����洢��ͨ���ƺ������ж�ȡ����С����ҳ��չʾ��ͬʱ����˵��˲��Ը��ǡ�

## ��������

1. ׼���ƶ��ļ�
2. ��д�������ƺ���
3. ����С����ҳ��չʾ
4. ��չ�˵��˲���
5. ��ά���ĵ���¼

---

## 1. ׼���ƶ��ļ�

- ��װ��Ҫ������
  ```powershell
  npm install --save-dev @cloudbase/cli
  npm install xlsx
  ```
- ��¼��Ѷ�� CLI��
  ```powershell
  tcb login
  ```
- �� `prepare/b.xlsx` �ϴ����ƴ洢��ʾ��·�� `data/b.xlsx`����
  ```powershell
  tcb storage:upload prepare/b.xlsx -r data/b.xlsx --env cloud1-6g2fzr5f7cf51e38
  ```
  Ҳ����΢�ſ����߹��ߵġ��ƿ��� �� �洢�������ֶ��ϴ���

## 2. �ƺ�����ȡ�߼�

- �� `cloudfunctions/readExcel` Ŀ¼�д����ƺ�����
  - `index.js` ʹ�� `tcb-admin-node` �� `xlsx` ���ز������洢�е� `data/b.xlsx`��
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
  - `package.json` ����������
    ```json
    {
      "dependencies": {
        "wx-server-sdk": "~3",
        "xlsx": "^0.18.5"
      }
    }
    ```
- ��΢�ſ����߹����в����ƺ�����ѡ�񻷾� `cloud1-6g2fzr5f7cf51e38`����

## 3. С����ҳ��չʾ

- ��Ŀ��ҳ�棨���� `pages/index/index`�������ƺ�������Ⱦ��
  ```javascript
  Page({
    data: { rows: [], loading: true, error: '' },
    async onLoad() {
      try {
        const res = await wx.cloud.callFunction({ name: 'readExcel' });
        this.setData({ rows: res.result.rows || [], loading: false });
      } catch (err) {
        this.setData({ error: err.errMsg || '��ȡʧ��', loading: false });
      }
    }
  });
  ```
- ��Ӧ `index.wxml` ʹ�� `wx:for` ��Ⱦ�У�
  ```xml
  <view wx:if="{{loading}}">�����С�</view>
  <view wx:elif="{{error}}">{{error}}</view>
  <view wx:else>
    <view wx:for="{{rows}}" wx:key="index" class="row">
      <text wx:for="{{item}}" wx:key="inner">{{item}}</text>
    </view>
  </view>
  ```

## 4. �˵��˲�����չ

- �� `tests/e2e/specs/home.spec.js` ���Ӷ������ݵĶ��ԣ�
  ```javascript
  const rows = await waitForElement(page, '.row', 20, 500);
  expect(rows).not.toBeNull();
  ```
- ����ִ��ǰȷ�� `data/b.xlsx` ���ϴ������¡�
- ���У�
  ```powershell
  set WX_DEVTOOLS_WS=ws://127.0.0.1:9421
  npm run test:e2e
  ```

## 5. ��ά���¼

- ������ϴ��Ͳ�����д�ɽű����� `npm run upload-excel`��`npm run deploy:read-excel`����
- ����������ӵ��Ŷ��ĵ������� `docs/e2e-debug-notes.md`����˵����
  - �ƴ洢·�������ʱ�䣻
  - �ƺ������Ƽ��������ݸ�ʽ��
  - С����ҳ��λ����չʾ��ʽ��
  - �˵��˲��������ע��Ļ���������

---

ִ�й��������� `wx.cloud.callFunction` Ȩ�����⣬ȷ�ϵ�ǰ�˺Ŷ��ƻ����ʹ洢ӵ�з���Ȩ�ޣ�����΢�ſ����߹����е�½��ͬ΢�źš�
