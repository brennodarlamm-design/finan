// trigger.config.js — Configuração do Trigger.dev v3/v4 para o FinObra
import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "finan-as",
  dirs: ["./trigger"],
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 4,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 30000,
      factor: 2,
      randomize: true
    }
  }
});
