import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { ErrorApi } from '@/api/http'
import { reservaApi } from '@/api/reserva'
import type {
  CatalogoServicios,
  Contacto,
  DatosPasajero,
  MapaAsientos,
  PagoIniciado,
  Pasajero,
  Reserva,
  SeleccionAsiento,
  SolicitudReserva,
  SolicitudServicio,
} from '@/types/reserva'

const CLAVE = 'bandu.compra'

interface CompraGuardada {
  reservaId: number
  compraToken: string | null
}

function leerCompraGuardada(): CompraGuardada | null {
  try {
    return JSON.parse(sessionStorage.getItem(CLAVE) ?? 'null') as CompraGuardada | null
  } catch {
    return null
  }
}

/** Compra en curso: la reserva que se está armando y el tiempo que queda para pagarla. */
export const useCompraStore = defineStore('compra', () => {
  const guardada = leerCompraGuardada()
  const reservaId = ref<number | null>(guardada?.reservaId ?? null)
  const compraToken = ref<string | null>(guardada?.compraToken ?? null)
  const reserva = ref<Reserva | null>(null)
  const mapas = ref<Record<number, MapaAsientos>>({})
  const catalogo = ref<CatalogoServicios | null>(null)
  const ahora = ref(Date.now())
  let reloj: ReturnType<typeof setInterval> | null = null

  const segundosRestantes = computed(() =>
    reserva.value
      ? Math.max(0, Math.floor((new Date(reserva.value.expiraEn).getTime() - ahora.value) / 1000))
      : 0,
  )
  /** La compra sigue abierta: ni pagada, ni cancelada. */
  const enCurso = computed(
    () => reserva.value?.estado === 'PENDIENTE_PAGO' && reserva.value.estadoPago !== 'PAGADO',
  )
  const expirada = computed(() => enCurso.value && segundosRestantes.value === 0)
  /** Pasajeros que ocupan asiento (los bebés viajan en brazos). */
  const pasajerosConAsiento = computed<Pasajero[]>(
    () => reserva.value?.pasajeros.filter((p) => p.tipo !== 'BEBE') ?? [],
  )

  function persistir(): void {
    if (reservaId.value === null) sessionStorage.removeItem(CLAVE)
    else {
      const compra: CompraGuardada = { reservaId: reservaId.value, compraToken: compraToken.value }
      sessionStorage.setItem(CLAVE, JSON.stringify(compra))
    }
  }

  function iniciarReloj(): void {
    ahora.value = Date.now()
    reloj ??= setInterval(() => {
      ahora.value = Date.now()
    }, 1000)
  }

  function detenerReloj(): void {
    if (reloj) clearInterval(reloj)
    reloj = null
  }

  function idActual(): number {
    if (reservaId.value === null) throw new Error('No hay una compra en curso')
    return reservaId.value
  }

  /** Olvida la compra local sin avisar al backend. */
  function reiniciar(): void {
    reservaId.value = null
    compraToken.value = null
    reserva.value = null
    mapas.value = {}
    catalogo.value = null
    persistir()
  }

  async function recargar(): Promise<Reserva> {
    const actual = await reservaApi.obtener(idActual(), compraToken.value)
    reserva.value = actual
    return actual
  }

  /** Recupera la compra guardada tras recargar la página. Devuelve `false` si ya no existe. */
  async function restaurar(): Promise<boolean> {
    if (reservaId.value === null) return false
    if (reserva.value) return true
    try {
      await recargar()
      return true
    } catch (error) {
      if (error instanceof ErrorApi && error.status >= 400 && error.status < 500) {
        reiniciar()
        return false
      }
      throw error
    }
  }

  async function iniciar(solicitud: SolicitudReserva): Promise<void> {
    const creada = await reservaApi.crear(solicitud)
    reservaId.value = creada.reservaId
    compraToken.value = creada.compraToken
    mapas.value = {}
    catalogo.value = null
    persistir()
    await recargar()
  }

  async function guardarPasajeros(pasajeros: DatosPasajero[], contacto: Contacto): Promise<void> {
    await reservaApi.guardarPasajeros(idActual(), pasajeros, compraToken.value)
    await reservaApi.guardarContacto(idActual(), contacto, compraToken.value)
    await recargar()
  }

  async function cargarMapa(tramoId: number): Promise<MapaAsientos> {
    const mapa = await reservaApi.mapaAsientos(idActual(), tramoId, compraToken.value)
    mapas.value = { ...mapas.value, [tramoId]: mapa }
    return mapa
  }

  /** Bloquea o libera asientos y refresca el mapa del tramo y el total. */
  async function elegirAsientos(selecciones: SeleccionAsiento[]): Promise<void> {
    if (selecciones.length === 0) return
    try {
      await reservaApi.elegirAsientos(idActual(), selecciones, compraToken.value)
    } finally {
      // También tras un error: otro pasajero pudo tomar el asiento.
      const tramos = [...new Set(selecciones.map((s) => s.tramoId))]
      await Promise.all([recargar(), ...tramos.map(cargarMapa)])
    }
  }

  async function cargarCatalogo(): Promise<CatalogoServicios> {
    catalogo.value ??= await reservaApi.catalogoServicios(idActual(), compraToken.value)
    return catalogo.value
  }

  async function contratarServicios(servicios: SolicitudServicio[]): Promise<void> {
    await reservaApi.contratarServicios(idActual(), servicios, compraToken.value)
    await recargar()
  }

  async function aplicarPromocion(codigo: string): Promise<void> {
    await reservaApi.aplicarPromocion(idActual(), codigo, compraToken.value)
    await recargar()
  }

  async function quitarPromocion(): Promise<void> {
    await reservaApi.quitarPromocion(idActual(), compraToken.value)
    await recargar()
  }

  /**
   * Inicia el pago por `totalEsperado`. Si el backend responde `PRECIO_CAMBIADO`, la reserva
   * queda recargada con el precio vigente y el error se propaga para mostrar el aviso.
   */
  async function iniciarPago(totalEsperado: number): Promise<PagoIniciado> {
    try {
      const pago = await reservaApi.iniciarPago(idActual(), totalEsperado, compraToken.value)
      await recargar()
      return pago
    } catch (error) {
      if (error instanceof ErrorApi && error.code === 'PRECIO_CAMBIADO') await recargar()
      throw error
    }
  }

  /** Deja en la cuenta con sesión iniciada una compra que partió como invitado. */
  async function asociarCuenta(): Promise<void> {
    await reservaApi.asociarCuenta(idActual(), compraToken.value)
    await recargar()
  }

  /** Abandona la compra y libera los asientos. */
  async function cancelar(): Promise<void> {
    try {
      if (reservaId.value !== null && enCurso.value) {
        await reservaApi.cancelar(reservaId.value, compraToken.value)
      }
    } finally {
      reiniciar()
    }
  }

  return {
    reservaId,
    compraToken,
    reserva,
    mapas,
    catalogo,
    segundosRestantes,
    enCurso,
    expirada,
    pasajerosConAsiento,
    iniciarReloj,
    detenerReloj,
    reiniciar,
    recargar,
    restaurar,
    iniciar,
    guardarPasajeros,
    cargarMapa,
    elegirAsientos,
    cargarCatalogo,
    contratarServicios,
    aplicarPromocion,
    quitarPromocion,
    iniciarPago,
    asociarCuenta,
    cancelar,
  }
})
