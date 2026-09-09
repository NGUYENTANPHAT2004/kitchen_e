const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const {
  requirements,
  validateIntegration,
} = require("../config/local-integrations");

async function run() {
  const env = dotenv.parse(fs.readFileSync(path.resolve(__dirname, "../.env")));
  const available = new Set();
  for (const name of Object.keys(requirements)) {
    try {
      validateIntegration(name, env);
      available.add(name);
      console.log(`${name}: CONFIGURED (not yet authenticated)`);
    } catch (error) {
      console.log(`${name}: ${error.message}`);
    }
  }
  const aiPath = path.resolve(__dirname, "../../py-ai/.env");
  const ai = fs.existsSync(aiPath) ? dotenv.parse(fs.readFileSync(aiPath)) : {};
  for (const key of ["HUGGINGFACE_API_KEY", "OPENAI_API_KEY", "SECRET_KEY"])
    console.log(`py-ai ${key}: ${ai[key]?.trim() ? "SET" : "MISSING"}`);
  console.log(
    "OPENAI_API_KEY is not consumed by the current AI implementation."
  );
  if (!process.argv.includes("--network")) return;
  console.log(
    "Read-only probes: SMTP authentication, S3 HeadBucket and AI health. No mail or object writes."
  );

  if (available.has("smtp")) {
    const transporter = require("nodemailer").createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT || 587),
      secure: env.SMTP_SECURE === "true",
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      logger: false,
      debug: false,
    });
    try {
      await transporter.verify();
      console.log(
        "smtp: PASS connection and authentication; delivery not tested"
      );
    } catch (error) {
      const code = [
        "EAUTH",
        "ETIMEDOUT",
        "ECONNECTION",
        "ESOCKET",
        "ETLS",
        "EDNS",
      ].includes(error.code)
        ? error.code
        : "FAILED";
      console.log(
        `smtp: FAIL ${code}; response=${Number(error.responseCode) || "none"}`
      );
      process.exitCode = 1;
    } finally {
      transporter.close();
    }
  }
  if (available.has("s3")) {
    const {
      S3Client,
      HeadBucketCommand,
      GetBucketLocationCommand,
    } = require("@aws-sdk/client-s3");
    const client = new S3Client({
      region: env.AWS_REGION,
      maxAttempts: 1,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        ...(env.AWS_SESSION_TOKEN
          ? { sessionToken: env.AWS_SESSION_TOKEN }
          : {}),
      },
    });
    try {
      await client.send(new HeadBucketCommand({ Bucket: env.AWS_BUCKET }), {
        abortSignal: AbortSignal.timeout(15000),
      });
      console.log(
        "s3: PASS bucket access; object upload/read/delete not tested"
      );
    } catch (error) {
      console.log(
        `s3: FAIL HTTP ${
          Number(error.$metadata?.httpStatusCode) || "unavailable"
        }; no response details printed`
      );
      if (error.$metadata?.httpStatusCode === 403) {
        try {
          const location = await client.send(
            new GetBucketLocationCommand({ Bucket: env.AWS_BUCKET }),
            { abortSignal: AbortSignal.timeout(10000) }
          );
          const region = location.LocationConstraint || "us-east-1";
          console.log(
            `s3: GetBucketLocation PASS; configured region ${
              region === env.AWS_REGION ? "matches" : "differs"
            }. HeadBucket permission remains unverified.`
          );
        } catch (diagnosticError) {
          const codes = [
            "AccessDenied",
            "InvalidAccessKeyId",
            "SignatureDoesNotMatch",
            "AuthorizationHeaderMalformed",
            "ExpiredToken",
            "NoSuchBucket",
          ];
          console.log(
            `s3: bucket-location diagnostic ${
              codes.includes(diagnosticError.name)
                ? diagnosticError.name
                : "FAILED"
            }`
          );
        }
      }
      process.exitCode = 1;
    } finally {
      client.destroy();
    }
  }
  if (available.has("ai")) {
    try {
      const url = new URL(
        "/health",
        env.AI_SERVICE_URL || env.PYTHON_AI_SERVICE_URL
      );
      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000),
        redirect: "error",
      });
      console.log(
        `ai: ${response.ok ? "PASS" : "FAIL"} health HTTP ${
          response.status
        }; inference not tested`
      );
      if (!response.ok) process.exitCode = 1;
    } catch {
      console.log("ai: FAIL health endpoint unavailable");
      process.exitCode = 1;
    }
  }
}
run().catch(() => {
  console.error(
    "Configuration check failed; secret-bearing details suppressed."
  );
  process.exitCode = 1;
});
