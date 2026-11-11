<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { ErrorApi } from '@/api/http'
import MapaAsientos from '@/components/reserva/MapaAsientos.vue'
import ResumenViaje from '@/components/reserva/ResumenViaje.vue'
import { useCompraStore } from '@/stores/compra'
import type { Pasajero, Reserva, SeleccionAsiento } from '@/types/reserva'
import { formatoCLP } from '@/utils/formato'
import { asientosContiguos, iniciales, nombreCorto } from '@/utils/reserva'

const compra = useCompraStore()
const router = useRouter()

const reserva = computed(() => compra.reserva as Reserva)
const tramos = computed(() => reserva.value.itinerario.tramos)
const tramoId = ref(tramos.value[0]?.tramoId ?? 0)
const tramo = computed(() => tramos.value.find((t) => t.tramoId === tramoId.value))
const mapa = computed(() => compra.mapas[tramoId.value] ?? null)
const pasajeros = computed(() => compra.pasajerosConAsiento)

const activoId = ref<number | null>(null)
const guardando = ref(false)
const mensajeError = ref('')
const mensajeInfo = ref('')

function asientoDe(pasajeroId: number | undefined): string | null {
  return (
    reserva.value.asientos.find((a) => a.pasajeroId === pasajeroId && a.tramoId === tramoId.value)
      ?.asiento ?? null
  )
}

function responsableDe(pasajero: Pasajero): Pasajero | undefined {
  return reserva.value.pasajeros.find((p) => p.ref === pasajero.adultoResponsableRef)
}

const activo = computed(() => pasajeros.value.find((p) => p.pasajeroId === activoId.value) ?? null)
const responsable = computed(() =>
  activo.value?.tipo === 'NINO' ? responsableDe(activo.value) : undefined,
)
const asientoResponsable = computed(() => asientoDe(responsable.value?.pasajeroId))
/** Un menor no puede elegir mientras su adulto no tenga asiento. */
const esperaAdulto = computed(() => activo.value?.tipo === 'NINO' && !asientoResponsable.value)
/** Para un menor, solo valen los asientos libres junto a su adulto. */
const permitidos = computed(() =>
  activo.value?.tipo === 'NINO' && asientoResponsable.value && mapa.value
    ? asientosContiguos(asientoResponsable.value, mapa.value)
    : null,
)

/** Puede pasar que junto al adulto ya no queden asientos libres. */
const sinContiguosLibres = computed(() => {
  const libres = mapa.value?.filas
    .flatMap((f) => f.asientos)
    .filter((a) => a.estado === 'DISPONIBLE')
    .map((a) => a.codigo)
  return permitidos.value !== null && !permitidos.value.some((codigo) => libres?.includes(codigo))
})

const ocupantes = computed(() =>
  Object.fromEntries(
    pasajeros.value.flatMap((p) => {
      const asiento = asientoDe(p.pasajeroId)
      return asiento ? [[asiento, iniciales(p.nombres, p.apellidos)]] : []
    }),
  ),
)

const precios = computed(() => {
  const asientos = mapa.value?.filas.flatMap((f) => f.asientos) ?? []
  const filasMasEspacio = (mapa.value?.filas ?? [])
    .filter((f) => f.asientos.some((a) => a.categoria === 'MAS_ESPACIO'))
    .map((f) => f.numero)
  return {
    estandar: asientos.find((a) => a.categoria === 'ESTANDAR')?.precioCLP,
    masEspacio: asientos.find((a) => a.categoria === 'MAS_ESPACIO')?.precioCLP,
    filas:
      filasMasEspacio.length > 1
        ? `filas ${filasMasEspacio[0]}–${filasMasEspacio.at(-1)}`
        : `fila ${filasMasEspacio[0]}`,
  }
})

function estadoDe(pasajero: Pasajero): string {
  const asiento = asientoDe(pasajero.pasajeroId)
  const eligiendo = pasajero.pasajeroId === activoId.value
  if (pasajero.tipo === 'NINO' && !asiento) {
    return `Menor · a cargo de ${responsableDe(pasajero)?.nombres ?? 'un adulto'}`
  }
  if (asiento) return `Asiento ${asiento} · ${eligiendo ? 'Cambiando' : 'Cambiar'}`
  return eligiendo ? 'Eligiendo ahora' : 'Sin asiento'
}

/** Pasa al siguiente pasajero sin asiento; los adultos van antes que los menores a su cargo. */
function activarSiguiente(): void {
  const pendientes = pasajeros.value.filter((p) => !asientoDe(p.pasajeroId))
  const siguiente =
    pendientes.find((p) => p.tipo === 'ADULTO') ??
    pendientes.find((p) => asientoDe(responsableDe(p)?.pasajeroId)) ??
    null
  if (siguiente) activoId.value = siguiente.pasajeroId
}

async function guardar(selecciones: SeleccionAsiento[]): Promise<boolean> {
  guardando.value = true
  mensajeError.value = ''
  try {
    await compra.elegirAsientos(selecciones)
    return true
  } catch (error) {
    if (!(error instanceof ErrorApi)) throw error
    mensajeError.value = error.message
    return false
  } finally {
    guardando.value = false
  }
}

async function elegir(codigo: string): Promise<void> {
  const pasajero = activo.value
  if (!pasajero || !mapa.value || guardando.value) return
  mensajeInfo.value = ''
  const liberar = asientoDe(pasajero.pasajeroId) === codigo
  const selecciones: SeleccionAsiento[] = [
    { pasajeroId: pasajero.pasajeroId, tramoId: tramoId.value, asiento: liberar ? null : codigo },
  ]
  // Si un adulto se cambia o suelta su asiento, los menores a su cargo que ya no quedan a su
  // lado pierden el suyo y deben elegir de nuevo.
  const contiguos = liberar ? [] : asientosContiguos(codigo, mapa.value)
  const separados = pasajeros.value.filter((p) => {
    const asiento = asientoDe(p.pasajeroId)
    return (
      p.tipo === 'NINO' &&
      p.adultoResponsableRef === pasajero.ref &&
      asiento !== null &&
      !contiguos.includes(asiento)
    )
  })
  for (const menor of separados) {
    selecciones.push({ pasajeroId: menor.pasajeroId, tramoId: tramoId.value, asiento: null })
  }
  if (!(await guardar(selecciones))) return
  if (separados.length > 0) {
    const nombres = separados.map((p) => p.nombres).join(' y ')
    mensajeInfo.value = `Liberamos el asiento de ${nombres} para que vuelva a quedar junto a ${pasajero.nombres}.`
  }
  if (!liberar) activarSiguiente()
}

async function cambiarTramo(id: number): Promise<void> {
  tramoId.value = id
  mensajeError.value = ''
  mensajeInfo.value = ''
  if (!compra.mapas[id]) await cargarMapa()
  activoId.value = null
  activarSiguiente()
  activoId.value ??= pasajeros.value[0]?.pasajeroId ?? null
}

async function cargarMapa(): Promise<void> {
  try {
    await compra.cargarMapa(tramoId.value)
  } catch (error) {
    if (!(error instanceof ErrorApi)) throw error
    mensajeError.value = error.message
  }
}

onMounted(() => cambiarTramo(tramoId.value))

async function continuarSinAsiento(): Promise<void> {
  const selecciones = reserva.value.asientos.map((a) => ({
    pasajeroId: a.pasajeroId,
    tramoId: a.tramoId,
    asiento: null,
  }))
  if (selecciones.length > 0 && !(await guardar(selecciones))) return
  await router.push({ name: 'compra-equipaje' })
}
</script>

<template>
  <div class="compra-columnas">
    <div class="compra-principal">
      <div class="compra-titulo">
        <h1>Elige tus asientos</h1>
        <p v-if="tramo">
          Vuelo {{ tramo.numeroVuelo }} · {{ tramo.origen.codigo }} → {{ tramo.destino.codigo }}.
          Selecciona un pasajero y luego su asiento.
        </p>
      </div>

      <div v-if="tramos.length > 1" class="tramos" role="tablist" aria-label="Tramos del viaje">
        <button
          v-for="opcion in tramos"
          :key="opcion.tramoId"
          type="button"
          role="tab"
          class="boton"
          :class="{ 'boton-secundario': opcion.tramoId !== tramoId }"
          :aria-selected="opcion.tramoId === tramoId"
          @click="cambiarTramo(opcion.tramoId)"
        >
          {{ opcion.origen.codigo }} → {{ opcion.destino.codigo }}
        </button>
      </div>

      <div class="pasajeros" role="radiogroup" aria-label="Pasajero que elige asiento">
        <button
          v-for="pasajero in pasajeros"
          :key="pasajero.pasajeroId"
          type="button"
          role="radio"
          class="pasajero"
          :class="{ activo: pasajero.pasajeroId === activoId }"
          :aria-checked="pasajero.pasajeroId === activoId"
          @click="activoId = pasajero.pasajeroId"
        >
          <span class="avatar" aria-hidden="true">{{
            iniciales(pasajero.nombres, pasajero.apellidos)
          }}</span>
          <span>
            <strong>{{ nombreCorto(pasajero.nombres, pasajero.apellidos) }}</strong>
            <small class="suave">{{ estadoDe(pasajero) }}</small>
          </span>
        </button>
      </div>

      <div aria-live="polite" class="mensajes">
        <p v-if="activo && esperaAdulto && responsable" class="aviso aviso-alerta">
          Primero elige el asiento de
          {{ nombreCorto(responsable.nombres, responsable.apellidos) }}. {{ activo.nombres }} debe
          sentarse a su lado.
        </p>
        <p
          v-else-if="activo && responsable && sinContiguosLibres && !asientoDe(activo.pasajeroId)"
          class="aviso aviso-alerta"
        >
          No quedan asientos libres junto a
          {{ nombreCorto(responsable.nombres, responsable.apellidos) }} ({{ asientoResponsable }}).
          Cambia su asiento para que {{ activo.nombres }} pueda sentarse a su lado.
        </p>
        <p v-else-if="activo && responsable && permitidos" class="aviso aviso-exito">
          {{ activo.nombres }} viaja a cargo de
          {{ nombreCorto(responsable.nombres, responsable.apellidos) }} ({{ asientoResponsable }}).
          Solo puedes elegir un asiento a su lado.
        </p>
        <p v-if="mensajeInfo" class="aviso">{{ mensajeInfo }}</p>
        <p v-if="mensajeError" class="aviso aviso-error" role="alert">{{ mensajeError }}</p>
      </div>

      <div class="cabina">
        <MapaAsientos
          v-if="mapa"
          :mapa="mapa"
          :ocupantes="ocupantes"
          :asiento-activo="asientoDe(activo?.pasajeroId)"
          :permitidos="permitidos"
          :deshabilitado="guardando || esperaAdulto || !activo"
          @elegir="elegir"
        />
        <p v-else class="suave">Cargando el mapa de asientos…</p>

        <div class="lateral">
          <section class="tarjeta leyenda">
            <h2>Leyenda</h2>
            <ul>
              <li v-if="precios.estandar !== undefined">
                <span class="muestra"></span>Disponible · {{ formatoCLP(precios.estandar) }}
              </li>
              <li v-if="precios.masEspacio !== undefined">
                <span class="muestra mas-espacio"></span>Más espacio, {{ precios.filas }} ·
                {{ formatoCLP(precios.masEspacio) }}
              </li>
              <li><span class="muestra seleccionado"></span>Seleccionado</li>
              <li><span class="muestra ocupado"></span>No disponible</li>
              <template v-if="permitidos">
                <li><span class="muestra permitido"></span>Válido para el menor</li>
                <li><span class="muestra restringido"></span>No permitido para este pasajero</li>
              </template>
            </ul>
          </section>

          <p class="aviso aviso-exito retenidos">
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.4" />
              <path d="m5 8.3 2.1 2L11 6" fill="none" stroke="currentColor" stroke-width="1.5" />
            </svg>
            <span>
              <strong>Tus asientos quedan retenidos</strong>
              Nadie más puede tomarlos mientras el contador siga corriendo.
            </span>
          </p>

          <section class="sin-asiento">
            <h2>¿Prefieres no elegir ahora?</h2>
            <p class="suave">Se te asignará un asiento sin costo al hacer check-in.</p>
            <button type="button" class="enlace" :disabled="guardando" @click="continuarSinAsiento">
              Continuar sin elegir asiento
            </button>
          </section>
        </div>
      </div>

      <div class="compra-acciones">
        <button
          type="button"
          class="boton boton-secundario"
          @click="router.push({ name: 'compra-pasajeros' })"
        >
          Volver
        </button>
        <button
          type="button"
          class="boton"
          :disabled="guardando"
          @click="router.push({ name: 'compra-equipaje' })"
        >
          Continuar a equipaje
        </button>
      </div>
    </div>

    <ResumenViaje :reserva="reserva" />
  </div>
</template>

<style scoped>
.tramos,
.pasajeros {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.pasajero {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.45rem 1rem 0.45rem 0.5rem;
  border: 2px solid transparent;
  border-radius: 999px;
  background: var(--color-superficie);
  color: var(--color-texto);
  font-size: 0.78rem;
  text-align: left;
  cursor: pointer;
}

.pasajero.activo {
  border-color: var(--color-primario);
}

.pasajero strong,
.pasajero small {
  display: block;
  line-height: 1.25;
}

.pasajero small {
  font-size: 0.68rem;
}

.avatar {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: var(--color-primario);
  color: #fff;
  font-size: 0.68rem;
  font-weight: 700;
}

.mensajes {
  display: grid;
  gap: 0.5rem;
}

.mensajes:empty {
  display: none;
}

.cabina {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 1rem;
}

.lateral {
  display: grid;
  flex: 1;
  gap: 0.75rem;
  min-width: 220px;
}

.leyenda {
  padding: 1rem 1.1rem;
}

h2 {
  font-size: 0.82rem;
}

.leyenda ul {
  display: grid;
  gap: 0.55rem;
  margin: 0.7rem 0 0;
  padding: 0;
  list-style: none;
  font-size: 0.72rem;
}

.leyenda li {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.muestra {
  flex: none;
  width: 1.15rem;
  height: 1.15rem;
  border: 1.5px solid var(--color-texto);
  border-radius: 4px;
  background: var(--color-superficie);
}

.muestra.mas-espacio {
  border-color: var(--color-primario);
}

.muestra.seleccionado {
  border-color: var(--color-primario);
  background: var(--color-primario);
}

.muestra.ocupado {
  border-color: #cfd2d6;
  background: #cfd2d6;
}

.muestra.permitido {
  border-color: var(--color-exito);
  background: var(--color-exito-suave);
}

.muestra.restringido {
  border: 1.5px dashed #9aa1ab;
}

.retenidos {
  font-size: 0.72rem;
}

.retenidos strong {
  display: block;
  font-size: 0.8rem;
}

.sin-asiento {
  display: grid;
  gap: 0.3rem;
  justify-items: start;
  padding: 0.9rem 1.1rem;
  border: 1.5px dashed #8b929c;
  border-radius: var(--radio-tarjeta);
  font-size: 0.72rem;
}

.sin-asiento .enlace {
  font-size: 0.72rem;
}
</style>
