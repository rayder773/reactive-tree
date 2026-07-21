import type { CounterController } from '../../../apps/counter/domain'

export function App({ controller }: { controller: CounterController }) {
  const count = controller.count
  return (
    <section className="counter-card">
      <div className="counter-value">{count.value}</div>
      <div className="counter-actions">
        <button type="button" onClick={controller.decrement}>−</button>
        <button type="button" onClick={controller.reset}>Reset</button>
        <button type="button" onClick={controller.increment}>+</button>
      </div>
    </section>
  )
}
