<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { ErrorApi } from '@/api/http'
import ModalCambioPrecio from '@/components/reserva/ModalCambioPrecio.vue'
import ResumenViaje from '@/components/reserva/ResumenViaje.vue'
import { useCompraStore } from '@/stores/compra'
import type { Reserva, Total } from '@/types/reserva'
import { formatoFechaLarga, formatoHora } from '@/utils/formato'
import { adicionalesDe, asientosDe, NOMBRE_PACK, NOMBRE_TIPO } from '@/utils/reserva'

const compra = useCompraStore()
const router = useRouter()

const reserva = computed(() => compra.reserva as Reserva)
const codigo = ref('')
const aplicando = ref(false)
const errorPromocion = ref('')
const pagando = ref(false)
const mensajeError = ref('')
/** Total que el pasajero vio antes de que el backend avisara del cambio de precio. */
const totalAnterior = ref<Total | null>(null)
const confirmandoCambio = ref(false)

const descripcionTarifa = computed(() => {
  const incluidos = compra.catalogo?.incluidos.map((i) => i.descripcion.toLowerCase()) ?? []
  const tarifa = `Tarifa ${NOMBRE_PACK[reserva.value.pack]}`
  return incluidos.length > 0 ? `${tarifa}: ${incluidos.join(' y ')}` : tarifa
})

// El catálogo trae lo incluido en la tarifa; si falla, el resumen se muestra igual.
onMounted(() => compra.cargarCatalogo().catch(() => {}))

async function aplicarPromocion(): Promise<void> {
  if (!codigo.value.trim()) return
  aplicando.value = true
  errorPromocion.value = ''
  try {
    await compra.aplicarPromocion(codigo.value.trim())
    codigo.value = ''
  } catch (error) {
    if (!(error instanceof ErrorApi)) throw error
    errorPromocion.value = error.message
  } finally {
    aplicando.value = false
  }
}

async function quitarPromocion(): Promise<void> {
  aplicando.value = true
  errorPromocion.value = ''
  try {
    await compra.quitarPromocion()
  } catch (error) {
    if (!(error instanceof ErrorApi)) throw error
    errorPromocion.value = error.message
  } finally {
    aplicando.value = false
  }
}

async function pagar(): Promise<void> {
  const visto = reserva.value.total
  pagando.value = true
  mensajeError.value = ''
  try {
    const pago = await compra.iniciarPago(visto.totalCLP)
    totalAnterior.value = null
    // La pasarela es una página externa; la simulación vuelve directo a la confirmación.
    if (pago.urlPago.startsWith('/')) await router.push(pago.urlPago)
    else window.location.assign(pago.urlPago)
  } catch (error) {
    if (!(error instanceof ErrorApi)) throw error
    if (error.code === 'PRECIO_CAMBIADO') totalAnterior.value = visto
    else {
      totalAnterior.value = null
      mensajeError.value = error.message
    }
  } finally {
    pagando.value = false
  }
}

async function cambiarVuelo(): Promise<void> {
  await compra.cancelar().catch(() => {})
  await router.push({ name: 'inicio' })
}
</script>

<template>
  <div class="compra-columnas">
    <div class="compra-principal">
      <div class="compra-titulo">
        <h1>Revisa y confirma tu compra</h1>
        <p>Verifica que todo esté correcto antes de ir al pago.</p>
      </div>

      <section class="tarjeta bloque">
        <header>
          <h2>Vuelo</h2>
          <span v-if="confirmandoCambio" class="confirmar">
            Perderás esta selección.
            <button type="button" class="enlace" @click="cambiarVuelo">Sí, cambiar</button>
            <button type="button" class="enlace" @click="confirmandoCambio = false">No</button>
          </span>
          <button v-else type="button" class="enlace" @click="confirmandoCambio = true">
            Cambiar
          </button>
        </header>
        <p v-for="tramo in reserva.itinerario.tramos" :key="tramo.tramoId">
          {{ tramo.origen.codigo }} {{ formatoHora(tramo.salida) }} → {{ tramo.destino.codigo }}
          {{ formatoHora(tramo.llegada) }} · {{ formatoFechaLarga(tramo.salida) }} ·
          {{ tramo.numeroVuelo }} · Directo
        </p>
        <p class="suave nota">{{ descripcionTarifa }}</p>
      </section>

      <section class="tarjeta bloque">
        <header>
          <h2>Pasajeros, asientos y equipaje</h2>
          <button type="button" class="enlace" @click="router.push({ name: 'compra-pasajeros' })">
            Editar
          </button>
        </header>
        <div class="tabla">
          <table>
            <thead>
              <tr>
                <th>Pasajero</th>
                <th>Documento</th>
                <th>Asiento</th>
                <th>Adicionales</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="pasajero in reserva.pasajeros" :key="pasajero.pasajeroId">
                <td>
                  {{ pasajero.nombres }} {{ pasajero.apellidos }}
                  <small v-if="pasajero.tipo !== 'ADULTO'" class="suave">
                    ({{ NOMBRE_TIPO[pasajero.tipo].toLowerCase() }})
                  </small>
                </td>
                <td>
                  {{ pasajero.tipoDocumento === 'RUT' ? 'RUT' : 'Pasaporte' }}
                  {{ pasajero.numeroDocumento }}
                </td>
                <td v-if="pasajero.tipo === 'BEBE'" class="suave">En brazos</td>
                <td v-else-if="asientosDe(reserva, pasajero.pasajeroId)">
                  {{ asientosDe(reserva, pasajero.pasajeroId) }}
                </td>
                <td v-else class="suave">En el check-in</td>
                <td v-if="adicionalesDe(reserva, pasajero.pasajeroId).length > 0">
                  {{ adicionalesDe(reserva, pasajero.pasajeroId).join(', ') }}
                </td>
                <td v-else class="suave">Sin adicionales</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="atajos">
          <button type="button" class="enlace" @click="router.push({ name: 'compra-asientos' })">
            Cambiar asientos
          </button>
          <button type="button" class="enlace" @click="router.push({ name: 'compra-equipaje' })">
            Cambiar equipaje
          </button>
        </p>
      </section>

      <section v-if="reserva.contacto" class="tarjeta bloque">
        <header>
          <h2>Contacto</h2>
          <button type="button" class="enlace" @click="router.push({ name: 'compra-pasajeros' })">
            Editar
          </button>
        </header>
        <p>{{ reserva.contacto.correo }} · {{ reserva.contacto.telefono }}</p>
      </section>

      <section class="tarjeta bloque">
        <h2>¿Tienes un código promocional?</h2>
        <p v-if="reserva.promocion" class="aviso aviso-exito aplicada">
          <span>
            Código <strong>{{ reserva.promocion.codigo }}</strong> aplicado.
          </span>
          <button type="button" class="enlace" :disabled="aplicando" @click="quitarPromocion">
            Quitar
          </button>
        </p>
        <form v-else class="promocion" novalidate @submit.prevent="aplicarPromocion">
          <label class="campo" :class="{ 'campo-error': errorPromocion }">
            Código
            <input v-model="codigo" type="text" placeholder="Ej: VERANO26" autocomplete="off" />
            <small v-if="errorPromocion" role="alert">{{ errorPromocion }}</small>
          </label>
          <button
            type="submit"
            class="boton boton-secundario"
            :disabled="aplicando || !codigo.trim()"
          >
            {{ aplicando ? 'Aplicando…' : 'Aplicar' }}
          </button>
        </form>
      </section>

      <div class="compra-acciones">
        <button
          type="button"
          class="boton boton-secundario"
          @click="router.push({ name: 'compra-equipaje' })"
        >
          Volver
        </button>
      </div>
    </div>

    <ResumenViaje :reserva="reserva" variante="detalle">
      <button type="button" class="boton pagar" :disabled="pagando" @click="pagar">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M3 6h18v12H3V6Zm0 4h18" fill="none" stroke="currentColor" stroke-width="1.8" />
        </svg>
        {{ pagando && !totalAnterior ? 'Conectando con el pago…' : 'Continuar al pago' }}
      </button>
      <p v-if="mensajeError" class="error mensaje" role="alert">{{ mensajeError }}</p>
      <p class="suave mensaje">
        Pagarás en una plataforma segura. Al continuar aceptas las condiciones de la tarifa
        {{ NOMBRE_PACK[reserva.pack] }}.
      </p>
    </ResumenViaje>

    <ModalCambioPrecio
      v-if="totalAnterior"
      :anterior="totalAnterior"
      :nuevo="reserva.total"
      :enviando="pagando"
      @aceptar="pagar"
      @rechazar="totalAnterior = null"
    />
  </div>
</template>

<style scoped>
.bloque {
  display: grid;
  gap: 0.5rem;
  font-size: 0.8rem;
}

header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

h2 {
  font-size: 1rem;
}

.confirmar {
  display: inline-flex;
  gap: 0.6rem;
}

.nota {
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
  vertical-align: top;
}

td:nth-child(2),
td:nth-child(3) {
  white-space: nowrap;
}

.atajos {
  display: flex;
  gap: 1.25rem;
  margin-top: 0.25rem;
}

.atajos .enlace {
  font-size: 0.75rem;
}

.promocion {
  display: flex;
  align-items: flex-end;
  gap: 1rem;
}

.promocion .campo {
  flex: 1;
}

.aplicada {
  align-items: center;
  justify-content: space-between;
}

.pagar {
  width: 100%;
  margin-top: 0.9rem;
}

.mensaje {
  margin-top: 0.6rem;
  font-size: 0.68rem;
}
</style>
