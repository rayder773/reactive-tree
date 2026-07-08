import type { Component } from 'vue'
import CounterApp from './apps/counter/App.vue'
import { counter } from './apps/counter/tree'
import PartSearchApp from './apps/part-search/App.vue'
import { display as partSearchDisplay } from './apps/part-search/display'
import { tree as partSearchTree } from './apps/part-search/tree'
import UploadWizardApp from './apps/upload-wizard/App.vue'
import { wizardDisplay } from './apps/upload-wizard/display'
import { wizard } from './apps/upload-wizard/tree'

export interface AppEntry {
	id: string
	label: string
	tree: any
	display?: any
	component: Component
}

export const apps: AppEntry[] = [
	{
		id: 'upload-wizard',
		label: 'Upload Wizard',
		tree: wizard,
		display: wizardDisplay,
		component: UploadWizardApp,
	},
	{
		id: 'counter',
		label: 'Counter',
		tree: counter,
		component: CounterApp,
	},
	{
		id: 'part-search',
		label: 'Part Search',
		tree: partSearchTree,
		display: partSearchDisplay,
		component: PartSearchApp,
	},
]
