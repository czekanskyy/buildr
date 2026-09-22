import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'boundary-fixtures',
    include: ['*.test.ts'],
  },
});
