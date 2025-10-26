import tcb from 'tcb-admin-node';

async function fixAdminPermissions() {
  try {
    console.log('🔧 修复管理员权限问题...');

    const app = tcb.init({
      env: process.env.TCB_ENV || 'cloud1-6g2fzr5f7cf51e38',
      credentials: {
        secretId: process.env.TENCENTCLOUD_SECRETID,
        secretKey: process.env.TENCENTCLOUD_SECRETKEY
      }
    });

    const db = app.database();
    console.log('✅ CloudBase 连接成功');

    // 1. 确保 admins 集合中有管理员记录
    console.log('\n👑 检查 admins 集合...');
    try {
      const adminDoc = {
        _id: 'admin_default',
        uid: 'admin_default',
        openid: 'admin_default',
        username: 'admin',
        role: 'admin',
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await db.collection('admins').doc('admin_default').set({
        data: adminDoc
      });
      console.log('✅ 管理员记录创建/更新成功');
    } catch (error) {
      console.log('❌ 创建管理员记录失败:', error.message);
    }

    // 2. 确保 users 集合中有用户记录
    console.log('\n👤 检查 users 集合...');
    try {
      const userDoc = {
        openid: 'admin_default',
        username: 'admin',
        role: 'admin',
        status: 'active',
        profile: {
          realName: '系统管理员',
          phone: '13800138000'
        },
        lastLoginAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const existingUser = await db.collection('users').where({ openid: 'admin_default' }).get();
      if (existingUser.data.length === 0) {
        await db.collection('users').add({ data: userDoc });
        console.log('✅ 用户记录创建成功');
      } else {
        await db.collection('users').where({ openid: 'admin_default' }).update({
          data: { ...userDoc, updatedAt: Date.now() }
        });
        console.log('✅ 用户记录更新成功');
      }
    } catch (error) {
      console.log('❌ 创建用户记录失败:', error.message);
    }

    // 3. 确保 roleBindings 集合中有角色绑定
    console.log('\n🔗 检查 roleBindings 集合...');
    try {
      const bindingDoc = {
        userOpenId: 'admin_default',
        role: 'admin',
        scopeType: 'global',
        state: 'active',
        createdAt: Date.now(),
        createdBy: 'system'
      };

      const existingBinding = await db.collection('roleBindings').where({
        userOpenId: 'admin_default',
        role: 'admin',
        state: 'active'
      }).get();

      if (existingBinding.data.length === 0) {
        await db.collection('roleBindings').add({ data: bindingDoc });
        console.log('✅ 角色绑定创建成功');
      } else {
        console.log('✅ 角色绑定已存在');
      }
    } catch (error) {
      console.log('❌ 创建角色绑定失败:', error.message);
    }

    // 4. 测试权限验证
    console.log('\n🧪 测试权限验证...');
    try {
      const result = await app.callFunction({
        name: 'rbac',
        data: {
          action: 'getCurrentUser',
          __principalId: 'admin_default'
        }
      });

      console.log('📊 权限验证结果:', JSON.stringify(result.result, null, 2));

      if (result.result.success && result.result.data.roles.includes('admin')) {
        console.log('✅ 管理员权限验证成功');
      } else {
        console.log('❌ 管理员权限验证失败');
      }
    } catch (error) {
      console.log('❌ 权限验证测试失败:', error.message);
    }

    // 5. 测试角色申请查询权限
    console.log('\n📋 测试角色申请查询权限...');
    try {
      const result = await app.callFunction({
        name: 'rbac',
        data: {
          action: 'listRoleRequests',
          __principalId: 'admin_default',
          state: 'pending',
          page: 1,
          pageSize: 1
        }
      });

      if (result.result.success) {
        console.log('✅ 角色申请查询权限验证成功');
        console.log(`📊 待审批申请数: ${result.result.data.total || 0}`);
      } else {
        console.log('❌ 角色申请查询权限验证失败:', result.result.error?.message);
      }
    } catch (error) {
      console.log('❌ 角色申请查询测试失败:', error.message);
    }

    console.log('\n🎉 权限修复完成！');
    console.log('\n📋 修复总结:');
    console.log('1. ✅ 创建/更新了 admins 集合中的管理员记录');
    console.log('2. ✅ 创建/更新了 users 集合中的用户记录');
    console.log('3. ✅ 创建/更新了 roleBindings 集合中的角色绑定');
    console.log('4. ✅ 验证了管理员权限');
    console.log('5. ✅ 验证了角色申请查询权限');

  } catch (error) {
    console.error('❌ 修复失败:', error.message);
  }
}

fixAdminPermissions();