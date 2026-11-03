import type { RespuestaSesion, SolicitudInicioSesion, Usuario } from '@/types/api'
import { api } from './http'

export const cuentaApi = {
  iniciarSesion: (solicitud: SolicitudInicioSesion) =>
    api.post<RespuestaSesion>('/auth/inicio-sesion', solicitud, { autenticada: false }),

  cerrarSesion: (credencialRenovacion: string) =>
    api.post<void>('/auth/cierre-sesion', { credencialRenovacion }),

  consultarCuentaActual: () => api.get<Usuario>('/cuentas/actual'),
}
