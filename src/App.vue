<script setup lang="ts">
import { RouterView } from 'vue-router'

import EncabezadoSitio from '@/components/EncabezadoSitio.vue'
</script>

<template>
  <EncabezadoSitio />
  <main class="contenedor">
    <RouterView />
  </main>
</template>
