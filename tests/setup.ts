import { config } from "dotenv";

// Load local secrets/config for tests (RPCs, addresses). Chain tests fall back to
// public Base RPCs when BASE_RPC_URL is unset, so they run without any secret.
config({ path: ".env.local" });
