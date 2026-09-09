const {
  parseIntegrations,
  integrationOverrides,
} = require("../config/local-integrations");
const env = {
  GOOGLE_CLIENT_ID: "google-test",
  GOOGLE_CLIENT_SECRET: "google-secret",
  FACEBOOK_APP_ID: "facebook-test",
  FACEBOOK_APP_SECRET: "facebook-secret",
  SMTP_HOST: "smtp.example.test",
  SMTP_USER: "test",
  SMTP_PASSWORD: "test",
  FROM_EMAIL: "test@example.test",
  AWS_REGION: "test-region",
  AWS_BUCKET: "test-bucket",
  AWS_ACCESS_KEY_ID: "test",
  AWS_SECRET_ACCESS_KEY: "test",
  VNPAY_TMN_CODE: "test",
  VNPAY_HASH_SECRET: "test",
  VNPAY_URL: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
  PYTHON_AI_SERVICE_URL: "http://127.0.0.1:8000",
  API_URL: "http://localhost:5000",
  FRONTEND_URL: "http://localhost:5173",
};
test("default mode disables external integrations even when credentials exist", () => {
  expect(integrationOverrides(env, [])).toMatchObject({
    EMAIL_TRANSPORT: "local",
    STORAGE_TYPE: "local",
    GOOGLE_CLIENT_ID: "",
    FACEBOOK_APP_ID: "",
    VNPAY_ENABLED: "false",
  });
});
test("only selected OAuth provider is enabled and configured callback origins are preserved", () => {
  expect(integrationOverrides(env, ["google"])).toMatchObject({
    GOOGLE_CLIENT_ID: "google-test",
    GOOGLE_CLIENT_SECRET: "google-secret",
    FACEBOOK_APP_ID: "",
    API_URL: env.API_URL,
    FRONTEND_URL: env.FRONTEND_URL,
    EMAIL_TRANSPORT: "local",
  });
});
test("SMTP and S3 are opt-in", () => {
  expect(integrationOverrides(env, ["smtp", "s3"])).toMatchObject({
    EMAIL_TRANSPORT: "smtp",
    STORAGE_TYPE: "s3",
    VNPAY_ENABLED: "false",
  });
});
test("local AI uses the launcher's port while a selected AI endpoint is preserved", () => {
  const configured = { ...env, LOCAL_AI_PORT: "8001" };
  expect(integrationOverrides(configured, [])).toMatchObject({
    AI_SERVICE_URL: "http://127.0.0.1:8001",
    PYTHON_AI_SERVICE_URL: "http://127.0.0.1:8001",
  });
  expect(integrationOverrides(configured, ["ai"]).AI_SERVICE_URL).toBe(
    env.PYTHON_AI_SERVICE_URL
  );
});
test("integration selection cannot override the local database or session secret", () => {
  const result = integrationOverrides(
    { ...env, MONGO_URI: "remote", JWT_SECRET: "remote" },
    parseIntegrations("ai,smtp,s3,google,facebook,vnpay")
  );
  expect(result).not.toHaveProperty("MONGO_URI");
  expect(result).not.toHaveProperty("JWT_SECRET");
  expect(result).not.toHaveProperty("SESSION_SECRET");
});
test.each([
  "https://pay.vnpay.vn/vpcpay.html",
  "https://sandbox.vnpayment.vn.evil.test",
  "https://user:password@sandbox.vnpayment.vn",
])("refuses non-sandbox payment endpoints: %s", (url) => {
  expect(() =>
    integrationOverrides({ ...env, VNPAY_URL: url }, ["vnpay"])
  ).toThrow("sandbox");
});
test("missing values produce errors with variable names, not other credentials", () => {
  expect(() =>
    integrationOverrides({ ...env, GOOGLE_CLIENT_ID: "" }, ["google"])
  ).toThrow("GOOGLE_CLIENT_ID");
});
test("unknown integration names are rejected and duplicates normalized", () => {
  expect(() => parseIntegrations("something-else")).toThrow(
    "Unknown integration"
  );
  expect(parseIntegrations("smtp,google,smtp")).toEqual(["google", "smtp"]);
});
test("rejects callback URLs containing credentials", () => {
  expect(() =>
    integrationOverrides(
      { ...env, API_URL: "http://user:pass@localhost:5000" },
      ["google"]
    )
  ).toThrow("origin");
});
