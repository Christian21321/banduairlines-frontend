<script setup lang="ts">
import LogoBandu from '@/components/LogoBandu.vue'
</script>

<template>
  <footer class="pie">
    <div class="contenedor contenido">
      <LogoBandu />
      <small>© 2026 BanduAirlines Chile. Universidad de la Frontera, Temuco</small>
    </div>
  </footer>
</template>

<style scoped>
.pie {
  background: var(--color-superficie);
}

.contenido {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1.5rem;
  padding-block: 1.5rem;
  color: var(--color-texto-suave);
}

small {
  font-size: 0.7rem;
}
</style>
