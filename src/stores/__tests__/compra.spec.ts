import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { ErrorApi } from '@/api/http'
import type { DatosPasajero } from '@/types/reserva'
import { useCompraStore } from '../compra'

// En pruebas `reservaApi` es la implementación simulada (import.meta.env.DEV es true).

const CONTACTO = {
  nombreCompleto: 'Camila Rojas Pérez',
  correo: 'camila.rojas@correo.cl',
  telefono: '+56912345678',
}

function pasajero(ref: string, datos: Partial<DatosPasajero>): DatosPasajero {
  return {
    ref,
    tipo: 'ADULTO',
    nombres: 'Camila',
    apellidos: 'Rojas Pérez',
    fechaNacimiento: '1990-03-02',
    tipoDocumento: 'RUT',
    numeroDocumento: '12.345.678-5',
    nacionalidad: 'CL',
    adultoResponsableRef: null,
    ...datos,
  }
}

const CAMILA = pasajero('p1', {})
const TOMAS = pasajero('p2', { nombres: 'Tomás' })
const SOFIA = pasajero('p3', {
  tipo: 'NINO',
  nombres: 'Sofía',
  fechaNacimiento: '2015-05-08',
  adultoResponsableRef: 'p1',
})

async function compraConMenor() {
  const compra = useCompraStore()
  await compra.iniciar({
    alternativaId: 'ALT-1',
    tramos: [{ tramoId: 204, cabina: 'ECONOMY' }],
    pack: 'LIGHT',
    cantidadPasajeros: { adultos: 2, ninos: 1, bebes: 0 },
  })
  await compra.guardarPasajeros([CAMILA, TOMAS, SOFIA], CONTACTO)
  const [camila, tomas, sofia] = compra.reserva!.pasajeros
  return { compra, camila: camila!, tomas: tomas!, sofia: sofia! }
}

async function codigoDe(promesa: Promise<unknown>): Promise<string> {
  const error = await promesa.then(
    () => null,
    (motivo: unknown) => motivo,
  )
  expect(error).toBeInstanceOf(ErrorApi)
  return (error as ErrorApi).code
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setActivePinia(createPinia())
})

describe('compra', () => {
  it('inicia la compra como invitado y la recupera tras recargar la página', async () => {
    const compra = useCompraStore()
    await compra.iniciar({
      alternativaId: 'ALT-1',
      tramos: [{ tramoId: 204, cabina: 'ECONOMY' }],
      pack: 'LIGHT',
      cantidadPasajeros: { adultos: 2, ninos: 0, bebes: 0 },
    })

    expect(compra.reserva?.tipoCompra).toBe('INVITADO')
    expect(compra.compraToken).not.toBeNull()
    expect(compra.reserva?.total.totalCLP).toBe(172600)

    setActivePinia(createPinia())
    const recargada = useCompraStore()
    expect(await recargada.restaurar()).toBe(true)
    expect(recargada.reserva?.reservaId).toBe(compra.reservaId)
  })

  it('rechaza a un menor sin adulto responsable', async () => {
    const compra = useCompraStore()
    await compra.iniciar({
      alternativaId: 'ALT-1',
      tramos: [{ tramoId: 204, cabina: 'ECONOMY' }],
      pack: 'LIGHT',
      cantidadPasajeros: { adultos: 2, ninos: 1, bebes: 0 },
    })

    const sinAdulto = { ...SOFIA, adultoResponsableRef: null }
    const codigo = await codigoDe(compra.guardarPasajeros([CAMILA, TOMAS, sinAdulto], CONTACTO))

    expect(codigo).toBe('MENOR_SIN_ADULTO_RESPONSABLE')
  })

  it('exige que el adulto elija asiento antes que el menor a su cargo', async () => {
    const { compra, sofia } = await compraConMenor()

    const codigo = await codigoDe(
      compra.elegirAsientos([{ pasajeroId: sofia.pasajeroId, tramoId: 204, asiento: '13A' }]),
    )

    expect(codigo).toBe('ADULTO_SIN_ASIENTO')
    expect(compra.reserva?.asientos).toEqual([])
  })

  it('solo deja al menor junto a su adulto y suma los asientos al total', async () => {
    const { compra, camila, sofia } = await compraConMenor()
    await compra.elegirAsientos([{ pasajeroId: camila.pasajeroId, tramoId: 204, asiento: '13B' }])

    const separado = await codigoDe(
      compra.elegirAsientos([{ pasajeroId: sofia.pasajeroId, tramoId: 204, asiento: '14A' }]),
    )
    await compra.elegirAsientos([{ pasajeroId: sofia.pasajeroId, tramoId: 204, asiento: '13A' }])

    expect(separado).toBe('MENOR_SEPARADO_DE_ADULTO')
    expect(compra.reserva?.asientos.map((a) => a.asiento)).toEqual(['13B', '13A'])
    expect(compra.reserva?.total.totalCLP).toBe(3 * (74000 + 12300) + 2 * 6500)
    const fila13 = compra.mapas[204]?.filas.find((f) => f.numero === 13)
    expect(fila13?.asientos.find((a) => a.codigo === '13A')?.estado).toBe('SELECCIONADO')
  })

  it('no permite tomar un asiento ocupado', async () => {
    const { compra, tomas } = await compraConMenor()

    const codigo = await codigoDe(
      compra.elegirAsientos([{ pasajeroId: tomas.pasajeroId, tramoId: 204, asiento: '10A' }]),
    )

    expect(codigo).toBe('ASIENTO_NO_DISPONIBLE')
  })

  it('cobra maletas y descuenta el código promocional', async () => {
    const { compra, camila } = await compraConMenor()
    const base = compra.reserva!.total.totalCLP

    await compra.contratarServicios([
      { servicioId: 'BODEGA_23KG', pasajeroId: camila.pasajeroId, tramoId: 204, cantidad: 1 },
    ])
    expect(compra.reserva?.total.totalCLP).toBe(base + 22000)

    await compra.aplicarPromocion('verano26')
    expect(compra.reserva?.total.descuentoCLP).toBe(Math.round((base + 22000) * 0.1))

    await compra.quitarPromocion()
    expect(compra.reserva?.total.totalCLP).toBe(base + 22000)
    expect(await codigoDe(compra.aplicarPromocion('NOEXISTE'))).toBe('PROMOCION_INVALIDA')
  })

  it('avisa del cambio de precio y confirma la reserva al aceptar el nuevo total', async () => {
    const { compra } = await compraConMenor()
    const anterior = compra.reserva!.total.totalCLP

    const codigo = await codigoDe(compra.iniciarPago(anterior))

    expect(codigo).toBe('PRECIO_CAMBIADO')
    const nuevo = compra.reserva!.total.totalCLP
    expect(nuevo).toBe(anterior + 3 * 4000)
    expect(compra.enCurso).toBe(true)

    const pago = await compra.iniciarPago(nuevo)

    expect(pago.codigoReserva).toMatch(/^[A-Z0-9]{6}$/)
    expect(compra.reserva?.estado).toBe('CONFIRMADA')
    expect(compra.reserva?.estadoPago).toBe('PAGADO')
    expect(compra.enCurso).toBe(false)
  })

  it('al cancelar olvida la compra', async () => {
    const { compra } = await compraConMenor()

    await compra.cancelar()

    expect(compra.reserva).toBeNull()
    expect(sessionStorage.getItem('bandu.compra')).toBeNull()
  })
})
