import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { guardarCredenciales, leerCredenciales } from '../credenciales'
import { api, configurarExpiracionSesion, ErrorApi } from '../http'

function json(status: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  localStorage.clear()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('cliente http', () => {
  it('envía el JWT de acceso y arma la query', async () => {
    guardarCredenciales({ acceso: 'acceso-1', renovacion: 'renovacion-1' })
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }))

    await api.get('/vuelos', { query: { origen: 'SCL', pagina: 0, destino: undefined } })

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/v1/vuelos?origen=SCL&pagina=0')
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer acceso-1')
  })

  it('convierte el formato de error del backend en ErrorApi', async () => {
    fetchMock.mockResolvedValueOnce(
      json(400, {
        status: 400,
        code: 'VALIDACION',
        message: 'Los datos enviados no son válidos',
        details: [{ campo: 'correo', mensaje: 'El correo es obligatorio' }],
      }),
    )

    const peticion = api.post('/auth/registro', {}, { autenticada: false })

    await expect(peticion).rejects.toBeInstanceOf(ErrorApi)
    await expect(peticion).rejects.toMatchObject({
      status: 400,
      code: 'VALIDACION',
      details: [{ campo: 'correo', mensaje: 'El correo es obligatorio' }],
    })
  })

  it('renueva las credenciales ante un 401 y reintenta la petición', async () => {
    guardarCredenciales({ acceso: 'vencido', renovacion: 'renovacion-1' })
    fetchMock
      .mockResolvedValueOnce(json(401, { code: 'NO_AUTENTICADO' }))
      .mockResolvedValueOnce(
        json(200, { credencialAcceso: 'acceso-2', credencialRenovacion: 'renovacion-2' }),
      )
      .mockResolvedValueOnce(json(200, { idUsuario: 1 }))

    const respuesta = await api.get('/cuentas/actual')

    expect(respuesta).toEqual({ idUsuario: 1 })
    expect(leerCredenciales()).toEqual({ acceso: 'acceso-2', renovacion: 'renovacion-2' })
    const reintento = fetchMock.mock.calls[2]![1]
    expect(new Headers(reintento?.headers).get('Authorization')).toBe('Bearer acceso-2')
  })

  it('cierra la sesión local si la renovación falla', async () => {
    const alExpirar = vi.fn<() => void>()
    configurarExpiracionSesion(alExpirar)
    guardarCredenciales({ acceso: 'vencido', renovacion: 'vencida' })
    fetchMock
      .mockResolvedValueOnce(json(401, { code: 'NO_AUTENTICADO' }))
      .mockResolvedValueOnce(json(401, { code: 'CREDENCIAL_RENOVACION_VENCIDA' }))

    await expect(api.get('/cuentas/actual')).rejects.toMatchObject({ status: 401 })
    expect(leerCredenciales()).toBeNull()
    expect(alExpirar).toHaveBeenCalledOnce()
  })
})
