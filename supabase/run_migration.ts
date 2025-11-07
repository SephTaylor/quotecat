#!/usr/bin/env node
/**
 * Run a migration file against the remote Supabase database
 * Usage: npx tsx supabase/run_migration.ts 004_add_retailer_support.sql
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_DB_PASSWORD) {
  console.error('❌ Missing environment variables!');
  console.error('Make sure .env has:');
  console.error('  EXPO_PUBLIC_SUPABASE_URL');
  console.error('  SUPABASE_DB_PASSWORD');
  process.exit(1);
}

async function runMigration(filename: string) {
  console.log(`📂 Running migration: ${filename}`);

  // Read the SQL file
  const migrationPath = path.join(__dirname, 'migrations', filename);

  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf-8');
  console.log(`📄 Read ${sql.length} characters from ${filename}`);

  // Extract project ref from URL
  const projectRef = SUPABASE_URL.match(/https:\/\/(.+?)\.supabase\.co/)?.[1];

  if (!projectRef) {
    console.error('❌ Could not extract project ref from URL');
    process.exit(1);
  }

  // Construct PostgreSQL connection string
  // Supabase direct connection format
  // URL encode the password in case it has special characters
  const encodedPassword = encodeURIComponent(SUPABASE_DB_PASSWORD);
  const connectionString = `postgresql://postgres:${encodedPassword}@db.${projectRef}.supabase.co:5432/postgres`;

  console.log(`🔌 Connecting to database...`);

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    console.log('🚀 Executing migration...');
    const result = await client.query(sql);

    console.log('✅ Migration completed successfully!');

    if (result.rowCount !== null) {
      console.log(`📊 Rows affected: ${result.rowCount}`);
    }

    if (result.rows && result.rows.length > 0) {
      console.log(`📊 Result:`, JSON.stringify(result.rows, null, 2));
    } else {
      console.log('📊 No rows returned (DDL migration)');
    }
  } catch (error: any) {
    console.error('❌ Migration failed!');
    console.error('Error:', error.message);

    if (error.detail) {
      console.error('Detail:', error.detail);
    }

    console.log('\n💡 You may need to run this migration manually in the Supabase Dashboard:');
    console.log(`   1. Go to: https://supabase.com/dashboard/project/${projectRef}/sql/new`);
    console.log(`   2. Copy contents of: ${migrationPath}`);
    console.log('   3. Paste and click "Run"');
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Disconnected from database');
  }
}

// Get filename from command line args
const filename = process.argv[2];

if (!filename) {
  console.error('❌ Please provide a migration filename');
  console.error('Usage: npx tsx supabase/run_migration.ts 004_add_retailer_support.sql');
  process.exit(1);
}

runMigration(filename).catch((error) => {
  console.error('❌ Error running migration:', error.message);
  process.exit(1);
});
