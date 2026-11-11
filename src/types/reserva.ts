// Tipos espejo del contrato del módulo Compra y Reserva (com.banduairlines.dto.reserva.*).

export type TipoPasajero = 'ADULTO' | 'NINO' | 'BEBE'
export type EstadoReserva = 'PENDIENTE_PAGO' | 'CONFIRMADA' | 'CANCELADA'
export type EstadoPago = 'PENDIENTE' | 'PAGADO' | 'RECHAZADO'
export type TipoCompra = 'INVITADO' | 'REGISTRADO'
export type Pack = 'BASIC' | 'LIGHT' | 'FULL'
export type TipoDocumento = 'RUT' | 'PASAPORTE'

export interface Aeropuerto {
  codigo: string
  ciudad: string
}

export interface Tramo {
  tramoId: number
  numeroVuelo: string
  origen: Aeropuerto
  destino: Aeropuerto
  /** ISO 8601 con zona horaria. */
  salida: string
  llegada: string
  cabina: string
}

export interface Itinerario {
  tramos: Tramo[]
}

export interface CantidadPasajeros {
  adultos: number
  ninos: number
  bebes: number
}

export type ConceptoTotal = 'TARIFA' | 'TASAS' | 'ASIENTOS' | 'EQUIPAJE' | 'SERVICIOS'

export interface LineaTotal {
  concepto: ConceptoTotal
  descripcion: string
  montoCLP: number
}

export interface Total {
  lineas: LineaTotal[]
  descuentoCLP: number
  totalCLP: number
  moneda: 'CLP'
}

/** Datos que el pasajero completa en el formulario. `ref` lo asigna el frontend (p1, p2...). */
export interface DatosPasajero {
  ref: string
  tipo: TipoPasajero
  nombres: string
  apellidos: string
  /** AAAA-MM-DD */
  fechaNacimiento: string
  tipoDocumento: TipoDocumento
  numeroDocumento: string
  nacionalidad: string
  adultoResponsableRef: string | null
}

export interface Pasajero extends DatosPasajero {
  pasajeroId: number
}

export interface Contacto {
  nombreCompleto: string
  correo: string
  telefono: string
}

export interface AsignacionAsiento {
  pasajeroId: number
  tramoId: number
  asiento: string
  precioCLP: number
}

export interface SeleccionAsiento {
  pasajeroId: number
  tramoId: number
  /** `null` libera el asiento del pasajero. */
  asiento: string | null
}

export type CategoriaAsiento = 'ESTANDAR' | 'MAS_ESPACIO'
export type EstadoAsiento = 'DISPONIBLE' | 'NO_DISPONIBLE' | 'SELECCIONADO'

export interface Asiento {
  codigo: string
  categoria: CategoriaAsiento
  estado: EstadoAsiento
  precioCLP: number
  incluidoEnPack: boolean
}

export interface FilaAsientos {
  numero: number
  asientos: Asiento[]
}

export interface MapaAsientos {
  tramoId: number
  modeloAeronave: string
  columnas: string[]
  pasillosDespuesDe: string[]
  filas: FilaAsientos[]
}

export interface ServicioIncluido {
  tipo: string
  cantidad: number
  descripcion: string
}

export interface ServicioDisponible {
  servicioId: string
  nombre: string
  categoria: 'EQUIPAJE' | 'EMBARQUE_PRIORITARIO'
  precioCLP: number
  porTramo: boolean
  maximoPorPasajero: number
}

export interface CatalogoServicios {
  incluidos: ServicioIncluido[]
  disponibles: ServicioDisponible[]
}

export interface SolicitudServicio {
  servicioId: string
  pasajeroId: number
  tramoId: number
  cantidad: number
}

export interface ServicioContratado extends SolicitudServicio {
  nombre: string
  subtotalCLP: number
}

export interface Promocion {
  codigo: string
  tipoDescuento: 'PORCENTAJE' | 'MONTO'
  valor: number
  descuentoCLP: number
}

export interface Reserva {
  reservaId: number
  /** Se genera al iniciar el pago. */
  codigoReserva: string | null
  estado: EstadoReserva
  /** `null` mientras la compra se está armando y todavía no hay cobro. */
  estadoPago: EstadoPago | null
  tipoCompra: TipoCompra
  expiraEn: string
  itinerario: Itinerario
  pack: Pack
  cantidadPasajeros: CantidadPasajeros
  pasajeros: Pasajero[]
  contacto: Contacto | null
  asientos: AsignacionAsiento[]
  servicios: ServicioContratado[]
  promocion: Promocion | null
  total: Total
}

/** Lo que Búsqueda entrega al iniciar la compra. */
export interface SolicitudReserva {
  alternativaId: string
  tramos: { tramoId: number; cabina: string }[]
  pack: Pack
  cantidadPasajeros: CantidadPasajeros
}

export interface ReservaCreada {
  reservaId: number
  estado: EstadoReserva
  /** `null` si la compra es de un pasajero registrado. */
  compraToken: string | null
  expiraEn: string
  total: Total
}

export interface PagoIniciado {
  reservaId: number
  codigoReserva: string
  estado: EstadoReserva
  pagoId: string
  /** Página de pago (Flow) a la que se redirige al pasajero. */
  urlPago: string
  montoCLP: number
  expiraEn: string
}
