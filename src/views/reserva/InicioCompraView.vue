<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ErrorApi } from '@/api/http'
import { reservaSimulada } from '@/api/reserva'
import { useCompraStore } from '@/stores/compra'
import { useSesionStore } from '@/stores/sesion'
import type { Pack, SolicitudReserva } from '@/types/reserva'
import { formatoDuracion, formatoFechaLarga, formatoHora } from '@/utils/formato'
import { describirPasajeros, NOMBRE_PACK } from '@/utils/reserva'

const compra = useCompraStore()
const sesion = useSesionStore()
const route = useRoute()
const router = useRouter()

const cargando = ref(true)
const mensajeError = ref('')
const incluidos = ref<string[]>([])
const confirmandoCambio = ref(false)

const reserva = computed(() => (compra.enCurso ? compra.reserva : null))

function numero(valor: unknown, porDefecto: number): number {
  const leido = typeof valor === 'string' ? Number.parseInt(valor, 10) : Number.NaN
  return Number.isInteger(leido) && leido >= 0 ? leido : porDefecto
}

/**
 * Búsqueda entrega la alternativa elegida en la URL:
 * /compra?alternativaId=ALT-1&tramos=204,310&cabina=ECONOMY&pack=LIGHT&adultos=2&ninos=1&bebes=0
 */
function leerSeleccion(): SolicitudReserva | null {
  const { alternativaId, tramos, cabina, pack, adultos, ninos, bebes } = route.query
  if (typeof adultos !== 'string') return null
  const packs: Pack[] = ['BASIC', 'LIGHT', 'FULL']
  const cabinaElegida = typeof cabina === 'string' ? cabina : 'ECONOMY'
  return {
    alternativaId: typeof alternativaId === 'string' ? alternativaId : 'ALT-DEMO',
    tramos: (typeof tramos === 'string' ? tramos : '204')
      .split(',')
      .map((id) => ({ tramoId: Number(id), cabina: cabinaElegida })),
    pack: packs.find((p) => p === pack) ?? 'LIGHT',
    cantidadPasajeros: {
      adultos: numero(adultos, 1),
      ninos: numero(ninos, 0),
      bebes: numero(bebes, 0),
    },
  }
}

const SELECCION_DEMO: SolicitudReserva = {
  alternativaId: 'ALT-DEMO',
  tramos: [{ tramoId: 204, cabina: 'ECONOMY' }],
  pack: 'LIGHT',
  cantidadPasajeros: { adultos: 2, ninos: 0, bebes: 0 },
}

async function preparar(): Promise<void> {
  cargando.value = true
  mensajeError.value = ''
  try {
    // Una selección nueva en la URL reemplaza a la compra anterior.
    const seleccion = leerSeleccion() ?? (!reserva.value && reservaSimulada ? SELECCION_DEMO : null)
    if (seleccion) {
      await compra.cancelar().catch(() => compra.reiniciar())
      await compra.iniciar(seleccion)
      await router.replace({ name: 'compra-inicio' })
    }
    if (reserva.value) {
      if (sesion.autenticado && reserva.value.tipoCompra === 'INVITADO') {
        await compra.asociarCuenta()
      }
      const catalogo = await compra.cargarCatalogo()
      incluidos.value = catalogo.incluidos.map((i) => i.descripcion)
    }
  } catch (error) {
    if (!(error instanceof ErrorApi)) throw error
    mensajeError.value = error.message
  } finally {
    cargando.value = false
  }
}

onMounted(preparar)

function continuar(): void {
  void router.push({ name: 'compra-pasajeros' })
}

function iniciarSesion(): void {
  void router.push({ name: 'inicio-sesion', query: { redirigir: '/compra' } })
}

async function cambiarVuelo(): Promise<void> {
  await compra.cancelar().catch(() => {})
  await router.push({ name: 'inicio' })
}
</script>

<template>
  <p v-if="cargando" class="suave" aria-live="polite">Preparando tu compra…</p>

  <section v-else-if="!reserva" class="tarjeta vacio">
    <h1>Primero elige un vuelo</h1>
    <p v-if="mensajeError" class="error" role="alert">{{ mensajeError }}</p>
    <p v-else class="suave">Todavía no tienes una compra en curso.</p>
    <button type="button" class="boton" @click="router.push({ name: 'inicio' })">
      Buscar vuelos
    </button>
  </section>

  <div v-else class="inicio">
    <h1>Revisa tu vuelo antes de continuar</h1>

    <section
      v-for="(tramo, indice) in reserva.itinerario.tramos"
      :key="tramo.tramoId"
      class="tarjeta vuelo"
    >
      <div class="horario">
        <div>
          <p class="hora">{{ formatoHora(tramo.salida) }}</p>
          <p class="suave lugar">{{ tramo.origen.codigo }} · {{ tramo.origen.ciudad }}</p>
        </div>
        <div class="trayecto">
          <span class="suave">{{ formatoDuracion(tramo.salida, tramo.llegada) }} · Directo</span>
          <span class="linea" aria-hidden="true"></span>
        </div>
        <div class="llegada">
          <p class="hora">{{ formatoHora(tramo.llegada) }}</p>
          <p class="suave lugar">{{ tramo.destino.codigo }} · {{ tramo.destino.ciudad }}</p>
        </div>
      </div>
      <div class="datos">
        <span>{{ formatoFechaLarga(tramo.salida) }}</span>
        <span>Vuelo {{ tramo.numeroVuelo }}</span>
        <span>{{ describirPasajeros(reserva.cantidadPasajeros) }}</span>
        <strong class="tarifa">Tarifa {{ NOMBRE_PACK[reserva.pack] }}</strong>
        <template v-if="indice === 0">
          <span v-if="confirmandoCambio" class="confirmar">
            Perderás esta selección.
            <button type="button" class="enlace" @click="cambiarVuelo">Sí, cambiar</button>
            <button type="button" class="enlace" @click="confirmandoCambio = false">No</button>
          </span>
          <button v-else type="button" class="enlace cambiar" @click="confirmandoCambio = true">
            Cambiar vuelo
          </button>
        </template>
      </div>
      <div v-if="incluidos.length > 0" class="incluidos">
        <span v-for="incluido in incluidos" :key="incluido" class="chip">
          {{ incluido }} incluido
        </span>
      </div>
    </section>

    <p v-if="mensajeError" class="aviso aviso-error" role="alert">{{ mensajeError }}</p>

    <h2>¿Cómo quieres continuar?</h2>
    <div v-if="sesion.usuario" class="opciones">
      <section class="tarjeta opcion destacada">
        <h3>Continuar como {{ sesion.usuario.nombres }}</h3>
        <p>Completamos tus datos y la reserva queda guardada en Mis Viajes.</p>
        <button type="button" class="boton boton-secundario" @click="continuar">Continuar</button>
      </section>
    </div>
    <div v-else class="opciones">
      <section class="tarjeta opcion">
        <h3>Iniciar sesión</h3>
        <p class="suave">Tus datos se completan solos y la reserva queda guardada en Mis Viajes.</p>
        <button type="button" class="boton boton-secundario" @click="iniciarSesion">
          Iniciar sesión
        </button>
      </section>
      <section class="tarjeta opcion destacada">
        <h3>Continuar como invitado</h3>
        <p>No necesitas una cuenta. Te enviamos el código de reserva por correo.</p>
        <button type="button" class="boton boton-secundario" @click="continuar">
          Continuar como invitado
        </button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.inicio {
  display: grid;
  gap: 1rem;
  max-width: 760px;
  margin: 1rem auto 0;
  width: 100%;
}

h1 {
  font-size: 1.45rem;
}

h2 {
  margin-top: 0.5rem;
  font-size: 1rem;
}

.vacio {
  display: grid;
  gap: 0.75rem;
  justify-items: start;
  max-width: 520px;
  margin: 2rem auto;
}

.vuelo {
  display: grid;
  gap: 1rem;
  padding-block: 1.5rem;
}

.horario {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 1.5rem;
}

.hora {
  font-size: 2.1rem;
  font-weight: 800;
  line-height: 1.1;
}

.lugar {
  font-size: 0.72rem;
}

.llegada {
  text-align: right;
}

.trayecto {
  display: grid;
  gap: 0.35rem;
  text-align: center;
  font-size: 0.7rem;
}

.linea {
  height: 2px;
  background: var(--color-primario);
}

.datos {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 1.5rem;
  font-size: 0.78rem;
}

.tarifa {
  color: var(--color-primario);
}

.cambiar,
.confirmar {
  margin-left: auto;
}

.confirmar {
  display: inline-flex;
  gap: 0.6rem;
}

.incluidos {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.opciones {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1rem;
}

.opcion {
  display: grid;
  gap: 0.6rem;
  justify-items: start;
  align-content: start;
  font-size: 0.8rem;
}

.opcion h3 {
  font-size: 1.05rem;
}

.destacada {
  background: var(--color-primario);
  color: #fff;
}
</style>
