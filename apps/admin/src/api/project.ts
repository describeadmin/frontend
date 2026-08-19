/**
 * 项目 接口。由 codegen 生成。
 *
 * 后端统一返回 Result：{ code, message, data, traceId }，
 * code === 0 为成功。解包由 requestClient 的响应拦截器完成，
 * 这里拿到的已经是 data 本身。
 */
import { requestClient } from '#/api/request';

/** 审计字段由后端 BaseEntity 承担，业务代码不要赋值。 */
export interface ProjectAudit {
  createBy?: null | number;
  createTime?: null | string;
  id?: number;
  updateBy?: null | number;
  updateTime?: null | string;
  version?: null | number;
}

export interface Project extends ProjectAudit {
  budget?: number;
  ownerDeptId?: number;
  projectCode?: string;
  projectName?: string;
  remark?: string;
  startDate?: string;
  status?: number;
}

export interface ProjectQuery {
  current?: number;
  size?: number;
  ownerDeptId?: number;
  projectCode?: string;
  projectName?: string;
  startDateEnd?: string;
  startDateStart?: string;
  status?: number;
}

export interface ProjectPage {
  current: number;
  pages: number;
  records: Project[];
  size: number;
  total: number;
}

export async function getProjectListApi(params: ProjectQuery) {
  return requestClient.get<ProjectPage>('/project', { params });
}

export async function createProjectApi(data: Project) {
  return requestClient.post<Project>('/project', data);
}

export async function updateProjectApi(id: number, data: Project) {
  return requestClient.put<Project>(`/project/${id}`, data);
}

export async function deleteProjectApi(id: number) {
  return requestClient.delete(`/project/${id}`);
}
