import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

const target = resolve(".env");
if (existsSync(target)) {
  console.error(".env already exists. Delete or rename it only if you intentionally want a new local secret set.");
  process.exit(1);
}

const base64 = (bytes = 32) => randomBytes(bytes).toString("base64");
const token = (bytes = 24) => randomBytes(bytes).toString("base64url");
const adminPassword = `Bsc!${token(18)}9a`;

const content = `# Generated for local Docker Compose use. Never commit this file.
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
NEXT_PUBLIC_OFFICE_TIME_ZONE=Asia/Kolkata
FRONTEND_PUBLIC_URL=http://localhost:3000
BRAIN_SERVE_ALLOWED_ORIGINS=http://localhost:3000
MAIL_FROM=noreply@brainserve.in

DB_PASSWORD=${token(30)}
SYSTEM_ADMIN_DEFAULT_PASSWORD=${adminPassword}
CEO_BOOTSTRAP_ENABLED=false
CEO_BOOTSTRAP_PASSWORD=
JWT_SECRET=${base64(64)}
PII_ENCRYPTION_KEY=${base64(32)}
QR_PASS_SIGNING_SECRET=${base64(32)}
ARCHIVE_ENCRYPTION_KEYS=v1=${base64(32)}
ARCHIVE_ENCRYPTION_ACTIVE_KEY_VERSION=v1
S3_ACCESS_KEY=brainserve${token(8)}
S3_SECRET_KEY=${token(36)}
S3_PUBLIC_ENDPOINT=http://localhost:9000

ACCOUNT_ARCHIVE_OTP_MINUTES=10
ACCOUNT_ARCHIVE_OTP_RESEND_SECONDS=60
ACCOUNT_ARCHIVE_OTP_MAX_ATTEMPTS=5
ADMIN_PASSWORD_VERIFICATION_LOCK_MINUTES=15
ACCOUNT_ARCHIVE_RETENTION_YEARS=7
ACCOUNT_CLOSURE_CRON="0 5 0 * * *"
DASHBOARD_CACHE_SECONDS=180
REPORT_EXPORT_RETENTION_DAYS=7
REPORT_EXPORT_MAX_ROWS=1000000
PARTITION_ARCHIVE_ENABLED=true
PARTITION_CLEANUP_ENABLED=true
BACKUP_LIFECYCLE_RETENTION_DAYS=35
POSTGRES_BACKUP_INTERVAL_SECONDS=86400
POSTGRES_BACKUP_RETENTION_DAYS=14
POSTGRES_WAL_RETENTION_DAYS=35
`;

writeFileSync(target, content, { encoding: "utf8", mode: 0o600, flag: "wx" });
console.log("Created .env with private local secrets.");
console.log(`Initial System Admin password: ${adminPassword}`);
console.log("Keep this password private. It is shown once here and is also present in your local .env.");
