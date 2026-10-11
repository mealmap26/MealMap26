import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// Cobertura combinada: pruebas unitarias + pruebas de integración (Supertest) en una sola corrida.
// El enunciado del taller exige cubrir al menos el 80 % del código fuente.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
    globalSetup: ['./test/support/global-setup.ts'],
    setupFiles: ['./test/support/setup-env.ts'],
    // Los e2e comparten la misma base de datos: se ejecutan en serie
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // data-source.ts es solo el punto de entrada del CLI de migraciones, no lo carga la app
      exclude: ['src/**/*.spec.ts', 'src/main.ts', 'src/database/data-source.ts'],
      reporter: ['text', 'text-summary'],
      // Si la cobertura baja de estos valores, la corrida falla (y por tanto el pipeline)
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
    },
  },
});
