import { execFileSync } from "node:child_process";

const requiredServices = [
  "postgres", "postgres-backup", "redis", "kafka", "minio", "clamav",
  "mailpit", "backend", "frontend",
];
const results = [];

const run = (name, purpose, command, args) => {
  const startedAt = Date.now();
  try {
    const output = execFileSync(command, args, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 20_000,
    }).trim();
    results.push({ name, purpose, ready: true, detail: output.split("\n").at(-1) || "Ready", latencyMs: Date.now() - startedAt });
  } catch (reason) {
    const detail = reason?.stderr?.toString().trim().split("\n").at(-1)
      || reason?.message || "Check failed";
    results.push({ name, purpose, ready: false, detail, latencyMs: Date.now() - startedAt });
  }
};

const request = async (name, purpose, url) => {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    results.push({ name, purpose, ready: true, detail: `HTTP ${response.status}`, latencyMs: Date.now() - startedAt });
  } catch (reason) {
    results.push({ name, purpose, ready: false, detail: reason instanceof Error ? reason.message : "Request failed", latencyMs: Date.now() - startedAt });
  }
};

run("Docker Compose", "Required containers", "docker", ["compose", "ps", "--services", "--filter", "status=running"]);
const running = (() => {
  try {
    return new Set(execFileSync("docker", ["compose", "ps", "--services", "--filter", "status=running"], {
      cwd: process.cwd(), encoding: "utf8", timeout: 10_000,
    }).trim().split(/\s+/).filter(Boolean));
  } catch { return new Set(); }
})();
const missing = requiredServices.filter((service) => !running.has(service));
if (missing.length) results.push({
  name: "Compose services", purpose: "Container availability", ready: false,
  detail: `Not running: ${missing.join(", ")}`, latencyMs: 0,
});

run("PostgreSQL", "Flyway and transactional data", "docker",
  ["compose", "exec", "-T", "postgres", "pg_isready", "-U", "brainserve", "-d", "brainserve"]);
run("Redis", "OTP, rate limits and cache", "docker",
  ["compose", "exec", "-T", "redis", "redis-cli", "ping"]);
run("Kafka", "Durable internal calls", "docker",
  ["compose", "exec", "-T", "kafka", "/opt/kafka/bin/kafka-topics.sh",
    "--bootstrap-server", "localhost:29092", "--describe", "--topic", "brainserve.internal-calls.v1"]);
run("ClamAV", "Document malware scanning", "docker",
  ["compose", "exec", "-T", "clamav", "clamdscan", "--ping", "5"]);

await Promise.all([
  request("Spring Boot API", "Java service and migrations", "http://localhost:8080/actuator/health/readiness"),
  request("Frontend", "Browser application", "http://localhost:3000"),
  request("MinIO", "Private employee documents", "http://localhost:9000/minio/health/ready"),
  request("Mailpit", "Development SMTP inbox", "http://localhost:8025/api/v1/info"),
]);

console.table(results);
const failures = results.filter((item) => !item.ready);
if (failures.length) {
  console.error(`Stack verification failed: ${failures.map((item) => item.name).join(", ")}`);
  process.exit(1);
}
console.log("BrainServe Connect full stack is ready.");
