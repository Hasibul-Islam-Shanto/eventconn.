import coreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
const config = [
  ...coreWebVitals,
  ...nextTypescript,
  { ignores: ['next-env.d.ts', '.next/**', '.next-dev/**', 'node_modules/**'] },
];

export default config;
