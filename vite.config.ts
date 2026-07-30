import vinext from "vinext";
import { defineConfig, type PluginOption } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
    "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// Codex/macOS sandbox support.
const isCodexSeatbeltSandbox =
    process.env.CODEX_SANDBOX === "seatbelt";

// Local Spring Boot development mode.
// Enabled by the package.json dev:backend script.
const useLocalBackendRuntime =
    process.env.BRAINSERVE_LOCAL_BACKEND === "1";

const localBindingConfig = {
    main: "./worker/index.ts",

    compatibility_flags: ["nodejs_compat"],

    d1_databases: d1
        ? [
            {
                binding: d1,
                database_name: "site-creator-d1",
                database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
            },
        ]
        : [],

    r2_buckets: r2
        ? [
            {
                binding: r2,
                bucket_name: "site-creator-r2",
            },
        ]
        : [],
};

export default defineConfig(async () => {
    process.env.WRANGLER_WRITE_LOGS ??= "false";
    process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
    process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

    const plugins: PluginOption[] = [
        vinext(),
        sites(),
    ];

    /*
     * Do not start the Cloudflare workerd runner while using the
     * local Spring Boot backend.
     *
     * Cloudflare remains enabled for normal builds and deployment.
     */
    if (!useLocalBackendRuntime) {
        const { cloudflare } = await import(
            "@cloudflare/vite-plugin"
            );

        plugins.push(
            cloudflare({
                viteEnvironment: {
                    name: "rsc",
                    childEnvironments: ["ssr"],
                },

                inspectorPort: false,

                config: localBindingConfig,
            }),
        );
    }

    return {
        server: {
            host: useLocalBackendRuntime
                ? "localhost"
                : "0.0.0.0",

            port: 5173,

            strictPort: true,

            allowedHosts: useLocalBackendRuntime
                ? [
                    "localhost",
                    "127.0.0.1",
                ]
                : [
                    "terminal.local",
                ],

            ...(isCodexSeatbeltSandbox
                ? {
                    watch: {
                        useFsEvents: false,
                        usePolling: true,
                    },
                }
                : {}),
        },

        plugins,
    };
});