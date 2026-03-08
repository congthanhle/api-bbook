const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const run = async () => {
  const client = new Client({
    connectionString:
      'postgresql://postgres:b-book@2026@db.okwbucnczzglotbuwefp.supabase.co:5432/postgres',
  });
  await client.connect();

  const sql = `
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, avatar_url, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    NEW.raw_user_meta_data ->> 'avatar_url',
    COALESCE(
      (NEW.raw_user_meta_data ->> 'role')::public.user_role,
      'staff'::public.user_role
    )
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
  `;

  await client.query(sql);
  console.log('✅ Trigger fixed.');

  const supa = createClient(
    'https://okwbucnczzglotbuwefp.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rd2J1Y25jenpnbG90YnV3ZWZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjA3MDg0NSwiZXhwIjoyMDg3NjQ2ODQ1fQ._TYm7UqkGMOdPmXceIjdxb-73NBFD8yKw0mGWA9ytAo',
  );

  const res1 = await supa.auth.admin.createUser({
    email: 'admin@courtos.io',
    password: 'password123',
    email_confirm: true,
    user_metadata: { name: 'Admin User', role: 'admin' },
  });
  console.log('📌 Admin user:', res1.error ? res1.error.message : 'Created successfully');

  const res2 = await supa.auth.admin.createUser({
    email: 'staff@courtos.io',
    password: 'password123',
    email_confirm: true,
    user_metadata: { name: 'Staff User', role: 'staff' },
  });
  console.log('📌 Staff user:', res2.error ? res2.error.message : 'Created successfully');

  await client.end();
};

run().catch(console.error);
