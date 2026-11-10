import js from "@eslint/js";
import globals from "globals";

/**
 * ESLint configuration for the JavaScript ESM backend.
 */
export default [
    {
        ignores: [
            "node_modules/**",
            "coverage/**"
        ]
    },

    js.configs.recommended,

    {
        files: ["**/*.js"],

        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.node
            }
        },

        rules: {
            "no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_"
                }
            ],

            // Replace with a centralized logger if one is introduced.
            "no-console": "off"
        }
    }
];