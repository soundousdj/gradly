import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const SUPABASE_URL = 'https://rrkesmaombznchqhtvqh.supabase.co'; //  ضع هنا رابط مشروعك
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJya2VzbWFvbWJ6bmNocWh0dnFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3ODE1NjUsImV4cCI6MjA2ODM1NzU2NX0.VBD-XmhhgcbXaMB7IqvfABsf4yt6q4SdLZYxrj5Pv_4';
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
    alert('خطأ: الرجاء تعبئة بيانات Supabase في ملف js/supabaseClient.js');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);