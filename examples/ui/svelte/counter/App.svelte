<script lang="ts">
  import type { CounterController } from '../../../apps/counter/domain'

  let { controller }: { controller: CounterController } = $props()
  const count = controller.count
</script>

<section class="counter-card">
  <div class="counter-value">{count.value}</div>
  <div class="counter-actions">
    <button type="button" onclick={controller.decrement}>−</button>
    <button type="button" onclick={controller.reset}>Reset</button>
    <button type="button" onclick={controller.increment}>+</button>
  </div>
</section>
