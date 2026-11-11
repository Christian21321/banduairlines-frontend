<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { ErrorApi } from '@/api/http'
import ResumenViaje from '@/components/reserva/ResumenViaje.vue'
import { useCompraStore } from '@/stores/compra'
import { useSesionStore } from '@/stores/sesion'
import type { DatosPasajero, Reserva, TipoPasajero } from '@/types/reserva'
import {
  calcularEdad,
  correoValido,
  EDAD_MINIMA_ADULTO,
  EDAD_MINIMA_NINO,
  NOMBRE_TIPO,
  rutValido,
  telefonoValido,
  tipoSegunEdad,
} from '@/utils/reserva'

const compra = useCompraStore()
const sesion = useSesionStore()
const router = useRouter()

const reserva = computed(() => compra.reserva as Reserva)
const fechaVuelo = computed(() => reserva.value.itinerario.tramos[0]?.salida ?? '')

const NACIONALIDADES = [
  { codigo: 'CL', nombre: 'Chilena' },
  { codigo: 'AR', nombre: 'Argentina' },
  { codigo: 'PE', nombre: 'Peruana' },
  { codigo: 'BO', nombre: 'Boliviana' },
  { codigo: 'OTRA', nombre: 'Otra' },
]

function formulariosIniciales(): DatosPasajero[] {
  if (reserva.value.pasajeros.length > 0) {
    return reserva.value.pasajeros.map((p) => ({
      ref: p.ref,
      tipo: p.tipo,
      nombres: p.nombres,
      apellidos: p.apellidos,
      fechaNacimiento: p.fechaNacimiento,
      tipoDocumento: p.tipoDocumento,
      numeroDocumento: p.numeroDocumento,
      nacionalidad: p.nacionalidad,
      adultoResponsableRef: p.adultoResponsableRef,
    }))
  }
  const { adultos, ninos, bebes } = reserva.value.cantidadPasajeros
  const tipos: TipoPasajero[] = [
    ...Array<TipoPasajero>(adultos).fill('ADULTO'),
    ...Array<TipoPasajero>(ninos).fill('NINO'),
    ...Array<TipoPasajero>(bebes).fill('BEBE'),
  ]
  return tipos.map((tipo, indice) => ({
    ref: `p${indice + 1}`,
    tipo,
    // Con sesión iniciada, el primer adulto parte con los datos de la cuenta.
    nombres: indice === 0 ? (sesion.usuario?.nombres ?? '') : '',
    apellidos: indice === 0 ? (sesion.usuario?.apellidos ?? '') : '',
    fechaNacimiento: '',
    tipoDocumento: 'RUT',
    numeroDocumento: '',
    nacionalidad: 'CL',
    adultoResponsableRef: null,
  }))
}

const pasajeros = reactive(formulariosIniciales())
const contacto = reactive({
  correo: reserva.value.contacto?.correo ?? sesion.usuario?.correo ?? '',
  telefono: reserva.value.contacto?.telefono ?? '',
})

const adultos = computed(() => pasajeros.filter((p) => p.tipo === 'ADULTO'))

// Con un solo adulto no hay nada que elegir: queda a cargo de todos los menores.
if (adultos.value.length === 1) {
  for (const pasajero of pasajeros) {
    if (pasajero.tipo !== 'ADULTO') pasajero.adultoResponsableRef ??= adultos.value[0]?.ref ?? null
  }
}

const errores = ref<Record<string, string>>({})
const mensajeError = ref('')
const enviando = ref(false)

function nombreDe(pasajero: DatosPasajero): string {
  const numeroPasajero = pasajeros.indexOf(pasajero) + 1
  return `${pasajero.nombres} ${pasajero.apellidos}`.trim() || `Pasajero ${numeroPasajero}`
}

function edadDe(pasajero: DatosPasajero): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pasajero.fechaNacimiento)) return null
  return calcularEdad(pasajero.fechaNacimiento, fechaVuelo.value)
}

const REQUISITO_EDAD: Record<TipoPasajero, string> = {
  ADULTO: `debe tener ${EDAD_MINIMA_ADULTO} años o más el día del vuelo`,
  NINO: `debe tener entre ${EDAD_MINIMA_NINO} y ${EDAD_MINIMA_ADULTO - 1} años el día del vuelo`,
  BEBE: `debe tener menos de ${EDAD_MINIMA_NINO} años el día del vuelo`,
}

function validar(): Record<string, string> {
  const encontrados: Record<string, string> = {}
  for (const pasajero of pasajeros) {
    const clave = (campo: string) => `${pasajero.ref}.${campo}`
    if (!pasajero.nombres.trim()) encontrados[clave('nombres')] = 'Ingresa los nombres.'
    if (!pasajero.apellidos.trim()) encontrados[clave('apellidos')] = 'Ingresa los apellidos.'

    const edad = edadDe(pasajero)
    if (edad === null || edad < 0) {
      encontrados[clave('fechaNacimiento')] = 'Ingresa una fecha de nacimiento válida.'
    } else if (tipoSegunEdad(edad) !== pasajero.tipo) {
      encontrados[clave('fechaNacimiento')] =
        `Un pasajero ${NOMBRE_TIPO[pasajero.tipo].toLowerCase()} ${REQUISITO_EDAD[pasajero.tipo]}.`
    }

    if (!pasajero.numeroDocumento.trim()) {
      encontrados[clave('numeroDocumento')] = 'Ingresa el número de documento.'
    } else if (pasajero.tipoDocumento === 'RUT' && !rutValido(pasajero.numeroDocumento)) {
      encontrados[clave('numeroDocumento')] = 'El RUT no es válido.'
    }

    if (pasajero.tipo !== 'ADULTO' && !pasajero.adultoResponsableRef) {
      encontrados[clave('adultoResponsableRef')] =
        'Debes elegir un adulto responsable para continuar.'
    }
  }
  // Cada adulto puede llevar un solo bebé en brazos.
  const conBebe = new Set<string>()
  for (const bebe of pasajeros.filter((p) => p.tipo === 'BEBE' && p.adultoResponsableRef)) {
    const adulto = bebe.adultoResponsableRef as string
    if (conBebe.has(adulto)) {
      encontrados[`${bebe.ref}.adultoResponsableRef`] = 'Ese adulto ya viaja con otro bebé.'
    }
    conBebe.add(adulto)
  }
  if (!correoValido(contacto.correo)) encontrados['contacto.correo'] = 'Ingresa un correo válido.'
  if (!telefonoValido(contacto.telefono)) {
    encontrados['contacto.telefono'] = 'Ingresa un teléfono válido, por ejemplo +56 9 1234 5678.'
  }
  return encontrados
}

async function continuar(): Promise<void> {
  mensajeError.value = ''
  errores.value = validar()
  if (Object.keys(errores.value).length > 0) {
    mensajeError.value = 'Revisa los campos marcados antes de continuar.'
    return
  }
  enviando.value = true
  try {
    const titular = adultos.value[0]
    await compra.guardarPasajeros(
      pasajeros.map((p) => ({
        ...p,
        nombres: p.nombres.trim(),
        apellidos: p.apellidos.trim(),
        numeroDocumento: p.numeroDocumento.trim(),
        adultoResponsableRef: p.tipo === 'ADULTO' ? null : p.adultoResponsableRef,
      })),
      {
        nombreCompleto: titular ? nombreDe(titular) : '',
        correo: contacto.correo.trim(),
        telefono: contacto.telefono.replace(/\s+/g, ''),
      },
    )
    await router.push({ name: 'compra-asientos' })
  } catch (error) {
    if (!(error instanceof ErrorApi)) throw error
    mensajeError.value = error.message
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <div class="compra-columnas">
    <form class="compra-principal" novalidate @submit.prevent="continuar">
      <div class="compra-titulo">
        <h1>¿Quiénes viajan?</h1>
        <p>Ingresa los datos tal como aparecen en el documento de cada pasajero.</p>
      </div>

      <fieldset
        v-for="(pasajero, indice) in pasajeros"
        :key="pasajero.ref"
        class="tarjeta pasajero"
        :class="{ menor: pasajero.tipo !== 'ADULTO' }"
      >
        <legend class="solo-lectores">Pasajero {{ indice + 1 }}</legend>
        <div class="cabecera">
          <h2>Pasajero {{ indice + 1 }} · {{ NOMBRE_TIPO[pasajero.tipo] }}</h2>
          <span v-if="pasajero.tipo !== 'ADULTO'" class="chip chip-aviso">
            Requiere adulto responsable
          </span>
        </div>

        <div class="campos">
          <label class="campo" :class="{ 'campo-error': errores[`${pasajero.ref}.nombres`] }">
            Nombres
            <input v-model="pasajero.nombres" type="text" autocomplete="off" />
            <small v-if="errores[`${pasajero.ref}.nombres`]">{{
              errores[`${pasajero.ref}.nombres`]
            }}</small>
          </label>
          <label class="campo" :class="{ 'campo-error': errores[`${pasajero.ref}.apellidos`] }">
            Apellidos
            <input v-model="pasajero.apellidos" type="text" autocomplete="off" />
            <small v-if="errores[`${pasajero.ref}.apellidos`]">{{
              errores[`${pasajero.ref}.apellidos`]
            }}</small>
          </label>
          <label
            class="campo"
            :class="{ 'campo-error': errores[`${pasajero.ref}.fechaNacimiento`] }"
          >
            Fecha de nacimiento
            <input v-model="pasajero.fechaNacimiento" type="date" />
            <small v-if="errores[`${pasajero.ref}.fechaNacimiento`]">{{
              errores[`${pasajero.ref}.fechaNacimiento`]
            }}</small>
          </label>
          <label class="campo">
            Tipo de documento
            <select v-model="pasajero.tipoDocumento">
              <option value="RUT">RUT</option>
              <option value="PASAPORTE">Pasaporte</option>
            </select>
          </label>
          <label
            class="campo"
            :class="{ 'campo-error': errores[`${pasajero.ref}.numeroDocumento`] }"
          >
            Número de documento
            <input
              v-model="pasajero.numeroDocumento"
              type="text"
              autocomplete="off"
              :placeholder="pasajero.tipoDocumento === 'RUT' ? '12.345.678-9' : ''"
            />
            <small v-if="errores[`${pasajero.ref}.numeroDocumento`]">{{
              errores[`${pasajero.ref}.numeroDocumento`]
            }}</small>
          </label>
          <label class="campo">
            Nacionalidad
            <select v-model="pasajero.nacionalidad">
              <option v-for="pais in NACIONALIDADES" :key="pais.codigo" :value="pais.codigo">
                {{ pais.nombre }}
              </option>
            </select>
          </label>
        </div>

        <template v-if="pasajero.tipo !== 'ADULTO'">
          <p class="aviso">
            <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
              <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.4" />
              <path d="M8 7.2v4M8 4.8v.4" stroke="currentColor" stroke-width="1.6" />
            </svg>
            <span v-if="pasajero.tipo === 'BEBE'">
              Los bebés viajan en brazos y no ocupan asiento. Elige qué adulto de esta reserva lo
              llevará.
            </span>
            <span v-else>
              <template v-if="pasajero.nombres.trim() && edadDe(pasajero) !== null">
                {{ pasajero.nombres.trim() }} tiene {{ edadDe(pasajero) }} años.
              </template>
              Elige qué adulto de esta reserva viajará a su cargo. Deberá sentarse a su lado en el
              avión.
            </span>
          </p>
          <label
            class="campo responsable"
            :class="{ 'campo-error': errores[`${pasajero.ref}.adultoResponsableRef`] }"
          >
            Adulto responsable
            <select v-model="pasajero.adultoResponsableRef">
              <option :value="null" disabled>Selecciona un adulto</option>
              <option v-for="adulto in adultos" :key="adulto.ref" :value="adulto.ref">
                {{ nombreDe(adulto) }}
              </option>
            </select>
            <small>{{
              errores[`${pasajero.ref}.adultoResponsableRef`] ??
              'Solo aparecen los adultos de esta reserva.'
            }}</small>
          </label>
        </template>
      </fieldset>

      <fieldset class="tarjeta pasajero">
        <legend class="solo-lectores">Contacto</legend>
        <div class="cabecera">
          <h2>Contacto</h2>
        </div>
        <p class="suave ayuda">
          A este correo enviamos el código de reserva y el comprobante de la compra.
        </p>
        <div class="campos dos">
          <label class="campo" :class="{ 'campo-error': errores['contacto.correo'] }">
            Correo
            <input v-model.trim="contacto.correo" type="email" autocomplete="email" />
            <small v-if="errores['contacto.correo']">{{ errores['contacto.correo'] }}</small>
          </label>
          <label class="campo" :class="{ 'campo-error': errores['contacto.telefono'] }">
            Teléfono
            <input
              v-model.trim="contacto.telefono"
              type="tel"
              autocomplete="tel"
              placeholder="+56 9 1234 5678"
            />
            <small v-if="errores['contacto.telefono']">{{ errores['contacto.telefono'] }}</small>
          </label>
        </div>
      </fieldset>

      <p v-if="mensajeError" class="aviso aviso-error" role="alert">{{ mensajeError }}</p>

      <div class="compra-acciones">
        <button
          type="button"
          class="boton boton-secundario"
          @click="router.push({ name: 'compra-inicio' })"
        >
          Volver
        </button>
        <button type="submit" class="boton" :disabled="enviando">
          {{ enviando ? 'Guardando…' : 'Continuar a asientos' }}
        </button>
      </div>
    </form>

    <ResumenViaje :reserva="reserva" />
  </div>
</template>

<style scoped>
.pasajero {
  display: grid;
  gap: 1rem;
  min-width: 0;
  margin: 0;
  border: 1.5px solid transparent;
}

.pasajero.menor {
  border-color: var(--color-primario);
}

.cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

h2 {
  font-size: 1rem;
}

.campos {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem 1.25rem;
}

.campos.dos {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.ayuda {
  margin-top: -0.6rem;
  font-size: 0.78rem;
}

@media (max-width: 600px) {
  .campos,
  .campos.dos {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
