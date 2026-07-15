/// <reference types="vite/client" />

export function createRepository<T>(
	real: () => T,
	scenarios: Record<string, T>,
	scenarioKey?: string,
): T {
	console.log('[mock] VITE_MOCK =', import.meta.env.VITE_MOCK)
	if (import.meta.env.VITE_MOCK !== 'true') {
		return real()
	}

	const scenario =
		(scenarioKey !== undefined ? import.meta.env[scenarioKey] : undefined) ??
		import.meta.env.VITE_SCENARIO ??
		'happy-path'

	return scenarios[scenario] ?? scenarios['happy-path']
}
