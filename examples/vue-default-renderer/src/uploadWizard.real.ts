import { asyncNode, type AsyncNode, createTree, fileType, oneOf, state, type StateNode, when } from "../../../src";
import { createSimAdapter, error, loading, success } from '../../../src/adapters/sim'

export const wizard = createTree({
	currentStep: state<UploadStep>('upload', {
		label: 'Current step',
		checks: [oneOf(['upload', 'mapping', 'result'])],
	}),

	uploadType: state<UploadType>('approvedVendorList', {
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

	file: state<File | null>(null, {
		label: 'File',
		checks: [fileType(['xlsx', 'xls', 'csv'])],
	}),

	uploadedFileId: asyncNode<{ id: string }, File>({
		label: 'Uploaded file ID',
		trigger: (self: WizardSelf) => self.file.value,
	}),
})

type WizardSelf = {
	currentStep: StateNode<UploadStep>
	uploadType: StateNode<UploadType>
	approvedAction?: StateNode<ApprovedAction>
	file: StateNode<File | null>
	uploadedFileId: AsyncNode<{ id: string }, File>
}

type ApprovedAction = 'createNew' | 'replaceExisting'
type UploadType = 'approvedVendorList' | 'customPartData'
type UploadStep = 'upload' | 'mapping' | 'result'

const env = (import.meta as { env?: Record<string, string> }).env

createSimAdapter(wizard, [
	{
		node: wizard.uploadedFileId,
		activeScenario: env?.VITE_SIM_uploadedFileId,
		scenarios: {
			success: success({ id: 'file-abc-123' }, { delay: 1500 }),
			slow: success({ id: 'file-abc-123' }, { delay: 4000 }),
			error: error('Failed to upload file', { status: 500 }),
			loading: loading(),
		},
	},
], env?.VITE_SIM_SCENARIO)
