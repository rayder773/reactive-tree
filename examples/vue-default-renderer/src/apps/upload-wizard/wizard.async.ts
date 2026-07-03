import { asyncNode, defineAsync, type FileData, type StateNode } from '../../../../../src'
import { error, loading, success } from '../../../../../src/adapters/sim'

type AsyncSelf = { file: StateNode<FileData | null> }

export const uploadedFileId = defineAsync(
	asyncNode<{ id: string }, FileData>({
		label: 'Uploaded file ID',
		trigger: (self: AsyncSelf) => self.file.value,
		payload: (self: AsyncSelf) => self.file.value!,
	}),
	{
		fetch: async (payload, signal) => {
			const form = new FormData()
			form.append('file', payload as unknown as Blob)
			const r = await fetch('/api/upload', { method: 'POST', body: form, signal })
			return r.json()
		},
		scenarios: {
			success: success({ id: 'file-abc-123' }, { delay: 1500 }),
			slow:    success({ id: 'file-abc-123' }, { delay: 4000 }),
			error:   error('Failed to upload file', { status: 500 }),
			loading: loading(),
		},
	},
)
