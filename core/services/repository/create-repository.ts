/// <reference types="vite/client" />

export type RepositoryScenarios<TRepository> = Readonly<Record<string, TRepository>> & {
  readonly 'happy-path': TRepository
}

export function createRepository<TRepository>(
  real: () => TRepository,
  scenarios: RepositoryScenarios<TRepository>,
  scenarioKey?: string,
): TRepository {
  if (import.meta.env.VITE_MOCK !== 'true') return real()

  const scenario = (scenarioKey ? import.meta.env[scenarioKey] : undefined)
    ?? import.meta.env.VITE_SCENARIO
    ?? 'happy-path'

  return scenarios[scenario] ?? scenarios['happy-path']
}
