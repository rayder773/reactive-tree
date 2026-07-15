import { describe, expect, it } from 'vitest'
import { createAppRuntime } from '../index'

interface Part {
	id: string
	name: string
}

const parts: readonly Part[] = [
	{ id: 'p-100', name: 'Control board' },
	{ id: 'p-200', name: 'Servo actuator' },
	{ id: 'p-300', name: 'Pressure sensor' },
]

describe('MappedList', () => {
	it('stores and replaces entities in a shared map', () => {
		const mapped = createParts()

		mapped.set(parts[0])
		mapped.set({ id: 'p-100', name: 'Updated board' })
		mapped.setMany([parts[1], parts[2]])

		expect(mapped.get('p-100')).toEqual({
			id: 'p-100',
			name: 'Updated board',
		})
		expect(mapped.has('p-200')).toBe(true)
		expect(mapped.values()).toEqual([
			{ id: 'p-100', name: 'Updated board' },
			parts[1],
			parts[2],
		])

		mapped.delete('p-200')
		expect(mapped.has('p-200')).toBe(false)

		mapped.clear()
		expect(mapped.values()).toEqual([])
	})

	it('caches list objects by normalized keys and default key', () => {
		const mapped = createParts()

		expect(mapped.list('main')).toBe(mapped.list('main'))
		expect(mapped.list(['parts', 'main'])).toBe(mapped.list(['main', 'parts']))
		expect(mapped.list()).toBe(mapped.list())
		expect(mapped.list('main')).not.toBe(mapped.list('search'))
	})

	it('sets list entities as ordered unique ids without changing other lists', () => {
		const mapped = createParts()
		const main = mapped.list('main')
		const search = mapped.list('search')

		search.set([parts[2]])
		main.set([parts[0], parts[1], parts[0]])

		expect(main.getIds()).toEqual(['p-100', 'p-200'])
		expect(main.get()).toEqual([parts[0], parts[1]])
		expect(search.getIds()).toEqual(['p-300'])
		expect(
			mapped
				.values()
				.map((part) => part.id)
				.sort(),
		).toEqual(['p-100', 'p-200', 'p-300'])
	})

	it('returns updated shared entities from every list', () => {
		const mapped = createParts()

		mapped.list('main').set([parts[0], parts[1]])
		mapped.list('search').set([parts[1], parts[2]])
		mapped.set({ id: 'p-200', name: 'Updated actuator' })

		expect(mapped.list('main').get()[1]).toEqual({
			id: 'p-200',
			name: 'Updated actuator',
		})
		expect(mapped.list('search').get()[0]).toEqual({
			id: 'p-200',
			name: 'Updated actuator',
		})
	})

	it('sets ids only when all referenced entities exist', () => {
		const mapped = createParts()
		const list = mapped.list('main')

		mapped.setMany(parts)
		list.setIds(['p-200', 'p-100', 'p-200'])

		expect(list.getIds()).toEqual(['p-200', 'p-100'])
		expect(() => list.setIds(['p-300', 'p-404'])).toThrow(
			'Parts list cannot reference missing entity: p-404',
		)
	})

	it('appends entities and ids without duplicates', () => {
		const mapped = createParts()
		const list = mapped.list('main')

		list.set([parts[0]])
		list.append([parts[1], parts[0], parts[2]])
		list.appendIds(['p-300', 'p-100'])

		expect(list.getIds()).toEqual(['p-100', 'p-200', 'p-300'])
		expect(list.get()).toEqual(parts)
	})

	it('removes deleted entity ids from all lists', () => {
		const mapped = createParts()

		mapped.list('main').set([parts[0], parts[1]])
		mapped.list('search').set([parts[1], parts[2]])
		mapped.delete('p-200')

		expect(mapped.list('main').getIds()).toEqual(['p-100'])
		expect(mapped.list('search').getIds()).toEqual(['p-300'])
	})

	it('deletes one list without deleting entities or other lists', () => {
		const mapped = createParts()
		const main = mapped.list('main')
		const search = mapped.list('search')

		main.set([parts[0], parts[1]])
		search.set([parts[2]])
		mapped.deleteList('main')

		expect(mapped.values()).toEqual(parts)
		expect(mapped.list('search')).toBe(search)
		expect(mapped.list('search').getIds()).toEqual(['p-300'])
		expect(mapped.list('main')).not.toBe(main)
		expect(mapped.list('main').getIds()).toEqual([])
	})
})

function createParts() {
	return createAppRuntime().createMappedList<Part>({
		name: 'Parts',
		getId: (part) => part.id,
	})
}
