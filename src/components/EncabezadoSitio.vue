<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router'

import { useSesionStore } from '@/stores/sesion'

const sesion = useSesionStore()
const router = useRouter()

async function salir() {
  // cerrarSesion limpia la sesión local en su finally; si el backend falla, igual se sale.
  await sesion.cerrarSesion().catch(() => {})
  await router.push({ name: 'inicio' })
}
</script>

<template>
  <header class="encabezado">
    <nav class="contenedor navegacion">
      <RouterLink :to="{ name: 'inicio' }" class="marca">BanduAirlines</RouterLink>
      <div class="enlaces">
        <template v-if="sesion.usuario">
          <RouterLink v-if="sesion.esAdministrador" :to="{ name: 'admin' }"
            >Administración</RouterLink
          >
          <RouterLink :to="{ name: 'cuenta' }">{{ sesion.usuario.nombres }}</RouterLink>
          <button type="button" class="boton" @click="salir">Cerrar sesión</button>
        </template>
        <RouterLink v-else :to="{ name: 'inicio-sesion' }">Iniciar sesión</RouterLink>
      </div>
    </nav>
  </header>
</template>

<style scoped>
.encabezado {
  background: var(--color-superficie);
  border-bottom: 1px solid var(--color-borde);
}

.navegacion {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-block: 0.75rem;
}

.marca {
  font-weight: 700;
  font-size: 1.2rem;
  text-decoration: none;
}

.enlaces {
  display: flex;
  align-items: center;
  gap: 1rem;
}
</style>
