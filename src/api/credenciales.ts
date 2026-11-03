// Persistencia de las credenciales JWT entre recargas de página.

const CLAVE_ACCESO = 'bandu.credencialAcceso'
const CLAVE_RENOVACION = 'bandu.credencialRenovacion'

export interface Credenciales {
  acceso: string
  renovacion: string
}

export function leerCredenciales(): Credenciales | null {
  const acceso = localStorage.getItem(CLAVE_ACCESO)
  const renovacion = localStorage.getItem(CLAVE_RENOVACION)
  return acceso && renovacion ? { acceso, renovacion } : null
}

export function guardarCredenciales({ acceso, renovacion }: Credenciales): void {
  localStorage.setItem(CLAVE_ACCESO, acceso)
  localStorage.setItem(CLAVE_RENOVACION, renovacion)
}

export function borrarCredenciales(): void {
  localStorage.removeItem(CLAVE_ACCESO)
  localStorage.removeItem(CLAVE_RENOVACION)
}
