import { execSync } from "node:child_process";

if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== "") {
  console.log("DATABASE_URL is set; running prisma migrate deploy...");
  try {
    execSync("npx prisma migrate deploy", { stdio: "inherit" });
  } catch (error) {
    console.error("Prisma migration failed:", error);
    process.exit(1);
  }
} else {
  console.log("DATABASE_URL is not set; skipping database migration step.");
}
