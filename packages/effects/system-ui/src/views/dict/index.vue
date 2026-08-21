<script lang="ts" setup>
import type { SysDictData, SysDictType } from '../../api';

import { computed, onMounted, reactive, ref } from 'vue';

import { ConfirmDialog } from '@describeadmin/ele-ui';
import { Page } from '@describeadmin/ui';

import {
  ElButton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElPagination,
  ElSwitch,
  ElTable,
  ElTableColumn,
} from 'element-plus';

import {
  createDictDataApi,
  createDictTypeApi,
  deleteDictDataApi,
  deleteDictTypeApi,
  getDictDataListApi,
  getDictTypeListApi,
  updateDictDataApi,
  updateDictTypeApi,
} from '../../api';

defineOptions({ name: 'SystemDict' });

/**
 * 表单模型刻意不直接用 `SysDictType`/`SysDictData`：实体字段大多可空
 * （后端允许 NULL），而 ElSwitch 的 v-model 不接受 null，对照 dept/index.vue
 * 的 DeptForm 是同一处理方式。
 */
interface DictTypeForm {
  dictName: string;
  dictType: string;
  status: number;
  version?: number;
}

interface DictDataForm {
  dictLabel: string;
  dictType: string;
  dictValue: string;
  sort: number;
  status: number;
  version?: number;
}

// ------------------------------------------------------------------ 字典类型

const typeLoading = ref(false);
const typeRows = ref<SysDictType[]>([]);
const typeTotal = ref(0);
const typePage = reactive({ current: 1, size: 10 });

const typeFormVisible = ref(false);
const typeSubmitting = ref(false);
const editingTypeId = ref<null | number>(null);
const typeFormRef = ref();

const typeForm = reactive<DictTypeForm>({
  dictName: '',
  dictType: '',
  status: 1,
});

const typeRules = {
  dictName: [{ required: true, message: '请输入字典名称', trigger: 'blur' }],
  dictType: [{ required: true, message: '请输入字典类型', trigger: 'blur' }],
};

const typeConfirmVisible = ref(false);
const deletingTypeId = ref<null | number>(null);

const selectedType = ref<null | string>(null);

async function loadTypes() {
  typeLoading.value = true;
  try {
    const result = await getDictTypeListApi({ ...typePage });
    typeRows.value = result.records;
    typeTotal.value = result.total;
  } finally {
    typeLoading.value = false;
  }
}

function openCreateType() {
  editingTypeId.value = null;
  Object.assign(typeForm, { dictName: '', dictType: '', status: 1 });
  typeFormVisible.value = true;
}

function openEditType(row: SysDictType) {
  editingTypeId.value = row.id ?? null;
  Object.assign(typeForm, {
    dictName: row.dictName ?? '',
    dictType: row.dictType ?? '',
    status: row.status ?? 1,
    version: row.version,
  });
  typeFormVisible.value = true;
}

async function submitType() {
  await typeFormRef.value?.validate();
  typeSubmitting.value = true;
  try {
    await (editingTypeId.value === null
      ? createDictTypeApi({ ...typeForm })
      : updateDictTypeApi(editingTypeId.value, { ...typeForm }));
    ElMessage.success(editingTypeId.value === null ? '新增成功' : '保存成功');
    typeFormVisible.value = false;
    await loadTypes();
  } finally {
    typeSubmitting.value = false;
  }
}

function askDeleteType(row: SysDictType) {
  deletingTypeId.value = row.id ?? null;
  typeConfirmVisible.value = true;
}

async function confirmDeleteType() {
  if (deletingTypeId.value === null) {
    return;
  }
  typeSubmitting.value = true;
  try {
    const row = typeRows.value.find((item) => item.id === deletingTypeId.value);
    await deleteDictTypeApi(deletingTypeId.value);
    ElMessage.success('删除成功');
    typeConfirmVisible.value = false;
    if (row?.dictType === selectedType.value) {
      selectedType.value = null;
    }
    await loadTypes();
  } finally {
    typeSubmitting.value = false;
  }
}

function onSelectType(row: null | SysDictType) {
  selectedType.value = row?.dictType ?? null;
}

// ------------------------------------------------------------------ 字典数据

const dataLoading = ref(false);
/**
 * 后端未按 dictType 做服务端过滤，整批拉取（size=500）后客户端按选中类型过滤，
 * 见 api/index.ts 的 getDictDataListApi 注释。
 */
const allDictData = ref<SysDictData[]>([]);

const filteredDictData = computed(() =>
  selectedType.value === null
    ? []
    : allDictData.value.filter((item) => item.dictType === selectedType.value),
);

const dataFormVisible = ref(false);
const dataSubmitting = ref(false);
const editingDataId = ref<null | number>(null);
const dataFormRef = ref();

const dataForm = reactive<DictDataForm>({
  dictLabel: '',
  dictType: '',
  dictValue: '',
  sort: 0,
  status: 1,
});

const dataRules = {
  dictLabel: [{ required: true, message: '请输入字典标签', trigger: 'blur' }],
  dictValue: [{ required: true, message: '请输入字典键值', trigger: 'blur' }],
};

const dataConfirmVisible = ref(false);
const deletingDataId = ref<null | number>(null);

async function loadAllDictData() {
  dataLoading.value = true;
  try {
    const result = await getDictDataListApi({ current: 1, size: 500 });
    allDictData.value = result.records;
  } finally {
    dataLoading.value = false;
  }
}

function openCreateData() {
  if (selectedType.value === null) {
    return;
  }
  editingDataId.value = null;
  Object.assign(dataForm, {
    dictLabel: '',
    dictType: selectedType.value,
    dictValue: '',
    sort: 0,
    status: 1,
  });
  dataFormVisible.value = true;
}

function openEditData(row: SysDictData) {
  editingDataId.value = row.id ?? null;
  Object.assign(dataForm, {
    dictLabel: row.dictLabel ?? '',
    dictType: row.dictType ?? '',
    dictValue: row.dictValue ?? '',
    sort: row.sort ?? 0,
    status: row.status ?? 1,
    version: row.version,
  });
  dataFormVisible.value = true;
}

async function submitData() {
  await dataFormRef.value?.validate();
  dataSubmitting.value = true;
  try {
    await (editingDataId.value === null
      ? createDictDataApi({ ...dataForm })
      : updateDictDataApi(editingDataId.value, { ...dataForm }));
    ElMessage.success(editingDataId.value === null ? '新增成功' : '保存成功');
    dataFormVisible.value = false;
    await loadAllDictData();
  } finally {
    dataSubmitting.value = false;
  }
}

function askDeleteData(row: SysDictData) {
  deletingDataId.value = row.id ?? null;
  dataConfirmVisible.value = true;
}

async function confirmDeleteData() {
  if (deletingDataId.value === null) {
    return;
  }
  dataSubmitting.value = true;
  try {
    await deleteDictDataApi(deletingDataId.value);
    ElMessage.success('删除成功');
    dataConfirmVisible.value = false;
    await loadAllDictData();
  } finally {
    dataSubmitting.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadTypes(), loadAllDictData()]);
});
</script>

<template>
  <Page
    description="字典类型与字典数据由框架的 framework-system-starter 提供，byType 查询读穿 CacheProvider"
    title="字典管理"
  >
    <div class="flex gap-4">
      <div class="w-2/5">
        <div class="mb-2 flex items-center justify-between">
          <span class="font-medium">字典类型</span>
          <ElButton
            type="primary"
            size="small"
            data-testid="dict-type-add-btn"
            @click="openCreateType"
          >
            新增
          </ElButton>
        </div>

        <ElTable
          v-loading="typeLoading"
          :data="typeRows"
          row-key="id"
          highlight-current-row
          data-testid="dict-type-table"
          @current-change="onSelectType"
        >
          <ElTableColumn prop="dictName" label="字典名称" min-width="140" />
          <ElTableColumn prop="dictType" label="字典类型" min-width="140" />
          <ElTableColumn label="操作" width="140" fixed="right">
            <template #default="{ row }">
              <ElButton
                link
                type="primary"
                data-testid="dict-type-edit-btn"
                @click.stop="openEditType(row)"
              >
                编辑
              </ElButton>
              <ElButton
                link
                type="danger"
                data-testid="dict-type-delete-btn"
                @click.stop="askDeleteType(row)"
              >
                删除
              </ElButton>
            </template>
          </ElTableColumn>
        </ElTable>

        <div class="mt-4 flex justify-end">
          <ElPagination
            v-model:current-page="typePage.current"
            v-model:page-size="typePage.size"
            :total="typeTotal"
            :page-sizes="[10, 20, 50]"
            layout="total, prev, pager, next"
            small
            data-testid="dict-type-pagination"
            @current-change="loadTypes"
            @size-change="loadTypes"
          />
        </div>
      </div>

      <div class="flex-1">
        <div class="mb-2 flex items-center justify-between">
          <span class="font-medium">字典数据</span>
          <ElButton
            type="primary"
            size="small"
            :disabled="selectedType === null"
            data-testid="dict-data-add-btn"
            @click="openCreateData"
          >
            新增
          </ElButton>
        </div>

        <ElTable
          v-loading="dataLoading"
          :data="filteredDictData"
          row-key="id"
          :empty-text="
            selectedType === null ? '请先在左侧选择字典类型' : '暂无数据'
          "
          data-testid="dict-data-table"
        >
          <ElTableColumn prop="dictLabel" label="字典标签" min-width="140" />
          <ElTableColumn prop="dictValue" label="字典键值" min-width="140" />
          <ElTableColumn prop="sort" label="排序" width="80" />
          <ElTableColumn label="状态" width="90">
            <template #default="{ row }">
              {{ row.status === 1 ? '启用' : '停用' }}
            </template>
          </ElTableColumn>
          <ElTableColumn label="操作" width="140" fixed="right">
            <template #default="{ row }">
              <ElButton
                link
                type="primary"
                data-testid="dict-data-edit-btn"
                @click="openEditData(row)"
              >
                编辑
              </ElButton>
              <ElButton
                link
                type="danger"
                data-testid="dict-data-delete-btn"
                @click="askDeleteData(row)"
              >
                删除
              </ElButton>
            </template>
          </ElTableColumn>
        </ElTable>
      </div>
    </div>

    <ElDialog
      v-model="typeFormVisible"
      :title="editingTypeId === null ? '新增字典类型' : '编辑字典类型'"
      width="480px"
      append-to-body
      data-testid="dict-type-form-dialog"
    >
      <ElForm
        ref="typeFormRef"
        :model="typeForm"
        :rules="typeRules"
        label-width="90px"
      >
        <ElFormItem label="字典名称" prop="dictName">
          <ElInput
            v-model="typeForm.dictName"
            data-testid="dict-type-dict-name-input"
            placeholder="请输入字典名称"
          />
        </ElFormItem>
        <ElFormItem label="字典类型" prop="dictType">
          <ElInput
            v-model="typeForm.dictType"
            :disabled="editingTypeId !== null"
            data-testid="dict-type-dict-type-input"
            placeholder="如 sys_common_status，创建后不可修改"
          />
        </ElFormItem>
        <ElFormItem label="状态" prop="status">
          <ElSwitch
            v-model="typeForm.status"
            :active-value="1"
            :inactive-value="0"
            data-testid="dict-type-status-input"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton
          data-testid="dict-type-cancel-btn"
          @click="typeFormVisible = false"
        >
          取消
        </ElButton>
        <ElButton
          type="primary"
          :loading="typeSubmitting"
          data-testid="dict-type-submit-btn"
          @click="submitType"
        >
          确定
        </ElButton>
      </template>
    </ElDialog>

    <ElDialog
      v-model="dataFormVisible"
      :title="editingDataId === null ? '新增字典数据' : '编辑字典数据'"
      width="480px"
      append-to-body
      data-testid="dict-data-form-dialog"
    >
      <ElForm
        ref="dataFormRef"
        :model="dataForm"
        :rules="dataRules"
        label-width="90px"
      >
        <ElFormItem label="字典类型">
          <ElInput :model-value="dataForm.dictType" disabled />
        </ElFormItem>
        <ElFormItem label="字典标签" prop="dictLabel">
          <ElInput
            v-model="dataForm.dictLabel"
            data-testid="dict-data-dict-label-input"
            placeholder="请输入字典标签"
          />
        </ElFormItem>
        <ElFormItem label="字典键值" prop="dictValue">
          <ElInput
            v-model="dataForm.dictValue"
            data-testid="dict-data-dict-value-input"
            placeholder="请输入字典键值"
          />
        </ElFormItem>
        <ElFormItem label="排序" prop="sort">
          <ElInputNumber
            v-model="dataForm.sort"
            :min="0"
            data-testid="dict-data-sort-input"
          />
        </ElFormItem>
        <ElFormItem label="状态" prop="status">
          <ElSwitch
            v-model="dataForm.status"
            :active-value="1"
            :inactive-value="0"
            data-testid="dict-data-status-input"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton
          data-testid="dict-data-cancel-btn"
          @click="dataFormVisible = false"
        >
          取消
        </ElButton>
        <ElButton
          type="primary"
          :loading="dataSubmitting"
          data-testid="dict-data-submit-btn"
          @click="submitData"
        >
          确定
        </ElButton>
      </template>
    </ElDialog>

    <ConfirmDialog
      v-model="typeConfirmVisible"
      testid="dict-type"
      :loading="typeSubmitting"
      message="删除字典类型不会连带删除其下的字典数据，确定继续？"
      @confirm="confirmDeleteType"
    />

    <ConfirmDialog
      v-model="dataConfirmVisible"
      testid="dict-data"
      :loading="dataSubmitting"
      @confirm="confirmDeleteData"
    />
  </Page>
</template>
