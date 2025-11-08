// js/auth.js

import { supabase } from './supabaseClient.js';

let currentUserProfile = null;

export async function getCurrentUserProfile() {
    if (currentUserProfile) return currentUserProfile;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = 'index.html';
        return null;
    }

    try {
        // [1] جلب بيانات البروفايل الأساسية أولاً (بشكل آمن)
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('id, full_name, email, role, current_role')
            .eq('id', user.id)
            .single();

        if (profileError || !profileData) {
            console.error('profiles query error:', profileError);
            throw new Error('لا يمكن جلب ملف المستخدم.');
        }

        // [2] حاول جلب أدوار المستخدم بشكل منفصل (إن وجدت)
        let roleName = profileData.current_role || profileData.role || 'غير محدد';
        try {
            const { data: userRoles, error: rolesError } = await supabase
                .from('user_roles')
                .select('roles(role_name)')
                .eq('user_id', user.id);

            if (!rolesError && Array.isArray(userRoles) && userRoles.length > 0) {
                // خذ أول دور إن وُجد
                const r = userRoles[0]?.roles?.role_name;
                if (r) roleName = r;
            }
        } catch (e) {
            console.warn('user_roles fetch failed, continuing with profile role:', e);
        }

        profileData.role_name = roleName;
        currentUserProfile = profileData;
        return currentUserProfile;

    } catch (err) {
        console.error("Auth Error:", err);
        throw new Error('لا يمكن جلب ملف المستخدم مع الدور.');
    }
}