import { createDisplayTree, createI18nPlugin, form, input, valuesFrom, when } from '../../../../../src'
import { type ApprovedAction, type UploadType, wizard } from './tree'

export const wizardDisplay = createDisplayTree(wizard, ({ i18n }) => ({

  uploadForm: form({

    uploadType: input({
      source: () => wizard.uploadType,
      showError: (self) => self.touched.value && wizard.uploadType.invalid.value,
      errorMessage: () => wizard.uploadType.errors.value[0]?.message,
      options: () => valuesFrom<UploadType>(wizard.uploadType).map(v => ({
        value: v,
        label: i18n.t.value.uploadType[v],
      })),
    }),

    approvedAction: when(
      () => wizard.approvedAction !== undefined,
      () => input({
        source: () => wizard.approvedAction,
        showError: (self) => self.touched.value && wizard.approvedAction!.invalid.value,
        errorMessage: () => wizard.approvedAction!.errors.value[0]?.message,
        options: () => valuesFrom<ApprovedAction>(wizard.approvedAction!).map(v => ({
          value: v,
          label: i18n.t.value.approvedAction[v],
        })),
      }),
    ),

    file: input({
      source: () => wizard.file,
      showError: (self) => self.touched.value && wizard.file.invalid.value,
      errorMessage: () => wizard.file.errors.value[0]?.message,
      dirty: () => wizard.file.value !== null,
    }),

  }),

}), {
  plugins: {
    i18n: createI18nPlugin({
      defaultLocale: 'en',
      messages: {
        en: {
          uploadType: {
            approvedVendorList: 'Approved vendor list',
            customPartData: 'Custom part data',
          },
          approvedAction: {
            createNew: 'Create new',
            replaceExisting: 'Replace existing',
          },
        },
        uk: {
          uploadType: {
            approvedVendorList: 'Список постачальників',
            customPartData: 'Кастомні дані',
          },
          approvedAction: {
            createNew: 'Створити новий',
            replaceExisting: 'Замінити існуючий',
          },
        },
      },
    }),
  },
})
