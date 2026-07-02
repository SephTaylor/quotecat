import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profiles, count } = await supabase
    .from('profiles')
    .select('id, email, tier, created_at', { count: 'exact' })
    .eq('tier', 'free')
    .order('created_at', { ascending: false })
    .limit(20);

  if (!profiles) {
    console.log('No Free profiles found.');
    return;
  }
  console.log(`Total Free profiles: ${count}\n`);
  console.log('Recent Free signups (newest 20):');
  for (const p of profiles) {
    console.log(`  ${p.created_at?.slice(0,10)}  ${p.email?.padEnd(40)} id=${p.id?.slice(0,8)}`);
  }
}
main().catch(console.error);
