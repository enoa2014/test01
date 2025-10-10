import { CloudBase } from '@cloudbase/js-sdk';
import { PatientDetail, PatientFormPayload, PatientSummary } from '../types/patient';

const PATIENT_PROFILE_FUNCTION = 'patientProfile';

type PatientListResponse = {
  success?: boolean;
  patients?: PatientSummary[];
  totalCount?: number;
  hasMore?: boolean;
  error?: { message?: string };
};

type PatientListParams = {
  page?: number;
  pageSize?: number;
  keyword?: string;
  filters?: {
    gender?: string;
    careStatus?: string;
    nativePlace?: string;
  };
};

export async function fetchPatientList(app: CloudBase, params: PatientListParams = {}) {
  const { page, pageSize, keyword, filters } = params;
  const res = await app.callFunction({
    name: PATIENT_PROFILE_FUNCTION,
    data: {
      action: 'list',
      includeTotal: true,
      page,
      pageSize,
      keyword,
      filters,
    },
  });
  const result = res.result as PatientListResponse;
  if (!result?.patients) {
    const message = result?.error?.message || '无法获取患者列表';
    throw new Error(message);
  }
  return {
    patients: result.patients,
    totalCount: result.totalCount,
    hasMore: result.hasMore
  };
}

type PatientDetailResponse = {
  success?: boolean;
  patient?: PatientDetail['patient'];
  basicInfo?: PatientDetail['basicInfo'];
  familyInfo?: PatientDetail['familyInfo'];
  economicInfo?: PatientDetail['economicInfo'];
  records?: PatientDetail['records'];
  error?: { message?: string };
};

export async function fetchPatientDetail(app: CloudBase, patientKey: string): Promise<PatientDetail> {
  const res = await app.callFunction({
    name: PATIENT_PROFILE_FUNCTION,
    data: { action: 'detail', patientKey }
  });
  const result = res.result as PatientDetailResponse;
  if (result?.error) {
    throw new Error(result.error.message || '获取患者详情失败');
  }
  return {
    patient: result.patient,
    basicInfo: result.basicInfo,
    familyInfo: result.familyInfo,
    economicInfo: result.economicInfo,
    records: result.records
  };
}

export async function deletePatient(app: CloudBase, patientKey: string, operator?: string) {
  const res = await app.callFunction({
    name: PATIENT_PROFILE_FUNCTION,
    data: { action: 'delete', patientKey, operator }
  });
  const result = res.result as { success?: boolean; error?: { message?: string } };
  if (!result?.success) {
    throw new Error(result?.error?.message || '删除失败');
  }
}

export async function exportPatients(app: CloudBase, patientKeys: string[]) {
  const res = await app.callFunction({
    name: PATIENT_PROFILE_FUNCTION,
    data: { action: 'export', patientKeys }
  });
  const result = res.result as {
    success?: boolean;
    fileId?: string;
    downloadUrl?: string;
    error?: { message?: string };
  };
  if (result?.error) {
    throw new Error(result.error.message || '导出失败');
  }
  return result;
}

type MutationResult = {
  success?: boolean;
  patientKey?: string;
  updatedAt?: number;
  error?: { code?: string; message?: string };
};

export async function createPatient(app: CloudBase, payload: PatientFormPayload) {
  const res = await app.callFunction({
    name: PATIENT_PROFILE_FUNCTION,
    data: { action: 'create', data: payload },
  });
  const result = res.result as MutationResult;
  if (!result?.success || !result.patientKey) {
    throw new Error(result?.error?.message || '创建住户失败');
  }
  return result;
}

export async function updatePatient(
  app: CloudBase,
  patientKey: string,
  patch: Partial<PatientFormPayload>
) {
  const res = await app.callFunction({
    name: PATIENT_PROFILE_FUNCTION,
    data: { action: 'update', patientKey, patch },
  });
  const result = res.result as MutationResult;
  if (!result?.success) {
    throw new Error(result?.error?.message || '更新住户失败');
  }
  return { ...result, patientKey: patientKey || result.patientKey };
}
