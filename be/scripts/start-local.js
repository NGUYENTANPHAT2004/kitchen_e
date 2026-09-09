const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

process.chdir(path.resolve(__dirname, ".."));
require("dotenv").config();
const {
  parseIntegrations,
  integrationOverrides,
} = require("../config/local-integrations");
const integrationArgument = process.argv.find((value) =>
  value.startsWith("--integrations=")
);
const integrations = parseIntegrations(
  integrationArgument?.slice("--integrations=".length)
);
const selectedOverrides = integrationOverrides(process.env, integrations);
const directory = path.resolve(__dirname, "../../.local");
fs.mkdirSync(directory, { recursive: true });
const secretPath = path.join(directory, "session-secret");
if (!fs.existsSync(secretPath))
  fs.writeFileSync(secretPath, crypto.randomBytes(48).toString("hex"));
const aiSecretPath = path.join(directory, "python-ai-secret");
if (!fs.existsSync(aiSecretPath))
  fs.writeFileSync(aiSecretPath, crypto.randomBytes(48).toString("hex"), { flag: "wx" });
Object.assign(process.env, {
  NODE_ENV: "development",
  MONGO_URI:
    "mongodb://127.0.0.1:27018/kitchen_e_local?replicaSet=kitchenLocal",
  JWT_SECRET: fs.readFileSync(secretPath, "utf8"),
  SESSION_SECRET: fs.readFileSync(secretPath, "utf8"),
  PORT: process.env.LOCAL_API_PORT || "5000",
  API_URL: `http://127.0.0.1:${process.env.LOCAL_API_PORT || "5000"}`,
  FRONTEND_URL: `http://127.0.0.1:${process.env.LOCAL_WEB_PORT || "5173"}`,
  ...selectedOverrides,
  ...(!integrations.includes("ai") ? { AI_SERVICE_KEY: fs.readFileSync(aiSecretPath, "utf8").trim() } : {}),
});
console.log(
  `Selected integrations: ${integrations.join(", ") || "none (isolated demo)"}`
);
require("../server");
