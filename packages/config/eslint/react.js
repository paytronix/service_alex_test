module.exports = {
  ...require("./base"),
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "prettier",
  ],
  plugins: ["@typescript-eslint", "react", "react-hooks"],
  settings: {
    react: {
      version: "detect",
    },
  },
  env: {
    browser: true,
    es2022: true,
  },
  rules: {
    ...require("./base").rules,
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
  },
};
