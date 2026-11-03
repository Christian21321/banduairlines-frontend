import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { configurarExpiracionSesion } from './api/http'
import { useSesionStore } from './stores/sesion'
import './assets/base.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// Si el refresh JWT ya no sirve, se limpia la sesión y se vuelve al login.
configurarExpiracionSesion(() => {
  useSesionStore().limpiar()
  const actual = router.currentRoute.value
  if (actual.meta.requiereSesion || actual.meta.roles) {
    router.push({ name: 'inicio-sesion', query: { redirigir: actual.fullPath } })
  }
})

app.mount('#app')
