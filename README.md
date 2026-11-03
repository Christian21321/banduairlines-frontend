# BanduAirlines · Frontend

Interfaz web de BanduAirlines (proyecto semestral ICC712, UFRO, 2° semestre 2026) para buscar, reservar, pagar y gestionar pasajes. La API vive en el repositorio [banduairlines-backend](https://github.com/ISOFT-UFRO/banduairlines-backend) (Spring Boot + JWT).

**Stack:** Vue 3 + TypeScript + Vite, Vue Router, Pinia, Vitest, ESLint + Oxlint + Prettier.

## 1. Puesta en marcha local

Requisitos: Node `^22.18.0` o `>=24.12.0`, y el backend corriendo (por defecto en `http://localhost:8080`).

```sh
npm install
npm run dev        # http://localhost:5173
```

El servidor de Vite reenvía `/api/**` al backend (proxy), así que el navegador ve front y API en el mismo origen, igual que en producción. Para apuntar a otro backend, copiar `.env.example` a `.env.local` y cambiar `VITE_PROXY_TARGET` (por ejemplo, `https://dev.isoft.lazycat.app`).

El puerto `5173` es fijo (`strictPort`): el backend arma con él los enlaces de recuperación de contraseña (`RECUPERACION_URL_BASE`).

## 2. Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Revisión de tipos + build de producción en `dist/` |
| `npm run preview` | Sirve el build de `dist/` |
| `npm run test:unit` | Pruebas unitarias con Vitest (modo watch) |
| `npm run lint` | Oxlint + ESLint (con `--fix`) |
| `npm run format` | Prettier sobre `src/` |

## 3. Estructura

```
src/
├── api/            # Cliente HTTP y un archivo por módulo del backend
│   ├── http.ts     # fetch + JWT + renovación automática + ErrorApi
│   ├── credenciales.ts
│   ├── cuenta.ts
│   └── integra.ts
├── assets/         # CSS global y recursos estáticos
├── components/     # Componentes reutilizables
├── router/         # Rutas y guards (requiereSesion, roles, soloInvitados)
├── stores/         # Pinia (sesion.ts: usuario autenticado)
├── types/          # Tipos espejo de los DTO del backend
└── views/<modulo>/ # Pantallas agrupadas por módulo
```

Las vistas y los archivos de `api/` usan los mismos módulos del backend: `admin`, `busqueda`, `checkin`, `cuenta`, `integra`, `pagos`, `reportes`, `reserva`, `tracking` (más `comun` para páginas genéricas).

## 4. Consumir la API

```ts
import { api, ErrorApi } from '@/api/http'

const itinerarios = await api.get<Itinerario[]>('/busqueda/itinerarios', {
  query: { origen: 'SCL', destino: 'PMC' },
  autenticada: false, // ruta pública: no envía JWT
})
const reserva = await api.post<Reserva>('/reservas', solicitud)

try {
  await api.get(`/reservas/${id}`)
} catch (error) {
  if (error instanceof ErrorApi && error.code === 'RECURSO_NO_ENCONTRADO') {
    // ...
  }
}
```

- Las rutas son relativas a `/api/v1`.
- Si hay sesión, se envía `Authorization: Bearer <credencialAcceso>`. Ante un `401`, el cliente llama una sola vez a `/auth/renovacion` y reintenta; si la renovación falla, se cierra la sesión y se vuelve al login.
- Los errores llegan como `ErrorApi` con `status`, `code` (`VALIDACION`, `NO_AUTENTICADO`, `REGLA_NEGOCIO`, etc.), `message` y `details` (errores por campo), siguiendo el formato de `GlobalExceptionHandler` del backend. Sin conexión, `code` es `SIN_CONEXION`.

## 5. Rutas protegidas

```ts
{ path: '/cuenta', component: ..., meta: { requiereSesion: true } }
{ path: '/admin', component: ..., meta: { roles: ['ADMINISTRADOR'] } }
{ path: '/inicio-sesion', component: ..., meta: { soloInvitados: true } }
```

Los guards solo mejoran la navegación; la autorización real la hace el backend.

## 6. Convenciones

- **Ramas:** `feature/<nombre>` desde `develop`, con Pull Request hacia `develop`. `main` queda para entregas.
- **Commits convencionales** (`commitlint.config.js`, validados en CI): `<tipo>(<scope>): <descripción>`.
  - Tipos: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style`.
  - Scopes: `checkin`, `reservas`, `pagos`, `tracking`, `administracion`, `reportes`, `cuentas`, `busqueda`, `integracion`, `core`.
- **Idioma:** nombres de dominio en español, igual que en el backend.
