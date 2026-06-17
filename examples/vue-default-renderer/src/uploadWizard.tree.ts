import {
  computed,
  createTree,
  fileType,
  manyOf,
  oneOf,
  record,
  section,
  state,
  when,
} from '../../../src'

export const wizard = createTree({
  currentStep: state<'upload' | 'mapping' | 'result'>('upload', {
    label: 'Current step',
    checks: [oneOf(['upload', 'mapping', 'result'] as const)],
  }),

  upload: section({
    uploadType: state<'approvedVendorList' | 'customPartData'>(
      'approvedVendorList',
      {
        label: 'Upload type',
        checks: [oneOf(['approvedVendorList', 'customPartData'] as const)],
      },
    ),

    approvedAction: when(
      self => self.upload.uploadType.value === 'approvedVendorList',
      () =>
        state<'createNew' | 'replaceExisting'>('createNew', {
          label: 'Action',
          checks: [oneOf(['createNew', 'replaceExisting'] as const)],
        }),
    ),

    file: state<File | null>(null, {
      label: 'File',
      checks: [fileType(['xlsx', 'xls', 'csv'])],
    }),

    previewFields: state<Array<'mpn' | 'manufacturer' | 'description' | 'category'>>(
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
    self => self.upload.file.value !== null,
    () =>
      section({
        columns: computed(() => ['MPN', 'Manufacturer', 'Description', 'Category']),
        rowsCount: computed(() => 100),
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
              checks: [oneOf(self => self.filePreview.columns.value)],
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
