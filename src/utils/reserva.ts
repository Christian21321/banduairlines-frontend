// Reglas de negocio de la compra que el frontend aplica antes de llamar al backend.
// El backend las valida de nuevo; aquí solo sirven para guiar al pasajero.

import type { MapaAsientos, Pack, Reserva, TipoPasajero } from '@/types/reserva'

/** Bebé: menor de 2 años. Niño: de 2 a 11 años. Se calcula a la fecha del vuelo. */
export const EDAD_MINIMA_NINO = 2
export const EDAD_MINIMA_ADULTO = 12

/** Edad en años cumplidos a una fecha. `fechaNacimiento` viene como AAAA-MM-DD. */
export function calcularEdad(fechaNacimiento: string, fechaReferencia: string | Date): number {
  const [anio = 0, mes = 1, dia = 1] = fechaNacimiento.split('-').map(Number)
  const referencia = new Date(fechaReferencia)
  let edad = referencia.getFullYear() - anio
  const cumple =
    referencia.getMonth() + 1 > mes ||
    (referencia.getMonth() + 1 === mes && referencia.getDate() >= dia)
  if (!cumple) edad -= 1
  return edad
}

export function tipoSegunEdad(edad: number): TipoPasajero {
  if (edad < EDAD_MINIMA_NINO) return 'BEBE'
  return edad < EDAD_MINIMA_ADULTO ? 'NINO' : 'ADULTO'
}

export const NOMBRE_TIPO: Record<TipoPasajero, string> = {
  ADULTO: 'Adulto',
  NINO: 'Menor de edad',
  BEBE: 'Bebé',
}

export const NOMBRE_PACK: Record<Pack, string> = {
  BASIC: 'Basic',
  LIGHT: 'Light',
  FULL: 'Full',
}

/** "Camila Rojas Pérez" -> "CR" */
export function iniciales(nombres: string, apellidos: string): string {
  return `${nombres.trim().charAt(0)}${apellidos.trim().charAt(0)}`.toUpperCase()
}

/** "Camila Andrea", "Rojas Pérez" -> "Camila Rojas" */
export function nombreCorto(nombres: string, apellidos: string): string {
  return `${nombres.trim().split(/\s+/)[0] ?? ''} ${apellidos.trim().split(/\s+/)[0] ?? ''}`.trim()
}

/** Valida un RUT chileno con dígito verificador (acepta puntos y guion). */
export function rutValido(rut: string): boolean {
  const limpio = rut.replace(/[.\s-]/g, '').toUpperCase()
  if (!/^\d{7,8}[\dK]$/.test(limpio)) return false
  const cuerpo = limpio.slice(0, -1)
  let suma = 0
  let factor = 2
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * factor
    factor = factor === 7 ? 2 : factor + 1
  }
  const resto = 11 - (suma % 11)
  const digito = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto)
  return digito === limpio.slice(-1)
}

export function correoValido(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)
}

export function telefonoValido(telefono: string): boolean {
  return /^\+?\d{8,15}$/.test(telefono.replace(/[\s-]/g, ''))
}

/** "12C" -> { fila: 12, columna: "C" } */
export function partirAsiento(codigo: string): { fila: number; columna: string } {
  return { fila: Number.parseInt(codigo, 10), columna: codigo.replace(/^\d+/, '') }
}

/**
 * Asientos contiguos a uno dado: misma fila y columna vecina sin pasillo de por medio.
 * Es donde puede sentarse un menor respecto de su adulto responsable.
 */
export function asientosContiguos(
  codigo: string,
  mapa: Pick<MapaAsientos, 'columnas' | 'pasillosDespuesDe'>,
): string[] {
  const { fila, columna } = partirAsiento(codigo)
  const indice = mapa.columnas.indexOf(columna)
  if (indice === -1) return []
  const contiguos: string[] = []
  const anterior = mapa.columnas[indice - 1]
  const siguiente = mapa.columnas[indice + 1]
  if (anterior && !mapa.pasillosDespuesDe.includes(anterior)) contiguos.push(`${fila}${anterior}`)
  if (siguiente && !mapa.pasillosDespuesDe.includes(columna)) contiguos.push(`${fila}${siguiente}`)
  return contiguos
}

/** Servicios contratados por un pasajero, listos para mostrar: "1 × Maleta en bodega 23 kg". */
export function adicionalesDe(reserva: Reserva, pasajeroId: number): string[] {
  const cantidades = new Map<string, number>()
  for (const servicio of reserva.servicios) {
    if (servicio.pasajeroId !== pasajeroId) continue
    cantidades.set(servicio.nombre, (cantidades.get(servicio.nombre) ?? 0) + servicio.cantidad)
  }
  return [...cantidades].map(([nombre, cantidad]) => `${cantidad} × ${nombre}`)
}

/** Asientos de un pasajero en el orden de los tramos: "12C" o "12C / 14A". */
export function asientosDe(reserva: Reserva, pasajeroId: number): string {
  return reserva.itinerario.tramos
    .map(
      (tramo) =>
        reserva.asientos.find((a) => a.pasajeroId === pasajeroId && a.tramoId === tramo.tramoId)
          ?.asiento,
    )
    .filter((asiento) => asiento !== undefined)
    .join(' / ')
}

/** "2 adultos + 1 menor" */
export function describirPasajeros(cantidad: Reserva['cantidadPasajeros']): string {
  const partes = [`${cantidad.adultos} ${cantidad.adultos === 1 ? 'adulto' : 'adultos'}`]
  if (cantidad.ninos > 0)
    partes.push(`${cantidad.ninos} ${cantidad.ninos === 1 ? 'menor' : 'menores'}`)
  if (cantidad.bebes > 0)
    partes.push(`${cantidad.bebes} ${cantidad.bebes === 1 ? 'bebé' : 'bebés'}`)
  return partes.join(' + ')
}
