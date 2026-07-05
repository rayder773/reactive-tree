import { type AsyncNode, createTree, type FileData, fileType, oneOf, required, state, type StateNode, withActions, withWatch, when } from "../../../../../src";
import { uploadedFileId } from './wizard.async'
import { columnSuggestions, type ColumnSuggestion } from './column-suggestions'

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
	mapping: {
		mpn: StateNode<string>
		manufacturer: StateNode<string>
		ipn: StateNode<string>
	}
}

export const wizard = createTree({
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

	uploadedFileId,

	columnSuggestions,

	mapping: {
		mpn: withWatch(
			state<string>(NOT_MAPPED, {
				label: 'MPN column',
				checks: [
					oneOf((root: Wizard) => [NOT_MAPPED, ...(root.columnSuggestions.value?.map(c => c.name) ?? [])]),
				],
			}),
			[(root: Wizard) => root.columnSuggestions.value?.find(c => c.mappedTo === 'mpn')?.name],
		),

		manufacturer: withWatch(
			state<string>(NOT_MAPPED, {
				label: 'Manufacturer column',
				checks: [
					oneOf((root: Wizard) => [NOT_MAPPED, ...(root.columnSuggestions.value?.map(c => c.name) ?? [])]),
				],
			}),
			[(root: Wizard) => root.columnSuggestions.value?.find(c => c.mappedTo === 'manufacturer')?.name],
		),

		ipn: withWatch(
			state<string>(NOT_MAPPED, {
				label: 'IPN column',
				checks: [
					oneOf((root: Wizard) => [NOT_MAPPED, ...(root.columnSuggestions.value?.map(c => c.name) ?? [])]),
				],
			}),
			[(root: Wizard) => root.columnSuggestions.value?.find(c => c.mappedTo === 'ipn')?.name],
		),
	},
})
