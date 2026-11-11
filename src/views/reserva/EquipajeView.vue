<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { ErrorApi } from '@/api/http'
import ResumenViaje from '@/components/reserva/ResumenViaje.vue'
import { useCompraStore } from '@/stores/compra'
import type { Reserva, ServicioDisponible, SolicitudServicio } from '@/types/reserva'
import { formatoCLP } from '@/utils/formato'
import { asientosDe, nombreCorto } from '@/utils/reserva'

const compra = useCompraStore()
const router = useRouter()

const reserva = computed(() => compra.reserva as Reserva)
const pasajeros = computed(() => compra.pasajerosConAsiento)
const catalogo = computed(() => compra.catalogo)
const guardando = ref(false)
const mensajeError = ref('')

/** Cantidad por pasajero y servicio; se contrata la misma en cada tramo del viaje. */
const cantidades = reactive<Record<string, number>>({})
const clave = (pasajeroId: number, servicioId: string) => `${pasajeroId}:${servicioId}`

function cantidadDe(pasajeroId: number, servicioId: string): number {
  return cantidades[clave(pasajeroId, servicioId)] ?? 0
}

function sincronizar(): void {
  for (const nombre of Object.keys(cantidades)) delete cantidades[nombre]
  for (const servicio of reserva.value.servicios) {
    const nombre = clave(servicio.pasajeroId, servicio.servicioId)
    cantidades[nombre] = Math.max(cantidades[nombre] ?? 0, servicio.cantidad)
  }
}

onMounted(async () => {
  sincronizar()
  try {
    await compra.cargarCatalogo()
  } catch (error) {
    if (!(error instanceof ErrorApi)) throw error
    mensajeError.value = error.message
  }
})

function unidad(servicio: ServicioDisponible): string {
  return servicio.categoria === 'EQUIPAJE' ? 'por maleta' : 'por tramo'
}

async function cambiar(pasajeroId: number, servicio: ServicioDisponible, paso: number) {
  const nueva = cantidadDe(pasajeroId, servicio.servicioId) + paso
  if (nueva < 0 || nueva > servicio.maximoPorPasajero || guardando.value) return
  cantidades[clave(pasajeroId, servicio.servicioId)] = nueva

  const solicitud: SolicitudServicio[] = []
  for (const pasajero of pasajeros.value) {
    for (const disponible of catalogo.value?.disponibles ?? []) {
      const cantidad = cantidadDe(pasajero.pasajeroId, disponible.servicioId)
      if (cantidad === 0) continue
      for (const tramo of reserva.value.itinerario.tramos) {
        solicitud.push({
          servicioId: disponible.servicioId,
          pasajeroId: pasajero.pasajeroId,
          tramoId: tramo.tramoId,
          cantidad,
        })
      }
    }
  }

  guardando.value = true
  mensajeError.value = ''
  try {
    await compra.contratarServicios(solicitud)
  } catch (error) {
    if (!(error instanceof ErrorApi)) throw error
    mensajeError.value = error.message
  } finally {
    // Lo que manda es lo que quedó guardado en la reserva.
    sincronizar()
    guardando.value = false
  }
}
</script>

<template>
  <div class="compra-columnas">
    <div class="compra-principal">
      <div class="compra-titulo">
        <h1>Equipaje y servicios</h1>
        <p>Agrega lo que necesites por pasajero. Lo incluido en tu tarifa ya está considerado.</p>
      </div>

      <p v-if="!catalogo && !mensajeError" class="suave">Cargando servicios…</p>

      <section v-for="pasajero in pasajeros" :key="pasajero.pasajeroId" class="tarjeta pasajero">
        <header>
          <h2>
            {{ nombreCorto(pasajero.nombres, pasajero.apellidos) }}
            <template v-if="asientosDe(reserva, pasajero.pasajeroId)">
              · {{ asientosDe(reserva, pasajero.pasajeroId) }}
            </template>
          </h2>
          <span class="incluidos">
            <span v-for="incluido in catalogo?.incluidos" :key="incluido.tipo" class="chip">
              {{ incluido.descripcion }}
            </span>
          </span>
        </header>

        <div v-for="servicio in catalogo?.disponibles" :key="servicio.servicioId" class="servicio">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              v-if="servicio.categoria === 'EQUIPAJE'"
              d="M9 6V3h6v3m-8 0h10v14H7V6Zm2 16v-2m6 2v-2m-4-10v7m2-7v7"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <path
              v-else
              d="M3 8h18v3a1.5 1.5 0 0 0 0 3v3H3v-3a1.5 1.5 0 0 0 0-3V8Zm11 0v9"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            />
          </svg>
          <div class="descripcion">
            <strong>{{ servicio.nombre }}</strong>
            <small class="suave">{{ formatoCLP(servicio.precioCLP) }} {{ unidad(servicio) }}</small>
          </div>
          <div class="contador">
            <button
              type="button"
              :disabled="guardando || cantidadDe(pasajero.pasajeroId, servicio.servicioId) === 0"
              :aria-label="`Quitar ${servicio.nombre} a ${pasajero.nombres}`"
              @click="cambiar(pasajero.pasajeroId, servicio, -1)"
            >
              −
            </button>
            <output aria-live="polite">{{
              cantidadDe(pasajero.pasajeroId, servicio.servicioId)
            }}</output>
            <button
              type="button"
              :disabled="
                guardando ||
                cantidadDe(pasajero.pasajeroId, servicio.servicioId) >= servicio.maximoPorPasajero
              "
              :aria-label="`Agregar ${servicio.nombre} a ${pasajero.nombres}`"
              @click="cambiar(pasajero.pasajeroId, servicio, 1)"
            >
              +
            </button>
          </div>
        </div>
      </section>

      <p v-if="mensajeError" class="aviso aviso-error" role="alert">{{ mensajeError }}</p>

      <div class="compra-acciones">
        <button
          type="button"
          class="boton boton-secundario"
          @click="router.push({ name: 'compra-asientos' })"
        >
          Volver
        </button>
        <button
          type="button"
          class="boton"
          :disabled="guardando"
          @click="router.push({ name: 'compra-resumen' })"
        >
          Revisar resumen
        </button>
      </div>
    </div>

    <ResumenViaje :reserva="reserva" />
  </div>
</template>

<style scoped>
.pasajero {
  padding-block: 0.5rem;
}

header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding-block: 0.75rem;
}

h2 {
  font-size: 1rem;
}

.incluidos {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.servicio {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding-block: 0.9rem;
  border-top: 1px solid var(--color-borde);
  font-size: 0.8rem;
}

.servicio svg {
  flex: none;
  color: var(--color-texto-suave);
}

.descripcion {
  flex: 1;
}

.descripcion strong,
.descripcion small {
  display: block;
}

.contador {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 700;
}

.contador output {
  min-width: 1ch;
  text-align: center;
}

.contador button {
  display: grid;
  place-items: center;
  width: 1.6rem;
  height: 1.6rem;
  padding: 0;
  border: 1.5px solid var(--color-texto);
  border-radius: 50%;
  background: var(--color-superficie);
  color: var(--color-texto);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
}

.contador button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
</style>
