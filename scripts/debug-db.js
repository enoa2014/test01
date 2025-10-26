require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const cloudbase = require('@cloudbase/node-sdk');

const envId = process.env.TCB_ENV;
const secretId = process.env.TENCENTCLOUD_SECRETID;
const secretKey = process.env.TENCENTCLOUD_SECRETKEY;

if (!envId || !secretId || !secretKey) {
  console.error('Missing TCB_ENV or credentials.');
  process.exit(1);
}

const app = cloudbase.init({ envId, secretId, secretKey });

(async () => {
  try {
    const db = app.database();
    const res = await db.collection('excel_records').limit(5).get();
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error(err);
  }
})();
