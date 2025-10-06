#!/usr/bin/env node
const tcb = require('@cloudbase/node-sdk');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const envId = process.env.TCB_ENV;
const secretId = process.env.TENCENTCLOUD_SECRETID;
const secretKey = process.env.TENCENTCLOUD_SECRETKEY;
const syncBatchId = process.argv[2] || 'raw-reinit-20240607';

if (!envId || !secretId || !secretKey) {
  console.error('Missing TCB credentials in environment variables.');
  process.exit(1);
}

(async () => {
  const app = tcb.init({ env: envId, secretId, secretKey });
  const res = await app.callFunction({
    name: 'readExcel',
    data: {
      action: 'normalizeFromRaw',
      syncBatchId,
    },
  });
  console.log(JSON.stringify(res.result, null, 2));
})();
