import type {
	ButtonNode,
	FormNode,
	InputNode,
	NodeSpec,
	RecordNode,
	StateNode,
	TableNode,
} from '../../../../../src'
import {
	button,
	createDisplayTree,
	disposeOnHmr,
	form,
	input,
	record,
	table,
	text,
	valuesFrom,
	when,
} from '../../../../../src'
import { i18nPlugin } from './i18n'
import {
	type ApprovedAction,
	NOT_MAPPED,
	type UploadType,
	wizard,
} from './tree'

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
		customFields: NodeSpec<RecordNode<InputNode>, true>
	}>
	submitButton: ButtonNode
}

function createWizardDisplay() {
	return createDisplayTree(
		wizard,
		({ i18n }) => ({
			uploadForm: form({
				uploadType: input({
					source: () => wizard.uploadType,
					options: () =>
						valuesFrom<UploadType>(wizard.uploadType).map((v) => ({
							value: v,
							label: i18n.t.value.uploadType[v],
						})),
				}),

				approvedAction: when(
					() => wizard.approvedAction !== undefined,
					() =>
						input({
							source: () => wizard.approvedAction,
							options: () =>
								valuesFrom<ApprovedAction>(wizard.approvedAction!).map((v) => ({
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
					{
						id: 'manufacturer',
						text: text(() => i18n.t.value.mapping.manufacturer),
					},
					{ id: 'ipn', text: text(() => i18n.t.value.mapping.ipn) },
					...Object.keys(
						wizard.customFormFields?.items.value ?? {},
					).map((name) => ({ id: name, text: name })),
				],
			}),

			mappingForm: form({
				mpn: input({
					source: () => wizard.generalMapping.mpn,
					options: () =>
						valuesFrom<string>(wizard.generalMapping.mpn, wizard).map((v) => ({
							value: v,
							label: v === NOT_MAPPED ? i18n.t.value.mapping.notMapped : v,
						})),
					disabled: () => wizard.columnSuggestions.status === 'loading',
				}),

				manufacturer: input({
					source: () => wizard.generalMapping.manufacturer,
					options: () =>
						valuesFrom<string>(wizard.generalMapping.manufacturer, wizard).map(
							(v) => ({
								value: v,
								label: v === NOT_MAPPED ? i18n.t.value.mapping.notMapped : v,
							}),
						),
					disabled: () => wizard.columnSuggestions.status === 'loading',
				}),

				ipn: input({
					source: () => wizard.generalMapping.ipn,
					options: () =>
						valuesFrom<string>(wizard.generalMapping.ipn, wizard).map((v) => ({
							value: v,
							label: v === NOT_MAPPED ? i18n.t.value.mapping.notMapped : v,
						})),
					disabled: () => wizard.columnSuggestions.status === 'loading',
				}),

				customFields: when(
					() => wizard.uploadType.value === 'customPartData',
					() =>
						record<
							[string, StateNode<string>],
							string,
							InputNode
						>({
							from: () =>
								Object.entries(
									(
										wizard.customFormFields as RecordNode<StateNode<string>>
									).items.value,
								),
							key: ([name]) => name,
							item: ([, stateNode]) =>
								input({
									source: () => stateNode,
									options: () =>
										valuesFrom<string>(stateNode, wizard).map((v) => ({
											value: v,
											label:
												v === NOT_MAPPED
													? i18n.t.value.mapping.notMapped
													: v,
										})),
									disabled: () =>
										wizard.columnSuggestions.status === 'loading',
								}),
						}),
				),
			}),

			submitButton: button<WizardDisplay>({
				text: text(() => i18n.t.value.submit),
				disabled: (root) => root.uploadForm.invalid.value,
				handlers: {
					click: wizard.currentStep.goNext,
				},
			}),
		}),
		{
			plugins: {
				i18n: i18nPlugin,
			},
		},
	)
}

export const wizardDisplay = disposeOnHmr(
	createWizardDisplay(),
	import.meta.hot,
)
