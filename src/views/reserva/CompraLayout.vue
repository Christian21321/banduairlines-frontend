<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

import { ErrorApi } from '@/api/http'
import PasosCompra from '@/components/reserva/PasosCompra.vue'
import { useCompraStore } from '@/stores/compra'

const compra = useCompraStore()
const route = useRoute()
const router = useRouter()

const PASO_CONFIRMACION = 5

const listo = ref(false)
const errorCarga = ref('')
const paso = computed(() => route.meta.pasoCompra ?? 0)

/** Lleva al pasajero al paso que le corresponde si entra a uno que todavía no puede ver. */
async function verificarPaso(): Promise<void> {
  if (paso.value === 0) return
  const reserva = compra.reserva
  if (!reserva) {
    await router.replace({ name: 'compra-inicio' })
  } else if (paso.value < PASO_CONFIRMACION && !compra.enCurso) {
    await router.replace({
      name: reserva.estado === 'CONFIRMADA' ? 'compra-confirmacion' : 'compra-inicio',
    })
  } else if (
    paso.value > 1 &&
    paso.value < PASO_CONFIRMACION &&
    (reserva.pasajeros.length === 0 || !reserva.contacto)
  ) {
    await router.replace({ name: 'compra-pasajeros' })
  }
}

async function cargar(): Promise<void> {
  errorCarga.value = ''
  try {
    await compra.restaurar()
    await verificarPaso()
    listo.value = true
  } catch (error) {
    if (!(error instanceof ErrorApi)) throw error
    errorCarga.value = error.message
  }
}

onMounted(() => {
  compra.iniciarReloj()
  void cargar()
})
onBeforeUnmount(() => compra.detenerReloj())

watch(
  () => route.name,
  () => {
    if (listo.value) void verificarPaso()
  },
)

function buscarDeNuevo(): void {
  compra.reiniciar()
  void router.push({ name: 'inicio' })
}
</script>

<template>
  <div class="compra">
    <section v-if="errorCarga" class="tarjeta estado" role="alert">
      <h1>No pudimos cargar tu compra</h1>
      <p class="suave">{{ errorCarga }}</p>
      <button type="button" class="boton" @click="cargar">Reintentar</button>
    </section>

    <p v-else-if="!listo" class="suave" aria-live="polite">Cargando tu compra…</p>

    <section v-else-if="compra.expirada" class="tarjeta estado" role="alert">
      <h1>Tu selección venció</h1>
      <p class="suave">
        Se acabó el tiempo para completar la compra y liberamos tus asientos. Busca tu vuelo de
        nuevo para empezar otra vez.
      </p>
      <button type="button" class="boton" @click="buscarDeNuevo">Buscar vuelos</button>
    </section>

    <template v-else>
      <PasosCompra
        v-if="compra.reserva && compra.enCurso"
        :paso-actual="paso"
        :segundos-restantes="compra.segundosRestantes"
      />
      <RouterView v-if="paso === 0 || compra.reserva" />
    </template>
  </div>
</template>

<style scoped>
.compra {
  display: grid;
  gap: 1.25rem;
  max-width: 920px;
  margin: 0 auto;
}

.estado {
  display: grid;
  gap: 0.75rem;
  justify-items: start;
  max-width: 520px;
  margin: 2rem auto;
}

.estado h1 {
  font-size: 1.3rem;
}
</style>
