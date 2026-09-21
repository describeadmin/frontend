<script lang="ts" setup>
import type { OptionItem, SysUser } from '../../api';
import type { SearchFormSchema } from '../../composables/useSearchForm';

import { onMounted, reactive, ref } from 'vue';

import { ConfirmDialog } from '@describeadmin/ele-ui';
import { Page } from '@describeadmin/ui';

import {
  ElButton,
  ElCheckbox,
  ElCheckboxGroup,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElOption,
  ElPagination,
  ElSelect,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTreeSelect,
} from 'element-plus';

import {
  assignUserRolesApi,
  createUserApi,
  deleteUserApi,
  getDeptOptionsApi,
  getRoleOptionsApi,
  getUserListApi,
  getUserRolesApi,
  resetUserPasswordApi,
  updateUserApi,
} from '../../api';
import { useSearchForm } from '../../composables/useSearchForm';

defineOptions({ name: 'SystemUser' });

const loading = ref(false);
const rows = ref<SysUser[]>([]);
const total = ref(0);
const page = reactive({ current: 1, size: 10 });

const filter = reactive<{
  mobile: string;
  nickname: string;
  status: null | number;
  username: string;
}>({
  mobile: '',
  nickname: '',
  status: null,
  username: '',
});

const searchSchema: SearchFormSchema[] = [
  {
    component: 'Input',
    componentProps: { 'data-testid': 'user-search-username-input' },
    fieldName: 'username',
    label: '用户名',
  },
  {
    component: 'Input',
    componentProps: { 'data-testid': 'user-search-nickname-input' },
    fieldName: 'nickname',
    label: '昵称',
  },
  {
    component: 'Input',
    componentProps: { 'data-testid': 'user-search-mobile-input' },
    fieldName: 'mobile',
    label: '手机号',
  },
  {
    component: 'Select',
    componentProps: {
      'data-testid': 'user-search-status-select',
      options: [
        { label: '启用', value: 1 },
        { label: '停用', value: 0 },
      ],
    },
    fieldName: 'status',
    label: '状态',
  },
];

const { SearchFormBar } = useSearchForm({
  testid: 'user',
  schema: searchSchema,
  async onSearch(values) {
    Object.assign(filter, values);
    page.current = 1;
    await load();
  },
  async onReset() {
    filter.username = '';
    filter.nickname = '';
    filter.mobile = '';
    filter.status = null;
    page.current = 1;
    await load();
  },
});

// 部门与角色都取「选项」接口而不是对方模块的列表/树接口：后者要 system:dept:list /
// system:role:list，于是只授「用户管理」的角色会 403，补授又会让侧边栏多出别的模块入口。
// 选项接口只要求登录，且不分页——详见 CLAUDE.md 4.11。
const deptTree = ref<OptionItem[]>([]);

const formVisible = ref(false);
const submitting = ref(false);
const editingId = ref<null | number>(null);
const formRef = ref();

const form = reactive({
  deptId: undefined as number | undefined,
  email: '',
  mobile: '',
  nickname: '',
  password: '',
  // 只在新增时使用：后端 /with-password 支持建号的同时授予角色，省掉
  // 「先建号、再分配角色」两步。编辑时仍走「分配角色」按钮，保持单一路径。
  roleIds: [] as number[],
  status: 1,
  username: '',
  version: undefined as number | undefined,
});

const rules = {
  nickname: [{ required: true, message: '请输入昵称', trigger: 'blur' }],
  password: [{ required: true, message: '请输入初始密码', trigger: 'blur' }],
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
};

const confirmVisible = ref(false);
const deletingId = ref<null | number>(null);

const pwdVisible = ref(false);
const pwdUserId = ref<null | number>(null);
const newPassword = ref('');

const roleVisible = ref(false);
const roleUserId = ref<null | number>(null);
const allRoles = ref<OptionItem[]>([]);
const checkedRoleIds = ref<number[]>([]);

async function load() {
  loading.value = true;
  try {
    const result = await getUserListApi({
      ...page,
      mobile: filter.mobile || undefined,
      nickname: filter.nickname || undefined,
      status: filter.status ?? undefined,
      username: filter.username || undefined,
    });
    rows.value = result.records;
    total.value = result.total;
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingId.value = null;
  Object.assign(form, {
    deptId: undefined,
    email: '',
    mobile: '',
    nickname: '',
    password: '',
    roleIds: [],
    status: 1,
    username: '',
    version: undefined,
  });
  formVisible.value = true;
}

function openEdit(row: SysUser) {
  editingId.value = row.id ?? null;
  Object.assign(form, {
    deptId: row.deptId ?? undefined,
    email: row.email ?? '',
    mobile: row.mobile ?? '',
    nickname: row.nickname ?? '',
    // 编辑时不改密码，改密码走「重置密码」，避免把哈希值当明文回填
    password: '',
    roleIds: [],
    status: row.status ?? 1,
    username: row.username ?? '',
    version: row.version ?? undefined,
  });
  formVisible.value = true;
}

async function submit() {
  await formRef.value?.validate();
  submitting.value = true;
  try {
    if (editingId.value === null) {
      await createUserApi({
        deptId: form.deptId,
        email: form.email || undefined,
        mobile: form.mobile || undefined,
        nickname: form.nickname,
        password: form.password,
        roleIds: form.roleIds,
        username: form.username,
      });
      ElMessage.success('新增成功');
    } else {
      // 不提交 password：后端 SysUserController.update 已用 @TableField(updateStrategy
      // = NOT_NULL) 锁住密码列，但这里仍不传，保持"改密码只走重置密码"的单一路径
      await updateUserApi(editingId.value, {
        deptId: form.deptId,
        email: form.email || undefined,
        mobile: form.mobile || undefined,
        nickname: form.nickname,
        status: form.status,
        username: form.username,
        version: form.version,
      });
      ElMessage.success('保存成功');
    }
    formVisible.value = false;
    await load();
  } finally {
    submitting.value = false;
  }
}

function askDelete(row: SysUser) {
  deletingId.value = row.id ?? null;
  confirmVisible.value = true;
}

async function confirmDelete() {
  if (deletingId.value === null) {
    return;
  }
  submitting.value = true;
  try {
    await deleteUserApi(deletingId.value);
    ElMessage.success('删除成功');
    confirmVisible.value = false;
    await load();
  } finally {
    submitting.value = false;
  }
}

function openResetPassword(row: SysUser) {
  pwdUserId.value = row.id ?? null;
  newPassword.value = '';
  pwdVisible.value = true;
}

async function submitResetPassword() {
  if (pwdUserId.value === null || !newPassword.value) {
    ElMessage.warning('请输入新密码');
    return;
  }
  submitting.value = true;
  try {
    await resetUserPasswordApi(pwdUserId.value, newPassword.value);
    ElMessage.success('密码已重置');
    pwdVisible.value = false;
  } finally {
    submitting.value = false;
  }
}

async function openAssignRole(row: SysUser) {
  roleUserId.value = row.id ?? null;
  const [options, owned] = await Promise.all([
    getRoleOptionsApi(),
    getUserRolesApi(row.id as number),
  ]);
  allRoles.value = options;
  checkedRoleIds.value = owned;
  roleVisible.value = true;
}

async function submitAssignRole() {
  if (roleUserId.value === null) {
    return;
  }
  submitting.value = true;
  try {
    await assignUserRolesApi(roleUserId.value, checkedRoleIds.value);
    ElMessage.success('授权成功');
    roleVisible.value = false;
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  // 角色与部门都走只要求登录的选项接口，不会再因为缺少别的模块的 :list 权限而 403，
  // 所以这里不再需要那段「单独 try 吞掉角色 403」的绕行代码——留着它只会掩盖真实故障。
  try {
    [allRoles.value, deptTree.value] = await Promise.all([
      getRoleOptionsApi(),
      getDeptOptionsApi(),
    ]);
    await load();
  } catch {
    // 已经由请求层的全局拦截器处理（弹出提示、401 时跳转登录页），这里只需要
    // 避免异常继续冒泡成 Vue 的 "Unhandled error during execution of mounted hook"。
  }
});
</script>

<template>
  <Page title="用户管理">
    <!-- 用户体系由框架的 framework-system-starter 提供，业务方无需实现——这是给开发者看的实现说明，不面向最终用户，故不放进 Page 的 description。 -->
    <template #extra>
      <ElButton type="primary" data-testid="user-add-btn" @click="openCreate">
        新增
      </ElButton>
    </template>

    <SearchFormBar />

    <ElTable
      v-loading="loading"
      :data="rows"
      row-key="id"
      data-testid="user-table"
    >
      <ElTableColumn prop="username" label="用户名" min-width="140" />
      <ElTableColumn prop="nickname" label="昵称" min-width="140" />
      <ElTableColumn prop="deptName" label="部门" min-width="140" />
      <ElTableColumn label="状态" width="90">
        <template #default="{ row }">
          {{ row.status === 1 ? '启用' : '停用' }}
        </template>
      </ElTableColumn>
      <ElTableColumn prop="createTime" label="创建时间" min-width="180" />
      <ElTableColumn label="操作" width="320" fixed="right">
        <template #default="{ row }">
          <ElButton
            link
            type="primary"
            data-testid="user-assign-role-btn"
            @click="openAssignRole(row)"
          >
            分配角色
          </ElButton>
          <ElButton
            link
            type="primary"
            data-testid="user-reset-password-btn"
            @click="openResetPassword(row)"
          >
            重置密码
          </ElButton>
          <ElButton
            link
            type="primary"
            data-testid="user-edit-btn"
            @click="openEdit(row)"
          >
            编辑
          </ElButton>
          <ElButton
            link
            type="danger"
            data-testid="user-delete-btn"
            @click="askDelete(row)"
          >
            删除
          </ElButton>
        </template>
      </ElTableColumn>
    </ElTable>

    <div class="mt-4 flex justify-end">
      <ElPagination
        v-model:current-page="page.current"
        v-model:page-size="page.size"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        data-testid="user-pagination"
        @current-change="load"
        @size-change="load"
      />
    </div>

    <ElDialog
      v-model="formVisible"
      :title="editingId === null ? '新增用户' : '编辑用户'"
      width="520px"
      append-to-body
      data-testid="user-form-dialog"
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="90px">
        <ElFormItem label="用户名" prop="username">
          <ElInput
            v-model="form.username"
            :disabled="editingId !== null"
            data-testid="user-username-input"
            placeholder="登录账号，创建后不可修改"
          />
        </ElFormItem>
        <ElFormItem label="昵称" prop="nickname">
          <ElInput
            v-model="form.nickname"
            data-testid="user-nickname-input"
            placeholder="请输入昵称"
          />
        </ElFormItem>
        <ElFormItem label="手机号" prop="mobile">
          <ElInput
            v-model="form.mobile"
            data-testid="user-mobile-input"
            placeholder="选填，重复的手机号会被拒绝"
          />
        </ElFormItem>
        <ElFormItem label="邮箱" prop="email">
          <ElInput
            v-model="form.email"
            data-testid="user-email-input"
            placeholder="选填，重复的邮箱会被拒绝"
          />
        </ElFormItem>
        <ElFormItem v-if="editingId === null" label="初始密码" prop="password">
          <ElInput
            v-model="form.password"
            type="password"
            show-password
            data-testid="user-password-input"
            placeholder="创建后请提醒用户尽快修改"
          />
        </ElFormItem>
        <ElFormItem label="部门" prop="deptId">
          <ElTreeSelect
            v-model="form.deptId"
            :data="deptTree"
            :props="{
              children: 'children',
              label: 'label',
              disabled: 'disabled',
            }"
            node-key="value"
            check-strictly
            clearable
            data-testid="user-dept-id-input"
          />
        </ElFormItem>
        <ElFormItem v-if="editingId === null" label="角色" prop="roleIds">
          <ElSelect
            v-model="form.roleIds"
            multiple
            clearable
            placeholder="选填，可在创建后通过「分配角色」调整"
            class="!w-full"
            data-testid="user-role-ids-select"
          >
            <ElOption
              v-for="role in allRoles"
              :key="role.value"
              :label="role.label"
              :value="role.value"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem v-if="editingId !== null" label="状态" prop="status">
          <ElSwitch
            v-model="form.status"
            :active-value="1"
            :inactive-value="0"
            data-testid="user-status-input"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton data-testid="user-cancel-btn" @click="formVisible = false">
          取消
        </ElButton>
        <ElButton
          type="primary"
          :loading="submitting"
          data-testid="user-submit-btn"
          @click="submit"
        >
          确定
        </ElButton>
      </template>
    </ElDialog>

    <ElDialog
      v-model="pwdVisible"
      title="重置密码"
      width="420px"
      append-to-body
      data-testid="user-password-dialog"
    >
      <ElInput
        v-model="newPassword"
        type="password"
        show-password
        data-testid="user-new-password-input"
        placeholder="请输入新密码"
      />
      <template #footer>
        <ElButton
          data-testid="user-password-cancel-btn"
          @click="pwdVisible = false"
        >
          取消
        </ElButton>
        <ElButton
          type="primary"
          :loading="submitting"
          data-testid="user-password-submit-btn"
          @click="submitResetPassword"
        >
          确定
        </ElButton>
      </template>
    </ElDialog>

    <ElDialog
      v-model="roleVisible"
      title="分配角色"
      width="420px"
      append-to-body
      data-testid="user-role-dialog"
    >
      <ElCheckboxGroup v-model="checkedRoleIds" data-testid="user-role-group">
        <ElCheckbox
          v-for="role in allRoles"
          :key="role.value"
          :value="role.value"
          :label="role.label"
        />
      </ElCheckboxGroup>
      <template #footer>
        <ElButton
          data-testid="user-role-cancel-btn"
          @click="roleVisible = false"
        >
          取消
        </ElButton>
        <ElButton
          type="primary"
          :loading="submitting"
          data-testid="user-role-submit-btn"
          @click="submitAssignRole"
        >
          确定
        </ElButton>
      </template>
    </ElDialog>

    <ConfirmDialog
      v-model="confirmVisible"
      testid="user"
      :loading="submitting"
      @confirm="confirmDelete"
    />
  </Page>
</template>
