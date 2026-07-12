import { examples } from './registry'
import './style.css'

const app = document.querySelector<HTMLDivElement>('#app')

if (app === null) {
	throw new Error('Examples host root was not found')
}

let activeExampleId = examples[0]?.id
let activeDispose: (() => void) | undefined

app.innerHTML = `
	<aside class="sidebar">
		<div class="brand">
			<div class="brand__mark">RT</div>
			<div>
				<h1>Reactive Tree</h1>
				<p>Runtime examples</p>
			</div>
		</div>
		<nav class="navigation" aria-label="Examples"></nav>
	</aside>
	<main class="workspace">
		<header class="workspace__header">
			<div>
				<h2 data-title></h2>
				<p data-description></p>
			</div>
		</header>
		<section class="example-shell" data-example></section>
	</main>
`

const navigation = getRequiredElement(app, '.navigation')
const title = getRequiredElement(app, '[data-title]')
const description = getRequiredElement(app, '[data-description]')
const exampleRoot = getRequiredElement(app, '[data-example]')

renderNavigation()
mountActiveExample()

function renderNavigation(): void {
	navigation.innerHTML = ''

	for (const example of examples) {
		const button = document.createElement('button')
		button.type = 'button'
		button.className = 'navigation__item'
		button.dataset.active = String(example.id === activeExampleId)
		button.textContent = example.title
		button.addEventListener('click', () => {
			if (activeExampleId === example.id) {
				return
			}

			activeExampleId = example.id
			renderNavigation()
			mountActiveExample()
		})

		navigation.append(button)
	}
}

function mountActiveExample(): void {
	const example = examples.find((candidate) => candidate.id === activeExampleId)

	if (example === undefined) {
		return
	}

	activeDispose?.()
	exampleRoot.innerHTML = ''
	title.textContent = example.title
	description.textContent = example.description

	const instance = example.mount({ element: exampleRoot })
	activeDispose = () => instance.dispose()
}

function getRequiredElement(root: ParentNode, selector: string): HTMLElement {
	const element = root.querySelector<HTMLElement>(selector)

	if (element === null) {
		throw new Error(`Examples host element was not found: ${selector}`)
	}

	return element
}
