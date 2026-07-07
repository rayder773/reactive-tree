import {
	type AsyncNode,
	createTree,
	type FileData,
	fileType,
	oneOf,
	preserveTreeSnapshotOnHmr,
	record,
	type RecordNode,
	required,
	type StateNode,
	state,
	when,
	withActions,
	withWatch,
} from '../../../../../src'
import { type ColumnSuggestion, columnSuggestions } from './column-suggestions'
import { uploadedFileId } from './wizard.async'

export const NOT_MAPPED = 'NOT_MAPPED' as const

export type ApprovedAction = 'createNew' | 'replaceExisting'
export type UploadType = 'approvedVendorList' | 'customPartData'
export type UploadStep = 'upload' | 'mapping' | 'result'

export type Wizard = {
	currentStep: StateNode<UploadStep> & { goNext(): void; goPrev(): void }
	uploadType: StateNode<UploadType>
	approvedAction?: StateNode<ApprovedAction>
	file: StateNode<FileData | null>
	uploadedFileId: AsyncNode<{ id: string }, FileData>
	columnSuggestions: AsyncNode<ColumnSuggestion[], { id: string }>
	generalMapping: {
		mpn: StateNode<string>
		manufacturer: StateNode<string>
		ipn: StateNode<string>
	}
	customFormFields?: RecordNode<StateNode<string>>
}

function createWizard() {
	return createTree({
		currentStep: withActions(
			state<UploadStep>('upload', {
				label: 'Current step',
				checks: [oneOf(['upload', 'mapping', 'result'])],
			}),
			{
				goNext: (self) => {
					const steps: UploadStep[] = ['upload', 'mapping', 'result']
					const idx = steps.indexOf(self.value)
					self.set(steps[Math.min(idx + 1, steps.length - 1)])
				},
				goPrev: (self) => {
					const steps: UploadStep[] = ['upload', 'mapping', 'result']
					const idx = steps.indexOf(self.value)
					self.set(steps[Math.max(idx - 1, 0)])
				},
			},
		),

		uploadType: state<UploadType>('approvedVendorList', {
			id: 'upload-type',
			label: 'Upload type',
			checks: [oneOf(['approvedVendorList', 'customPartData'])],
		}),

		approvedAction: when(
			(self: Wizard) => self.uploadType.value === 'approvedVendorList',
			() =>
				state<ApprovedAction>('createNew', {
					label: 'Action',
					checks: [oneOf(['createNew', 'replaceExisting'])],
				}),
		),

		file: state<FileData | null>(null, {
			label: 'File',
			checks: [required(), fileType(['csv'])],
		}),

		generalMapping: {
			mpn: withWatch(
				state<string>(NOT_MAPPED, {
					label: 'MPN column',
					checks: [
						oneOf((root: Wizard) => [
							NOT_MAPPED,
							...(root.columnSuggestions.value?.map((c) => c.name) ?? []),
						]),
					],
				}),
				[
					(root: Wizard) =>
						root.columnSuggestions.value?.find((c) => c.mappedTo === 'mpn')
							?.name,
				],
			),

			manufacturer: withWatch(
				state<string>(NOT_MAPPED, {
					label: 'Manufacturer column',
					checks: [
						oneOf((root: Wizard) => [
							NOT_MAPPED,
							...(root.columnSuggestions.value?.map((c) => c.name) ?? []),
						]),
					],
				}),
				[
					(root: Wizard) =>
						root.columnSuggestions.value?.find(
							(c) => c.mappedTo === 'manufacturer',
						)?.name,
				],
			),

			ipn: withWatch(
				state<string>(NOT_MAPPED, {
					label: 'IPN column',
					checks: [
						oneOf((root: Wizard) => [
							NOT_MAPPED,
							...(root.columnSuggestions.value?.map((c) => c.name) ?? []),
						]),
					],
				}),
				[
					(root: Wizard) =>
						root.columnSuggestions.value?.find((c) => c.mappedTo === 'ipn')
							?.name,
				],
			),
		},
		customFormFields: when(
			(self: Wizard) => self.uploadType.value === 'customPartData',
			() =>
				record<ColumnSuggestion, string, StateNode<string>>({
					from: (self: Wizard) =>
						(self.columnSuggestions.value ?? []).filter(
							(c) => c.mappedTo === null,
						),
					key: (c) => c.name,
					item: (c) =>
						state<string>(NOT_MAPPED, {
							label: c.name,
							checks: [
								oneOf((root: Wizard) => [
									NOT_MAPPED,
									...(root.columnSuggestions.value?.map((col) => col.name) ??
										[]),
								]),
							],
						}),
				}),
		),

		//Network requests
		uploadedFileId,
		columnSuggestions,
	})
}

export const wizard = preserveTreeSnapshotOnHmr(
	createWizard(),
	import.meta.hot,
	{
		key: 'wizardSnapshot',
	},
)
