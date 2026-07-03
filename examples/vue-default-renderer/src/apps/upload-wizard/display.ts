import { button, createDisplayTree, form, input, valuesFrom, when } from '../../../../../src'
import type { ButtonNode, FormNode, InputNode } from '../../../../../src'
import { i18nPlugin } from './i18n'
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
    label: () => i18n.t.value.submit,
    disabled: root => root.uploadForm.invalid.value,
    handlers: {
      click: wizard.currentStep.goNext,
    },
  }),

}), {
  plugins: {
    i18n: i18nPlugin,
  },
})
