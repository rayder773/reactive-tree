import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import { vInspect } from './ui/inspect'

const app = createApp(App)
app.directive('inspect', vInspect)
app.mount('#app')
