// Tipos espejo de los DTO del backend (com.banduairlines.dto.*).

/** Formato único de error que devuelve GlobalExceptionHandler. */
export interface ApiError {
  timestamp: string
  status: number
  error: string
  code: string
  message: string
  path: string
  details: { campo: string; mensaje: string }[]
}

export type RolUsuario = 'PASAJERO' | 'ADMINISTRADOR'

export type Nivel = 'BASICO' | 'PLATA' | 'ORO' | 'PLATINO'

/** RespuestaUsuario / RespuestaSesion.DatosUsuario */
export interface Usuario {
  idUsuario: number
  nombres: string
  apellidos: string
  correo: string
  rol: RolUsuario
  nivel: Nivel | null
}

export interface SolicitudInicioSesion {
  correo: string
  contrasena: string
}

export interface RespuestaSesion {
  credencialAcceso: string
  credencialRenovacion: string
  tipoCredencial: string
  segundosExpiracion: number
  usuario: Usuario
}

export interface RespuestaSalud {
  estado: string
  hora: string
}
