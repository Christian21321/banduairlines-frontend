import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { cuentaApi } from '@/api/cuenta'
import { borrarCredenciales, guardarCredenciales, leerCredenciales } from '@/api/credenciales'
import type { SolicitudInicioSesion, Usuario } from '@/types/api'

const CLAVE_USUARIO = 'bandu.usuario'

function leerUsuarioGuardado(): Usuario | null {
  const guardado = localStorage.getItem(CLAVE_USUARIO)
  if (!guardado || !leerCredenciales()) return null
  try {
    return JSON.parse(guardado) as Usuario
  } catch {
    localStorage.removeItem(CLAVE_USUARIO)
    return null
  }
}

export const useSesionStore = defineStore('sesion', () => {
  const usuario = ref<Usuario | null>(leerUsuarioGuardado())

  const autenticado = computed(() => usuario.value !== null)
  const esAdministrador = computed(() => usuario.value?.rol === 'ADMINISTRADOR')

  function establecerUsuario(nuevo: Usuario): void {
    usuario.value = nuevo
    localStorage.setItem(CLAVE_USUARIO, JSON.stringify(nuevo))
  }

  /** Olvida la sesión local sin avisar al backend (p. ej. cuando ya expiró). */
  function limpiar(): void {
    usuario.value = null
    localStorage.removeItem(CLAVE_USUARIO)
    borrarCredenciales()
  }

  async function iniciarSesion(solicitud: SolicitudInicioSesion): Promise<void> {
    const sesion = await cuentaApi.iniciarSesion(solicitud)
    guardarCredenciales({
      acceso: sesion.credencialAcceso,
      renovacion: sesion.credencialRenovacion,
    })
    establecerUsuario(sesion.usuario)
  }

  async function cerrarSesion(): Promise<void> {
    const credenciales = leerCredenciales()
    try {
      if (credenciales) await cuentaApi.cerrarSesion(credenciales.renovacion)
    } finally {
      limpiar()
    }
  }

  return { usuario, autenticado, esAdministrador, iniciarSesion, cerrarSesion, limpiar }
})
