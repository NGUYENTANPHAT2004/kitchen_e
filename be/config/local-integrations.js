const requirements = {
  google: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  facebook: ["FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET"],
  smtp: ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "FROM_EMAIL"],
  s3: [
    "AWS_REGION",
    "AWS_BUCKET",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
  ],
  vnpay: ["VNPAY_TMN_CODE", "VNPAY_HASH_SECRET", "VNPAY_URL"],
  ai: ["PYTHON_AI_SERVICE_URL"],
};

function parseIntegrations(value = "") {
  const names = [
    ...new Set(
      value
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean)
    ),
  ].sort();
  if (names.some((name) => !Object.hasOwn(requirements, name))) {
    throw new Error(
      "Unknown integration. Allowed: google, facebook, smtp, s3, vnpay, ai."
    );
  }
  return names;
}

function validateIntegration(name, env) {
  const missing = requirements[name].filter((key) => !env[key]?.trim());
  if (missing.length)
    throw new Error(`Missing variables for ${name}: ${missing.join(", ")}`);
  if (name === "vnpay") {
    let url;
    try {
      url = new URL(env.VNPAY_URL);
    } catch {
      throw new Error("VNPAY_URL is invalid.");
    }
    if (
      url.origin !== "https://sandbox.vnpayment.vn" ||
      url.username ||
      url.password
    ) {
      throw new Error(
        "Local integration mode allows only the VNPay sandbox endpoint."
      );
    }
  }
  if (name === "smtp") {
    const port = Number(env.SMTP_PORT || 587);
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      throw new Error("SMTP_PORT is invalid.");
    if (env.SMTP_SECURE && !["true", "false"].includes(env.SMTP_SECURE))
      throw new Error("SMTP_SECURE must be true or false.");
  }
  if (name === "ai") {
    let url;
    try {
      url = new URL(env.AI_SERVICE_URL || env.PYTHON_AI_SERVICE_URL);
    } catch {
      throw new Error("AI service URL is invalid.");
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error("AI service URL must be HTTP(S) without credentials.");
  }
}

function integrationOverrides(env, names) {
  const overrides = {
    EMAIL_TRANSPORT: "local",
    STORAGE_TYPE: "local",
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
    FACEBOOK_APP_ID: "",
    FACEBOOK_APP_SECRET: "",
    REDIS_URL: "",
    VNPAY_ENABLED: "false",
    AI_SERVICE_URL: `http://127.0.0.1:${env.LOCAL_AI_PORT || "8000"}`,
    PYTHON_AI_SERVICE_URL: `http://127.0.0.1:${env.LOCAL_AI_PORT || "8000"}`,
  };
  for (const name of names) {
    validateIntegration(name, env);
    if (name === "google" || name === "facebook") {
      for (const key of requirements[name]) overrides[key] = env[key];
      for (const key of ["API_URL", "FRONTEND_URL"]) {
        if (!env[key]) continue;
        let url;
        try {
          url = new URL(env[key]);
        } catch {
          throw new Error(`${key} must be a valid origin for OAuth.`);
        }
        if (
          !["http:", "https:"].includes(url.protocol) ||
          url.origin !== env[key].replace(/\/$/, "")
        )
          throw new Error(
            `${key} must be a single HTTP(S) origin without credentials or path.`
          );
        overrides[key] = url.origin;
      }
    }
    if (name === "smtp") overrides.EMAIL_TRANSPORT = "smtp";
    if (name === "s3") overrides.STORAGE_TYPE = "s3";
    if (name === "vnpay") overrides.VNPAY_ENABLED = "true";
    if (name === "ai") {
      overrides.AI_SERVICE_URL =
        env.AI_SERVICE_URL || env.PYTHON_AI_SERVICE_URL;
      overrides.PYTHON_AI_SERVICE_URL = env.PYTHON_AI_SERVICE_URL;
    }
  }
  return overrides;
}

module.exports = {
  requirements,
  parseIntegrations,
  validateIntegration,
  integrationOverrides,
};
