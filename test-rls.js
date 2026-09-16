const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data, error } = await supabase.rpc('run_sql', { sql_query: "SELECT * FROM pg_policies WHERE tablename = 'profiles';" });
  if (error) {
    console.log("No RPC 'run_sql', falling back to direct table inspect via REST may not show policies.");
  } else {
    console.log(data);
  }
}
run();
