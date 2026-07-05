import { asyncNode, defineAsync } from '../../../../../src'
import { success } from '../../../../../src/adapters/sim'

export type KnownColumn = 'mpn' | 'manufacturer' | 'ipn'

export interface ColumnSuggestion {
  name: string
  mappedTo: KnownColumn | null
}

export async function fetchColumnSuggestions(_fileId: string): Promise<ColumnSuggestion[]> {
  const r = await fetch(`/api/column-suggestions?fileId=${_fileId}`)
  return r.json()
}

type AsyncSelf = { uploadedFileId: { value: { id: string } | null } }

const MOCK_SUGGESTIONS: ColumnSuggestion[] = [
  { name: 'Part Number', mappedTo: 'mpn' },
  { name: 'Vendor Name', mappedTo: 'manufacturer' },
  { name: 'Internal Part Number', mappedTo: 'ipn' },
  { name: 'Description', mappedTo: null },
  { name: 'Unit Price', mappedTo: null },
]

export const columnSuggestions = defineAsync(
  asyncNode<ColumnSuggestion[], { id: string }>({
    label: 'Column suggestions',
    trigger: (self: AsyncSelf) => self.uploadedFileId.value?.id,
    payload: (self: AsyncSelf) => self.uploadedFileId.value!,
  }),
  {
    fetch: async (payload) => fetchColumnSuggestions(payload.id),
    scenarios: {
      success: success(MOCK_SUGGESTIONS, { delay: 800 }),
    },
  },
)
