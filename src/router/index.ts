import { createRouter, createWebHistory } from 'vue-router'

import { useSesionStore } from '@/stores/sesion'
import type { RolUsuario } from '@/types/api'
import InicioView from '@/views/busqueda/InicioView.vue'

declare module 'vue-router' {
  interface RouteMeta {
    /** Exige sesión iniciada. */
    requiereSesion?: boolean
    /** Roles permitidos; implica `requiereSesion`. */
    roles?: RolUsuario[]
    /** Solo sin sesión (login, recuperación). */
    soloInvitados?: boolean
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'inicio',
      component: InicioView,
    },
    {
      path: '/inicio-sesion',
      name: 'inicio-sesion',
      component: () => import('@/views/cuenta/InicioSesionView.vue'),
      meta: { soloInvitados: true },
    },
    {
      // Ruta fija: el backend envía por correo <RECUPERACION_URL_BASE>?codigoRecuperacion=...
      path: '/restablecer-contrasena',
      name: 'restablecer-contrasena',
      component: () => import('@/views/cuenta/RestablecerContrasenaView.vue'),
      meta: { soloInvitados: true },
    },
    {
      path: '/cuenta',
      name: 'cuenta',
      component: () => import('@/views/cuenta/MiCuentaView.vue'),
      meta: { requiereSesion: true },
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/views/admin/PanelAdminView.vue'),
      meta: { requiereSesion: true, roles: ['ADMINISTRADOR'] },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'no-encontrado',
      component: () => import('@/views/comun/NoEncontradoView.vue'),
    },
  ],
})

router.beforeEach((destino) => {
  const sesion = useSesionStore()
  const requiereSesion = destino.meta.requiereSesion || destino.meta.roles !== undefined

  if (requiereSesion && !sesion.usuario) {
    return { name: 'inicio-sesion', query: { redirigir: destino.fullPath } }
  }
  if (destino.meta.roles && sesion.usuario && !destino.meta.roles.includes(sesion.usuario.rol)) {
    return { name: 'inicio' }
  }
  if (destino.meta.soloInvitados && sesion.autenticado) {
    return { name: 'inicio' }
  }
})

export default router
