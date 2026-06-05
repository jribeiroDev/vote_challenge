import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;

export const hasDatabase = Boolean(connectionString);

export const sql = connectionString ? neon(connectionString) : null;
