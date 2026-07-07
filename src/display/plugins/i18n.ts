import type { ComputedRef, Ref } from 'vue'
import { computed, ref } from 'vue'

export interface I18nPlugin<TLocale extends string, TMessages extends object> {
	locale: { value: Ref<TLocale>; set(v: TLocale): void }
	t: ComputedRef<TMessages>
}

export function createI18nPlugin<
	TLocale extends string,
	TMessages extends object,
>(config: {
	defaultLocale: NoInfer<TLocale>
	messages: Record<TLocale, TMessages>
}): I18nPlugin<TLocale, TMessages> {
	const locale = ref<TLocale>(config.defaultLocale) as Ref<TLocale>
	const t = computed(() => config.messages[locale.value])

	return {
		locale: {
			value: locale,
			set: (v: TLocale) => {
				locale.value = v
			},
		},
		t,
	}
}
