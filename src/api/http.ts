import type { ApiError, RespuestaSesion } from '@/types/api'
import { borrarCredenciales, guardarCredenciales, leerCredenciales } from './credenciales'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

/** Error de la API con el `code` y los `details` del backend. */
export class ErrorApi extends Error {
  readonly status: number
  readonly code: string
  readonly details: ApiError['details']

  constructor(status: number, cuerpo: Partial<ApiError> | null) {
    super(cuerpo?.message ?? `Error HTTP ${status}`)
    this.name = 'ErrorApi'
    this.status = status
    this.code = cuerpo?.code ?? (status === 0 ? 'SIN_CONEXION' : 'ERROR_DESCONOCIDO')
    this.details = cuerpo?.details ?? []
  }
}

type Consulta = Record<string, string | number | boolean | null | undefined>

export interface OpcionesPeticion {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Consulta
  /** Enviar el JWT de acceso. Por defecto `true`. */
  autenticada?: boolean
  /** Cabeceras extra, p. ej. `X-Compra-Token` en una compra de invitado. */
  headers?: Record<string, string>
  signal?: AbortSignal
}

type OpcionesSinCuerpo = Omit<OpcionesPeticion, 'method' | 'body'>

let alExpirarSesion: () => void = () => {}

/** Registra qué hacer cuando la sesión no se puede renovar (p. ej. ir al login). */
export function configurarExpiracionSesion(callback: () => void): void {
  alExpirarSesion = callback
}

function construirUrl(ruta: string, query?: Consulta): string {
  const url = `${BASE_URL}${ruta}`
  if (!query) return url
  const params = new URLSearchParams()
  for (const [clave, valor] of Object.entries(query)) {
    if (valor !== undefined && valor !== null) params.append(clave, String(valor))
  }
  const texto = params.toString()
  return texto ? `${url}?${texto}` : url
}

async function leerCuerpo(respuesta: Response): Promise<unknown> {
  if (respuesta.status === 204) return null
  const tipo = respuesta.headers.get('Content-Type') ?? ''
  if (tipo.includes('json')) return respuesta.json()
  const texto = await respuesta.text()
  return texto || null
}

async function ejecutar(ruta: string, opciones: OpcionesPeticion): Promise<Response> {
  const { method = 'GET', body, query, autenticada = true, signal } = opciones
  const headers = new Headers({ Accept: 'application/json', ...opciones.headers })
  if (body !== undefined) headers.set('Content-Type', 'application/json')

  const credenciales = autenticada ? leerCredenciales() : null
  if (credenciales) headers.set('Authorization', `Bearer ${credenciales.acceso}`)

  try {
    return await fetch(construirUrl(ruta, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ErrorApi(0, { message: 'No se pudo conectar con el servidor' })
  }
}

// Una sola renovación en curso aunque fallen varias peticiones a la vez.
let renovacionEnCurso: Promise<boolean> | null = null

function renovarCredenciales(): Promise<boolean> {
  renovacionEnCurso ??= (async () => {
    const actuales = leerCredenciales()
    if (!actuales) return false
    const respuesta = await ejecutar('/auth/renovacion', {
      method: 'POST',
      body: { credencialRenovacion: actuales.renovacion },
      autenticada: false,
    })
    if (!respuesta.ok) return false
    const sesion = (await respuesta.json()) as RespuestaSesion
    guardarCredenciales({
      acceso: sesion.credencialAcceso,
      renovacion: sesion.credencialRenovacion,
    })
    return true
  })()
    .catch(() => false)
    .finally(() => {
      renovacionEnCurso = null
    })
  return renovacionEnCurso
}

export async function peticion<T>(ruta: string, opciones: OpcionesPeticion = {}): Promise<T> {
  let respuesta = await ejecutar(ruta, opciones)

  const autenticada = opciones.autenticada ?? true
  if (respuesta.status === 401 && autenticada && leerCredenciales()) {
    if (await renovarCredenciales()) {
      respuesta = await ejecutar(ruta, opciones)
    } else {
      borrarCredenciales()
      alExpirarSesion()
    }
  }

  const cuerpo = await leerCuerpo(respuesta)
  if (!respuesta.ok) {
    const error =
      cuerpo !== null && typeof cuerpo === 'object' ? (cuerpo as Partial<ApiError>) : null
    throw new ErrorApi(respuesta.status, error)
  }
  return cuerpo as T
}

export const api = {
  get: <T>(ruta: string, opciones?: OpcionesSinCuerpo) =>
    peticion<T>(ruta, { ...opciones, method: 'GET' }),
  post: <T>(ruta: string, body?: unknown, opciones?: OpcionesSinCuerpo) =>
    peticion<T>(ruta, { ...opciones, method: 'POST', body }),
  put: <T>(ruta: string, body?: unknown, opciones?: OpcionesSinCuerpo) =>
    peticion<T>(ruta, { ...opciones, method: 'PUT', body }),
  patch: <T>(ruta: string, body?: unknown, opciones?: OpcionesSinCuerpo) =>
    peticion<T>(ruta, { ...opciones, method: 'PATCH', body }),
  delete: <T>(ruta: string, opciones?: OpcionesSinCuerpo) =>
    peticion<T>(ruta, { ...opciones, method: 'DELETE' }),
}
