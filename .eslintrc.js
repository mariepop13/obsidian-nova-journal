module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  plugins: ['@typescript-eslint'],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  env: {
    browser: true,
    es6: true,
    node: true,
  },
  rules: {
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
    'no-unused-vars': 'off', // Handled by TypeScript
    '@typescript-eslint/no-unused-vars': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    'no-magic-numbers': ['error', { ignore: [-1, 0, 1, 2] }],
    'prefer-template': 'error',
    'object-shorthand': 'error',

    // Clean Code: Comments and documentation
    'no-commented-out-code': 'off', // Would need custom rule
    'spaced-comment': ['error', 'always'],
    'no-warning-comments': ['error', { 
      terms: ['todo', 'fixme', 'hack'], 
      location: 'anywhere' 
    }],
    'no-inline-comments': 'error',

    // Clean Code: Formatting (Prettier will handle these, so we disable ESLint formatting rules)
    'indent': 'off',
    'max-len': ['error', { code: 120, ignoreUrls: true, ignoreStrings: true }],
    'quotes': 'off',
    'semi': 'off',

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
  ignorePatterns: [
    'node_modules/',
    '*.js',
    '*.mjs',
    'main.js',
    'dist/',
    'build/',
  ],
};