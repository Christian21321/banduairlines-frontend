import type {
  AsignacionAsiento,
  CatalogoServicios,
  Contacto,
  DatosPasajero,
  MapaAsientos,
  PagoIniciado,
  Pasajero,
  Promocion,
  Reserva,
  ReservaCreada,
  SeleccionAsiento,
  ServicioContratado,
  SolicitudReserva,
  SolicitudServicio,
  Total,
} from '@/types/reserva'
import { api } from './http'
import { reservaApiSimulada } from './reservaSimulada'

/**
 * Operaciones del módulo Compra y Reserva. `compraToken` identifica la compra de un
 * invitado (cabecera `X-Compra-Token`); con sesión iniciada va `null` y basta el JWT.
 */
export interface ReservaApi {
  crear(solicitud: SolicitudReserva): Promise<ReservaCreada>
  obtener(reservaId: number, compraToken: string | null): Promise<Reserva>
  guardarPasajeros(
    reservaId: number,
    pasajeros: DatosPasajero[],
    compraToken: string | null,
  ): Promise<{ pasajeros: Pasajero[] }>
  guardarContacto(
    reservaId: number,
    contacto: Contacto,
    compraToken: string | null,
  ): Promise<Contacto>
  mapaAsientos(
    reservaId: number,
    tramoId: number,
    compraToken: string | null,
  ): Promise<MapaAsientos>
  elegirAsientos(
    reservaId: number,
    selecciones: SeleccionAsiento[],
    compraToken: string | null,
  ): Promise<{ asignaciones: AsignacionAsiento[]; expiraEn: string; total: Total }>
  catalogoServicios(reservaId: number, compraToken: string | null): Promise<CatalogoServicios>
  contratarServicios(
    reservaId: number,
    servicios: SolicitudServicio[],
    compraToken: string | null,
  ): Promise<{ servicios: ServicioContratado[]; total: Total }>
  aplicarPromocion(
    reservaId: number,
    codigo: string,
    compraToken: string | null,
  ): Promise<{ promocion: Promocion; total: Total }>
  quitarPromocion(reservaId: number, compraToken: string | null): Promise<{ total: Total }>
  /** Responde `409 PRECIO_CAMBIADO` si el total vigente ya no es `totalEsperado`. */
  iniciarPago(
    reservaId: number,
    totalEsperado: number,
    compraToken: string | null,
  ): Promise<PagoIniciado>
  cancelar(reservaId: number, compraToken: string | null): Promise<void>
  /** Asocia una compra iniciada como invitado a la cuenta con sesión iniciada. */
  asociarCuenta(reservaId: number, compraToken: string | null): Promise<void>
}

function conToken(compraToken: string | null) {
  return compraToken ? { headers: { 'X-Compra-Token': compraToken } } : {}
}

const reservaApiHttp: ReservaApi = {
  crear: (solicitud) => api.post('/reservas', solicitud),
  obtener: (id, token) => api.get(`/reservas/${id}`, conToken(token)),
  guardarPasajeros: (id, pasajeros, token) =>
    api.put(`/reservas/${id}/pasajeros`, { pasajeros }, conToken(token)),
  guardarContacto: (id, contacto, token) =>
    api.put(`/reservas/${id}/contacto`, contacto, conToken(token)),
  mapaAsientos: (id, tramoId, token) =>
    api.get(`/reservas/${id}/tramos/${tramoId}/asientos`, conToken(token)),
  elegirAsientos: (id, selecciones, token) =>
    api.put(`/reservas/${id}/asientos`, { selecciones }, conToken(token)),
  catalogoServicios: (id, token) => api.get(`/reservas/${id}/servicios`, conToken(token)),
  contratarServicios: (id, servicios, token) =>
    api.put(`/reservas/${id}/servicios`, { servicios }, conToken(token)),
  aplicarPromocion: (id, codigo, token) =>
    api.put(`/reservas/${id}/promocion`, { codigo }, conToken(token)),
  quitarPromocion: (id, token) => api.delete(`/reservas/${id}/promocion`, conToken(token)),
  iniciarPago: (id, totalEsperado, token) =>
    api.post(`/reservas/${id}/pago`, { totalEsperado }, conToken(token)),
  cancelar: (id, token) => api.post(`/reservas/${id}/cancelacion`, undefined, conToken(token)),
  asociarCuenta: (id, token) => api.put(`/reservas/${id}/cuenta`, undefined, conToken(token)),
}

/**
 * Con `VITE_RESERVA_SIMULADA=true` la compra corre contra datos locales de ejemplo, sin
 * backend. Si la variable no está definida, se simula solo en `npm run dev`.
 */
export const reservaSimulada: boolean =
  import.meta.env.VITE_RESERVA_SIMULADA === undefined
    ? import.meta.env.DEV
    : import.meta.env.VITE_RESERVA_SIMULADA === 'true'

export const reservaApi: ReservaApi = reservaSimulada ? reservaApiSimulada : reservaApiHttp
