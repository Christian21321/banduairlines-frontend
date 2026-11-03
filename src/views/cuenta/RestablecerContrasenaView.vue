<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

// El backend envía el enlace como /restablecer-contrasena?codigoRecuperacion=<token>
const codigoRecuperacion = computed(() => {
  const codigo = route.query.codigoRecuperacion
  return typeof codigo === 'string' ? codigo : null
})
</script>

<template>
  <section class="tarjeta">
    <h1>Restablecer contraseña</h1>
    <p v-if="codigoRecuperacion">
      Aquí irá el formulario para definir la nueva contraseña (módulo Cuentas).
    </p>
    <p v-else class="error">El enlace de recuperación no es válido o está incompleto.</p>
  </section>
</template>
