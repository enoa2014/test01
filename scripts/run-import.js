require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const cloudbase = require('@cloudbase/node-sdk');
const envId = process.env.TCB_ENV;
const secretId = process.env.TENCENTCLOUD_SECRETID;
const secretKey = process.env.TENCENTCLOUD_SECRETKEY;

if (!envId || !secretId || !secretKey) {
  console.error('Missing env or credentials');
  process.exit(1);
}

const app = cloudbase.init({ envId, secretId, secretKey });

(async () => {
  try {
    const res = await app.callFunction({ name: 'readExcel', data: { action: 'import' } });
    console.log(JSON.stringify(res.result, null, 2));
  } catch (err) {
    console.error(err);
  }
})();
