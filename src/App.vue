<script setup lang="ts">
import { RouterView } from 'vue-router'

import EncabezadoSitio from '@/components/EncabezadoSitio.vue'
import PieSitio from '@/components/PieSitio.vue'
</script>

<template>
  <EncabezadoSitio />
  <main class="contenedor">
    <RouterView />
  </main>
  <PieSitio />
</template>
