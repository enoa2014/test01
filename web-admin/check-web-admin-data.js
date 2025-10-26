import tcb from 'tcb-admin-node';

async function checkWebAdminData() {
  try {
    console.log('🔍 检查 Web Admin 数据状态...');

    // 初始化 CloudBase
    const app = tcb.init({
      env: process.env.TCB_ENV || 'cloud1-6g2fzr5f7cf51e38',
      credentials: {
        secretId: process.env.TENCENTCLOUD_SECRETID,
        secretKey: process.env.TENCENTCLOUD_SECRETKEY
      }
    });

    const db = app.database();
    console.log('✅ CloudBase 连接成功');

    // 检查关键集合
    const checks = [
      { name: 'users', desc: '用户数据' },
      { name: 'patients', desc: '患者数据' },
      { name: 'excel_records', desc: 'Excel记录' },
      { name: 'invites', desc: '邀请数据' },
      { name: 'roles', desc: '角色数据' },
      { name: 'user_roles', desc: '用户角色关联' }
    ];

    console.log('\n📊 数据检查结果:');

    for (const check of checks) {
      try {
        const count = await db.collection(check.name).count();
        console.log(`${count.total > 0 ? '✅' : '⚠️'} ${check.name} (${check.desc}): ${count.total} 条记录`);

        if (count.total > 0 && count.total <= 3) {
          const sample = await db.collection(check.name).limit(1).get();
          if (sample.data.length > 0) {
            console.log(`   样例数据: ${JSON.stringify(sample.data[0]).substring(0, 100)}...`);
          }
        }
      } catch (err) {
        console.log(`❌ ${check.name}: ${err.message}`);
      }
    }

    // 检查管理员账号
    try {
      const adminUsers = await db.collection('users').where({ role: 'admin' }).get();
      console.log(`\n👑 管理员账号: ${adminUsers.data.length} 个`);

      if (adminUsers.data.length === 0) {
        console.log('⚠️  没有管理员账号，需要创建管理员');
      }
    } catch (err) {
      console.log('❌ 检查管理员失败:', err.message);
    }

  } catch (error) {
    console.error('❌ 检查失败:', error.message);
    console.error('\n💡 可能的解决方案:');
    console.error('1. 检查 .env 文件中的 CloudBase 配置');
    console.error('2. 确认 TCB_ENV、TENCENTCLOUD_SECRETID、TENCENTCLOUD_SECRETKEY 已配置');
    console.error('3. 运行 npm run database:reinit 初始化数据');
  }
}

checkWebAdminData();