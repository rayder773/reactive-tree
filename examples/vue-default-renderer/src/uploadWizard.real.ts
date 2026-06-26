import { asyncNode, type AsyncNode, createTree, type FileData, fileType, oneOf, section, state, type StateNode, when } from "../../../src";
import { createSimAdapter, error, loading, success } from '../../../src/adapters/sim'

export const wizard = createTree({
	currentStep: state<UploadStep>('upload', {
		label: 'Current step',
		checks: [oneOf(['upload', 'mapping', 'result'])],
	}),

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
		checks: [fileType(['xlsx', 'xls', 'csv', 'png', 'pdf'])],
	}),

	uploadedFileId: asyncNode<{ id: string }, FileData>({
		label: 'Uploaded file ID',
		trigger: (self: WizardSelf) => self.file.value,
	}),

	test: section({
		testState: state<string>('test value', {
			id: 'test-state'
		}),
		innerSection: section({
			innerState: state<string>('inner value', {
				id: 'inner-state'
			})
		}, {
			id: 'inner-section',
		})
	}, {
		id: 'test-section',
	})
})

type WizardSelf = {
	currentStep: StateNode<UploadStep>
	uploadType: StateNode<UploadType>
	approvedAction?: StateNode<ApprovedAction>
	file: StateNode<FileData | null>
	uploadedFileId: AsyncNode<{ id: string }, FileData>
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
