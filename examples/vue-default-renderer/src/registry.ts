import type { Component } from 'vue'
import { wizard } from './apps/upload-wizard/tree'
import { wizardDisplay } from './apps/upload-wizard/display'
import UploadWizardApp from './apps/upload-wizard/App.vue'
import { counter } from './apps/counter/tree'
import CounterApp from './apps/counter/App.vue'

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
]
