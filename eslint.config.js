import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import security from 'eslint-plugin-security';
import globals from 'globals';

const noUnsafeInnerHtml = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'innerHTML/outerHTML with template interpolation requires DOMPurify.sanitize(), escapeHtml(), or a // safe: comment on the line before',
    },
    messages: {
      unsafe:
        'innerHTML/outerHTML with template interpolation requires DOMPurify.sanitize(), escapeHtml(), or a "// safe: <reason>" comment on the line before the assignment.',
    },
    schema: [],
  },
  create(context) {
    return {
      AssignmentExpression(node) {
        if (
          node.left.type !== 'MemberExpression' ||
          node.left.property.type !== 'Identifier' ||
          (node.left.property.name !== 'innerHTML' &&
            node.left.property.name !== 'outerHTML')
        )
          return;
        if (
          node.right.type !== 'TemplateLiteral' ||
          node.right.expressions.length === 0
        )
          return;

        const text = context.sourceCode.getText(node.right);
        if (text.includes('DOMPurify.sanitize(') || text.includes('escapeHtml('))
          return;

        const comments = context.sourceCode.getCommentsBefore(node);
        if (comments.some((c) => c.value.trim().startsWith('safe:'))) return;

        context.report({ node: node.right, messageId: 'unsafe' });
      },
    };
  },
};

export default [
  {
    ignores: ['node_modules/**', 'dist/**', '.claude/**', 'lambda/**', 'coverage/**'],
  },

  // Node.js-scripts under src/ (sync-data.js, generate-llms.js osv.)
  {
    files: ['src/scripts/sync-data.js', 'src/scripts/generate-llms.js'],
    ...js.configs.recommended,
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { vars: 'all', args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }],
    },
  },

  // Admin browser-scripts
  {
    files: ['src/scripts/**/*.js'],
    ignores: ['src/scripts/__tests__/**', 'src/scripts/sync-data.js', 'src/scripts/generate-llms.js'],
    ...js.configs.recommended,
    languageOptions: {
      globals: {
        ...globals.browser,
        gapi: 'readonly',
        google: 'readonly',
      },
    },
    rules: {
      // args: 'none' — callback-parametere mottas ofte men brukes ikke alle (vanlig mønster)
      // caughtErrors: 'none' — catch (err) {} er ofte bevisst ignorering
      'no-unused-vars': ['error', { vars: 'all', args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }],
    },
  },

  // Vitest test-filer: browser + node globals (jsdom med vitest)
  {
    files: ['src/**/__tests__/**/*.{js,ts}', 'src/**/*.test.{js,ts}'],
    ...js.configs.recommended,
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        gapi: 'readonly',
        google: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { vars: 'all', args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }],
    },
  },

  // TypeScript
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['src/**/*.ts'],
    rules: {
      ...config.rules,
      // Eksisterende kode bruker any; downgrade til warn
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  })),

  // eslint-plugin-security for JS/TS
  // detect-object-injection og detect-non-literal-fs-filename gir falske positiver
  // på vanlig bracket-notasjon og build-script fs-bruk — slått av
  {
    files: ['src/**/*.{js,ts}'],
    plugins: { security },
    rules: {
      ...Object.fromEntries(
        Object.entries(security.configs.recommended.rules).map(([k]) => [k, 'warn'])
      ),
      'security/detect-object-injection': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-possible-timing-attacks': 'off',
    },
  },

  // Egendefinert innerHTML/outerHTML-regel — kun src/scripts, ikke tester
  {
    files: ['src/scripts/**/*.js'],
    ignores: ['src/scripts/__tests__/**'],
    plugins: { local: { rules: { 'no-unsafe-inner-html': noUnsafeInnerHtml } } },
    rules: {
      'local/no-unsafe-inner-html': 'error',
    },
  },
];
