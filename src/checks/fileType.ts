import type { CheckMode, FileData } from '../types'
import { check } from './check'
import { error } from './diagnostics'

export function fileType(
	extensions: readonly string[],
	options: { mode?: CheckMode } = {},
) {
	const normalized = extensions.map((extension) =>
		extension.replace(/^\./, '').toLowerCase(),
	)

	return check<FileData | null | undefined>(
		(value) => {
			if (!value) {
				return undefined
			}

			const name = typeof value.name === 'string' ? value.name : ''
			const extension = name.split('.').pop()?.toLowerCase()

			if (!extension || !normalized.includes(extension)) {
				return error('fileType', 'File type is not allowed', {
					allowed: normalized,
					value: extension,
				})
			}

			return undefined
		},
		{
			mode: options.mode ?? 'error',
			metadata: { kind: 'fileType', extensions: normalized },
		},
	)
}
