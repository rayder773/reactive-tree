import { createI18nPlugin } from "../../../../../src";

export const i18nPlugin = createI18nPlugin({
	defaultLocale: 'en',
	messages: {
		en: {
			submit: 'Upload',
			uploadType: {
				approvedVendorList: 'Approved vendor list',
				customPartData: 'Custom part data',
			},
			approvedAction: {
				createNew: 'Create new',
				replaceExisting: 'Replace existing',
			},
		},
		uk: {
			submit: 'Завантажити',
			uploadType: {
				approvedVendorList: 'Список постачальників',
				customPartData: 'Кастомні дані',
			},
			approvedAction: {
				createNew: 'Створити новий',
				replaceExisting: 'Замінити існуючий',
			},
		},
	},
})