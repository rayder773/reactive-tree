import {
  computed,
  createTree,
  fileType,
  oneOf,
  record,
  required,
  section,
  state,
  when,
} from '../src'

export type UploadStep = 'upload' | 'mapping' | 'result'
export type UploadType = 'approvedVendorList' | 'customPartData'
export type ApprovedAction = 'createNew' | 'replaceExisting'

export interface UploadFile extends File {
  columns?: string[]
  rowsCount?: number
}

function parseColumns(file: UploadFile | null): string[] {
  return file?.columns ?? []
}

function parseRowsCount(file: UploadFile | null): number {
  return file?.rowsCount ?? 0
}

export const wizard = createTree({
  currentStep: state<UploadStep>('upload'),

  upload: section({
    uploadType: state<UploadType>('approvedVendorList', {
      label: 'Upload type',
      checks: [oneOf(['approvedVendorList', 'customPartData'] as const)],
    }),

    approvedAction: when(
      self => self.upload.uploadType.value === 'approvedVendorList',
      () =>
        state<ApprovedAction>('createNew', {
          label: 'Action',
          checks: [oneOf(['createNew', 'replaceExisting'] as const)],
        }),
    ),

    file: state<UploadFile | null>(null, {
      label: 'File',
      checks: [required(), fileType(['xlsx', 'xls', 'csv'])],
    }),
  }),

  filePreview: when(
    self => self.upload.file.value !== null,
    () =>
      section({
        columns: computed(self => parseColumns(self.upload.file.value)),
        rowsCount: computed(self => parseRowsCount(self.upload.file.value)),
      }),
  ),

  mapping: when(
    self =>
      self.currentStep.value === 'mapping' &&
      self.filePreview !== undefined,
    () =>
      section({
        targets: computed(self => {
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
          from: self => self.mapping.targets.value,
          key: target => target.key,
          item: target =>
            state<string | null>(null, {
              label: target.label,
              checks: [
                target.required ? required() : null,
                oneOf(self => self.filePreview.columns.value),
              ],
            }),
        }),
      }),
  ),

  canGoNext: computed(self => {
    if (self.currentStep.value === 'upload') {
      return self.upload.file.value !== null && self.upload.valid.value
    }

    if (self.currentStep.value === 'mapping') {
      return self.mapping?.valid.value === true
    }

    return false
  }),
})
