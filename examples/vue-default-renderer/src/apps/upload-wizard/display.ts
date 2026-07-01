import { computed, createDisplayTree, form, input, when } from '../../../../../src'
import { wizard } from './tree'

export const wizardDisplay = createDisplayTree(wizard, (data) => ({

  uploadForm: form({

    uploadType: input({
      source: (_self, data) => data.uploadType,
      showError: (self, data) => self.touched.value && data.uploadType.invalid.value,
      errorMessage: (self, data) => data.uploadType.errors.value[0]?.message,
    }),

    approvedAction: when(
      (_self, data) => data.approvedAction !== undefined,
      () => input({
        source: (_self, data) => data.approvedAction,
        showError: (self, data) => self.touched.value && data.approvedAction!.invalid.value,
        errorMessage: (self, data) => data.approvedAction!.errors.value[0]?.message,
      }),
    ),

    file: input({
      source: (_self, data) => data.file,
      showError: (self, data) => self.touched.value && data.file.invalid.value,
      errorMessage: (self, data) => data.file.errors.value[0]?.message,
      dirty: (_self, data) => data.file.value !== null,
    }),

  }),

  isFormValid: computed((self, data) =>
    data.uploadType.valid.value &&
    (data.approvedAction === undefined || data.approvedAction.valid.value) &&
    data.file.valid.value &&
    data.uploadedFileId.value !== null,
  ),

}))
