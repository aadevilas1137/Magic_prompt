/** @type {import('lint-staged').Configuration} */
module.exports = {
  '*.{ts,tsx,js,jsx,mjs,cjs}': ['eslint --fix --max-warnings=0', 'prettier --write'],
  '*.{json,md,yml,yaml,css}': ['prettier --write'],
};
