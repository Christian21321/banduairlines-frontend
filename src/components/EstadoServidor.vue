<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { integraApi } from '@/api/integra'
import { ErrorApi } from '@/api/http'

const estado = ref<'cargando' | 'ok' | 'error'>('cargando')
const detalle = ref('')

onMounted(async () => {
  try {
    const salud = await integraApi.salud()
    estado.value = salud.estado === 'ok' ? 'ok' : 'error'
    detalle.value = new Date(salud.hora).toLocaleString('es-CL')
  } catch (error) {
    estado.value = 'error'
    detalle.value = error instanceof ErrorApi ? error.message : 'Error desconocido'
  }
})
</script>

<template>
  <p class="estado" :class="estado">
    <span v-if="estado === 'cargando'">Conectando con el backend…</span>
    <span v-else-if="estado === 'ok'">Backend disponible ({{ detalle }})</span>
    <span v-else>Backend no disponible: {{ detalle }}</span>
  </p>
</template>

<style scoped>
.estado {
  font-size: 0.9rem;
  color: var(--color-texto-suave);
}

.ok {
  color: var(--color-exito);
}

.error {
  color: var(--color-error);
}
</style>
