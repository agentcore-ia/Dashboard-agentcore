const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://eqnjyygokjinmsfvogxi.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxbmp5eWdva2ppbm1zZnZvZ3hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NzcxMjEsImV4cCI6MjA4OTI1MzEyMX0.BrVsESdtgMBnPjfZfwreg7PWg-HIgiLO5-QoN0qqbkE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log("Fetching conversaciones...");
  const { data: convs, error: convError } = await supabase
    .from('conversaciones')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (convError) console.error("Error:", convError);
  else {
    console.log(JSON.stringify(convs, null, 2));
    
    // Fetch messages for the newest conversation
    if (convs.length > 0) {
      const newestId = convs[0].id;
      console.log(`\nFetching messages for conversation ${newestId}...`);
      const { data: msgs, error: msgError } = await supabase
        .from('mensajes')
        .select('*')
        .eq('conversacion_id', newestId)
        .order('created_at', { ascending: false })
        .limit(5);
        
      if (msgError) console.error("Error:", msgError);
      else console.log(JSON.stringify(msgs, null, 2));
    }
  }
}

main();
