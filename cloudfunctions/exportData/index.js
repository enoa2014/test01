const cloud = require('wx-server-sdk');
const tcb = require('@cloudbase/node-sdk');
const xlsx = require('node-xlsx');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

// Collections
const EXPORT_JOBS_COLLECTION = 'export_jobs';
const EXCEL_RECORDS_COLLECTION = 'excel_records';

function makeError(code, message, details) {
  const err = new Error(message || code);
  err.code = code;
  if (details !== undefined) err.details = details;
  return err;
}

function getEnvId() {
  const direct = process.env.TCB_ENV || process.env.SCF_NAMESPACE || process.env.TENCENTCLOUD_ENV;
  if (direct) return direct;
  try {
    const ctx = cloud.getWXContext();
    return ctx && (ctx.ENV || ctx.TCB_ENV || ctx.SCF_NAMESPACE);
  } catch (_) {
    return '';
  }
}

// 数据脱敏函数
function maskSensitiveData(data, fieldsPolicy = 'masked', userRole = 'social_worker') {
  if (fieldsPolicy === 'full') {
    return data; // 管理员可以看到完整数据
  }

  // 社工角色的脱敏规则
  const maskedData = { ...data };

  // 家庭信息脱敏：保留前20个字符
  if (maskedData.familyInfo && maskedData.familyInfo.length > 20) {
    maskedData.familyInfo = maskedData.familyInfo.substring(0, 20) + '...';
  }

  // 医疗信息脱敏：保留前30个字符
  if (maskedData.treatmentInfo && maskedData.treatmentInfo.length > 30) {
    maskedData.treatmentInfo = maskedData.treatmentInfo.substring(0, 30) + '...';
  }

  return maskedData;
}

// 生成Excel文件
function generateExcelFile(data, filename) {
  if (!data || data.length === 0) {
    throw makeError('NO_DATA', '没有数据可导出');
  }

  // 定义字段顺序和中文标题 - 根据实际Excel文件格式
  const fieldMapping = [
    { field: 'sequence', title: '序号' },
    { field: 'name', title: '姓名' },
    { field: 'gender', title: '性别' },
    { field: 'checkInDate', title: '入住时间' },
    { field: 'residentNames', title: '入住人' },
    { field: 'childInfo', title: '患儿基本信息' },
    { field: 'medicalInfo', title: '就诊情况' },
    { field: 'treatmentInfo', title: '医疗情况' },
    { field: 'familyInfo', title: '家庭基本情况' }
  ];

  // 构建Excel数据
  const headers = fieldMapping.map(item => item.title);
  const rows = data.map(record => {
    return fieldMapping.map(item => record[item.field] || '');
  });

  const sheetData = [headers, ...rows];

  // 生成Excel文件
  const buffer = xlsx.build([{
    name: '患者数据',
    data: sheetData
  }]);

  return buffer;
}

// 创建导出任务
async function createExportJob(event, context) {
  const { filters = {}, fieldsPolicy = 'masked' } = event;
  const openId = context.OPENID || 'system';

  // 创建导出任务记录
  const jobData = {
    filters,
    fieldsPolicy,
    state: 'queued',
    stats: {
      total: 0,
      exported: 0,
      failed: 0
    },
    createdBy: openId,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const result = await db.collection(EXPORT_JOBS_COLLECTION).add(jobData);

  return {
    success: true,
    jobId: result._id
  };
}

// 执行导出
async function executeExport(event, context) {
  const { jobId } = event;
  const openId = context.OPENID || 'system';

  if (!jobId) {
    throw makeError('INVALID_INPUT', '缺少任务ID');
  }

  // 获取任务信息
  const jobResult = await db.collection(EXPORT_JOBS_COLLECTION).doc(jobId).get();
  if (!jobResult.data) {
    throw makeError('JOB_NOT_FOUND', '导出任务不存在');
  }

  const job = jobResult.data;
  if (job.state !== 'queued') {
    throw makeError('INVALID_JOB_STATE', '任务状态不正确，无法执行导出');
  }

  // 更新任务状态为运行中
  await db.collection(EXPORT_JOBS_COLLECTION).doc(jobId).update({
    state: 'running',
    updatedAt: Date.now()
  });

  try {
    // 构建查询条件
    let query = db.collection(EXCEL_RECORDS_COLLECTION);

    if (job.filters && Object.keys(job.filters).length > 0) {
      if (job.filters.keyword) {
        const keyword = job.filters.keyword.trim();
        if (keyword) {
          query = query.where(_.or([
            { name: db.RegExp({ regexp: keyword }) },
            { residentNames: db.RegExp({ regexp: keyword }) },
            { medicalInfo: db.RegExp({ regexp: keyword }) },
            { familyInfo: db.RegExp({ regexp: keyword }) }
          ]));
        }
      }

      if (job.filters.gender) {
        query = query.where({ gender: job.filters.gender });
      }

      if (job.filters.medicalInfo) {
        query = query.where({ medicalInfo: db.RegExp({ regexp: job.filters.medicalInfo }) });
      }

      if (job.filters.treatmentInfo) {
        query = query.where({ treatmentInfo: db.RegExp({ regexp: job.filters.treatmentInfo }) });
      }
    }

    // 获取总数
    const countResult = await query.count();
    const total = countResult.total;

    if (total === 0) {
      throw makeError('NO_DATA', '没有符合条件的数据');
    }

    // 分批获取数据（每次最多1000条）
    const batchSize = 1000;
    const batches = Math.ceil(total / batchSize);
    const allData = [];

    for (let i = 0; i < batches; i++) {
      const batchResult = await query
        .skip(i * batchSize)
        .limit(batchSize)
        .get();

      allData.push(...batchResult.data);
    }

    // 获取用户角色（简单判断，实际应该从RBAC系统获取）
    const userRole = openId === 'admin' ? 'admin' : 'social_worker';

    // 数据脱敏
    const maskedData = allData.map(record =>
      maskSensitiveData(record, job.fieldsPolicy, userRole)
    );

    // 生成Excel文件
    const filename = `export_${new Date().toISOString().split('T')[0]}_${openId.substring(-8)}.xlsx`;
    const excelBuffer = generateExcelFile(maskedData, filename);

    // 上传到云存储
    const app = tcb.init({ env: getEnvId() });
    const uploadResult = await app.uploadFile({
      cloudPath: `exports/${filename}`,
      fileContent: excelBuffer
    });

    // 更新任务状态
    await db.collection(EXPORT_JOBS_COLLECTION).doc(jobId).update({
      state: 'succeeded',
      fileId: uploadResult.fileID,
      filename,
      stats: {
        total,
        exported: maskedData.length,
        failed: 0
      },
      completedAt: Date.now(),
      updatedAt: Date.now()
    });

    return {
      success: true,
      stats: {
        total,
        exported: maskedData.length,
        failed: 0
      },
      fileId: uploadResult.fileID,
      filename
    };

  } catch (error) {
    // 更新任务状态为失败
    await db.collection(EXPORT_JOBS_COLLECTION).doc(jobId).update({
      state: 'failed',
      error: error.message,
      completedAt: Date.now(),
      updatedAt: Date.now()
    });

    throw error;
  }
}

// 获取导出任务列表
async function listExportJobs(event) {
  const { page = 1, pageSize = 20, state } = event;

  const query = {};
  if (state) {
    query.state = state;
  }

  const countResult = await db.collection(EXPORT_JOBS_COLLECTION)
    .where(query)
    .count();

  const listResult = await db.collection(EXPORT_JOBS_COLLECTION)
    .where(query)
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();

  return {
    success: true,
    data: {
      items: listResult.data,
      total: countResult.total,
      page,
      pageSize,
      hasMore: countResult.total > page * pageSize
    }
  };
}

// 获取导出任务详情
async function getExportJob(event) {
  const { jobId } = event;

  if (!jobId) {
    throw makeError('INVALID_INPUT', '缺少任务ID');
  }

  const result = await db.collection(EXPORT_JOBS_COLLECTION).doc(jobId).get();
  if (!result.data) {
    throw makeError('JOB_NOT_FOUND', '导出任务不存在');
  }

  return {
    success: true,
    data: result.data
  };
}

// 下载导出文件
async function downloadExportFile(event, context) {
  const { jobId } = event;
  const openId = context.OPENID || 'system';

  if (!jobId) {
    throw makeError('INVALID_INPUT', '缺少任务ID');
  }

  // 获取任务信息
  const jobResult = await db.collection(EXPORT_JOBS_COLLECTION).doc(jobId).get();
  if (!jobResult.data) {
    throw makeError('JOB_NOT_FOUND', '导出任务不存在');
  }

  const job = jobResult.data;

  if (job.state !== 'succeeded') {
    throw makeError('JOB_NOT_READY', '导出任务未完成或失败');
  }

  if (!job.fileId) {
    throw makeError('FILE_NOT_FOUND', '导出文件不存在');
  }

  // 权限检查：只能下载自己创建的文件或管理员可以下载所有文件
  if (job.createdBy !== openId && openId !== 'admin') {
    throw makeError('FORBIDDEN', '无权限下载此文件');
  }

  // 获取下载链接
  const app = tcb.init({ env: getEnvId() });
  const { fileList } = await app.getTempFileURL({
    fileList: [job.fileId],
    expire: 3600 // 1小时有效期
  });

  if (!fileList || fileList.length === 0 || !fileList[0].tempFileURL) {
    throw makeError('DOWNLOAD_FAILED', '无法获取下载链接');
  }

  return {
    success: true,
    downloadUrl: fileList[0].tempFileURL,
    filename: job.filename,
    expiresIn: 3600
  };
}

exports.main = async (event, context) => {
  const action = String(event.action || 'listJobs');

  try {
    switch (action) {
      case 'create':
        return await createExportJob(event, context);
      case 'export':
        return await executeExport(event, context);
      case 'listJobs':
        return await listExportJobs(event);
      case 'getJob':
        return await getExportJob(event);
      case 'download':
        return await downloadExportFile(event, context);
      default:
        throw makeError('UNSUPPORTED_ACTION', `不支持的操作: ${action}`);
    }
  } catch (error) {
    console.error('exportData action failed', action, error);
    return {
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || '服务内部错误',
        details: error.details || null
      }
    };
  }
};