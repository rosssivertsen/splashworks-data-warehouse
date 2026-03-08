import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// @ts-ignore - Vite/Vitest version mismatch in types
export default defineConfig({
  // @ts-ignore
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
