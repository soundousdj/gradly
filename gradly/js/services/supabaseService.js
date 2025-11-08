import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { showToast } from '../components/toast.js';

const SUPABASE_URL = 'https://sucqkobtappluwqtaskx.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1Y3Frb2J0YXBwbHV3cXRhc2t4Iiwicm9zZSI6ImFub24iLCJpYXQiOjE3NTAyOTc4NDMsImV4cCI6MjA2NTg3Mzg0M30.4U_7nDeNC85oWGmEuIPR2B-PjOxSIPyMy7SdjQx1fEw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * دالة مساعدة لتسجيل النشاطات في قاعدة البيانات
 * @param {string} description - وصف النشاط
 * @param {string} icon - اسم أيقونة Font Awesome
 */
export async function logActivity(description, icon = 'fas fa-info-circle') {
    const { error } = await supabase.from('activity_log').insert([{ description, icon }]);
    if (error) {
        console.error('Failed to log activity:', error.message);
        showToast('فشل تسجيل النشاط', 'error');
    }
}