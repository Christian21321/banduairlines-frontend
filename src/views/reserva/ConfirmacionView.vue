<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { ErrorApi } from '@/api/http'
import { useCompraStore } from '@/stores/compra'
import type { Pasajero, Reserva } from '@/types/reserva'
import { formatoCLP, formatoFechaLarga, formatoHora } from '@/utils/formato'
import { adicionalesDe, asientosDe, NOMBRE_PACK } from '@/utils/reserva'

const compra = useCompraStore()
const router = useRouter()

const reserva = computed(() => compra.reserva as Reserva)
const confirmada = computed(() => reserva.value.estado === 'CONFIRMADA')
const rechazado = computed(() => reserva.value.estadoPago === 'RECHAZADO')
const primerTramo = computed(() => reserva.value.itinerario.tramos[0])
const copiado = ref(false)
const actualizando = ref(false)
const mensajeError = ref('')

/** El check-in abre 48 horas antes del vuelo y cierra 1 hora antes. */
const checkinAbierto = computed(() => {
  if (!primerTramo.value) return false
  const horas = (new Date(primerTramo.value.salida).getTime() - Date.now()) / 3_600_000
  return horas <= 48 && horas >= 1
})

function equipajeDe(pasajero: Pasajero): string {
  if (pasajero.tipo === 'BEBE') return 'Viaja en brazos'
  return ['Bolso de mano', ...adicionalesDe(reserva.value, pasajero.pasajeroId)].join(' + ')
}

async function copiarCodigo(): Promise<void> {
  if (!reserva.value.codigoReserva) return
  try {
    await navigator.clipboard.writeText(reserva.value.codigoReserva)
    copiado.value = true
    setTimeout(() => (copiado.value = false), 2500)
  } catch {
    // Sin permiso para el portapapeles, el código sigue visible para copiarlo a mano.
  }
}

/**
 * Comprobante en texto armado con los datos de la reserva.
 * TODO(pagos): reemplazar por el comprobante oficial cuando PAGOS publique su endpoint.
 */
function descargarComprobante(): void {
  const r = reserva.value
  const lineas = [
    'BanduAirlines · Comprobante de compra',
    `Código de reserva: ${r.codigoReserva}`,
    '',
    ...r.itinerario.tramos.map(
      (t) =>
        `${t.numeroVuelo} · ${t.origen.codigo} ${formatoHora(t.salida)} → ${t.destino.codigo} ${formatoHora(t.llegada)} · ${formatoFechaLarga(t.salida)}`,
    ),
    '',
    'Pasajeros',
    ...r.pasajeros.map(
      (p) =>
        `- ${p.nombres} ${p.apellidos} · ${asientosDe(r, p.pasajeroId) || 'sin asiento'} · ${equipajeDe(p)}`,
    ),
    '',
    ...r.total.lineas.map((l) => `${l.descripcion}: ${formatoCLP(l.montoCLP)}`),
    ...(r.total.descuentoCLP > 0 ? [`Descuento: ${formatoCLP(-r.total.descuentoCLP)}`] : []),
    `Total pagado: CLP ${formatoCLP(r.total.totalCLP)}`,
  ]
  const enlace = document.createElement('a')
  enlace.href = URL.createObjectURL(new Blob([lineas.join('\n')], { type: 'text/plain' }))
  enlace.download = `comprobante-${r.codigoReserva}.txt`
  enlace.click()
  URL.revokeObjectURL(enlace.href)
}

async function actualizar(): Promise<void> {
  actualizando.value = true
  mensajeError.value = ''
  try {
    await compra.recargar()
  } catch (error) {
    if (!(error instanceof ErrorApi)) throw error
    mensajeError.value = error.message
  } finally {
    actualizando.value = false
  }
}
</script>

<template>
  <div v-if="confirmada" class="confirmacion">
    <header class="titulo">
      <span class="icono" aria-hidden="true">
        <svg viewBox="0 0 16 16" width="20" height="20">
          <path d="m3 8.5 3.2 3L13 4.5" fill="none" stroke="currentColor" stroke-width="2" />
        </svg>
      </span>
      <div>
        <h1>Tu reserva está confirmada</h1>
        <p v-if="reserva.contacto" class="suave">
          Enviamos el detalle y el comprobante a {{ reserva.contacto.correo }}
        </p>
      </div>
    </header>

    <section class="tarjeta codigo">
      <div>
        <p class="antetitulo">Código de reserva</p>
        <p class="valor">{{ reserva.codigoReserva }}</p>
        <p class="ayuda">Úsalo para hacer check-in y gestionar tu viaje.</p>
      </div>
      <button type="button" class="boton boton-secundario" @click="copiarCodigo">
        {{ copiado ? 'Código copiado' : 'Copiar código' }}
      </button>
    </section>

    <section class="tarjeta detalle">
      <header v-for="(tramo, indice) in reserva.itinerario.tramos" :key="tramo.tramoId">
        <div>
          <h2>
            {{ tramo.origen.codigo }} {{ formatoHora(tramo.salida) }} → {{ tramo.destino.codigo }}
            {{ formatoHora(tramo.llegada) }}
          </h2>
          <p class="suave">
            {{ formatoFechaLarga(tramo.salida) }} · {{ tramo.numeroVuelo }} · Tarifa
            {{ NOMBRE_PACK[reserva.pack] }}
          </p>
        </div>
        <span v-if="indice === 0" class="chip">Pago aprobado</span>
      </header>
      <div class="tabla">
        <table>
          <thead>
            <tr>
              <th>Pasajero</th>
              <th>Asiento</th>
              <th>Equipaje</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="pasajero in reserva.pasajeros" :key="pasajero.pasajeroId">
              <td>{{ pasajero.nombres }} {{ pasajero.apellidos }}</td>
              <td>{{ asientosDe(reserva, pasajero.pasajeroId) || 'En el check-in' }}</td>
              <td>{{ equipajeDe(pasajero) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="total">
        <span>Total pagado</span>
        <strong>CLP {{ formatoCLP(reserva.total.totalCLP) }}</strong>
      </p>
    </section>

    <div class="acciones">
      <button type="button" class="boton" @click="descargarComprobante">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          />
        </svg>
        Descargar comprobante
      </button>
      <button type="button" class="boton boton-secundario" :disabled="!checkinAbierto">
        Ir a check-in
      </button>
      <small class="suave">El check-in abre 48 horas antes del vuelo.</small>
    </div>

    <p v-if="reserva.tipoCompra === 'INVITADO'" class="invitacion">
      <span>¿Quieres ver este viaje en Mis Viajes? Crea una cuenta con tu correo.</span>
      <RouterLink :to="{ name: 'inicio-sesion' }" class="enlace">Crear cuenta</RouterLink>
    </p>
  </div>

  <section v-else class="tarjeta pendiente" aria-live="polite">
    <template v-if="rechazado">
      <h1>El pago fue rechazado</h1>
      <p class="suave">
        Tu reserva sigue guardada mientras corra el contador. Puedes intentar el pago otra vez.
      </p>
      <button type="button" class="boton" @click="router.push({ name: 'compra-resumen' })">
        Reintentar el pago
      </button>
    </template>
    <template v-else>
      <h1>Estamos esperando la confirmación del pago</h1>
      <p class="suave">
        Apenas el pago se apruebe verás aquí tu código de reserva. Si ya pagaste, actualiza en unos
        segundos.
      </p>
      <p v-if="mensajeError" class="error" role="alert">{{ mensajeError }}</p>
      <button type="button" class="boton" :disabled="actualizando" @click="actualizar">
        {{ actualizando ? 'Actualizando…' : 'Actualizar' }}
      </button>
    </template>
  </section>
</template>

<style scoped>
.confirmacion {
  display: grid;
  gap: 1rem;
  width: 100%;
  max-width: 700px;
  margin: 1rem auto 0;
}

.titulo {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.titulo h1 {
  font-size: 1.45rem;
  line-height: 1.2;
}

.titulo p {
  font-size: 0.78rem;
}

.icono {
  display: grid;
  flex: none;
  place-items: center;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: var(--color-exito-suave);
  color: #14431f;
}

.codigo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  background: var(--color-primario);
  color: #fff;
}

.antetitulo {
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.valor {
  font-size: 1.9rem;
  font-weight: 800;
  letter-spacing: 0.3em;
  line-height: 1.3;
}

.ayuda {
  font-size: 0.7rem;
}

.detalle {
  display: grid;
  gap: 0.75rem;
  font-size: 0.8rem;
}

.detalle header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

h2 {
  font-size: 1rem;
}

.detalle header p {
  font-size: 0.72rem;
}

.tabla {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  padding: 0.3rem 0.75rem 0.3rem 0;
  border-bottom: 1px solid var(--color-borde);
  color: var(--color-texto-suave);
  font-size: 0.6rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-align: left;
  text-transform: uppercase;
}

td {
  padding: 0.4rem 0.75rem 0.1rem 0;
}

.total {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-borde);
  font-weight: 700;
}

.total strong {
  color: var(--color-primario);
  font-size: 1.15rem;
}

.acciones {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.acciones small {
  font-size: 0.7rem;
}

.invitacion {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  padding: 0.8rem 1.25rem;
  border: 1.5px dashed #8b929c;
  border-radius: var(--radio-tarjeta);
  font-size: 0.78rem;
}

.pendiente {
  display: grid;
  gap: 0.75rem;
  justify-items: start;
  max-width: 520px;
  margin: 2rem auto;
}

.pendiente h1 {
  font-size: 1.3rem;
}
</style>
