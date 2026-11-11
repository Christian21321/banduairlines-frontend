import { describe, expect, it } from 'vitest'

import { formatoCLP, formatoCuentaRegresiva, formatoDuracion, formatoHora } from '../formato'
import {
  asientosContiguos,
  calcularEdad,
  iniciales,
  nombreCorto,
  rutValido,
  telefonoValido,
  tipoSegunEdad,
} from '../reserva'

const MAPA = { columnas: ['A', 'B', 'C', 'D', 'E', 'F'], pasillosDespuesDe: ['C'] }

describe('reglas de pasajeros', () => {
  it('calcula la edad cumplida a la fecha del vuelo', () => {
    expect(calcularEdad('2015-05-08', '2026-12-16T07:15:00-03:00')).toBe(11)
    expect(calcularEdad('2014-12-16', '2026-12-16T07:15:00-03:00')).toBe(12)
    expect(calcularEdad('2014-12-17', '2026-12-16T07:15:00-03:00')).toBe(11)
  })

  it('clasifica bebé, niño y adulto según la edad', () => {
    expect(tipoSegunEdad(1)).toBe('BEBE')
    expect(tipoSegunEdad(2)).toBe('NINO')
    expect(tipoSegunEdad(11)).toBe('NINO')
    expect(tipoSegunEdad(12)).toBe('ADULTO')
  })

  it('valida el dígito verificador del RUT', () => {
    expect(rutValido('18.456.237-K')).toBe(false)
    expect(rutValido('12.345.678-5')).toBe(true)
    expect(rutValido('12345678-5')).toBe(true)
    expect(rutValido('12.345.678-9')).toBe(false)
    expect(rutValido('abc')).toBe(false)
  })

  it('acepta teléfonos con espacios y prefijo', () => {
    expect(telefonoValido('+56 9 1234 5678')).toBe(true)
    expect(telefonoValido('1234')).toBe(false)
  })

  it('abrevia nombres para las fichas de pasajero', () => {
    expect(iniciales('Camila Andrea', 'Rojas Pérez')).toBe('CR')
    expect(nombreCorto('Camila Andrea', 'Rojas Pérez')).toBe('Camila Rojas')
  })
})

describe('asientos contiguos', () => {
  it('devuelve los vecinos de la misma fila', () => {
    expect(asientosContiguos('13B', MAPA)).toEqual(['13A', '13C'])
  })

  it('no cruza el pasillo', () => {
    expect(asientosContiguos('12C', MAPA)).toEqual(['12B'])
    expect(asientosContiguos('12D', MAPA)).toEqual(['12E'])
  })

  it('no sale del avión por la ventana', () => {
    expect(asientosContiguos('10A', MAPA)).toEqual(['10B'])
    expect(asientosContiguos('10F', MAPA)).toEqual(['10E'])
  })
})

describe('formato', () => {
  it('muestra montos en pesos chilenos', () => {
    expect(formatoCLP(148000)).toBe('$148.000')
    expect(formatoCLP(-8000)).toBe('-$8.000')
  })

  it('muestra horas y duraciones del vuelo en hora de Chile', () => {
    expect(formatoHora('2026-12-16T07:15:00-03:00')).toBe('07:15')
    expect(formatoDuracion('2026-12-16T07:15:00-03:00', '2026-12-16T09:00:00-03:00')).toBe(
      '1 h 45 min',
    )
  })

  it('muestra la cuenta regresiva como mm:ss', () => {
    expect(formatoCuentaRegresiva(872)).toBe('14:32')
    expect(formatoCuentaRegresiva(-5)).toBe('00:00')
  })
})
