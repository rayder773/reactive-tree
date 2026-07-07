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
	dynamicRows,
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
		({ i18n }, data) => ({
			uploadForm: form({
				uploadType: input({
					source: () => data.uploadType,
					options: () =>
						valuesFrom<UploadType>(data.uploadType).map((v) => ({
							value: v,
							label: i18n.t.value.uploadType[v],
						})),
				}),

				approvedAction: when(
					() => data.approvedAction !== undefined,
					() =>
						input({
							source: () => data.approvedAction,
							options: () =>
								valuesFrom<ApprovedAction>(data.approvedAction!).map((v) => ({
									value: v,
									label: i18n.t.value.approvedAction[v],
								})),
						}),
				),

				file: input({
					source: () => data.file,
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
					...dynamicRows(
						() => Object.keys(data.customFormFields?.items.value ?? {}),
						(name) => ({ id: name, text: text(() => name) }),
					),
				],
			}),

			mappingForm: form({
				mpn: input({
					source: () => data.generalMapping.mpn,
					options: () =>
						valuesFrom<string>(data.generalMapping.mpn, data).map((v) => ({
							value: v,
							label: v === NOT_MAPPED ? i18n.t.value.mapping.notMapped : v,
						})),
					disabled: () => data.columnSuggestions.status === 'loading',
				}),

				manufacturer: input({
					source: () => data.generalMapping.manufacturer,
					options: () =>
						valuesFrom<string>(data.generalMapping.manufacturer, data).map(
							(v) => ({
								value: v,
								label: v === NOT_MAPPED ? i18n.t.value.mapping.notMapped : v,
							}),
						),
					disabled: () => data.columnSuggestions.status === 'loading',
				}),

				ipn: input({
					source: () => data.generalMapping.ipn,
					options: () =>
						valuesFrom<string>(data.generalMapping.ipn, data).map((v) => ({
							value: v,
							label: v === NOT_MAPPED ? i18n.t.value.mapping.notMapped : v,
						})),
					disabled: () => data.columnSuggestions.status === 'loading',
				}),

				customFields: when(
					() => data.uploadType.value === 'customPartData',
					() =>
						record<[string, StateNode<string>], string, InputNode>({
							from: () =>
								Object.entries(
									(data.customFormFields as RecordNode<StateNode<string>>).items
										.value,
								),
							key: ([name]) => name,
							item: ([, stateNode]) =>
								input({
									source: () => stateNode,
									options: () =>
										valuesFrom<string>(stateNode, data).map((v) => ({
											value: v,
											label:
												v === NOT_MAPPED ? i18n.t.value.mapping.notMapped : v,
										})),
									disabled: () => data.columnSuggestions.status === 'loading',
								}),
						}),
				),
			}),

			submitButton: button<WizardDisplay>({
				text: text(() => i18n.t.value.submit),
				disabled: (root) => root.uploadForm.invalid.value,
				handlers: {
					click: data.currentStep.goNext,
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

export const wizardDisplay = createWizardDisplay()
