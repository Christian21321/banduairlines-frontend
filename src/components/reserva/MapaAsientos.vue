<script setup lang="ts">
import { computed } from 'vue'

import type { Asiento, MapaAsientos } from '@/types/reserva'
import { formatoCLP } from '@/utils/formato'

const props = defineProps<{
  mapa: MapaAsientos
  /** Iniciales del pasajero que ocupa cada asiento de esta reserva: { "12C": "CR" }. */
  ocupantes: Record<string, string>
  /** Asiento del pasajero que está eligiendo. */
  asientoActivo: string | null
  /** Si se indica, solo estos asientos se pueden elegir (menor junto a su adulto). */
  permitidos: string[] | null
  deshabilitado?: boolean
}>()

const emit = defineEmits<{ elegir: [codigo: string] }>()

type Aspecto = 'ocupado' | 'propio' | 'permitido' | 'restringido' | 'mas-espacio' | 'disponible'

function aspecto(asiento: Asiento): Aspecto {
  if (props.ocupantes[asiento.codigo]) return 'propio'
  if (asiento.estado !== 'DISPONIBLE') return 'ocupado'
  if (props.permitidos) {
    return props.permitidos.includes(asiento.codigo) ? 'permitido' : 'restringido'
  }
  return asiento.categoria === 'MAS_ESPACIO' ? 'mas-espacio' : 'disponible'
}

function sePuedeElegir(asiento: Asiento): boolean {
  if (props.deshabilitado) return false
  const tipo = aspecto(asiento)
  // El asiento propio se puede volver a pulsar para liberarlo.
  if (tipo === 'propio') return asiento.codigo === props.asientoActivo
  return tipo !== 'ocupado' && tipo !== 'restringido'
}

function etiqueta(asiento: Asiento): string {
  const ocupante = props.ocupantes[asiento.codigo]
  if (ocupante) return `Asiento ${asiento.codigo}, elegido para ${ocupante}`
  if (asiento.estado !== 'DISPONIBLE') return `Asiento ${asiento.codigo}, no disponible`
  if (aspecto(asiento) === 'restringido') {
    return `Asiento ${asiento.codigo}, no permitido para este pasajero`
  }
  return `Asiento ${asiento.codigo}, ${formatoCLP(asiento.precioCLP)}`
}

const filas = computed(() =>
  props.mapa.filas.map((fila) => {
    const porColumna = new Map(fila.asientos.map((a) => [a.codigo.replace(/^\d+/, ''), a]))
    // Los asientos se agrupan en bloques separados por pasillos; el número de fila va en el primero.
    const bloques: (Asiento | undefined)[][] = [[]]
    for (const columna of props.mapa.columnas) {
      bloques.at(-1)?.push(porColumna.get(columna))
      if (props.mapa.pasillosDespuesDe.includes(columna)) bloques.push([])
    }
    return { numero: fila.numero, bloques }
  }),
)

const encabezado = computed(() => filas.value[0]?.bloques.map((b) => b.length) ?? [])
const columnasPorBloque = computed(() => {
  let inicio = 0
  return encabezado.value.map((cantidad) => {
    const columnas = props.mapa.columnas.slice(inicio, inicio + cantidad)
    inicio += cantidad
    return columnas
  })
})
</script>

<template>
  <div class="fuselaje" role="group" :aria-label="`Mapa de asientos, ${mapa.modeloAeronave}`">
    <div class="fila letras" aria-hidden="true">
      <template v-for="(columnas, indice) in columnasPorBloque" :key="indice">
        <span v-if="indice > 0" class="pasillo"></span>
        <span v-for="columna in columnas" :key="columna" class="celda">{{ columna }}</span>
      </template>
    </div>
    <div v-for="fila in filas" :key="fila.numero" class="fila">
      <template v-for="(bloque, indice) in fila.bloques" :key="indice">
        <span v-if="indice > 0" class="pasillo" aria-hidden="true">{{
          indice === 1 ? fila.numero : ''
        }}</span>
        <template v-for="(asiento, posicion) in bloque" :key="posicion">
          <button
            v-if="asiento"
            type="button"
            class="celda asiento"
            :class="[aspecto(asiento), { activo: asiento.codigo === asientoActivo }]"
            :disabled="!sePuedeElegir(asiento)"
            :aria-label="etiqueta(asiento)"
            :aria-pressed="aspecto(asiento) === 'propio'"
            @click="emit('elegir', asiento.codigo)"
          >
            <template v-if="aspecto(asiento) === 'propio'">{{
              ocupantes[asiento.codigo]
            }}</template>
            <template v-else-if="aspecto(asiento) !== 'ocupado'">{{
              asiento.codigo.replace(/^\d+/, '')
            }}</template>
          </button>
          <span v-else class="celda"></span>
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped>
.fuselaje {
  display: grid;
  gap: 0.45rem;
  width: fit-content;
  padding: 4.5rem 1.4rem 1.4rem;
  border-radius: 9rem 9rem 1.5rem 1.5rem;
  background: var(--color-superficie);
}

.fila {
  display: flex;
  gap: 0.35rem;
}

.celda {
  display: grid;
  place-items: center;
  width: 1.75rem;
  height: 1.75rem;
  font-size: 0.62rem;
  font-weight: 700;
}

.letras .celda {
  height: 1.1rem;
  color: var(--color-texto-suave);
  font-weight: 500;
}

.pasillo {
  display: grid;
  place-items: center;
  width: 1.9rem;
  color: var(--color-texto-suave);
  font-size: 0.65rem;
}

.asiento {
  padding: 0;
  border: 1.5px solid var(--color-texto);
  border-radius: 5px;
  background: var(--color-superficie);
  color: var(--color-texto);
  cursor: pointer;
}

.asiento:disabled {
  cursor: not-allowed;
}

.asiento:hover:not(:disabled) {
  background: var(--color-primario-suave);
}

.mas-espacio {
  border-color: var(--color-primario);
  color: var(--color-primario);
}

.ocupado {
  border-color: #cfd2d6;
  background: #cfd2d6;
}

.propio {
  border-color: var(--color-primario);
  background: var(--color-primario);
  color: #fff;
}

.propio.activo {
  box-shadow:
    0 0 0 2px var(--color-superficie),
    0 0 0 4px var(--color-primario);
}

.propio:hover:not(:disabled) {
  background: var(--color-primario-oscuro);
}

.permitido {
  border-color: var(--color-exito);
  background: var(--color-exito-suave);
  color: #14431f;
}

.restringido {
  border: 1.5px dashed #9aa1ab;
  color: #9aa1ab;
}
</style>
