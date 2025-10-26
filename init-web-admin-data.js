const tcb = require('tcb-admin-node');

async function initWebAdminData() {
  try {
    console.log('🚀 初始化 Web Admin 数据...');

    const app = tcb.init({
      env: process.env.TCB_ENV || 'cloud1-6g2fzr5f7cf51e38',
      credentials: {
        secretId: process.env.TENCENTCLOUD_SECRETID,
        secretKey: process.env.TENCENTCLOUD_SECRETKEY
      }
    });

    const db = app.database();
    console.log('✅ CloudBase 连接成功');

    // 1. 检查并创建管理员用户
    console.log('\n👑 检查管理员用户...');
    const adminUsers = await db.collection('users').where({ role: 'admin' }).get();

    if (adminUsers.data.length === 0) {
      console.log('⚠️  没有管理员账号，创建默认管理员...');

      const adminData = {
        openid: 'admin_default',
        role: 'admin',
        name: '系统管理员',
        email: 'admin@example.com',
        created_at: new Date(),
        updated_at: new Date(),
        status: 'active'
      };

      await db.collection('users').add(adminData);
      console.log('✅ 默认管理员账号创建成功');
    } else {
      console.log(`✅ 已有 ${adminUsers.data.length} 个管理员账号`);
    }

    // 2. 检查角色数据
    console.log('\n🔐 检查角色数据...');
    const roleCount = await db.collection('roles').count();

    if (roleCount.total === 0) {
      console.log('⚠️  没有角色数据，创建基础角色...');

      const roles = [
        { code: 'admin', name: '管理员', description: '系统管理员，拥有所有权限', permissions: ['*'] },
        { code: 'doctor', name: '医生', description: '医生角色，可查看和编辑患者数据', permissions: ['patient:read', 'patient:write', 'media:read'] },
        { code: 'social_worker', name: '社工', description: '社工角色，可查看患者基本信息', permissions: ['patient:read', 'patient:basic'] }
      ];

      for (const role of roles) {
        await db.collection('roles').add({
          ...role,
          created_at: new Date(),
          updated_at: new Date()
        });
      }
      console.log('✅ 基础角色创建成功');
    } else {
      console.log(`✅ 已有 ${roleCount.total} 个角色`);
    }

    // 3. 检查患者数据
    console.log('\n🏥 检查患者数据...');
    const patientCount = await db.collection('patients').count();
    console.log(`📊 患者数据: ${patientCount.total} 条记录`);

    if (patientCount.total === 0) {
      console.log('⚠️  没有患者数据，请运行以下命令导入:');
      console.log('   npm run database:reinit');
    }

    // 4. 检查邀请数据
    console.log('\n📨 检查邀请数据...');
    const inviteCount = await db.collection('invites').count();
    console.log(`📊 邀请数据: ${inviteCount.total} 条记录`);

    // 5. 创建测试邀请（如果没有）
    if (inviteCount.total === 0) {
      console.log('⚠️  创建测试邀请...');

      const testInvite = {
        code: 'TEST-INVITE-2025',
        role: 'social_worker',
        created_by: 'admin_default',
        created_at: new Date(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天后过期
        status: 'active',
        usage_limit: 1,
        used_count: 0
      };

      await db.collection('invites').add(testInvite);
      console.log('✅ 测试邀请创建成功: TEST-INVITE-2025');
    }

    console.log('\n🎉 Web Admin 数据初始化完成！');
    console.log('\n📋 登录信息:');
    console.log('1. 使用种子代码登录: seed-admin-2025');
    console.log('2. 或使用测试邀请: TEST-INVITE-2025');
    console.log('3. 访问地址: http://localhost:5173');

  } catch (error) {
    console.error('❌ 初始化失败:', error.message);
    console.error('\n💡 请检查:');
    console.error('1. CloudBase 环境配置是否正确');
    console.error('2. 网络连接是否正常');
    console.error('3. 凭据是否有权限访问数据库');
  }
}

initWebAdminData();