import tseslint from 'typescript-eslint';

export default tseslint.config({
  files: ["**/*.{ts,tsx,js,jsx}"],
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      ecmaFeatures: {
        jsx: true
      }
    }
  },
  rules: {
    "semi": "error",
    "prefer-const": "warn"
  }
});