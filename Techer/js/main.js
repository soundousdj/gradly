// Techer/js/main.js - النسخة المصححة

import { getCurrentUserProfile } from './auth.js';
import { setupNavigation, navigateToPage } from './ui/navigation.js';
import { initDashboardPage } from './pages/dashboard.js';
import { 
    initClassesPage, 
    renderTeacherCourses,
    loadEvaluationNetworks, 
    initGradingFlow,
    loadGradesBook ,
    initAssessmentsPage
} from './pages/classes.js';
import { initMeetingsPage } from './pages/meetings.js';
import { supabase } from './supabaseClient.js';

let currentUserProfile = null;

// ======[  1. حارس التوجيه (Routing Guard)  ]======
(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '../index.html';
        return;
    }

    const { data: profile, error } = await supabase.from('profiles').select('current_role').eq('id', session.user.id).single();
    if (error || !profile || !profile.current_role) {
        await supabase.auth.signOut();
        window.location.href = '../index.html';
        return;
    }

    const authorizedRole = profile.current_role;
    if (authorizedRole !== 'teacher') {
        if (authorizedRole === 'director' || authorizedRole === 'admin') window.location.href = '../gradly/director.html';
        else if (authorizedRole === 'parent') window.location.href = '../parent/index.html';
        else window.location.href = '../index.html';
        return;
    }
    
    initializeTeacherPage(session.user.id);
})();


// ======[  2. دالة تهيئة الصفحة الرئيسية  ]======
async function initializeTeacherPage(userId) {
    try {
        currentUserProfile = await getCurrentUserProfile();
        if (!currentUserProfile) {
            window.location.href = '../index.html';
            return;
        }

        // عرض اسم المستخدم والدور
        const fullnameEl = document.getElementById('user-fullname');
        const roleEl = document.getElementById('user-role');
        if (fullnameEl) fullnameEl.textContent = currentUserProfile.full_name || '';
        if (roleEl) roleEl.textContent = "معلم";

        // إعداد مبدل الأدوار
        await setupTeacherRoleSwitcher(userId);

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = '../index.html';
        });

        setupNavigation(loadPageData);
        navigateToPage('dashboard-content');

    } catch (error) {
        console.error("Fatal Error during app initialization:", error);
        const mainContent = document.querySelector('.main-content');
        if (mainContent) mainContent.innerHTML = `<div class="p-6 text-center text-red-600 font-bold">${error.message}</div>`;
    }
}


// ======[  3. دالة تبديل الأدوار  ]======
async function setupTeacherRoleSwitcher(userId) {
    const { data: userData, error } = await supabase.from('profiles').select(`current_role, user_roles ( roles (role_name) )`).eq('id', userId).single();
    
    const roleSwitcher = document.getElementById('role-switcher');
    if (error || !userData || !userData.user_roles || userData.user_roles.length <= 1) {
        if (roleSwitcher) roleSwitcher.style.display = 'none';
        return;
    }
    
    const rolesArr = userData.user_roles.map(ur => ur.roles.role_name);
    const currentRole = userData.current_role || 'teacher';
    
    const currentRoleNameEl = document.getElementById('current-role-name');
    if (currentRoleNameEl) currentRoleNameEl.textContent = currentRole;
    
    const dropdown = document.getElementById('roles-dropdown');
    const btn = document.getElementById('current-role-btn');
    if (!dropdown || !btn) return;
    dropdown.innerHTML = '';
    
    rolesArr.forEach(role => {
        const li = document.createElement('li');
        li.textContent = role;
        li.className = 'p-2 hover:bg-gray-100 cursor-pointer';
        li.onclick = async () => {
            try {
                const { error: updateError } = await supabase.from('profiles').update({ current_role: role }).eq('id', userId);
                if (updateError) throw updateError;
                
                if (role === 'teacher') window.location.reload();
                else if (role === 'parent') window.location.href = '../parent/index.html';
                else if (role === 'director' || role === 'admin') window.location.href = '../gradly/director.html';
            } catch(e) {
                console.error("Role switch failed:", e?.message || e);
                alert('فشل تبديل الدور.');
            }
        };
        dropdown.appendChild(li);
    });

    btn.onclick = (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
    };

    document.addEventListener('click', (e) => {
        if (roleSwitcher && !roleSwitcher.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });

    if (roleSwitcher) roleSwitcher.style.display = 'block';
}


// ======[ 4. دالة تحميل بيانات الصفحات الداخلية ]======
async function loadPageData(pageId) {
    if (!currentUserProfile || !currentUserProfile.id) return;
    const teacherId = currentUserProfile.id;

    switch (pageId) {
        case 'dashboard-content':
            await initDashboardPage(teacherId);
            break;
        case 'classes-content':
            await initClassesPage(teacherId);
            break;
        case 'courses-content':
            await renderTeacherCourses(teacherId);
            break;
        case 'assessments-content':
            // ==========================================================
            //  هذا هو الجزء الذي تم تعديله بالكامل
            // ==========================================================
            
            // 1. عرض البيانات للتبويب الافتراضي (شبكات التقييم)
            await loadEvaluationNetworks(teacherId);

            // 2. إعداد مستمعي الأحداث لأزرار التبويب (هذا هو الحل)
            document.querySelectorAll('#assessments-content .tab-btn').forEach(button => {
                // استخدام .onclick لضمان استبدال أي مستمع قديم بدلاً من إضافته
                button.onclick = function() {
                    // --- أولاً: التعامل مع الواجهة ---
                    // إزالة 'active' من كل الأزرار وإضافتها للزر المضغوط
                    document.querySelectorAll('#assessments-content .tab-btn').forEach(btn => btn.classList.remove('active'));
                    this.classList.add('active');

                    // إخفاء كل محتويات التبويبات
                    document.querySelectorAll('#assessments-content .tab-content').forEach(content => {
                        content.style.display = 'none';
                    });
                    
                    // إظهار المحتوى المستهدف
                    const targetTabId = this.dataset.tab;
                    const targetContent = document.getElementById(targetTabId);
                    if (targetContent) {
                        targetContent.style.display = 'block';
                    }

                    // --- ثانياً: تحميل البيانات للتبويب المحدد ---
                    switch (targetTabId) {
                        case 'grids-tab':
                            // إعادة تحميل بيانات شبكات التقييم عند الرجوع إليها
                            loadEvaluationNetworks(teacherId);
                            break;
                        case 'grades-tab':
                            // <<-- هذا هو السطر المطلوب لتشغيل عملية إدخال الدرجات
                            initGradingFlow(teacherId);
                            break;
                        case 'gradebook-tab':
                            // تحميل سجل الدرجات عند الضغط على تبويبه
                            loadGradesBook(teacherId);
                            initAssessmentsPage(teacherId);
                            break;
                    }
                };
            });
            
            // 3. تأكد من أن الحالة الأولية للواجهة صحيحة عند تحميل الصفحة لأول مرة
            document.getElementById('grids-tab').style.display = 'block';
            document.getElementById('grades-tab').style.display = 'none';
            document.getElementById('gradebook-tab').style.display = 'none';
            // إعادة تعيين الزر النشط إلى الافتراضي
            document.querySelectorAll('#assessments-content .tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelector('#assessments-content .tab-btn[data-tab="grids-tab"]').classList.add('active');

            break;
        case 'meetings-content':
            await initMeetingsPage(teacherId);
            break;
    }
}

async function main() {
    try {
        currentUserProfile = await getCurrentUserProfile();
        if (!currentUserProfile) return;

        document.getElementById('user-fullname').textContent = currentUserProfile.full_name;
        document.getElementById('user-role').textContent = currentUserProfile.role_name;

        document.getElementById('logout-btn').addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = 'index.html';
        });

        setupNavigation(loadPageData);
        navigateToPage('dashboard-content');

    } catch (error) {
        console.error("Fatal Error during app initialization:", error);
        document.querySelector('.main-content').innerHTML = `<div class="p-6 text-center text-red-600 font-bold">${error.message}</div>`;
    }
}

// بعد تحميل الصفحة أو بعد تهيئة الجلسة، عبّئ بيانات المستخدم في الشريط الجانبي
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const profile = await getCurrentUserProfile();
        if (!profile) return;
        const nameEl = document.getElementById('user-fullname');
        const roleEl = document.getElementById('user-role');
        if (nameEl) nameEl.textContent = profile.full_name || profile.email || '';
        // اختر العرض المناسب: current_role ثم role_name ثم role
        const roleText = profile.current_role || profile.role_name || profile.role || '';
        if (roleEl) roleEl.textContent = roleText;
    } catch (err) {
        console.warn('populate user info failed', err);
    }
});

document.addEventListener('DOMContentLoaded', main);