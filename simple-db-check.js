const tcb = require('tcb-admin-node');

async function checkDB() {
  try {
    console.log('🔍 初始化 CloudBase...');
    const app = tcb.init({
      env: process.env.TCB_ENV || 'cloud1-6g2fzr5f7cf51e38',
      credentials: {
        secretId: process.env.TENCENTCLOUD_SECRETID,
        secretKey: process.env.TENCENTCLOUD_SECRETKEY
      }
    });

    const db = app.database();
    console.log('✅ CloudBase 初始化成功');

    // 检查主要集合
    const collections = ['users', 'patients', 'excel_records', 'invites'];

    for (const name of collections) {
      try {
        const count = await db.collection(name).count();
        console.log(`📊 ${name}: ${count.total} 条记录`);
      } catch (err) {
        console.log(`❌ ${name}: ${err.message}`);
      }
    }

  } catch (err) {
    console.error('❌ 检查失败:', err.message);
  }
}

checkDB();