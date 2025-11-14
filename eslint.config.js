import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  { ignores: ['dist', '.netlify', 'node_modules', 'coverage'] },
  js.configs.recommended,
  
  // JavaScript/JSX files
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
        React: true,
        JSX: true,
        console: true,
        process: true,
        Buffer: true,
        __dirname: true,
        __filename: true,
        global: true,
        require: true,
        module: true,
        exports: true
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        },
        sourceType: 'module'
      }
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'no-undef': 'error', 
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': 'off',
      'no-unused-vars': 'warn',
      'no-case-declarations': 'off',
      'no-useless-catch': 'warn'
    },
  },
  
  // TypeScript/TSX files
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
        React: true,
        JSX: true,
        console: true,
        process: true,
        Buffer: true,
        __dirname: true,
        __filename: true,
        global: true,
        require: true,
        module: true,
        exports: true
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        },
        sourceType: 'module'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'no-undef': 'off', // TypeScript handles this
      '@typescript-eslint/no-unused-vars': 'warn',
      'no-unused-vars': 'off', // Use TypeScript version instead
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': 'off',
      'no-case-declarations': 'off',
      'no-useless-catch': 'warn'
    },
  },
  
  // Node.js files (serverless functions, config files)
  {
    files: ['netlify/functions/**/*.{js,cjs}', '*.config.{js,cjs}', 'scripts/**/*.{js,cjs}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.node,
        console: true,
        process: true,
        Buffer: true,
        __dirname: true,
        __filename: true,
        global: true,
        require: true,
        module: true,
        exports: true
      },
      parserOptions: {
        sourceType: 'module'
      }
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': 'warn',
      'no-case-declarations': 'off',
      'no-useless-catch': 'warn'
    },
  }
];
