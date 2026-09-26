import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';
import { defineConfig } from "prisma/config";

dotenvExpand.expand(dotenv.config());

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
