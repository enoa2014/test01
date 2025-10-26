const cloud = require('wx-server-sdk');
const tcb = require('@cloudbase/node-sdk');
const xlsx = require('node-xlsx');
const fetch = require('node-fetch');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

// Collections
const IMPORT_JOBS_COLLECTION = 'import_jobs';
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

// 解析Excel文件
async function parseExcelFile(fileId) {
  try {
    // 获取文件URL
    const app = tcb.init({ env: getEnvId() });
    const { fileList } = await app.getTempFileURL({ fileList: [fileId] });

    if (!fileList || fileList.length === 0 || !fileList[0].tempFileURL) {
      throw makeError('INVALID_FILE_ID', '无法获取文件访问链接');
    }

    // 下载文件内容
    const response = await fetch(fileList[0].tempFileURL);
    if (!response.ok) {
      throw makeError('DOWNLOAD_FAILED', '文件下载失败');
    }

    const buffer = await response.arrayBuffer();
    const workbook = xlsx.parse(Buffer.from(buffer));

    if (!workbook || workbook.length === 0) {
      throw makeError('INVALID_EXCEL', 'Excel文件解析失败或无内容');
    }

    const sheet = workbook[0];
    if (!sheet || !sheet.data || sheet.data.length < 2) {
      throw makeError('INVALID_EXCEL_STRUCTURE', 'Excel文件结构不正确，至少需要标题行和一行数据');
    }

    return sheet;
  } catch (error) {
    if (error.code) throw error;
    throw makeError('PARSE_ERROR', `Excel解析失败: ${error.message}`);
  }
}

// 验证Excel数据
function validateExcelData(sheet) {
  const headers = sheet.data[0];
  const sampleRows = sheet.data.slice(1, 21); // 取前20行作为样本

  // 根据实际Excel文件格式的字段映射
  const fieldMapping = {
    '序号': 'sequence',
    '姓名': 'name',
    '性别': 'gender',
    '入住时间': 'checkInDate',
    '入住人': 'residentNames',
    '患儿基本信息': 'childInfo',
    '就诊情况': 'medicalInfo',
    '医疗情况': 'treatmentInfo',
    '家庭基本情况': 'familyInfo'
  };

  const warnings = [];
  const validatedHeaders = [];
  const missingRequiredFields = [];

  // 检查必填字段
  const requiredFields = ['姓名', '性别'];

  for (const header of headers) {
    if (!header) continue;

    const mappedField = fieldMapping[header];
    if (mappedField) {
      validatedHeaders.push({
        original: header,
        field: mappedField,
        required: requiredFields.includes(header)
      });
    } else {
      warnings.push(`未识别的字段: ${header}`);
    }
  }

  // 检查缺少的必填字段
  for (const required of requiredFields) {
    if (!headers.some(h => h === required)) {
      missingRequiredFields.push(required);
    }
  }

  if (missingRequiredFields.length > 0) {
    warnings.push(`缺少必填字段: ${missingRequiredFields.join(', ')}`);
  }

  // 验证数据样本
  const validatedSampleRows = sampleRows.map((row, index) => {
    const rowData = {};
    const rowWarnings = [];

    validatedHeaders.forEach(header => {
      const cellValue = row[headers.indexOf(header.original)];
      rowData[header.field] = cellValue;

      // 简单的数据格式验证
      if (header.required && !cellValue) {
        rowWarnings.push(`${header.original}不能为空`);
      }

      if (header.field === 'gender' && cellValue && !['男', '女'].includes(cellValue)) {
        rowWarnings.push(`性别格式不正确，应为"男"或"女"`);
      }

      if (header.field === 'checkInDate' && cellValue) {
        // 验证日期格式，支持如 "2020.6.3" 的格式
        const datePattern = /^\d{4}\.\d{1,2}\.\d{1,2}$/;
        if (!datePattern.test(cellValue.trim())) {
          rowWarnings.push(`入住时间格式不正确，应为"YYYY.MM.DD"格式`);
        }
      }
    });

    return {
      index: index + 2, // Excel行号（从1开始，加上标题行）
      data: rowData,
      warnings: rowWarnings
    };
  });

  return {
    sheetName: sheet.name,
    headers: validatedHeaders,
    sampleRows: validatedSampleRows,
    totalRows: sheet.data.length - 1,
    warnings,
    missingRequiredFields
  };
}

// 创建导入任务
async function createImportJob(event, context) {
  const { fileId, mode = 'smart' } = event;
  const openId = context.OPENID || 'system';

  if (!fileId) {
    throw makeError('INVALID_INPUT', '缺少文件ID');
  }

  // 解析Excel文件
  const sheet = await parseExcelFile(fileId);
  const validationResult = validateExcelData(sheet);

  // 创建导入任务记录
  const jobData = {
    fileId,
    mode,
    state: 'parsed',
    validationResult,
    stats: {
      total: validationResult.totalRows,
      success: 0,
      failed: 0,
      skipped: 0
    },
    createdBy: openId,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const result = await db.collection(IMPORT_JOBS_COLLECTION).add(jobData);

  return {
    success: true,
    jobId: result._id,
    validationResult
  };
}

// 执行导入
async function executeImport(event, context) {
  const { jobId } = event;
  const openId = context.OPENID || 'system';

  if (!jobId) {
    throw makeError('INVALID_INPUT', '缺少任务ID');
  }

  // 获取任务信息
  const jobResult = await db.collection(IMPORT_JOBS_COLLECTION).doc(jobId).get();
  if (!jobResult.data) {
    throw makeError('JOB_NOT_FOUND', '导入任务不存在');
  }

  const job = jobResult.data;
  if (job.state !== 'parsed') {
    throw makeError('INVALID_JOB_STATE', '任务状态不正确，无法执行导入');
  }

  // 更新任务状态为运行中
  await db.collection(IMPORT_JOBS_COLLECTION).doc(jobId).update({
    state: 'running',
    updatedAt: Date.now()
  });

  try {
    // 解析Excel文件
    const sheet = await parseExcelFile(job.fileId);
    const headers = sheet.data[0];
    const dataRows = sheet.data.slice(1);

    // 字段映射 - 根据实际Excel文件格式
    const fieldMapping = {
      '序号': 'sequence',
      '姓名': 'name',
      '性别': 'gender',
      '入住时间': 'checkInDate',
      '入住人': 'residentNames',
      '患儿基本信息': 'childInfo',
      '就诊情况': 'medicalInfo',
      '医疗情况': 'treatmentInfo',
      '家庭基本情况': 'familyInfo'
    };

    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const errors = [];

    // 批量处理数据
    const batchSize = 20;
    for (let i = 0; i < dataRows.length; i += batchSize) {
      const batch = dataRows.slice(i, i + batchSize);

      for (const row of batch) {
        try {
          const patientData = {};

          // 映射字段
          Object.keys(fieldMapping).forEach(header => {
            const cellIndex = headers.indexOf(header);
            if (cellIndex >= 0) {
              const value = row[cellIndex];
              if (value !== undefined && value !== null && value !== '') {
                patientData[fieldMapping[header]] = String(value).trim();
              }
            }
          });

          // 数据验证
          if (!patientData.name) {
            errors.push({
              row: i + 2,
              error: '缺少必填字段：姓名'
            });
            failedCount++;
            continue;
          }

          // 检查是否已存在（根据姓名和入住时间）
          let existingQuery = { name: patientData.name };
          if (patientData.checkInDate) {
            existingQuery.checkInDate = patientData.checkInDate;
          }

          const existing = await db.collection(EXCEL_RECORDS_COLLECTION)
            .where(existingQuery)
            .limit(1)
            .get();

          let shouldInsert = true;
          let action = 'create';

          if (job.mode === 'smart' && existing.data.length > 0) {
            // 智能合并模式：更新现有记录
            await db.collection(EXCEL_RECORDS_COLLECTION)
              .doc(existing.data[0]._id)
              .update({
                ...patientData,
                updatedAt: Date.now()
              });
            successCount++;
            action = 'update';
          } else if (job.mode === 'createOnly' && existing.data.length > 0) {
            // 仅新增模式：跳过已存在记录
            skippedCount++;
            continue;
          } else if (job.mode === 'updateOnly' && existing.data.length === 0) {
            // 仅更新模式：跳过新记录
            skippedCount++;
            continue;
          } else {
            // 创建新记录
            const recordData = {
              ...patientData,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              source: 'import',
              importJobId: jobId
            };

            await db.collection(EXCEL_RECORDS_COLLECTION).add(recordData);
            successCount++;
          }

        } catch (error) {
          errors.push({
            row: i + 2,
            error: error.message
          });
          failedCount++;
        }
      }
    }

    // 更新任务状态
    const finalState = failedCount === 0 ? 'succeeded' : 'completed_with_errors';
    await db.collection(IMPORT_JOBS_COLLECTION).doc(jobId).update({
      state: finalState,
      stats: {
        total: dataRows.length,
        success: successCount,
        failed: failedCount,
        skipped: skippedCount
      },
      errors,
      completedAt: Date.now(),
      updatedAt: Date.now()
    });

    return {
      success: true,
      stats: {
        total: dataRows.length,
        success: successCount,
        failed: failedCount,
        skipped: skippedCount
      },
      errors: errors.slice(0, 100) // 返回前100个错误
    };

  } catch (error) {
    // 更新任务状态为失败
    await db.collection(IMPORT_JOBS_COLLECTION).doc(jobId).update({
      state: 'failed',
      error: error.message,
      completedAt: Date.now(),
      updatedAt: Date.now()
    });

    throw error;
  }
}

// 获取导入任务列表
async function listImportJobs(event) {
  const { page = 1, pageSize = 20, state } = event;

  const query = {};
  if (state) {
    query.state = state;
  }

  const countResult = await db.collection(IMPORT_JOBS_COLLECTION)
    .where(query)
    .count();

  const listResult = await db.collection(IMPORT_JOBS_COLLECTION)
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

// 获取导入任务详情
async function getImportJob(event) {
  const { jobId } = event;

  if (!jobId) {
    throw makeError('INVALID_INPUT', '缺少任务ID');
  }

  const result = await db.collection(IMPORT_JOBS_COLLECTION).doc(jobId).get();
  if (!result.data) {
    throw makeError('JOB_NOT_FOUND', '导入任务不存在');
  }

  return {
    success: true,
    data: result.data
  };
}

exports.main = async (event, context) => {
  const action = String(event.action || 'listJobs');

  try {
    switch (action) {
      case 'parse':
        return await createImportJob(event, context);
      case 'import':
        return await executeImport(event, context);
      case 'listJobs':
        return await listImportJobs(event);
      case 'getJob':
        return await getImportJob(event);
      default:
        throw makeError('UNSUPPORTED_ACTION', `不支持的操作: ${action}`);
    }
  } catch (error) {
    console.error('importExcel action failed', action, error);
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