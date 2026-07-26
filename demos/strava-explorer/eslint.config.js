export default [
    {
        ignores: ["dist/**", "node_modules/**"]
    },
    {
        files: ["src/**/*.js", "server/**/*.js", "test/**/*.js", "tests/**/*.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                window: "readonly",
                document: "readonly",
                sessionStorage: "readonly",
                localStorage: "readonly",
                navigator: "readonly",
                setTimeout: "readonly",
                clearTimeout: "readonly",
                setInterval: "readonly",
                clearInterval: "readonly",
                fetch: "readonly",
                AbortController: "readonly",
                URL: "readonly",
                URLSearchParams: "readonly",
                Image: "readonly",
                DOMParser: "readonly",
                Intl: "readonly",
                console: "readonly",
                process: "readonly",
                Date: "readonly",
                Math: "readonly",
                Number: "readonly",
                Float64Array: "readonly",
                isNaN: "readonly",
                parseInt: "readonly",
                parseFloat: "readonly",
                Error: "readonly",
                JSON: "readonly",
                Map: "readonly",
                Set: "readonly",
                describe: "readonly",
                test: "readonly",
                it: "readonly",
                expect: "readonly",
                vi: "readonly",
                beforeEach: "readonly",
                afterEach: "readonly",
                performance: "readonly",
                google: "readonly",
                crypto: "readonly"
            }
        },
        rules: {
            "no-unused-vars": "warn",
            "no-undef": "error"
        }
    }
];
