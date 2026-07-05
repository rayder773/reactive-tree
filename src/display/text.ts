export type TextGetter = () => string

export function text(getter: TextGetter): TextGetter {
  return getter
}
