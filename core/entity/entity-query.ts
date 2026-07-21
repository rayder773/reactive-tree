import type { ReadonlyData } from '../data'
import {
  AbortService,
  FilteringService,
  LoadingService,
  PaginationService,
  SortingService,
  type LoadingState,
  type PaginationState,
  type SortingState,
} from '../services'
import {
  ENTITY_STORE_INTERNAL,
  type EntityListPluginContext,
  type NoPluginKeyOverlap,
  type QueryApi,
} from './entity.types'

type EmptyApi = Record<never, never>
type QueryRunner<TEntity, TInput> = (input: TInput, signal: AbortSignal) => Promise<readonly TEntity[]>
type QueryWrapper<TEntity, TInput> = (next: QueryRunner<TEntity, TInput>) => QueryRunner<TEntity, TInput>

export interface QueryPluginContext<TEntity, TInput> {
  wrap(wrapper: QueryWrapper<TEntity, TInput>): void
  onDispose(callback: () => void): void
}

export interface QueryPlugin<TEntity, TInput, TAdded extends object> {
  install(context: QueryPluginContext<TEntity, TInput>): TAdded
}

export interface UniversalQueryPlugin<TAdded extends object> {
  install<TEntity, TInput>(context: QueryPluginContext<TEntity, TInput>): TAdded
}

export interface QueryRequestContext<TInput> {
  readonly input: TInput
  readonly signal: AbortSignal
}

export interface QuerySourcePlugin<TEntity, TInput, TServices extends object> {
  readonly kind: 'query-source'
  readonly membership: true
  install(context: EntityListPluginContext<TEntity, unknown>): QueryApi<TEntity, TInput, TServices>
}

const mergeApi = (target: object, api: object): void => {
  for (const key of Reflect.ownKeys(api)) {
    if (key in target) throw new Error(`Query plugin API key "${String(key)}" already exists`)
    Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(api, key) as PropertyDescriptor)
  }
}

export class QueryBuilder<TEntity, TInput = void, TServices extends object = EmptyApi> {
  readonly #plugins: ReadonlyArray<QueryPlugin<TEntity, TInput, object> | UniversalQueryPlugin<object>>

  constructor(plugins: ReadonlyArray<QueryPlugin<TEntity, TInput, object> | UniversalQueryPlugin<object>> = []) {
    this.#plugins = plugins
  }

  use<TAdded extends object>(
    plugin: (QueryPlugin<TEntity, TInput, TAdded> | UniversalQueryPlugin<TAdded>)
      & NoPluginKeyOverlap<TServices & QueryRequestContext<TInput>, TAdded>,
  ): QueryBuilder<TEntity, TInput, TServices & TAdded> {
    return new QueryBuilder<TEntity, TInput, TServices & TAdded>([...this.#plugins, plugin])
  }

  request(
    handler: (context: QueryRequestContext<TInput> & TServices) => Promise<readonly TEntity[]>,
  ): QuerySourcePlugin<TEntity, TInput, TServices> {
    const plugins = this.#plugins
    return {
      kind: 'query-source',
      membership: true,
      install(sourceContext) {
        const wrappers: Array<QueryWrapper<TEntity, TInput>> = []
        const disposeCallbacks: Array<() => void> = []
        const services: object = {}
        const pluginContext: QueryPluginContext<TEntity, TInput> = {
          wrap: (wrapper) => wrappers.push(wrapper),
          onDispose: (callback) => disposeCallbacks.push(callback),
        }
        for (const plugin of plugins) mergeApi(services, plugin.install(pluginContext))

        let generation = 0
        let disposed = false
        sourceContext.setMembershipSource(() => sourceContext.membership.get())
        const removeDeleted = sourceContext.store[ENTITY_STORE_INTERNAL].onDelete((id) => {
          sourceContext.setMembership(sourceContext.membership.get().filter((value) => !Object.is(value, id)))
        })
        const clearDeleted = sourceContext.store[ENTITY_STORE_INTERNAL].onClear(() => sourceContext.setMembership([]))
        sourceContext.onDispose(removeDeleted)
        sourceContext.onDispose(clearDeleted)
        sourceContext.onDispose(() => {
          disposed = true
          generation++
          for (const callback of [...disposeCallbacks].reverse()) callback()
        })

        let execute: QueryRunner<TEntity, TInput> = (input, signal) => handler({
          ...services as TServices,
          input,
          signal,
        })
        for (const wrapper of [...wrappers].reverse()) execute = wrapper(execute)

        const run = async (mode: 'replace' | 'append', input: TInput): Promise<readonly TEntity[]> => {
          if (disposed) throw new Error('Entity list query has been disposed')
          const currentGeneration = ++generation
          const entities = await execute(input, new AbortController().signal)
          if (currentGeneration !== generation) return entities
          sourceContext.store.upsertMany(entities)
          const ids = entities.map(sourceContext.getId)
          if (mode === 'replace') sourceContext.setMembership([...new Set(ids)])
          else {
            const current = sourceContext.membership.get()
            const additions = [...new Set(ids)].filter((id) => !current.some((value) => Object.is(value, id)))
            sourceContext.setMembership([...current, ...additions])
          }
          return entities
        }

        const queryFacade = services as TServices & {
          replace(input?: TInput): Promise<readonly TEntity[]>
          append(input?: TInput): Promise<readonly TEntity[]>
        }
        Object.defineProperties(queryFacade, {
          replace: { value: (input?: TInput) => run('replace', input as TInput) },
          append: { value: (input?: TInput) => run('append', input as TInput) },
        })
        return { query: queryFacade } as QueryApi<TEntity, TInput, TServices>
      },
    }
  }
}

export const query = <TEntity, TInput = void>(): QueryBuilder<TEntity, TInput> => new QueryBuilder<TEntity, TInput>()

export interface QueryLoadingApi {
  readonly loading: {
    readonly state: ReadonlyData<LoadingState>
    reset(): void
  }
}

export const queryLoading = (): UniversalQueryPlugin<QueryLoadingApi> => ({
  install(context) {
    const service = new LoadingService<'request'>()
    context.wrap((next) => (input, signal) => service.run('request', () => next(input, signal)))
    context.onDispose(() => service.dispose())
    return { loading: { state: service.state('request'), reset: () => service.reset('request') } }
  },
})

export interface QueryAbortApi { readonly abort: { abort(): void } }

export const queryAbort = (): UniversalQueryPlugin<QueryAbortApi> => ({
  install(context) {
    const service = new AbortService<'request'>()
    context.wrap((next) => (input) => service.run('request', (signal) => next(input, signal)))
    context.onDispose(() => service.dispose())
    return { abort: { abort: () => service.abort('request') } }
  },
})

export interface QuerySortingApi<TField> { readonly sorting: SortingService<TField> }
export const querySorting = <TField>(
  initial: SortingState<TField>,
): UniversalQueryPlugin<QuerySortingApi<TField>> => ({
  install: () => ({ sorting: new SortingService(initial) }),
})

export interface QueryFilteringApi<TFilters extends object> { readonly filtering: FilteringService<TFilters> }
export const queryFiltering = <TFilters extends object>(
  initial: TFilters,
): UniversalQueryPlugin<QueryFilteringApi<TFilters>> => ({
  install: () => ({ filtering: new FilteringService(initial) }),
})

export interface QueryPaginationApi { readonly pagination: PaginationService }
export const queryPagination = (
  initial: Partial<PaginationState> = {},
): UniversalQueryPlugin<QueryPaginationApi> => ({
  install: () => ({ pagination: new PaginationService(initial) }),
})
