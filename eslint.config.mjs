import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';

export default [
  eslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: parser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        crypto: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // Base ESLint rules
      'no-unused-vars': 'off',
      'no-undef': 'error',
      
      // Clean Code: Naming conventions
      'camelcase': ['error', { 
        'properties': 'never',
        'ignoreDestructuring': true,
        'allow': ['max_completion_tokens', 'max_tokens', 'encoding_format']
      }],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE'],
        },
        {
          selector: 'function',
          format: ['camelCase'],
        },
        {
          selector: 'class',
          format: ['PascalCase'],
        },
        {
          selector: 'interface',
          format: ['PascalCase'],
        },
        {
          selector: 'typeAlias',
          format: ['PascalCase'],
        },
      ],

      // Clean Code: Function and complexity rules
      'max-lines-per-function': ['error', { max: 20, skipBlankLines: true, skipComments: true }],
      'max-params': ['error', 3],
      'max-depth': ['error', 2],
      'complexity': ['error', 10],
      'max-nested-callbacks': ['error', 3],

      // Clean Code: File organization
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
      'max-classes-per-file': ['error', 1],

      // Clean Code: Control flow and error handling
      'no-else-return': 'error',
      'no-nested-ternary': 'error',
      'no-console': 'warn',
      'no-throw-literal': 'error',

      // Clean Code: Code quality
      'no-duplicate-imports': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'no-magic-numbers': ['error', { ignore: [-1, 0, 1, 2] }],
      'prefer-template': 'error',
      'object-shorthand': 'error',

      // Clean Code: Comments and documentation
      'spaced-comment': ['error', 'always'],
      'no-warning-comments': ['error', { 
        terms: ['todo', 'fixme', 'hack'], 
        location: 'anywhere' 
      }],
      'no-inline-comments': 'error',

      // Clean Code: Formatting
      'max-len': ['error', { code: 120, ignoreUrls: true, ignoreStrings: true }],

      // TypeScript specific
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',

      // Import organization
      'sort-imports': ['error', {
        ignoreCase: false,
        ignoreDeclarationSort: true,
        ignoreMemberSort: false,
        memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
      }],

    },
  },
  {
    ignores: [
      'node_modules/',
      'main.js',
      'dist/',
      'build/',
      '*.js',
      '*.mjs',
      '!eslint.config.mjs',
    ],
  }
];