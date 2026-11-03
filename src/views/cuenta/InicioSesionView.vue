<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ErrorApi } from '@/api/http'
import { useSesionStore } from '@/stores/sesion'

const sesion = useSesionStore()
const router = useRouter()
const route = useRoute()

const formulario = reactive({ correo: '', contrasena: '' })
const enviando = ref(false)
const mensajeError = ref('')
const erroresCampo = ref<Record<string, string>>({})

/** Solo rutas internas, para no redirigir a sitios externos. */
function destinoTrasLogin(): string {
  const redirigir = route.query.redirigir
  return typeof redirigir === 'string' && redirigir.startsWith('/') && !redirigir.startsWith('//')
    ? redirigir
    : '/'
}

async function enviar() {
  enviando.value = true
  mensajeError.value = ''
  erroresCampo.value = {}
  try {
    await sesion.iniciarSesion({ ...formulario })
    await router.replace(destinoTrasLogin())
  } catch (error) {
    if (!(error instanceof ErrorApi)) throw error
    mensajeError.value = error.message
    erroresCampo.value = Object.fromEntries(error.details.map((d) => [d.campo, d.mensaje]))
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <section class="tarjeta formulario">
    <h1>Iniciar sesión</h1>
    <form novalidate @submit.prevent="enviar">
      <label>
        Correo
        <input v-model.trim="formulario.correo" type="email" autocomplete="email" required />
        <small v-if="erroresCampo.correo" class="error">{{ erroresCampo.correo }}</small>
      </label>
      <label>
        Contraseña
        <input
          v-model="formulario.contrasena"
          type="password"
          autocomplete="current-password"
          required
        />
        <small v-if="erroresCampo.contrasena" class="error">{{ erroresCampo.contrasena }}</small>
      </label>
      <p v-if="mensajeError" class="error" role="alert">{{ mensajeError }}</p>
      <button type="submit" class="boton" :disabled="enviando">
        {{ enviando ? 'Ingresando…' : 'Ingresar' }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.formulario {
  max-width: 420px;
  margin: 2rem auto;
}

form {
  display: grid;
  gap: 1rem;
}

label {
  display: grid;
  gap: 0.3rem;
}

input {
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--color-borde);
  border-radius: var(--radio);
}
</style>
