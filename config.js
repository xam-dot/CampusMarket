// Shared Supabase connection. Every page loads this file.
// Your project address (one line, no spaces)
const SUPABASE_URL = "https://vkbivjlthxarptitqbrw.supabase.co";

// Your publishable key (safe to use in website code)
const SUPABASE_KEY = "sb_publishable_ZymiNIS4zY95oR_VwLzeUA_Rmwbc3EZ";

// The Supabase tool (loaded in each HTML page) gives us "createClient".
// We build our connection and name it "db".
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);