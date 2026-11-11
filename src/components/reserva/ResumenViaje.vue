<script setup lang="ts">
import { computed } from 'vue'

import type { Reserva } from '@/types/reserva'
import { formatoCLP, formatoFechaCorta, formatoHora } from '@/utils/formato'
import { describirPasajeros, NOMBRE_PACK } from '@/utils/reserva'

const props = defineProps<{
  reserva: Reserva
  /** "viaje": panel lateral de los pasos. "detalle": desglose final del resumen. */
  variante?: 'viaje' | 'detalle'
}>()

const detalle = computed(() => props.variante === 'detalle')
const tramos = computed(() => props.reserva.itinerario.tramos)
const ruta = computed(() => {
  const primero = tramos.value[0]
  const ultimo = tramos.value.at(-1)
  return primero && ultimo ? `${primero.origen.codigo} → ${ultimo.destino.codigo}` : ''
})
const tiene = (concepto: string) => props.reserva.total.lineas.some((l) => l.concepto === concepto)
</script>

<template>
  <aside class="tarjeta resumen" aria-label="Resumen de tu viaje">
    <h2 v-if="detalle" class="titulo-detalle">Detalle del total</h2>
    <template v-else>
      <p class="antetitulo">Tu viaje</p>
      <h2 class="ruta">{{ ruta }}</h2>
      <p v-for="tramo in tramos" :key="tramo.tramoId" class="suave dato">
        {{ formatoFechaCorta(tramo.salida) }} · {{ tramo.numeroVuelo }} ·
        {{ formatoHora(tramo.salida) }} – {{ formatoHora(tramo.llegada) }}
      </p>
      <p class="suave dato">
        {{ describirPasajeros(reserva.cantidadPasajeros) }} · Tarifa {{ NOMBRE_PACK[reserva.pack] }}
      </p>
      <hr />
    </template>

    <dl>
      <div v-for="linea in reserva.total.lineas" :key="linea.descripcion">
        <dt>{{ linea.descripcion }}</dt>
        <dd>{{ formatoCLP(linea.montoCLP) }}</dd>
      </div>
      <template v-if="!detalle">
        <div v-if="!tiene('ASIENTOS')" class="pendiente">
          <dt>Asientos</dt>
          <dd>Por elegir</dd>
        </div>
        <div v-if="!tiene('EQUIPAJE')" class="pendiente">
          <dt>Equipaje</dt>
          <dd>Por elegir</dd>
        </div>
      </template>
      <div v-if="reserva.promocion" class="descuento">
        <dt>Código {{ reserva.promocion.codigo }}</dt>
        <dd>{{ formatoCLP(-reserva.total.descuentoCLP) }}</dd>
      </div>
    </dl>
    <hr />
    <p class="total">
      <span>{{ detalle ? 'Total a pagar' : 'Total' }}</span>
      <strong>CLP {{ formatoCLP(reserva.total.totalCLP) }}</strong>
    </p>
    <slot />
  </aside>
</template>

<style scoped>
.resumen {
  font-size: 0.8rem;
}

.antetitulo {
  color: var(--color-texto-suave);
  font-size: 0.62rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.ruta {
  margin: 0.2rem 0;
  font-size: 1.2rem;
}

.titulo-detalle {
  margin-bottom: 0.75rem;
  font-size: 1.05rem;
}

.dato {
  font-size: 0.72rem;
}

hr {
  margin: 0.75rem 0;
  border: none;
  border-top: 1px solid var(--color-borde);
}

dl {
  display: grid;
  gap: 0.4rem;
  margin: 0;
}

dl div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

dd {
  margin: 0;
  white-space: nowrap;
}

.pendiente {
  color: var(--color-texto-suave);
}

.descuento {
  color: var(--color-exito);
}

.total {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  font-weight: 700;
}

.total strong {
  color: var(--color-primario);
  font-size: 1.2rem;
}
</style>
