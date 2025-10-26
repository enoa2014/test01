#!/usr/bin/env node

const tcb = require('@cloudbase/node-sdk');
const fs = require('fs');
const path = require('path');

// 从环境变量或.env文件读取配置
require('dotenv').config();

const envId = process.env.TCB_ENV || process.env.TCB_ENV_ID;
const secretId = process.env.TENCENTCLOUD_SECRETID;
const secretKey = process.env.TENCENTCLOUD_SECRETKEY;

if (!envId || !secretId || !secretKey) {
  console.error('请配置环境变量:');
  console.error('- TCB_ENV 或 TCB_ENV_ID: 云环境ID');
  console.error('- TENCENTCLOUD_SECRETID: 腾讯云SecretId');
  console.error('- TENCENTCLOUD_SECRETKEY: 腾讯云SecretKey');
  process.exit(1);
}

const app = tcb.init({
  env: envId,
  credentials: { secretId, secretKey },
});

const db = app.database();

// 集合定义
const COLLECTIONS = [
  {
    name: 'users',
    description: '用户基础信息',
    indexes: [
      { name: 'openid_unique', fields: { openid: 1 }, unique: true },
      { name: 'status_created', fields: { status: 1, createdAt: -1 } },
    ],
  },
  {
    name: 'roleBindings',
    description: '角色绑定关系',
    indexes: [
      { name: 'userOpenId_index', fields: { userOpenId: 1 } },
      { name: 'role_state_index', fields: { role: 1, state: 1 } },
    ],
  },
  {
    name: 'roleRequests',
    description: '角色申请记录',
    indexes: [
      { name: 'state_type_index', fields: { state: 1, type: 1 } },
      { name: 'applicantOpenId_index', fields: { applicantOpenId: 1 } },
    ],
  },
  {
    name: 'invites',
    description: '邀请码管理',
    indexes: [
      { name: 'code_unique', fields: { code: 1 }, unique: true },
      { name: 'state_role_index', fields: { state: 1, role: 1 } },
    ],
  },
  {
    name: 'auditLogs',
    description: '审计日志',
    indexes: [
      { name: 'createdAt_index', fields: { createdAt: -1 } },
      { name: 'action_index', fields: { action: 1 } },
      { name: 'actorUserId_index', fields: { actorUserId: 1 } },
    ],
  },
  {
    name: 'import_jobs',
    description: '导入任务记录',
    indexes: [
      { name: 'createdAt_index', fields: { createdAt: -1 } },
      { name: 'state_index', fields: { state: 1 } },
    ],
  },
  {
    name: 'export_jobs',
    description: '导出任务记录',
    indexes: [
      { name: 'createdAt_index', fields: { createdAt: -1 } },
      { name: 'state_index', fields: { state: 1 } },
    ],
  },
];

async function createCollection(collection) {
  try {
    console.log(`创建集合: ${collection.name} (${collection.description})`);
    await db.createCollection(collection.name);
    console.log(`✓ 集合 ${collection.name} 创建成功`);

    // 创建索引
    if (collection.indexes && collection.indexes.length > 0) {
      for (const index of collection.indexes) {
        try {
          console.log(`  创建索引: ${index.name} on ${collection.name}`);
          await db.collection(collection.name).createIndex(index.fields, {
            name: index.name,
            unique: index.unique || false,
          });
          console.log(`  ✓ 索引 ${index.name} 创建成功`);
        } catch (indexError) {
          console.warn(`  ⚠ 索引 ${index.name} 创建失败:`, indexError.message);
        }
      }
    }
  } catch (error) {
    if (error.message.includes('already exists') || error.message.includes('ALREADY_EXISTS')) {
      console.log(`✓ 集合 ${collection.name} 已存在`);
    } else {
      console.error(`✗ 集合 ${collection.name} 创建失败:`, error.message);
      throw error;
    }
  }
}

async function verifyCollection(collection) {
  try {
    const result = await db.collection(collection.name).limit(1).get();
    console.log(`✓ 集合 ${collection.name} 验证成功`);
    return true;
  } catch (error) {
    console.error(`✗ 集合 ${collection.name} 验证失败:`, error.message);
    return false;
  }
}

async function main() {
  console.log('=== Web管理端数据库初始化 ===');
  console.log(`环境ID: ${envId}`);
  console.log('');

  try {
    // 创建所有集合
    for (const collection of COLLECTIONS) {
      await createCollection(collection);
      console.log('');
    }

    // 验证所有集合
    console.log('=== 验证集合 ===');
    let successCount = 0;
    for (const collection of COLLECTIONS) {
      const success = await verifyCollection(collection);
      if (success) successCount++;
      console.log('');
    }

    console.log(`=== 初始化完成 ===`);
    console.log(`成功创建/验证 ${successCount}/${COLLECTIONS.length} 个集合`);

    if (successCount === COLLECTIONS.length) {
      console.log('✓ 数据库初始化成功完成！');
    } else {
      console.log('⚠ 部分集合初始化失败，请检查错误信息');
      process.exit(1);
    }

  } catch (error) {
    console.error('数据库初始化失败:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });
}