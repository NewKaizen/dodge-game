import './lib/lan/audioTap.js' // antes de qualquer som: copia o áudio para a transmissão LAN
import { mount } from 'svelte'
import App from './App.svelte'

const app = mount(App, {
  target: document.getElementById('app'),
})

export default app
