import { supabase } from './supabaseService.js';
import { showToast } from '../components/toast.js';

let currentUser = null;

export async function authGuard() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'login_page.html';
        return false;
    }

    const { data: profile, error } = await supabase.from('profiles').select('full_name, role').eq('id', session.user.id).single();
    if (error || !profile || !['director', 'admin'].includes(profile.role)) {
        await supabase.auth.signOut();
        window.location.href = 'login_page.html';
        return false;
    }
    
    currentUser = { id: session.user.id, email: session.user.email, ...profile };
    document.getElementById('user-name').textContent = currentUser.full_name;
    document.getElementById('user-role').textContent = currentUser.role === 'admin' ? 'مدير عام' : 'مدير';
    return true;
}

export async function handleLogout() {
    if (confirm("هل أنت متأكد من تسجيل الخروج؟")) {
        showToast("جاري تسجيل الخروج...", "success");
        await supabase.auth.signOut();
        window.location.href = 'login_page.html';
    }
}