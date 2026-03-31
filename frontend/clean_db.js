const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://eqnjyygokjinmsfvogxi.supabase.co';
// We need the service role key to delete or modify table replica identity if we bypass RLS, but ANON key works if RLS is disabled.
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxbmp5eWdva2ppbm1zZnZvZ3hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NzcxMjEsImV4cCI6MjA4OTI1MzEyMX0.BrVsESdtgMBnPjfZfwreg7PWg-HIgiLO5-QoN0qqbkE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log("Deleting demo conversations...");
  // Delete where id starts with '0000' except the restaurant_id
  const { error } = await supabase
    .from('conversaciones')
    .delete()
    .like('id', '00000000-0000-0000-0000-00000000002%');
    
  if (error) console.error("Error deleting:", error);
  else console.log("Demo conversations deleted successfully.");
  
  // Realtime can only be enabled via SQL or Supabase Dashboard. 
  // Since SQL tool failed, we'll ask the user, or try another way.
}

main();
