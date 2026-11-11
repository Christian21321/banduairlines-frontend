<script setup lang="ts">
import { computed } from 'vue'

import { formatoCuentaRegresiva } from '@/utils/formato'

const props = defineProps<{
  /** 0 = inicio de compra (ningún paso activo), 1 a 4 = paso en curso. */
  pasoActual: number
  segundosRestantes: number
}>()

const PASOS = ['Pasajeros', 'Asientos', 'Equipaje', 'Resumen']

const pasos = computed(() =>
  PASOS.map((nombre, indice) => {
    const numero = indice + 1
    return {
      nombre,
      numero,
      estado:
        numero < props.pasoActual ? 'listo' : numero === props.pasoActual ? 'actual' : 'pendiente',
    }
  }),
)
</script>

<template>
  <div class="pasos tarjeta">
    <ol>
      <li
        v-for="paso in pasos"
        :key="paso.numero"
        :class="paso.estado"
        :aria-current="paso.estado === 'actual' ? 'step' : undefined"
      >
        <span class="numero" aria-hidden="true">
          <svg v-if="paso.estado === 'listo'" viewBox="0 0 16 16" width="12" height="12">
            <path d="m3 8.5 3.2 3L13 4.5" fill="none" stroke="currentColor" stroke-width="2" />
          </svg>
          <template v-else>{{ paso.numero }}</template>
        </span>
        <span>{{ paso.nombre }}</span>
        <span v-if="paso.estado === 'listo'" class="solo-lectores">(completado)</span>
      </li>
    </ol>
    <p class="contador" role="timer">
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.4" />
        <path d="M8 4.5V8l2.3 1.6" fill="none" stroke="currentColor" stroke-width="1.4" />
      </svg>
      Tu selección se mantiene por
      <strong>{{ formatoCuentaRegresiva(segundosRestantes) }}</strong>
    </p>
  </div>
</template>

<style scoped>
.pasos {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1.5rem;
  padding: 0.75rem 1.25rem;
}

ol {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

li {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--color-texto-suave);
  font-size: 0.8rem;
}

li + li::before {
  content: '';
  width: 1.75rem;
  height: 1.5px;
  margin-right: 0.3rem;
  background: var(--color-borde);
}

@media (max-width: 600px) {
  li + li::before {
    display: none;
  }
}

li.listo + li::before {
  background: var(--color-primario);
}

.numero {
  display: grid;
  place-items: center;
  width: 1.4rem;
  height: 1.4rem;
  border: 1.5px solid currentColor;
  border-radius: 50%;
  font-size: 0.7rem;
  font-weight: 600;
}

.actual {
  color: var(--color-primario);
  font-weight: 700;
}

.actual .numero {
  border-color: var(--color-primario);
  background: var(--color-primario);
  color: #fff;
}

.listo {
  color: var(--color-texto);
}

.listo .numero {
  border-color: var(--color-exito-suave);
  background: var(--color-exito-suave);
  color: #14431f;
}

.contador {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.9rem;
  border: 1.5px solid var(--color-primario);
  border-radius: 999px;
  color: var(--color-primario);
  font-size: 0.75rem;
  white-space: nowrap;
}

.contador strong {
  font-variant-numeric: tabular-nums;
}
</style>
