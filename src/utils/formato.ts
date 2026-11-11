// Formato de montos, fechas y horas. Los vuelos se muestran en hora de Chile continental.

const ZONA = 'America/Santiago'

const formatoMonto = new Intl.NumberFormat('es-CL')

/** 148000 -> "$148.000" */
export function formatoCLP(monto: number): string {
  const signo = monto < 0 ? '-' : ''
  return `${signo}$${formatoMonto.format(Math.abs(monto))}`
}

function partes(iso: string, opciones: Intl.DateTimeFormatOptions): Record<string, string> {
  const formato = new Intl.DateTimeFormat('es-CL', { timeZone: ZONA, ...opciones })
  return Object.fromEntries(formato.formatToParts(new Date(iso)).map((p) => [p.type, p.value]))
}

function mayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** "07:15" */
export function formatoHora(iso: string): string {
  const p = partes(iso, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  return `${p.hour}:${p.minute}`
}

/** "Miércoles 14 de octubre de 2026" */
export function formatoFechaLarga(iso: string): string {
  const p = partes(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return `${mayuscula(p.weekday ?? '')} ${p.day} de ${p.month} de ${p.year}`
}

/** "Mié 14 oct" */
export function formatoFechaCorta(iso: string): string {
  const p = partes(iso, { weekday: 'short', day: 'numeric', month: 'short' })
  const limpio = (texto = '') => texto.replace('.', '')
  return `${mayuscula(limpio(p.weekday))} ${p.day} ${limpio(p.month)}`
}

/** Duración entre dos instantes: "1 h 45 min" */
export function formatoDuracion(desde: string, hasta: string): string {
  const minutos = Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / 60000)
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  if (horas === 0) return `${resto} min`
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`
}

/** Segundos -> "14:32" */
export function formatoCuentaRegresiva(segundos: number): string {
  const total = Math.max(0, Math.floor(segundos))
  const minutos = Math.floor(total / 60)
  return `${String(minutos).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
