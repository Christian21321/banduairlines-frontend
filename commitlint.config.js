export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Tipos de commits permitidos (los del backend + style para cambios visuales)
    'type-enum': [2, 'always', ['feat', 'fix', 'docs', 'chore', 'refactor', 'test', 'style']],
    // Módulos (scopes) permitidos, iguales a los del backend
    'scope-enum': [
      2,
      'always',
      [
        'checkin',
        'reservas',
        'pagos',
        'tracking',
        'administracion',
        'reportes',
        'cuentas',
        'busqueda',
        'integracion',
        'core', // generales (layout, router, cliente HTTP, etc.)
      ],
    ],
    'scope-empty': [2, 'never'],
  },
}
