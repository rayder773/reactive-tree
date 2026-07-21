import { applications, uiLibraries } from '../examples/host/registry'

describe('example registry', () => {
  it('provides every application through every UI library', () => {
    for (const ui of uiLibraries) {
      expect(Object.keys(ui.renderers).sort()).toEqual(applications.map((application) => application.id).sort())
    }
  })
})
