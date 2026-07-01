import { button, createDisplayTree, createI18nPlugin, form, input, valuesFrom, when } from '../../../../../src'
import type { ButtonNode, FormNode, InputNode } from '../../../../../src'
import { type ApprovedAction, type UploadType, wizard } from './tree'

type WizardDisplay = {
  uploadForm: FormNode<{
    uploadType: InputNode
    approvedAction?: InputNode
    file: InputNode
  }>
  submitButton: ButtonNode
}

export const wizardDisplay = createDisplayTree(wizard, ({ i18n }) => ({

  uploadForm: form({

    uploadType: input({
      source: () => wizard.uploadType,
      options: () => valuesFrom<UploadType>(wizard.uploadType).map(v => ({
        value: v,
        label: i18n.t.value.uploadType[v],
      })),
    }),

    approvedAction: when(
      () => wizard.approvedAction !== undefined,
      () => input({
        source: () => wizard.approvedAction,
        options: () => valuesFrom<ApprovedAction>(wizard.approvedAction!).map(v => ({
          value: v,
          label: i18n.t.value.approvedAction[v],
        })),
      }),
    ),

    file: input({
      source: () => wizard.file,
    }),

  }),

  submitButton: button<WizardDisplay>({
    label: 'Upload',
    disabled: root => root.uploadForm.invalid.value,
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
