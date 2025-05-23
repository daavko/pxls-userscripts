import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
    js.configs.recommended,
    comments.recommended,
    tseslint.configs.recommendedTypeChecked,
    tseslint.configs.stylisticTypeChecked,
    {
        files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
        languageOptions: {
            globals: globals.browser,
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    {
        files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
        rules: {
            '@eslint-community/eslint-comments/no-use': [
                'error',
                { allow: ['eslint-disable-line', 'eslint-disable-next-line'] },
            ],
            '@eslint-community/eslint-comments/require-description': 'error',

            '@typescript-eslint/default-param-last': 'warn',
            '@typescript-eslint/explicit-function-return-type': 'warn',
            '@typescript-eslint/explicit-member-accessibility': ['warn', { accessibility: 'no-public' }],
            '@typescript-eslint/explicit-module-boundary-types': 'error',
            '@typescript-eslint/member-ordering': 'warn',
            '@typescript-eslint/no-import-type-side-effects': 'error',
            '@typescript-eslint/no-shadow': 'warn',
            '@typescript-eslint/no-unnecessary-parameter-property-assignment': 'error',
            '@typescript-eslint/no-unsafe-type-assertion': 'warn',
            '@typescript-eslint/prefer-enum-initializers': 'error',
            '@typescript-eslint/prefer-readonly': 'warn',
            '@typescript-eslint/promise-function-async': 'error',
            '@typescript-eslint/require-array-sort-compare': 'error',
            '@typescript-eslint/strict-boolean-expressions': ['error', { allowNumber: false, allowString: false }],
        },
    },
    {
        files: ['src/workers/**/*.{js,mjs,cjs,ts,mts,cts}'],
        languageOptions: {
            globals: globals.worker,
        },
    },
    eslintConfigPrettier,
]);
