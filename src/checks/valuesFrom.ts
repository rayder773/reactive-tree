import type { Check } from '../types'

type ValuesMetadata<T> = {
  kind: 'oneOf' | 'manyOf'
  values: readonly T[] | ((self: any) => readonly T[])
}

function isValuesMetadata(metadata: unknown): metadata is ValuesMetadata<unknown> {
  return (
    typeof metadata === 'object'
    && metadata !== null
    && 'kind' in metadata
    && ((metadata as any).kind === 'oneOf' || (metadata as any).kind === 'manyOf')
    && 'values' in metadata
  )
}

export function valuesFrom<T = unknown>(
  node: { checks?: readonly (Check<any> | null | undefined | false)[] },
  root?: any,
): readonly T[] {
  const match = node.checks?.find(c => c && isValuesMetadata(c.metadata))
  if (!match || !isValuesMetadata(match.metadata)) return []
  const { values } = match.metadata as ValuesMetadata<T>
  return typeof values === 'function' ? values(root) : values
}
