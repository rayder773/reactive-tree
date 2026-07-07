import { createI18nPlugin } from '../../../../../src'

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
			mapping: {
				field: 'Field',
				csvColumn: 'CSV Column',
				mpn: 'MPN',
				manufacturer: 'Manufacturer',
				ipn: 'IPN',
				notMapped: 'Not mapped',
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
			mapping: {
				field: 'Поле',
				csvColumn: 'Колонка CSV',
				mpn: 'MPN',
				manufacturer: 'Виробник',
				ipn: 'IPN',
				notMapped: 'Не змаповано',
			},
		},
	},
})
