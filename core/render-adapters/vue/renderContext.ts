import type { InjectionKey } from 'vue'
import type { RenderContext } from '../../ui'

export const RENDER_CTX_KEY: InjectionKey<RenderContext> =
	Symbol('ui-render-ctx')
