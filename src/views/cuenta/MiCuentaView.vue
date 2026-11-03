<script setup lang="ts">
import { useSesionStore } from '@/stores/sesion'

const sesion = useSesionStore()
</script>

<template>
  <section v-if="sesion.usuario" class="tarjeta">
    <h1>Mi cuenta</h1>
    <dl>
      <dt>Nombre</dt>
      <dd>{{ sesion.usuario.nombres }} {{ sesion.usuario.apellidos }}</dd>
      <dt>Correo</dt>
      <dd>{{ sesion.usuario.correo }}</dd>
      <dt>Rol</dt>
      <dd>{{ sesion.usuario.rol }}</dd>
      <template v-if="sesion.usuario.nivel">
        <dt>Nivel</dt>
        <dd>{{ sesion.usuario.nivel }}</dd>
      </template>
    </dl>
  </section>
</template>

<style scoped>
dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.4rem 1.5rem;
}

dt {
  font-weight: 600;
}

dd {
  margin: 0;
}
</style>
