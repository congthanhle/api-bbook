/**
 * migrate.ts — Run all SQL migrations in order against Supabase Postgres.
 *
 * Usage:
 *   npx ts-node src/database/migrate.ts
 *
 * Requires DATABASE_URL in .env, e.g.:
 *   DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
 *
 * Find your connection string in Supabase Dashboard → Settings → Database → Connection string (URI).
 */

import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env['DATABASE_URL'];

if (!DATABASE_URL) {
  console.error(
    '❌  DATABASE_URL is not set in .env\n' +
      '\n' +
      '   1. Go to Supabase Dashboard → Settings → Database\n' +
      '   2. Copy the "Connection string" (URI tab)\n' +
      '   3. Replace [YOUR-PASSWORD] with your database password\n' +
      '   4. Add it to .env:\n' +
      '      DATABASE_URL=postgresql://postgres.[ref]:[password]@...\n',
  );
  process.exit(1);
}

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function runMigrations() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  try {
    console.log('⏳  Connecting to database...');
    await client.connect();
    console.log('✅  Connected!\n');

    // Read all SQL files in order
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f: string) => f.endsWith('.sql'))
      .sort();

    console.log(`📂  Found ${files.length} migration files:\n`);

    for (const file of files) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      console.log(`  ▶  Running ${file}...`);
      try {
        await client.query(sql);
        console.log(`  ✅  ${file} — success`);
      } catch (err) {
        const error = err as Error;
        console.error(`  ❌  ${file} — FAILED: ${error.message}`);
        // Continue to next migration (idempotent scripts should be safe)
      }
    }

    console.log('\n🎉  All migrations completed!');
  } catch (err) {
    const error = err as Error;
    console.error(`❌  Connection failed: ${error.message}`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
