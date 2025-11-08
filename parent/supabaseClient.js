// supabaseClient.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://rrkesmaombznchqhtvqh.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJya2VzbWFvbWJ6bmNocWh0dnFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3ODE1NjUsImV4cCI6MjA2ODM1NzU2NX0.VBD-XmhhgcbXaMB7IqvfABsf4yt6q4SdLZYxrj5Pv_4';

// 💡 يجب أن يكون اسم التصدير هو 'supabase'
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log("✅ Supabase client initialized successfully!");