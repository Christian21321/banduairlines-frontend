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
    /** Paso del flujo de compra: 0 inicio, 1 a 4 pasos, 5 confirmación. */
    pasoCompra?: number
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
      // Compra y Reserva: admite invitados, así que no exige sesión.
      path: '/compra',
      component: () => import('@/views/reserva/CompraLayout.vue'),
      children: [
        {
          path: '',
          name: 'compra-inicio',
          component: () => import('@/views/reserva/InicioCompraView.vue'),
          meta: { pasoCompra: 0 },
        },
        {
          path: 'pasajeros',
          name: 'compra-pasajeros',
          component: () => import('@/views/reserva/PasajerosView.vue'),
          meta: { pasoCompra: 1 },
        },
        {
          path: 'asientos',
          name: 'compra-asientos',
          component: () => import('@/views/reserva/AsientosView.vue'),
          meta: { pasoCompra: 2 },
        },
        {
          path: 'equipaje',
          name: 'compra-equipaje',
          component: () => import('@/views/reserva/EquipajeView.vue'),
          meta: { pasoCompra: 3 },
        },
        {
          path: 'resumen',
          name: 'compra-resumen',
          component: () => import('@/views/reserva/ResumenView.vue'),
          meta: { pasoCompra: 4 },
        },
        {
          path: 'confirmacion',
          name: 'compra-confirmacion',
          component: () => import('@/views/reserva/ConfirmacionView.vue'),
          meta: { pasoCompra: 5 },
        },
      ],
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
