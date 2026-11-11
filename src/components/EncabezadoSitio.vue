<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router'

import LogoBandu from '@/components/LogoBandu.vue'
import { useSesionStore } from '@/stores/sesion'

const sesion = useSesionStore()
const router = useRouter()

// Secciones del menú que todavía no tienen pantalla en el frontend.
const PENDIENTES = [
  'Check-in Online',
  'Estado de Vuelo',
  'Gestionar Mi Reserva',
  'Servicios Adicionales',
]

async function salir() {
  // cerrarSesion limpia la sesión local en su finally; si el backend falla, igual se sale.
  await sesion.cerrarSesion().catch(() => {})
  await router.push({ name: 'inicio' })
}
</script>

<template>
  <header class="encabezado">
    <nav class="contenedor navegacion" aria-label="Principal">
      <RouterLink :to="{ name: 'inicio' }" class="marca" aria-label="BanduAirlines, inicio">
        <LogoBandu />
      </RouterLink>
      <div class="secciones">
        <RouterLink :to="{ name: 'inicio' }" class="seccion actual">Comprar Vuelos</RouterLink>
        <span v-for="nombre in PENDIENTES" :key="nombre" class="seccion">{{ nombre }}</span>
        <RouterLink v-if="sesion.esAdministrador" :to="{ name: 'admin' }" class="seccion"
          >Administración</RouterLink
        >
      </div>
      <div class="cuenta">
        <RouterLink
          v-if="sesion.usuario"
          :to="{ name: 'cuenta' }"
          class="boton boton-secundario acceso"
          >Mi cuenta</RouterLink
        >
        <RouterLink v-else :to="{ name: 'inicio-sesion' }" class="boton boton-secundario acceso"
          >Iniciar Sesión / Registrarse</RouterLink
        >
        <RouterLink :to="{ name: 'cuenta' }" class="boton viajes">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              d="M2.5 19h19v2h-19v-2Zm19.6-9.4a1.5 1.5 0 0 0-1.8-1L15 10 8.1 3.6l-1.9.5 4.1 7.2-5 1.3-2-1.5-1.4.4 1.8 3.2.8 1.3 16.6-4.5a1.5 1.5 0 0 0 1-1.9Z"
              fill="currentColor"
            />
          </svg>
          Mis Viajes
        </RouterLink>
        <button v-if="sesion.usuario" type="button" class="enlace" @click="salir">
          Cerrar sesión
        </button>
      </div>
    </nav>
  </header>
</template>

<style scoped>
.encabezado {
  background: var(--color-superficie);
}

.navegacion {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1.25rem;
  padding-block: 0.8rem;
}

.marca {
  text-decoration: none;
}

.secciones {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 1.1rem;
  margin-left: auto;
}

.seccion {
  color: var(--color-texto);
  /* Como en el Figma, cada sección ocupa dos líneas cortas. */
  max-width: 5.2rem;
  font-size: 0.78rem;
  font-weight: 500;
  line-height: 1.2;
  text-decoration: none;
}

.seccion.actual {
  color: var(--color-primario);
  font-weight: 700;
}

.cuenta {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.acceso,
.viajes {
  padding: 0.45rem 0.9rem;
  font-size: 0.75rem;
  white-space: nowrap;
}

.cuenta .enlace {
  font-size: 0.75rem;
  white-space: nowrap;
}
</style>
