// Implementación local del contrato de RESERVA, con los datos de ejemplo del Figma.
// Permite recorrer el flujo de compra sin backend. Aplica las mismas reglas y códigos de
// error del contrato para que las vistas se comporten igual contra la API real.

import type {
  Asiento,
  DatosPasajero,
  LineaTotal,
  MapaAsientos,
  Reserva,
  ServicioDisponible,
  Total,
  Tramo,
} from '@/types/reserva'
import { asientosContiguos, calcularEdad, NOMBRE_PACK, tipoSegunEdad } from '@/utils/reserva'
import { leerCredenciales } from './credenciales'
import { ErrorApi } from './http'
import type { ReservaApi } from './reserva'

const CLAVE = 'bandu.reservasSimuladas'
const MINUTOS_BLOQUEO = 20
const TARIFA_CLP = 74000
/** Tarifa vigente tras el cambio de precio que se simula en el primer intento de pago. */
const TARIFA_ACTUALIZADA_CLP = 78000
const TASAS_CLP = 12300
const PRECIO_ASIENTO: Record<Asiento['categoria'], number> = { ESTANDAR: 6500, MAS_ESPACIO: 12000 }
const FILAS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
const COLUMNAS = ['A', 'B', 'C', 'D', 'E', 'F']
const OCUPADOS = new Set(
  '10A 10B 11F 12A 12B 13C 13E 13F 14C 14D 15A 15D 16C 16E 16F 17B 17D 18C 18F 19A 19F'.split(' '),
)
const PROMOCIONES: Record<string, number> = { VERANO26: 10, BANDU10: 10 }

const TRAMO: Tramo = {
  tramoId: 204,
  numeroVuelo: 'BD 204',
  origen: { codigo: 'SCL', ciudad: 'Santiago' },
  destino: { codigo: 'PMC', ciudad: 'Puerto Montt' },
  salida: '2026-12-16T07:15:00-03:00',
  llegada: '2026-12-16T09:00:00-03:00',
  cabina: 'ECONOMY',
}

const SERVICIOS: ServicioDisponible[] = [
  {
    servicioId: 'BODEGA_23KG',
    nombre: 'Maleta en bodega 23 kg',
    categoria: 'EQUIPAJE',
    precioCLP: 22000,
    porTramo: true,
    maximoPorPasajero: 3,
  },
  {
    servicioId: 'EMBARQUE_PRIORITARIO',
    nombre: 'Embarque prioritario',
    categoria: 'EMBARQUE_PRIORITARIO',
    precioCLP: 5000,
    porTramo: true,
    maximoPorPasajero: 1,
  },
]

interface Registro {
  reserva: Reserva
  compraToken: string | null
  tarifaCLP: number
  precioYaCambio: boolean
}

type Base = Record<string, Registro>

function leerBase(): Base {
  try {
    return JSON.parse(sessionStorage.getItem(CLAVE) ?? '{}') as Base
  } catch {
    return {}
  }
}

function guardarBase(base: Base): void {
  sessionStorage.setItem(CLAVE, JSON.stringify(base))
}

function error(status: number, code: string, message: string): ErrorApi {
  return new ErrorApi(status, { status, code, message })
}

function copia<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T
}

/** Pequeña espera para que se vean los estados de carga. */
function esperar(): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, import.meta.env.MODE === 'test' ? 0 : 150))
}

function calcularTotal(registro: Registro): Total {
  const { reserva } = registro
  const { adultos, ninos } = reserva.cantidadPasajeros
  const pagan = adultos + ninos
  const detalle = ninos > 0 ? ` adultos + ${ninos} ${ninos === 1 ? 'menor' : 'menores'}` : ''
  const lineas: LineaTotal[] = [
    {
      concepto: 'TARIFA',
      descripcion: `Tarifa ${NOMBRE_PACK[reserva.pack]} × ${ninos > 0 ? adultos : pagan}${detalle}`,
      montoCLP: registro.tarifaCLP * pagan,
    },
    { concepto: 'TASAS', descripcion: 'Tasas y cargos', montoCLP: TASAS_CLP * pagan },
  ]
  if (reserva.asientos.length > 0) {
    lineas.push({
      concepto: 'ASIENTOS',
      descripcion: `Asientos (${reserva.asientos.map((a) => a.asiento).join(', ')})`,
      montoCLP: reserva.asientos.reduce((suma, a) => suma + a.precioCLP, 0),
    })
  }
  for (const servicio of SERVICIOS) {
    const contratados = reserva.servicios.filter((s) => s.servicioId === servicio.servicioId)
    const cantidad = contratados.reduce((suma, s) => suma + s.cantidad, 0)
    if (cantidad === 0) continue
    lineas.push({
      concepto: servicio.categoria === 'EQUIPAJE' ? 'EQUIPAJE' : 'SERVICIOS',
      descripcion:
        servicio.categoria === 'EQUIPAJE'
          ? `Equipaje (${cantidad} ${cantidad === 1 ? 'maleta' : 'maletas'})`
          : `${servicio.nombre} × ${cantidad}`,
      montoCLP: contratados.reduce((suma, s) => suma + s.subtotalCLP, 0),
    })
  }
  const bruto = lineas.reduce((suma, linea) => suma + linea.montoCLP, 0)
  let descuentoCLP = 0
  if (reserva.promocion) {
    descuentoCLP = Math.round((bruto * reserva.promocion.valor) / 100)
    reserva.promocion.descuentoCLP = descuentoCLP
  }
  return { lineas, descuentoCLP, totalCLP: bruto - descuentoCLP, moneda: 'CLP' }
}

function categoriaDe(fila: number): Asiento['categoria'] {
  return fila <= 11 ? 'MAS_ESPACIO' : 'ESTANDAR'
}

function construirMapa(reserva: Reserva): MapaAsientos {
  const propios = new Set(reserva.asientos.map((a) => a.asiento))
  return {
    tramoId: TRAMO.tramoId,
    modeloAeronave: 'Airbus A320',
    columnas: COLUMNAS,
    pasillosDespuesDe: ['C'],
    filas: FILAS.map((numero) => ({
      numero,
      asientos: COLUMNAS.map((columna) => {
        const codigo = `${numero}${columna}`
        const categoria = categoriaDe(numero)
        return {
          codigo,
          categoria,
          estado: propios.has(codigo)
            ? 'SELECCIONADO'
            : OCUPADOS.has(codigo)
              ? 'NO_DISPONIBLE'
              : 'DISPONIBLE',
          precioCLP: PRECIO_ASIENTO[categoria],
          incluidoEnPack: false,
        }
      }),
    })),
  }
}

function generarCodigo(): string {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => letras[Math.floor(Math.random() * letras.length)]).join('')
}

/** Busca la reserva y valida token, estado y vigencia como lo hace el backend. */
function abrir(
  reservaId: number,
  compraToken: string | null,
  opciones: { modificar: boolean },
): { base: Base; registro: Registro } {
  const base = leerBase()
  const registro = base[String(reservaId)]
  if (!registro) throw error(404, 'RECURSO_NO_ENCONTRADO', 'La reserva no existe.')
  if (registro.compraToken !== null && registro.compraToken !== compraToken) {
    throw error(403, 'ACCESO_DENEGADO', 'No tienes acceso a esta reserva.')
  }
  if (opciones.modificar) {
    if (registro.reserva.estado !== 'PENDIENTE_PAGO') {
      throw error(409, 'ESTADO_INVALIDO', 'La reserva ya no se puede modificar.')
    }
    if (new Date(registro.reserva.expiraEn).getTime() <= Date.now()) {
      throw error(409, 'RESERVA_EXPIRADA', 'El tiempo para completar la compra venció.')
    }
  }
  return { base, registro }
}

function cerrar(base: Base, registro: Registro): void {
  registro.reserva.total = calcularTotal(registro)
  guardarBase(base)
}

function validarPasajeros(reserva: Reserva, pasajeros: DatosPasajero[]): void {
  const { adultos, ninos, bebes } = reserva.cantidadPasajeros
  if (pasajeros.length !== adultos + ninos + bebes) {
    throw error(422, 'CANTIDAD_PASAJEROS_DISTINTA', 'La cantidad de pasajeros no coincide.')
  }
  const salida = reserva.itinerario.tramos[0]?.salida ?? new Date().toISOString()
  for (const pasajero of pasajeros) {
    const edad = calcularEdad(pasajero.fechaNacimiento, salida)
    if (tipoSegunEdad(edad) !== pasajero.tipo) {
      throw error(
        422,
        'TIPO_NO_COINCIDE_EDAD',
        `La fecha de nacimiento de ${pasajero.nombres} no corresponde al tipo de pasajero.`,
      )
    }
    if (pasajero.tipo === 'ADULTO') continue
    const responsable = pasajeros.find((p) => p.ref === pasajero.adultoResponsableRef)
    if (responsable?.tipo !== 'ADULTO') {
      throw error(
        422,
        'MENOR_SIN_ADULTO_RESPONSABLE',
        `${pasajero.nombres} necesita un adulto responsable.`,
      )
    }
  }
}

export const reservaApiSimulada: ReservaApi = {
  async crear(solicitud) {
    await esperar()
    const { adultos, bebes } = solicitud.cantidadPasajeros
    if (adultos < 1) throw error(400, 'VALIDACION', 'Debe viajar al menos un adulto.')
    if (bebes > adultos) throw error(422, 'BEBES_SIN_ADULTO', 'Hay más bebés que adultos.')
    const base = leerBase()
    const reservaId = Date.now()
    const invitado = leerCredenciales() === null
    const registro: Registro = {
      compraToken: invitado ? crypto.randomUUID() : null,
      tarifaCLP: TARIFA_CLP,
      precioYaCambio: false,
      reserva: {
        reservaId,
        codigoReserva: null,
        estado: 'PENDIENTE_PAGO',
        estadoPago: null,
        tipoCompra: invitado ? 'INVITADO' : 'REGISTRADO',
        expiraEn: new Date(Date.now() + MINUTOS_BLOQUEO * 60000).toISOString(),
        itinerario: { tramos: [TRAMO] },
        pack: solicitud.pack,
        cantidadPasajeros: solicitud.cantidadPasajeros,
        pasajeros: [],
        contacto: null,
        asientos: [],
        servicios: [],
        promocion: null,
        total: { lineas: [], descuentoCLP: 0, totalCLP: 0, moneda: 'CLP' },
      },
    }
    base[String(reservaId)] = registro
    cerrar(base, registro)
    const { estado, expiraEn, total } = registro.reserva
    return copia({ reservaId, estado, compraToken: registro.compraToken, expiraEn, total })
  },

  async obtener(reservaId, compraToken) {
    await esperar()
    return copia(abrir(reservaId, compraToken, { modificar: false }).registro.reserva)
  },

  async guardarPasajeros(reservaId, pasajeros, compraToken) {
    await esperar()
    const { base, registro } = abrir(reservaId, compraToken, { modificar: true })
    const { reserva } = registro
    validarPasajeros(reserva, pasajeros)
    // El id se conserva por `ref` para no perder asientos ni servicios al editar los datos.
    const anteriores = new Map(reserva.pasajeros.map((p) => [p.ref, p.pasajeroId]))
    reserva.pasajeros = pasajeros.map((pasajero, indice) => ({
      ...pasajero,
      pasajeroId: anteriores.get(pasajero.ref) ?? reservaId + indice + 1,
    }))
    const vigentes = new Set(
      reserva.pasajeros.filter((p) => p.tipo !== 'BEBE').map((p) => p.pasajeroId),
    )
    reserva.asientos = reserva.asientos.filter((a) => vigentes.has(a.pasajeroId))
    reserva.servicios = reserva.servicios.filter((s) => vigentes.has(s.pasajeroId))
    cerrar(base, registro)
    return copia({ pasajeros: reserva.pasajeros })
  },

  async guardarContacto(reservaId, contacto, compraToken) {
    await esperar()
    const { base, registro } = abrir(reservaId, compraToken, { modificar: true })
    registro.reserva.contacto = contacto
    cerrar(base, registro)
    return copia(contacto)
  },

  async mapaAsientos(reservaId, _tramoId, compraToken) {
    await esperar()
    return construirMapa(abrir(reservaId, compraToken, { modificar: false }).registro.reserva)
  },

  async elegirAsientos(reservaId, selecciones, compraToken) {
    await esperar()
    const { base, registro } = abrir(reservaId, compraToken, { modificar: true })
    const { reserva } = registro
    const mapa = construirMapa(reserva)
    let asientos = [...reserva.asientos]
    for (const seleccion of selecciones) {
      const pasajero = reserva.pasajeros.find((p) => p.pasajeroId === seleccion.pasajeroId)
      if (!pasajero) throw error(400, 'VALIDACION', 'El pasajero no pertenece a la reserva.')
      asientos = asientos.filter((a) => a.pasajeroId !== pasajero.pasajeroId)
      if (seleccion.asiento === null) continue
      if (pasajero.tipo === 'BEBE') {
        throw error(422, 'BEBE_NO_OCUPA_ASIENTO', 'Los bebés viajan en brazos de su adulto.')
      }
      const codigo = seleccion.asiento
      const existe = mapa.filas.some((f) => f.asientos.some((a) => a.codigo === codigo))
      if (!existe || OCUPADOS.has(codigo) || asientos.some((a) => a.asiento === codigo)) {
        throw error(409, 'ASIENTO_NO_DISPONIBLE', `El asiento ${codigo} ya no está disponible.`)
      }
      asientos.push({
        pasajeroId: pasajero.pasajeroId,
        tramoId: TRAMO.tramoId,
        asiento: codigo,
        precioCLP: PRECIO_ASIENTO[categoriaDe(Number.parseInt(codigo, 10))],
      })
    }
    // Un menor con asiento debe quedar junto a su adulto responsable.
    for (const menor of reserva.pasajeros.filter((p) => p.tipo === 'NINO')) {
      const propio = asientos.find((a) => a.pasajeroId === menor.pasajeroId)
      if (!propio) continue
      const adulto = reserva.pasajeros.find((p) => p.ref === menor.adultoResponsableRef)
      const delAdulto = asientos.find((a) => a.pasajeroId === adulto?.pasajeroId)
      if (!delAdulto) {
        throw error(
          422,
          'ADULTO_SIN_ASIENTO',
          `Primero elige el asiento de ${adulto?.nombres ?? 'su adulto responsable'}.`,
        )
      }
      if (!asientosContiguos(delAdulto.asiento, mapa).includes(propio.asiento)) {
        throw error(
          422,
          'MENOR_SEPARADO_DE_ADULTO',
          `${menor.nombres} debe sentarse junto a ${adulto?.nombres ?? 'su adulto responsable'}.`,
        )
      }
    }
    reserva.asientos = asientos
    cerrar(base, registro)
    return copia({ asignaciones: asientos, expiraEn: reserva.expiraEn, total: reserva.total })
  },

  async catalogoServicios(reservaId, compraToken) {
    await esperar()
    abrir(reservaId, compraToken, { modificar: false })
    return copia({
      incluidos: [
        { tipo: 'ARTICULO_PERSONAL', cantidad: 1, descripcion: 'Artículo personal' },
        { tipo: 'BOLSO_MANO', cantidad: 1, descripcion: 'Bolso de mano 10 kg' },
      ],
      disponibles: SERVICIOS,
    })
  },

  async contratarServicios(reservaId, servicios, compraToken) {
    await esperar()
    const { base, registro } = abrir(reservaId, compraToken, { modificar: true })
    registro.reserva.servicios = servicios
      .filter((s) => s.cantidad > 0)
      .map((solicitud) => {
        const servicio = SERVICIOS.find((s) => s.servicioId === solicitud.servicioId)
        if (!servicio || solicitud.cantidad > servicio.maximoPorPasajero) {
          throw error(422, 'SERVICIO_NO_PERMITIDO', 'El servicio no está disponible.')
        }
        return {
          ...solicitud,
          nombre: servicio.nombre,
          subtotalCLP: servicio.precioCLP * solicitud.cantidad,
        }
      })
    cerrar(base, registro)
    return copia({ servicios: registro.reserva.servicios, total: registro.reserva.total })
  },

  async aplicarPromocion(reservaId, codigo, compraToken) {
    await esperar()
    const { base, registro } = abrir(reservaId, compraToken, { modificar: true })
    const normalizado = codigo.trim().toUpperCase()
    const valor = PROMOCIONES[normalizado]
    if (valor === undefined) {
      throw error(404, 'PROMOCION_INVALIDA', 'El código promocional no existe.')
    }
    const promocion = {
      codigo: normalizado,
      tipoDescuento: 'PORCENTAJE' as const,
      valor,
      descuentoCLP: 0,
    }
    registro.reserva.promocion = promocion
    cerrar(base, registro)
    return copia({ promocion: registro.reserva.promocion, total: registro.reserva.total })
  },

  async quitarPromocion(reservaId, compraToken) {
    await esperar()
    const { base, registro } = abrir(reservaId, compraToken, { modificar: true })
    registro.reserva.promocion = null
    cerrar(base, registro)
    return copia({ total: registro.reserva.total })
  },

  async iniciarPago(reservaId, totalEsperado, compraToken) {
    await esperar()
    const { base, registro } = abrir(reservaId, compraToken, { modificar: true })
    const { reserva } = registro
    if (reserva.pasajeros.length === 0 || !reserva.contacto) {
      throw error(422, 'DATOS_INCOMPLETOS', 'Faltan los datos de pasajeros o de contacto.')
    }
    if (!registro.precioYaCambio) {
      // La tarifa sube una vez para poder recorrer el flujo "Cambio de precio".
      registro.precioYaCambio = true
      registro.tarifaCLP = TARIFA_ACTUALIZADA_CLP
      cerrar(base, registro)
    }
    if (reserva.total.totalCLP !== totalEsperado) {
      throw error(409, 'PRECIO_CAMBIADO', 'El precio de tu vuelo cambió.')
    }
    // Sin pasarela: el pago se aprueba de inmediato y se vuelve a la confirmación.
    reserva.codigoReserva = generarCodigo()
    reserva.estado = 'CONFIRMADA'
    reserva.estadoPago = 'PAGADO'
    cerrar(base, registro)
    return {
      reservaId,
      codigoReserva: reserva.codigoReserva,
      estado: reserva.estado,
      pagoId: `PAG-${reservaId}`,
      urlPago: '/compra/confirmacion',
      montoCLP: reserva.total.totalCLP,
      expiraEn: reserva.expiraEn,
    }
  },

  async cancelar(reservaId, compraToken) {
    await esperar()
    const { base, registro } = abrir(reservaId, compraToken, { modificar: false })
    if (registro.reserva.estado === 'CONFIRMADA') {
      throw error(409, 'ESTADO_INVALIDO', 'La reserva ya está confirmada.')
    }
    registro.reserva.estado = 'CANCELADA'
    registro.reserva.asientos = []
    guardarBase(base)
  },

  async asociarCuenta(reservaId, compraToken) {
    await esperar()
    const { base, registro } = abrir(reservaId, compraToken, { modificar: true })
    registro.reserva.tipoCompra = 'REGISTRADO'
    guardarBase(base)
  },
}
