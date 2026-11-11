<script setup lang="ts">
import { computed, onMounted, useTemplateRef } from 'vue'

import type { Total } from '@/types/reserva'
import { formatoCLP } from '@/utils/formato'

const props = defineProps<{
  anterior: Total
  nuevo: Total
  enviando?: boolean
}>()

const emit = defineEmits<{ aceptar: []; rechazar: [] }>()

const dialogo = useTemplateRef<HTMLDialogElement>('dialogo')

onMounted(() => dialogo.value?.showModal())

/** Líneas del total cuyo monto cambió, para explicar de dónde viene la diferencia. */
const cambios = computed(() =>
  props.nuevo.lineas.flatMap((linea) => {
    const antes = props.anterior.lineas.find((l) => l.concepto === linea.concepto)
    return antes && antes.montoCLP !== linea.montoCLP
      ? [{ descripcion: linea.descripcion, antes: antes.montoCLP, ahora: linea.montoCLP }]
      : []
  }),
)

const diferencia = computed(() => props.nuevo.totalCLP - props.anterior.totalCLP)
</script>

<template>
  <dialog
    ref="dialogo"
    class="modal"
    aria-labelledby="titulo-cambio-precio"
    @cancel.prevent="emit('rechazar')"
  >
    <span class="icono" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path
          d="M12 4 2.5 20h19L12 4Zm0 6v5m0 2.2v.3"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </span>
    <h2 id="titulo-cambio-precio">El precio de tu vuelo cambió</h2>
    <p class="suave">
      El precio se actualizó mientras completabas tu compra. Para seguir necesitamos que aceptes el
      nuevo total.
    </p>
    <dl class="detalle">
      <div v-for="cambio in cambios" :key="cambio.descripcion">
        <dt>{{ cambio.descripcion }}</dt>
        <dd>
          <strong>{{ formatoCLP(cambio.antes) }} → {{ formatoCLP(cambio.ahora) }}</strong>
        </dd>
      </div>
      <div>
        <dt>Total anterior</dt>
        <dd>
          <s>{{ formatoCLP(anterior.totalCLP) }}</s>
        </dd>
      </div>
      <div class="nuevo">
        <dt>Nuevo total</dt>
        <dd>
          <strong>CLP {{ formatoCLP(nuevo.totalCLP) }}</strong>
          <span class="diferencia" :class="{ baja: diferencia < 0 }">
            {{ diferencia > 0 ? '+' : '' }}{{ formatoCLP(diferencia) }}
          </span>
        </dd>
      </div>
    </dl>
    <p class="suave nota">Tus asientos y equipaje se mantienen igual.</p>
    <div class="acciones">
      <button
        type="button"
        class="boton boton-secundario"
        :disabled="enviando"
        @click="emit('rechazar')"
      >
        No acepto, volver
      </button>
      <button type="button" class="boton" :disabled="enviando" @click="emit('aceptar')">
        {{ enviando ? 'Continuando…' : 'Aceptar y continuar al pago' }}
      </button>
    </div>
  </dialog>
</template>

<style scoped>
.modal {
  width: min(27rem, calc(100vw - 2rem));
  padding: 1.5rem;
  border: none;
  border-radius: var(--radio-tarjeta);
  color: var(--color-texto);
  font-size: 0.82rem;
}

.modal::backdrop {
  background: rgb(22 25 31 / 55%);
}

.icono {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: #ffb3b3;
  color: var(--color-error);
}

h2 {
  margin: 0.9rem 0 0.3rem;
  font-size: 1.25rem;
}

.detalle {
  display: grid;
  gap: 0.5rem;
  margin: 1rem 0 0.75rem;
  padding: 0.9rem 1rem;
  border-radius: 12px;
  background: #f1f2f4;
}

.detalle div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

dd {
  margin: 0;
  text-align: right;
  white-space: nowrap;
}

.nuevo {
  padding-top: 0.6rem;
  border-top: 1px solid var(--color-borde);
  font-weight: 700;
}

.nuevo strong {
  display: block;
  color: var(--color-primario);
  font-size: 1.25rem;
}

.diferencia {
  display: inline-block;
  margin-top: 0.2rem;
  padding: 0.1rem 0.6rem;
  border-radius: 999px;
  background: #ffb3b3;
  color: var(--color-error);
  font-size: 0.7rem;
}

.diferencia.baja {
  background: var(--color-exito-suave);
  color: #14431f;
}

.nota {
  font-size: 0.72rem;
}

.acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 1rem;
}
</style>
