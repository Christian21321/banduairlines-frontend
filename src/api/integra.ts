import type { RespuestaSalud } from '@/types/api'
import { api } from './http'

export const integraApi = {
  salud: () => api.get<RespuestaSalud>('/health', { autenticada: false }),
}
