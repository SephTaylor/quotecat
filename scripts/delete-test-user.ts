// scripts/delete-test-user.ts
// Run with: npx tsx scripts/delete-test-user.ts your-email@example.com

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function deleteTestUser(email: string) {
  console.log(`\n🔍 Looking for user: ${email}`);

  // 1. Find user by email
  const { data: users, error: listError } = await supabase.auth.admin.listUsers();

  if (listError) {
    console.error('❌ Error listing users:', listError);
    return;
  }

  const user = users.users.find((u) => u.email === email);

  if (!user) {
    console.log('✅ User not found in auth - already deleted or never existed');

    // Still check profiles table
    const { data: profile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (profile) {
      console.log('🗑️  Found orphaned profile, deleting...');
      const { error: deleteProfileError } = await supabase
        .from('profiles')
        .delete()
        .eq('email', email);

      if (deleteProfileError) {
        console.error('❌ Error deleting profile:', deleteProfileError);
      } else {
        console.log('✅ Orphaned profile deleted');
      }
    }

    return;
  }

  console.log(`📋 Found user: ${user.id}`);

  // 2. Delete from profiles table first
  console.log('🗑️  Deleting from profiles table...');
  const { error: profileError } = await supabase
    .from('profiles')
    .delete()
    .eq('id', user.id);

  if (profileError) {
    console.error('❌ Error deleting profile:', profileError);
  } else {
    console.log('✅ Profile deleted');
  }

  // 3. Delete from auth
  console.log('🗑️  Deleting from auth...');
  const { error: authError } = await supabase.auth.admin.deleteUser(user.id);

  if (authError) {
    console.error('❌ Error deleting auth user:', authError);
  } else {
    console.log('✅ Auth user deleted');
  }

  console.log('\n✨ User cleanup complete! You can now reuse this email.\n');
}

// Get email from command line
const email = process.argv[2];

if (!email) {
  console.error('❌ Usage: npx tsx scripts/delete-test-user.ts your-email@example.com');
  process.exit(1);
}

deleteTestUser(email);
