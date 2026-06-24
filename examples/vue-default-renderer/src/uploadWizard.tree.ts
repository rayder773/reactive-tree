import {
  type AsyncNode,
  asyncNode,
  type ComputedNode,
  computed,
  createTree,
  fileType,
  manyOf,
  oneOf,
  record,
  type RecordNode,
  section,
  type StateNode,
  state,
  when,
} from '../../../src'
import { createSimAdapter, error, loading, success } from '../../../src/adapters/sim'

type UploadStep = 'upload' | 'mapping' | 'result'
type UploadType = 'approvedVendorList' | 'customPartData'
type ApprovedAction = 'createNew' | 'replaceExisting'
type PreviewField = 'mpn' | 'manufacturer' | 'description' | 'category'

type MappingTarget = {
  key: PreviewField | 'imageUrl'
  label: string
  required: boolean
}

type ServerConfig = { maxFileSize: number; allowedTypes: string[] }

type WizardSelf = {
  currentStep: StateNode<UploadStep>
  serverConfig: AsyncNode<ServerConfig>
  upload: {
    uploadType: StateNode<UploadType>
    approvedAction?: StateNode<ApprovedAction>
    file: StateNode<File | null>
    previewFields: StateNode<PreviewField[]>
    valid: { value: boolean }
  }
  filePreview?: {
    columns: ComputedNode<string[]>
    rowsCount: ComputedNode<number>
  }
  mapping?: {
    targets: ComputedNode<readonly MappingTarget[]>
    columns: RecordNode<StateNode<string | null>, MappingTarget['key']>
    valid: { value: boolean }
  }
}

export const wizard = createTree({
  currentStep: state<UploadStep>('upload', {
    label: 'Current step',
    checks: [oneOf(['upload', 'mapping', 'result'])],
  }),

  serverConfig: asyncNode<ServerConfig>({ label: 'Server config' }),

  upload: section({
    uploadType: state<UploadType>(
      'approvedVendorList',
      {
        label: 'Upload type',
        checks: [oneOf(['approvedVendorList', 'customPartData'] as const)],
      },
    ),

    approvedAction: when(
      (self: WizardSelf) => self.upload.uploadType.value === 'approvedVendorList',
      () =>
        state<ApprovedAction>('createNew', {
          label: 'Action',
          checks: [oneOf(['createNew', 'replaceExisting'] as const)],
        }),
    ),

    file: state<File | null>(null, {
      label: 'File',
      checks: [fileType(['xlsx', 'xls', 'csv'])],
    }),

    previewFields: state<PreviewField[]>(
      ['mpn', 'manufacturer'],
      {
        label: 'Preview fields',
        checks: [
          manyOf(['mpn', 'manufacturer', 'description', 'category'] as const),
        ],
      },
    ),
  }),

  filePreview: when(
    (self: WizardSelf) => self.upload.file.value !== null,
    () =>
      section({
        columns: computed(() => ['MPN', 'Manufacturer', 'Description', 'Category']),
        rowsCount: computed(() => 100),
      }, {
        label: 'File preview 11',
      }),
  ),

  mapping: when(
    (self: WizardSelf) => {
      const isMappingStep = self.currentStep.value === 'mapping'
      const hasFilePreview = self.filePreview !== undefined

      return isMappingStep && hasFilePreview
    },
    () =>
      section({
        targets: computed((self: WizardSelf): readonly MappingTarget[] => {
          if (self.upload.uploadType.value === 'approvedVendorList') {
            return [
              { key: 'mpn', label: 'MPN', required: true },
              { key: 'manufacturer', label: 'Manufacturer', required: true },
            ] as const
          }

          return [
            { key: 'mpn', label: 'MPN', required: true },
            { key: 'manufacturer', label: 'Manufacturer', required: true },
            { key: 'description', label: 'Description', required: false },
            { key: 'category', label: 'Category', required: false },
            { key: 'imageUrl', label: 'Image URL', required: false },
          ] as const
        }),

        columns: record({
          from: (self: WizardSelf) => self.mapping?.targets.value ?? [],
          key: (target: MappingTarget) => target.key,
          item: (target: MappingTarget) =>
            state<string | null>(null, {
              label: target.label,
              checks: [oneOf((self: WizardSelf) => self.filePreview?.columns.value ?? [])],
            }),
        }),
      }),
  ),

  test1: computed((self: WizardSelf) => {
    return {
      step: self.currentStep.value,
      hasFilePreview: self.filePreview !== undefined,
      hasMapping: self.mapping !== undefined,
      columns: self.mapping?.columns.value ?? null,
    }
  }),

  canGoNext: computed((self: WizardSelf) => {
    if (self.currentStep.value === 'upload') {
      return self.upload.file.value !== null && self.upload.valid.value
    }

    if (self.currentStep.value === 'mapping') {
      return self.mapping?.valid.value === true
    }

    return false
  }),
})

const mockServerConfig: ServerConfig = { maxFileSize: 10485760, allowedTypes: ['xlsx', 'xls', 'csv'] }

const env = (import.meta as { env?: Record<string, string> }).env

createSimAdapter(wizard, [
  {
    node: wizard.serverConfig,
    activeScenario: env?.VITE_SIM_serverConfig,
    scenarios: {
      success: success(mockServerConfig, { delay: 1200 }),
      slow: success(mockServerConfig, { delay: 4000 }),
      error: error('Failed to load server config', { status: 503 }),
      loading: loading(),
    },
  },
], env?.VITE_SIM_SCENARIO)
