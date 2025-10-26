const tcb = require('tcb-admin-node');

// 从 .env 文件加载配置
const envId = process.env.TCB_ENV || 'cloud1-6g2fzr5f7cf51e38';
const secretId = process.env.TENCENTCLOUD_SECRETID;
const secretKey = process.env.TENCENTCLOUD_SECRETKEY;

async function checkDatabaseStatus() {
  console.log('🔍 检查数据库状态...');
  console.log('环境ID:', envId);
  console.log('SecretId:', secretId ? '已配置' : '未配置');
  console.log('SecretKey:', secretKey ? '已配置' : '未配置');

  if (!envId || !secretId || !secretKey) {
    console.error('❌ CloudBase 环境或凭证未配置');
    process.exit(1);
  }

  const app = tcb.init({
    env: envId,
    credentials: { secretId, secretKey }
  });

  const db = app.database();

  console.log('\n📊 检查数据库集合状态...');

  const collections = [
    'excel_records',
    'patients',
    'patient_intake_records',
    'patient_media',
    'users',
    'invites',
    'roles',
    'user_roles'
  ];

  for (const collectionName of collections) {
    try {
      const collection = db.collection(collectionName);
      const count = await collection.count();
      console.log(`✅ ${collectionName}: ${count.total} 条记录`);

      if (count.total > 0 && count.total <= 5) {
        const sample = await collection.limit(3).get();
        sample.data.forEach((doc, index) => {
          console.log(`   样例 ${index + 1}:`, JSON.stringify(doc, null, 2).substring(0, 200) + '...');
        });
      }
    } catch (error) {
      if (error.message.includes('Collection not exists')) {
        console.log(`⚠️  ${collectionName}: 集合不存在`);
      } else {
        console.log(`❌ ${collectionName}: 错误 - ${error.message}`);
      }
    }
  }

  // 检查用户管理相关数据
  console.log('\n👥 检查用户管理数据...');
  try {
    const usersCount = await db.collection('users').count();
    console.log(`管理员用户数: ${usersCount.total}`);

    if (usersCount.total > 0) {
      const adminUsers = await db.collection('users').where({ role: 'admin' }).get();
      console.log(`管理员账号数: ${adminUsers.data.length}`);
    }
  } catch (error) {
    console.log('❌ 检查用户数据失败:', error.message);
  }

} catch (error) {
  console.error('❌ 初始化 CloudBase 失败:', error.message);
}
}

// 执行检查
checkDatabaseStatus().catch(console.error);