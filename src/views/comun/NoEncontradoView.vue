<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <section class="tarjeta">
    <h1>Página no encontrada</h1>
    <p>La página que buscas no existe.</p>
    <RouterLink :to="{ name: 'inicio' }">Volver al inicio</RouterLink>
  </section>
</template>
