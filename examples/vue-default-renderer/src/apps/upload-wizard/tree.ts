import { type AsyncNode, createTree, type FileData, fileType, oneOf, required, state, type StateNode, withActions, when } from "../../../../../src";
import { uploadedFileId } from './wizard.async'

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
		(self: WizardSelf) => self.uploadType.value === 'approvedVendorList',
		() =>
			state<ApprovedAction>('createNew', {
				label: 'Action',
				checks: [oneOf(['createNew', 'replaceExisting'])],
			}),
	),

	file: state<FileData | null>(null, {
		label: 'File',
		checks: [required(), fileType(['xlsx', 'xls', 'csv', 'png', 'pdf'])],
	}),

	uploadedFileId,
})

type WizardSelf = {
	currentStep: StateNode<UploadStep>
	uploadType: StateNode<UploadType>
	approvedAction?: StateNode<ApprovedAction>
	file: StateNode<FileData | null>
	uploadedFileId: AsyncNode<{ id: string }, FileData>
}

export type ApprovedAction = 'createNew' | 'replaceExisting'
export type UploadType = 'approvedVendorList' | 'customPartData'
export type UploadStep = 'upload' | 'mapping' | 'result'
