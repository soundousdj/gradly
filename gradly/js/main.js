// gradly/js/main.js - النسخة النهائية المصححة بالكامل

import * as Dashboard from './pages/dashboard.js';
import * as Students from './pages/students.js';
import * as Groups from './pages/groups.js';
import * as Teachers from './pages/teachers.js';
import * as Meetings from './pages/meetings.js';
import * as Reports from './pages/reports.js';
import * as Users from './pages/users.js';
import * as Permissions from './pages/permissions.js';
import * as Evaluation from './pages/evaluation.js';
import * as Settings from './pages/settings.js';

// ======[ 1. حارس التوجيه (Routing Guard) ]======
(async () => {
    const supabase = window.supabaseClient;
    if (!supabase) { console.error("Supabase client not found."); return; }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '../login_page.html'; return; }

    const { data: profile, error } = await supabase.from('profiles').select('current_role').eq('id', session.user.id).single();
    if (error || !profile || !profile.current_role) {
        await supabase.auth.signOut();
        window.location.href = '../login_page.html';
        return;
    }

    const authorizedRole = profile.current_role;
    if (authorizedRole !== 'director' && authorizedRole !== 'admin') {
        if (authorizedRole === 'parent') window.location.href = '../parent/index.html';
        else if (authorizedRole === 'teacher') window.location.href = '../Techer/teacher.html';
        else window.location.href = '../login_page.html';
        return; 
    }

    // ضع معرف المدير كقيمة عالمية لتستخدمه باقي الوحدات
    window.currentDirectorId = session.user.id;

    initializeDirectorPage(session.user.id);
})();

// ======[ 2. دالة تهيئة الصفحة الرئيسية ]======
async function initializeDirectorPage(directorId) {
    const supabase = window.supabaseClient;
    try {
        const { data: profile } = await supabase.from('profiles').select('full_name, current_role').eq('id', directorId).single();
        if (profile) {
            const userNameEl = document.getElementById('user-name');
            const userRoleEl = document.getElementById('user-role');
            if (userNameEl) userNameEl.textContent = profile.full_name || '';
            if (userRoleEl) userRoleEl.textContent = profile.current_role || '';
        }
    } catch (e) {
        console.error('Failed to load profile', e);
    }

    await setupRoleSwitcher(directorId);

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = '../login_page.html';
        });
    }

    document.querySelectorAll('.sidebar-menu .menu-item').forEach(item => {
        item.addEventListener('click', function() {
            document.querySelectorAll('.sidebar-menu .menu-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            const pageId = this.getAttribute('data-page');
            document.querySelectorAll('.content-area').forEach(area => area.style.display = 'none');
            const targetPage = document.getElementById(pageId);
            if (targetPage) targetPage.style.display = 'block';
            loadInternalPage(pageId, directorId); 
        });
    });

    // عرض افتراضي
    loadInternalPage('dashboard-content', directorId);
}

// ======[ 3. دالة تبديل الأدوار ]======
async function setupRoleSwitcher(userId) {
    const supabase = window.supabaseClient;
    const { data: userData, error } = await supabase
        .from('profiles')
        .select(`current_role, user_roles ( roles (role_name) )`)
        .eq('id', userId)
        .single();

    const roleSwitcher = document.getElementById('role-switcher');
    if (error || !userData) {
        if (roleSwitcher) roleSwitcher.style.display = 'none';
        return;
    }

    const rolesArr = (userData.user_roles || []).map(ur => ur.roles.role_name);
    if (rolesArr.length <= 1) {
        if (roleSwitcher) roleSwitcher.style.display = 'none';
        return;
    }

    const currentRoleNameEl = document.getElementById('current-role-name');
    const dropdown = document.getElementById('roles-dropdown');
    const btn = document.getElementById('current-role-btn');
    if (!currentRoleNameEl || !dropdown || !btn) return;

    currentRoleNameEl.textContent = userData.current_role || rolesArr[0];
    dropdown.innerHTML = '';

    rolesArr.forEach(role => {
        const li = document.createElement('li');
        li.textContent = role;
        li.style.cursor = 'pointer';
        li.style.padding = '8px';
        li.onclick = async () => {
            try {
                await supabase.from('profiles').update({ current_role: role }).eq('id', userId);
                if (role === 'teacher') window.location.href = '../Techer/teacher.html';
                else if (role === 'parent') window.location.href = '../parent/index.html';
                else if (role === 'director' || role === 'admin') window.location.reload();
            } catch (err) {
                console.error('Role switch failed', err);
            }
        };
        dropdown.appendChild(li);
    });

    btn.onclick = (e) => {
        e.stopPropagation();
        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    };

    document.addEventListener('click', () => {
        if (dropdown) dropdown.style.display = 'none';
    });

    if (roleSwitcher) roleSwitcher.style.display = 'block';
}

// ======[ 4. دالة تحميل الصفحات الداخلية (مع تمرير directorId) ]======
async function loadInternalPage(pageId, directorId) {
    switch (pageId) {
        case 'dashboard-content':
            if (Dashboard.renderDashboardStats) await Dashboard.renderDashboardStats(directorId);
            if (Dashboard.renderRecentActivities) await Dashboard.renderRecentActivities(directorId);
            if (Dashboard.renderUpcomingMeetings) await Dashboard.renderUpcomingMeetings(directorId);
            // استدعاء الدالة من وحدة Dashboard
            if (Dashboard.renderTopStudents) await Dashboard.renderTopStudents(directorId);
            break;
        case 'students-content':
            if (Students.initStudentsPage) await Students.initStudentsPage(directorId);
            break;
        case 'manage-groups-content':
            if (Groups.initGroupsPage) await Groups.initGroupsPage(directorId);
            break;
        case 'teachers-content':
            if (Teachers.initTeachersPage) await Teachers.initTeachersPage(directorId);
            break;
        case 'meetings-content':
            if (Meetings.initMeetingsPage) await Meetings.initMeetingsPage(directorId);
            break;
        case 'users-content':
            if (Users.initUsersPage) await Users.initUsersPage(directorId);
            break;
        case 'evaluation-network-content':
            if (Evaluation.initEvaluationPage) await Evaluation.initEvaluationPage(directorId);
            break;
        case 'reports-content':
            if (Reports.initReportsPage) await Reports.initReportsPage();
            break;
        case 'permissions-content':
            if (Permissions.initPermissionsPage) await Permissions.initPermissionsPage();
            break;
        case 'settings-content':
            if (Settings.initSettingsPage) await Settings.initSettingsPage();
            break;
        default:
            console.warn('Unknown pageId', pageId);
    }
}