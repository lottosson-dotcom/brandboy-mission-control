// Connection to the Supabase database.
//
// NOT USED YET. Nothing imports this file today. Before switching it on we need
// a login (Supabase Auth) and Row Level Security rules on every table —
// otherwise anyone who opens the website could read Lars's prospect data.
// See docs/PLAN.md, phase 2.
//
// The URL and key come from environment variables (see .env.example), not
// from this file, so they can be changed without touching code.
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
