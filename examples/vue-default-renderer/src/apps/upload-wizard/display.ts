import { button, createDisplayTree, form, input, table, text, valuesFrom, when } from '../../../../../src'
import type { ButtonNode, FormNode, InputNode, TableNode } from '../../../../../src'
import { i18nPlugin } from './i18n'
import { type ApprovedAction, type UploadType, NOT_MAPPED, wizard } from './tree'

type WizardDisplay = {
  uploadForm: FormNode<{
    uploadType: InputNode
    approvedAction?: InputNode
    file: InputNode
  }>
  mappingTable: TableNode
  mappingForm: FormNode<{
    mpn: InputNode
    manufacturer: InputNode
    ipn: InputNode
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

  mappingTable: table({
    columns: () => [
      { id: 'label', text: text(() => i18n.t.value.mapping.field) },
      { id: 'select', text: text(() => i18n.t.value.mapping.csvColumn) },
    ],
    rows: () => [
      { id: 'mpn', text: text(() => i18n.t.value.mapping.mpn) },
      { id: 'manufacturer', text: text(() => i18n.t.value.mapping.manufacturer) },
      { id: 'ipn', text: text(() => i18n.t.value.mapping.ipn) },
    ],
  }),

  mappingForm: form({
    mpn: input({
      source: () => wizard.mapping.mpn,
      options: () => valuesFrom<string>(wizard.mapping.mpn, wizard).map(v => ({
        value: v,
        label: v === NOT_MAPPED ? i18n.t.value.mapping.notMapped : v,
      })),
    }),

    manufacturer: input({
      source: () => wizard.mapping.manufacturer,
      options: () => valuesFrom<string>(wizard.mapping.manufacturer, wizard).map(v => ({
        value: v,
        label: v === NOT_MAPPED ? i18n.t.value.mapping.notMapped : v,
      })),
    }),

    ipn: input({
      source: () => wizard.mapping.ipn,
      options: () => valuesFrom<string>(wizard.mapping.ipn, wizard).map(v => ({
        value: v,
        label: v === NOT_MAPPED ? i18n.t.value.mapping.notMapped : v,
      })),
    }),
  }),

  submitButton: button<WizardDisplay>({
    text: text(() => i18n.t.value.submit),
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

