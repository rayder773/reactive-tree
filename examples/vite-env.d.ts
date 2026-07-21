/// <reference types="vite/client" />

type MockScenario = 'happy-path' | 'empty' | 'server-error' | 'loading' | 'not-found'

interface ImportMetaEnv {
  readonly VITE_MOCK?: 'true' | 'false'
  readonly VITE_SCENARIO?: MockScenario
  readonly VITE_PARTS_SCENARIO?: MockScenario
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent
  export default component
}
