import next from "eslint-config-next";

/** @type {import('eslint').Linter.FlatConfig[]} */
const eslintConfig = [
  {
    files: ["**/*.ts", "**/*.tsx"],
    ...next,
  },
];

export default eslintConfig;
