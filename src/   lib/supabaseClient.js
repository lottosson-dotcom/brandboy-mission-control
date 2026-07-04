  lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://igwmwhcnsmsxicmepvnj.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlnd213aGNuc21zeGljbWVwdm5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxMDY0MDcsImV4cCI6MjA5ODY4MjQwN30.awhep_rZrP4x07I7H2zoJun3MCaRIJxR6fqfYI4ilVs'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
