import type { CloudBase } from '@cloudbase/js-sdk';

type IntakeCreatePayload = {
  patientName: string;
  idType?: string;
  idNumber?: string;
  gender?: string;
  birthDate?: string;
  phone?: string;
  nativePlace?: string;
  address?: string;
  backupContact?: string;
  backupPhone?: string;
  fatherInfo?: string;
  fatherContactName?: string;
  fatherContactPhone?: string;
  motherInfo?: string;
  motherContactName?: string;
  motherContactPhone?: string;
  guardianInfo?: string;
  guardianContactName?: string;
  guardianContactPhone?: string;
  admissionDate?: string;
  situation?: string;
  visitHospital?: string;
  hospitalDiagnosis?: string;
  attendingDoctor?: string;
  symptomDetail?: string;
  treatmentProcess?: string;
  followUpPlan?: string;
};

export async function intakeCreatePatient(app: CloudBase, formData: IntakeCreatePayload) {
  const res = await app.callFunction({
    name: 'patientIntake',
    data: {
      action: 'createPatient',
      formData,
    },
  });
  const result = res.result as { success?: boolean; data?: { patientKey?: string }; error?: { message?: string } };
  if (!result?.success || !result?.data?.patientKey) {
    throw new Error(result?.error?.message || '创建住户失败');
  }
  return result.data;
}

type UpdateIntakePayload = {
  patientKey: string;
  intakeId?: string; // 若缺省则创建新条目
  intakeTime?: number | string; // 时间戳或可解析日期字符串
  checkoutAt?: number | string;
  note?: string;
  reason?: string;
  hospital?: string;
  diagnosis?: string;
  doctor?: string;
  symptoms?: string;
  treatmentProcess?: string;
  followUpPlan?: string;
  narrative?: string; // 等价于情况说明
};

export async function updateIntakeRecord(app: CloudBase, payload: UpdateIntakePayload) {
  const res = await app.callFunction({
    name: 'patientIntake',
    data: {
      action: 'updateIntakeRecord',
      patientKey: payload.patientKey,
      intakeId: payload.intakeId,
      intakeTime: payload.intakeTime,
      checkoutAt: payload.checkoutAt,
      note: payload.note,
      reason: payload.reason,
      hospital: payload.hospital,
      diagnosis: payload.diagnosis,
      doctor: payload.doctor,
      symptoms: payload.symptoms,
      treatmentProcess: payload.treatmentProcess,
      followUpPlan: payload.followUpPlan,
      narrative: payload.narrative,
    },
  });
  const result = res.result as { success?: boolean; error?: { message?: string } };
  if (!result?.success) {
    throw new Error(result?.error?.message || '更新入住记录失败');
  }
  return result;
}

export async function listIntakeRecords(app: CloudBase, patientKey: string) {
  const res = await app.callFunction({
    name: 'patientIntake',
    data: { action: 'listIntakeRecords', patientKey, limit: 100 },
  });
  const result = res.result as { success?: boolean; data?: { items?: any[] }; error?: { message?: string } };
  if (!result?.success) {
    throw new Error(result?.error?.message || '获取入住记录失败');
  }
  return result.data?.items || [];
}

export async function deleteIntakeRecord(app: CloudBase, patientKey: string, intakeId: string) {
  const res = await app.callFunction({
    name: 'patientIntake',
    data: { action: 'deleteIntakeRecord', patientKey, intakeId },
  });
  const result = res.result as { success?: boolean; error?: { message?: string } };
  if (!result?.success) {
    throw new Error(result?.error?.message || '删除入住记录失败');
  }
}

// 额外：获取患者详情（来源 patientIntake，用于补充 profile 不足）
export async function getPatientIntakeDetail(app: CloudBase, patientKey: string, options?: { recordKey?: string; patientName?: string }) {
  const res = await app.callFunction({
    name: 'patientIntake',
    data: {
      action: 'getPatientDetail',
      patientKey,
      recordKey: options?.recordKey,
      patientName: options?.patientName,
    },
  });
  const result = res.result as { success?: boolean; data?: any; error?: { message?: string } };
  if (!result?.success) {
    throw new Error(result?.error?.message || '获取住户详情失败');
  }
  return result.data || {};
}

// 额外：获取完整入住记录（来源 patientIntake，优先使用 records 字段；若缺失则回退 listIntakeRecords）
export async function getAllIntakeRecords(app: CloudBase, patientKey: string) {
  try {
    const res = await app.callFunction({
      name: 'patientIntake',
      data: { action: 'getAllIntakeRecords', patientKey },
    });
    const result = res.result as { success?: boolean; data?: { records?: any[]; items?: any[] } };
    if (result?.success) {
      const data = result.data || {};
      return (Array.isArray(data.records) ? data.records : Array.isArray(data.items) ? data.items : []) as any[];
    }
  } catch (err) {
    // ignore and fallback
  }
  // fallback to list
  return await listIntakeRecords(app, patientKey);
}
