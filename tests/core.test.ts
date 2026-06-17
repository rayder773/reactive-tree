import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  check,
  computed,
  createTree,
  error,
  fileType,
  list,
  manyOf,
  maxLength,
  oneOf,
  record,
  required,
  section,
  state,
  switchNode,
  when,
} from '../src'
import type { StateNode } from '../src'

describe('reactive tree core', () => {
  it('state stores value, set and reset', () => {
    const tree = createTree({
      name: state('initial'),
    })

    expect(tree.name.value).toBe('initial')
    expect(tree.name.set('next')).toBe(true)
    expect(tree.name.value).toBe('next')
    tree.name.reset()
    expect(tree.name.value).toBe('initial')
  })

  it('state with oneOf block mode rejects invalid value', () => {
    const tree = createTree({
      status: state<'draft' | 'published'>('draft', {
        checks: [oneOf(['draft', 'published'] as const, { mode: 'block' })],
      }),
    })

    expect(tree.status.set('archived' as 'draft')).toBe(false)
    expect(tree.status.value).toBe('draft')
  })

  it('state with error check writes value and stores error', () => {
    const tree = createTree({
      title: state('', {
        checks: [maxLength(3)],
      }),
    })

    expect(tree.title.set('long')).toBe(true)
    expect(tree.title.value).toBe('long')
    expect(tree.title.errors.value).toMatchObject([
      { level: 'error', code: 'maxLength' },
    ])
    expect(tree.title.valid.value).toBe(false)
  })

  it('manyOf validates arrays of allowed values', () => {
    const tree = createTree({
      selected: state<Array<'mpn' | 'manufacturer' | 'category'>>(['mpn'], {
        checks: [manyOf(['mpn', 'manufacturer', 'category'] as const)],
      }),
    })

    expect(tree.selected.valid.value).toBe(true)
    tree.selected.set(['mpn', 'unknown' as 'mpn'])
    expect(tree.selected.errors.value).toMatchObject([{ code: 'manyOf' }])
    expect(tree.selected.valid.value).toBe(false)
  })

  it('computed recalculates when dependencies change', () => {
    const tree = createTree({
      count: state(1),
      doubled: computed(self => self.count.value * 2),
    })

    expect(tree.doubled.value).toBe(2)
    tree.count.set(4)
    expect(tree.doubled.value).toBe(8)
  })

  it('section aggregates value and errors', () => {
    const tree = createTree({
      user: section({
        name: state('', { checks: [required()] }),
        age: state(30),
      }),
    })

    expect(tree.user.value).toEqual({ name: '', age: 30 })
    expect(tree.user.valid.value).toBe(false)
    expect(tree.user.errors.value).toMatchObject([{ code: 'required' }])
  })

  it('when creates a node when condition is true', () => {
    const tree = createTree({
      enabled: state(true),
      details: when(
        self => self.enabled.value,
        () => state('visible'),
      ),
    })

    expect(tree.details?.value).toBe('visible')
  })

  it('when removes a node when condition is false', () => {
    const tree = createTree({
      enabled: state(true),
      details: when(
        self => self.enabled.value,
        () => state('visible'),
      ),
    })

    expect(tree.details).toBeDefined()
    tree.enabled.set(false)
    expect(tree.details).toBeUndefined()
    expect(tree.value).toEqual({ enabled: false })
  })

  it('when field is typed as optional', () => {
    const tree = createTree({
      enabled: state(false),
      details: when(
        self => self.enabled.value,
        () => state('visible'),
      ),
    })

    expectTypeOf(tree.details).toEqualTypeOf<StateNode<string> | undefined>()
  })

  it('switchNode switches branches', () => {
    const tree = createTree({
      mode: state<'a' | 'b'>('a'),
      branch: switchNode(self => self.mode.value, {
        a: () => section({ value: state('A') }),
        b: () => section({ value: state('B') }),
      }),
    })

    expect(tree.branch?.value).toEqual({ value: 'A' })
    tree.mode.set('b')
    expect(tree.branch?.value).toEqual({ value: 'B' })
  })

  it('list creates items from source', () => {
    const tree = createTree({
      rowsSource: state([{ id: 1 }, { id: 2 }]),
      rows: list({
        from: self => self.rowsSource.value,
        key: row => row.id,
        item: row => section({ id: state(row.id), selected: state(false) }),
      }),
    })

    expect(tree.rows.items.value).toHaveLength(2)
    expect(tree.rows.value).toEqual([
      { id: 1, selected: false },
      { id: 2, selected: false },
    ])
  })

  it('list preserves existing items by key', () => {
    const tree = createTree({
      rowsSource: state([{ id: 1 }, { id: 2 }]),
      rows: list({
        from: self => self.rowsSource.value,
        key: row => row.id,
        item: row => section({ id: state(row.id), selected: state(false) }),
      }),
    })

    tree.rows.byKey(2)?.selected.set(true)
    tree.rowsSource.set([{ id: 2 }, { id: 3 }])

    expect(tree.rows.byKey(2)?.selected.value).toBe(true)
    expect(tree.rows.byKey(3)?.selected.value).toBe(false)
  })

  it('list removes items missing from source', () => {
    const tree = createTree({
      rowsSource: state([{ id: 1 }, { id: 2 }]),
      rows: list({
        from: self => self.rowsSource.value,
        key: row => row.id,
        item: row => section({ id: state(row.id) }),
      }),
    })

    tree.rowsSource.set([{ id: 2 }])

    expect(tree.rows.items.value).toHaveLength(1)
    expect(tree.rows.byKey(1)).toBeUndefined()
    expect(tree.rows.byKey(2)?.value).toEqual({ id: 2 })
  })

  it('record creates object by keys', () => {
    const tree = createTree({
      targets: state([
        { key: 'mpn', label: 'MPN' },
        { key: 'manufacturer', label: 'Manufacturer' },
      ] as const),
      columns: record({
        from: self => self.targets.value,
        key: target => target.key,
        item: target => state<string | null>(target.label),
      }),
    })

    expect(tree.columns.value).toEqual({
      mpn: 'MPN',
      manufacturer: 'Manufacturer',
    })
    expect(tree.columns.mpn.value).toBe('MPN')
  })

  it('record.byKey works for dynamic keys', () => {
    const tree = createTree({
      targets: state([{ key: 'runtime', label: 'Runtime' }]),
      columns: record({
        from: self => self.targets.value,
        key: target => target.key,
        item: target => state(target.label),
      }),
    })

    expect(tree.columns.byKey('runtime')?.value).toBe('Runtime')
  })

  it('supports checks on section level', () => {
    const tree = createTree({
      upload: section(
        {
          file: state<string | null>(null),
        },
        {
          checks: [
            check(selfValue => {
              if (!selfValue.file) {
                return error('fileRequired', 'File is required')
              }
            }),
          ],
        },
      ),
    })

    expect(tree.upload.errors.value).toMatchObject([{ code: 'fileRequired' }])
    tree.upload.file.set('file.csv')
    expect(tree.upload.valid.value).toBe(true)
  })

  it('wizard example works end to end', () => {
    type UploadFile = File & { columns: string[]; rowsCount: number }

    const parseColumns = (file: UploadFile | null) => file?.columns ?? []
    const parseRowsCount = (file: UploadFile | null) => file?.rowsCount ?? 0
    const file = {
      name: 'parts.csv',
      columns: ['MPN', 'Manufacturer'],
      rowsCount: 2,
    } as UploadFile

    const wizard = createTree({
      currentStep: state<'upload' | 'mapping' | 'result'>('upload'),

      upload: section({
        uploadType: state<'approvedVendorList' | 'customPartData'>(
          'approvedVendorList',
          {
            label: 'Upload type',
            checks: [oneOf(['approvedVendorList', 'customPartData'] as const)],
          },
        ),

        approvedAction: when(
          self => self.upload.uploadType.value === 'approvedVendorList',
          () =>
            state<'createNew' | 'replaceExisting'>('createNew', {
              label: 'Action',
              checks: [oneOf(['createNew', 'replaceExisting'] as const)],
            }),
        ),

        file: state<UploadFile | null>(null, {
          label: 'File',
          checks: [required(), fileType(['xlsx', 'xls', 'csv'])],
        }),
      }),

      filePreview: when(
        self => self.upload.file.value !== null,
        () =>
          section({
            columns: computed(self => parseColumns(self.upload.file.value)),
            rowsCount: computed(self => parseRowsCount(self.upload.file.value)),
          }),
      ),

      mapping: when(
        self =>
          self.currentStep.value === 'mapping' &&
          self.filePreview !== undefined,
        () =>
          section({
            targets: computed(self => {
              if (self.upload.uploadType.value === 'approvedVendorList') {
                return [
                  { key: 'mpn', label: 'MPN', required: true },
                  { key: 'manufacturer', label: 'Manufacturer', required: true },
                ] as const
              }

              return [
                { key: 'mpn', label: 'MPN', required: true },
                { key: 'manufacturer', label: 'Manufacturer', required: true },
                { key: 'description', label: 'Description', required: false },
                { key: 'category', label: 'Category', required: false },
                { key: 'imageUrl', label: 'Image URL', required: false },
              ] as const
            }),

            columns: record({
              from: self => self.mapping.targets.value,
              key: target => target.key,
              item: target =>
                state<string | null>(null, {
                  label: target.label,
                  checks: [
                    target.required ? required() : null,
                    oneOf(self => self.filePreview.columns.value),
                  ],
                }),
            }),
          }),
      ),

      canGoNext: computed(self => {
        if (self.currentStep.value === 'upload') {
          return self.upload.file.value !== null && self.upload.valid.value
        }

        if (self.currentStep.value === 'mapping') {
          return self.mapping?.valid.value === true
        }

        return false
      }),
    })

    expectTypeOf(wizard.upload.uploadType.value).toEqualTypeOf<
      'approvedVendorList' | 'customPartData'
    >()
    expectTypeOf(wizard.upload.file.value).toEqualTypeOf<UploadFile | null>()
    expectTypeOf(wizard.mapping).toMatchTypeOf<unknown | undefined>()

    expect(wizard.upload.approvedAction?.value).toBe('createNew')
    wizard.upload.uploadType.set('customPartData')
    expect(wizard.upload.approvedAction).toBeUndefined()

    wizard.upload.file.set(file)
    expect(wizard.filePreview?.columns.value).toEqual(['MPN', 'Manufacturer'])
    expect(wizard.canGoNext.value).toBe(true)

    wizard.currentStep.set('mapping')
    expect(wizard.mapping).toBeDefined()
    expect(wizard.mapping?.valid.value).toBe(false)

    wizard.mapping?.columns.mpn.set('MPN')
    wizard.mapping?.columns.manufacturer.set('Manufacturer')

    expect(wizard.mapping?.errors.value).toEqual([])
    expect(wizard.canGoNext.value).toBe(true)
    expect(wizard.value).toMatchObject({
      currentStep: 'mapping',
      upload: {
        uploadType: 'customPartData',
        file,
      },
      filePreview: {
        columns: ['MPN', 'Manufacturer'],
        rowsCount: 2,
      },
      mapping: {
        columns: {
          mpn: 'MPN',
          manufacturer: 'Manufacturer',
        },
      },
      canGoNext: true,
    })
  })

  it('debug tracks computed reads of state.value', () => {
    const tree = createTree({
      source: state(1),
      derived: computed(self => self.source.value + 1),
    })

    expect(tree.derived.value).toBe(2)
    expect(tree.debug.readsOf('derived')).toContain('source.value')
    expect(tree.debug.readBy('source')).toContain('derived')
  })

  it('debug tracks when condition dependencies', () => {
    const tree = createTree({
      enabled: state(true),
      details: when(
        self => self.enabled.value,
        () => state('visible'),
      ),
    })

    expect(tree.details?.value).toBe('visible')
    expect(tree.debug.getEdges()).toMatchObject([
      { readerId: 'details', targetId: 'enabled', targetProp: 'value', reason: 'when' },
    ])
  })

  it('debug tracks switchNode source dependency', () => {
    const tree = createTree({
      mode: state<'a' | 'b'>('a'),
      branch: switchNode(self => self.mode.value, {
        a: () => state('A'),
        b: () => state('B'),
      }),
    })

    expect(tree.branch?.value).toBe('A')
    expect(tree.debug.readsOf('branch')).toContain('mode.value')
  })

  it('debug tracks list.from dependency', () => {
    const tree = createTree({
      rowsSource: state([{ id: 1 }]),
      rows: list({
        from: self => self.rowsSource.value,
        key: row => row.id,
        item: row => state(row.id),
      }),
    })

    expect(tree.rows.value).toEqual([1])
    expect(tree.debug.getEdges()).toMatchObject([
      { readerId: 'rows', targetId: 'rowsSource', targetProp: 'value', reason: 'list.from' },
    ])
  })

  it('debug tracks record.from dependency', () => {
    const tree = createTree({
      targets: state([{ key: 'mpn' }]),
      columns: record({
        from: self => self.targets.value,
        key: target => target.key,
        item: target => state(target.key),
      }),
    })

    expect(tree.columns.value).toEqual({ mpn: 'mpn' })
    expect(tree.debug.getEdges()).toMatchObject([
      { readerId: 'columns', targetId: 'targets', targetProp: 'value', reason: 'record.from' },
    ])
  })

  it('debug tracks check dependencies through self', () => {
    const tree = createTree({
      minAllowed: state(3),
      count: state(1, {
        checks: [
          check((value, context) => {
            if (value < context.root.minAllowed.value) {
              return error('tooSmall', 'Too small')
            }
          }),
        ],
      }),
    })

    expect(tree.count.errors.value).toMatchObject([{ code: 'tooSmall' }])
    expect(tree.debug.getEdges()).toMatchObject([
      { readerId: 'count', targetId: 'minAllowed', targetProp: 'value', reason: 'check' },
    ])
  })

  it('debug clears stale dependencies when computed reruns', () => {
    const tree = createTree({
      mode: state<'a' | 'b'>('a'),
      a: state(1),
      b: state(2),
      selected: computed(self =>
        self.mode.value === 'a' ? self.a.value : self.b.value,
      ),
    })

    expect(tree.selected.value).toBe(1)
    expect(tree.debug.readsOf('selected')).toEqual(
      expect.arrayContaining(['mode.value', 'a.value']),
    )

    tree.mode.set('b')
    expect(tree.selected.value).toBe(2)
    expect(tree.debug.readsOf('selected')).toEqual(
      expect.arrayContaining(['mode.value', 'b.value']),
    )
    expect(tree.debug.readsOf('selected')).not.toContain('a.value')
  })

  it('debug updates conditional branch dependencies', () => {
    const tree = createTree({
      step: state<'upload' | 'mapping'>('upload'),
      file: state<File | null>(null),
      mapping: when(
        self => self.step.value === 'mapping',
        () => section({ ready: state(true) }),
      ),
      canGoNext: computed(self => {
        if (self.step.value === 'upload') {
          return self.file.value !== null
        }

        return self.mapping?.valid.value === true
      }),
    })

    expect(tree.canGoNext.value).toBe(false)
    expect(tree.debug.readsOf('canGoNext')).toEqual(
      expect.arrayContaining(['step.value', 'file.value']),
    )

    tree.step.set('mapping')
    expect(tree.canGoNext.value).toBe(true)
    expect(tree.debug.readsOf('canGoNext')).toEqual(
      expect.arrayContaining(['step.value', 'mapping.exists', 'mapping.valid']),
    )
    expect(tree.debug.readsOf('canGoNext')).not.toContain('file.value')
  })

  it('debug marks disappeared when node inactive', () => {
    const tree = createTree({
      enabled: state(true),
      details: when(
        self => self.enabled.value,
        () => state('visible'),
      ),
    })

    expect(tree.debug.getNodes().find(node => node.id === 'details')?.active).toBe(true)
    tree.enabled.set(false)
    expect(tree.details).toBeUndefined()
    expect(tree.debug.getNodes().find(node => node.id === 'details')?.active).toBe(false)
  })

  it('debug does not duplicate edges across reruns', () => {
    const tree = createTree({
      source: state(1),
      derived: computed(self => self.source.value + 1),
    })

    expect(tree.derived.value).toBe(2)
    tree.source.set(2)
    expect(tree.derived.value).toBe(3)
    tree.source.set(3)
    expect(tree.derived.value).toBe(4)

    const edges = tree.debug
      .getEdges()
      .filter(edge => edge.readerId === 'derived' && edge.targetId === 'source')

    expect(edges).toHaveLength(1)
  })
})
