import { computed, createDisplayTree, form, input, when } from '../../../src'
import { wizard } from './uploadWizard.real'

export const wizardDisplay = createDisplayTree(wizard, () => ({
  uploadForm: form({
    uploadType: input({
      source: () => wizard.uploadType,
      showError: (self) => self.touched.value && wizard.uploadType.invalid.value,
      errorMessage: () => wizard.uploadType.errors.value[0]?.message,
    }),

    approvedAction: when(
      () => wizard.approvedAction !== undefined,
      () => input({
        source: () => wizard.approvedAction,
        showError: (self) => self.touched.value && wizard.approvedAction!.invalid.value,
        errorMessage: () => wizard.approvedAction!.errors.value[0]?.message,
      }),
    ),

    file: input({
      source: () => wizard.file,
      showError: (self) => self.touched.value && wizard.file.invalid.value,
      errorMessage: () => wizard.file.errors.value[0]?.message,
      dirty: () => wizard.file.value !== null,
    }),
  }),

  isFormValid: computed(() =>
    wizard.uploadType.valid.value &&
    (wizard.approvedAction === undefined || wizard.approvedAction.valid.value) &&
    wizard.file.valid.value &&
    wizard.uploadedFileId.value !== null,
  ),
}))
