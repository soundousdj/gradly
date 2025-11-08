// parent/script.js - النسخة النهائية المصححة والمنقحة

import { supabase } from "./supabaseClient.js";

// متغير عام لتخزين بيانات ولي الأمر الحالي
let currentParentProfile = null; 
let currentRole = null;
let currentLang = document.documentElement.dir === 'rtl' ? 'ar' : 'en';

// ====================================================================
// ====== 🌐 كائن تخزين النصوص للترجمة (Localization Object) ======
// ====================================================================

const translations = {
    ar: { 
        dashboard: "لوحة التحكم", children: "الأبناء", grades: "التقييمات", meetings: "الاجتماعات", profile: "الملف الشخصي", logout: "تسجيل الخروج", 
        title_dashboard: "لوحة التحكم", title_children: "الأبناء", title_grades: "تقييمات الأبناء", title_meetings: "الاجتماعات", title_profile: "الملف الشخصي",
        stat_children: "عدد الأبناء", stat_grade: "آخر تقييم", stat_meetings: "عدد الاجتماعات", parent_role: "ولي أمر", loading: "جاري التحميل...",
        field_role: "الدور", field_name: "الاسم", field_email: "البريد الإلكتروني", field_phone: "رقم الهاتف", field_address: "العنوان", field_degree: "الدرجة العلمية",
        not_available: "غير متوفر", subject_details: "تفاصيل تقييم", no_profile: "عذراً، لم يتم العثور على ملف شخصي لولي الأمر.",
        lang_msg_ar: "تم التبديل إلى اللغة العربية! 🌐", lang_msg_en: "تم التبديل إلى اللغة الإنجليزية! 🌐", lang_msg_fr: "تم التبديل إلى اللغة الفرنسية! 🌐",
        no_comment: "لا يوجد تعليق", unknown_criterion: "معيار غير معروف", level: "المستوى", no_children: "لا يوجد أبناء مسجلين لهذا الحساب.",
        no_evals: "لا توجد تقييمات متاحة لأبنائك.", no_meetings: "لا توجد اجتماعات مجدولة لهذا الحساب.", evaluation_network: "شبكة التقييم",
        latest_grade: "آخر درجة", grade_date: "التاريخ", details: "التفاصيل", close: "إغلاق",
    },
    en: { /* ... أضف ترجماتك الإنجليزية هنا ... */ },
    fr: { /* ... أضف ترجماتك الفرنسية هنا ... */ }
};

// دالة الترجمة
function t(key) {
    return translations[currentLang]?.[key] || key;
}

// دالة لتنظيف النصوص من أكواد HTML
function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return unsafe.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// ====================================================================
// ====== 1. حارس التوجيه (Routing Guard) والتهيئة الأساسية ======
// ====================================================================

(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '../index.html'; return; }

    const { data: profile, error } = await supabase.from('profiles').select('current_role').eq('id', session.user.id).single();
    if (error || !profile || !profile.current_role) {
        await supabase.auth.signOut();
        window.location.href = '../index.html';
        return;
    }

    const authorizedRole = profile.current_role;
    if (authorizedRole !== 'parent') {
        if (authorizedRole === 'director' || authorizedRole === 'admin') window.location.href = '../gradly/director.html';
        else if (authorizedRole === 'teacher') window.location.href = '../Techer/teacher.html';
        else window.location.href = '../index.html';
        return;
    }

    initApp();
})();

// دالة لجلب المستخدم وتحديد الأدوار (مستخدمة داخل initApp فقط)
async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile, error } = await supabase
        .from('profiles')
        .select(`*, user_roles ( roles (role_name) )`)
        .eq('id', user.id)
        .single();
    
    if (error || !profile) return null;

    const rolesArr = (profile.user_roles || []).map(ur => ur.roles.role_name);
    currentParentProfile = profile;
    currentRole = profile.current_role;
    currentParentProfile.roles = rolesArr;

    document.getElementById('parent-name').textContent = profile.full_name || 'ولي أمر';
    document.getElementById('parent-role').textContent = t(currentRole === 'parent' ? 'parent_role' : currentRole);

    return currentParentProfile;
}

// دالة إظهار مبدل الدور
function showRoleSwitcher(roles) {
    const roleSwitcher = document.getElementById('role-switcher');
    const btn = document.getElementById('current-role-btn');
    const dropdown = document.getElementById('roles-dropdown');
    
    if (!roleSwitcher || !Array.isArray(roles) || roles.length <= 1) {
        if (roleSwitcher) roleSwitcher.style.display = 'none';
        return;
    }
    
    const currentRoleName = document.getElementById('current-role-name');
    currentRoleName.textContent = t(currentRole === 'parent' ? 'parent_role' : currentRole);
    dropdown.innerHTML = '';

    roles.forEach(role => {
        const li = document.createElement('li');
        li.textContent = t(role === 'parent' ? 'parent_role' : role);
        li.className = 'role-option';
        li.onclick = async () => {
            try {
                await supabase.from('profiles').update({ current_role: role }).eq('id', currentParentProfile.id);
                
                // التوجيه الصحيح بعد التبديل
                if (role === 'parent') window.location.reload();
                else if (role === 'director' || role === 'admin') window.location.href = "../gradly/director.html";
                else if (role === 'teacher') window.location.href = "../Techer/teacher.html";
            } catch (err) {
                alert("حدث خطأ أثناء تبديل الدور!");
            }
        };
        dropdown.appendChild(li);
    });

    btn.onclick = () => { dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none'; };
    roleSwitcher.style.display = 'block';
}

// دالة تطبيق الترجمة وإعادة تحميل الصفحة النشطة
function applyStaticTranslations() {
    document.querySelector('.nav-link[data-page="dashboard"] span').textContent = t('dashboard');
    document.querySelector('.nav-link[data-page="children"] span').textContent = t('children');
    document.querySelector('.nav-link[data-page="grades"] span').textContent = t('grades');
    document.querySelector('.nav-link[data-page="meetings"] span').textContent = t('meetings');
    document.querySelector('.nav-link[data-page="profile"] span').textContent = t('profile');
    document.getElementById('logout').lastChild.textContent = ' ' + t('logout');

    document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = currentLang;

    const activeLink = document.querySelector('.nav-link.active');
    if (activeLink) {
        loadPage(activeLink.dataset.page);
    } else {
        loadPage('dashboard');
    }
}

// دالة التهيئة الرئيسية
async function initApp() {
    // جلب بيانات المستخدم
    const userProfile = await getCurrentUser();
    if (!userProfile) return;

    // عرض مبدل الدور
    showRoleSwitcher(userProfile.roles || []);
    
    // تطبيق الترجمة وتحميل الصفحة الافتراضية
    applyStaticTranslations();
}

// ====================================================================
// ====== 2. وظائف التفاعل الرئيسية (Events) ======
// ====================================================================

const links = document.querySelectorAll(".nav-link");
const pageContent = document.getElementById("page-content");
const app = document.querySelector(".app");
const themeToggle = document.getElementById("theme-toggle");
const logoutBtn = document.getElementById("logout");
const langToggle = document.getElementById("lang-toggle");
const availableLangs = ['ar', 'en', 'fr'];

// الوضع الليلي
themeToggle.addEventListener("click", () => {
    app.classList.toggle("dark");
    const icon = themeToggle.querySelector('i');
    if (app.classList.contains('dark')) {
        icon.classList.replace('fa-sun', 'fa-moon');
    } else {
        icon.classList.replace('fa-moon', 'fa-sun');
    }
});

// تسجيل الخروج
logoutBtn.addEventListener("click", async () => {
    try {
        await supabase.auth.signOut();
        window.location.href = "../index.html";
    } catch (err) {
        alert("حدث خطأ أثناء تسجيل الخروج!");
    }
});

// تبديل اللغة
langToggle.addEventListener("click", () => {
    const currentIndex = availableLangs.indexOf(currentLang);
    const nextIndex = (currentIndex + 1) % availableLangs.length;
    currentLang = availableLangs[nextIndex];

    alert(t(`lang_msg_${currentLang}`));
    applyStaticTranslations();
});

// التنقل بين الصفحات
links.forEach(link => {
  link.addEventListener("click", e => {
    e.preventDefault();
    links.forEach(l => l.classList.remove("active"));
    link.classList.add("active");
    loadPage(link.dataset.page);
  });
});

// ====================================================================
// ====== 3. وظائف تحميل محتوى الصفحات (loadPage) ======
// ====================================================================

async function loadPage(page) {
    if (!currentParentProfile) {
        await getCurrentUser();
        if (!currentParentProfile) return;
    }

    pageContent.innerHTML = `<h1 style="text-align:center; margin-top: 50px;">${t('loading')}</h1>`;
    const parentId = currentParentProfile.id; 

    try {
        switch (page) {
            case "dashboard":
                await renderDashboard(parentId);
                break;
            case "children":
                await renderChildrenList(parentId);
                break;
            case "grades":
                await renderParentEvaluations(parentId); // استخدام الدالة المحدثة للتقييم
                break;
            case "meetings":
                await renderMeetings(parentId);
                break;
            case "profile":
                renderProfile();
                break;
        }
    } catch (err) {
        console.error(`Error loading page ${page}:`, err);
        pageContent.innerHTML = `<h1 style="text-align:center; color: red;">حدث خطأ: ${err.message || 'فشل التحميل'}</h1>`;
    }
}

// ====== دالة مساعدة: تحويل التاريخ إلى صيغة محلية YYYY‑MM‑DD أو عرض -
function fmtDate(dateStr) {
    if (!dateStr) return '-';
    try { return new Date(dateStr).toISOString().split('T')[0]; } catch (e) { return '-'; }
}

// ====== دالة مساعدة: اختيار لون الشارة ونص الحالة
function performanceBadge(finalScore, overallGrade) {
    let label = overallGrade || '';
    let bg = '#eef2ff'; // افتراضي أزرق فاتح
    let color = '#1e3a8a';

    const n = Number(finalScore);
    if (!Number.isNaN(n)) {
        if (n >= 16) { bg = '#d1fae5'; color = '#065f46'; label = label || 'تحكّم أقصى'; }
        else if (n >= 12) { bg = '#fff7c2'; color = '#92400e'; label = label || 'تحكّم جزئي'; }
        else { bg = '#fee2e2'; color = '#7f1d1d'; label = label || 'يحتاج تحسين'; }
    } else {
        // إن لم تكن رقمية استخدم overallGrade إن وُجد
        if (overallGrade === 'تحكّم أقصى') { bg = '#d1fae5'; color = '#065f46'; }
        else if (overallGrade === 'تحكّم جزئي') { bg = '#fff7c2'; color = '#92400e'; }
        else { bg = '#eef2ff'; color = '#1e3a8a'; }
        label = overallGrade || label || '-';
    }

    return { label, style: `background:${bg};color:${color};padding:6px 10px;border-radius:999px;font-weight:700` };
}

// ====== عرض لوحة التحكم مع بطاقة "آخر تقييم" محسّنة ======
async function renderDashboard(parentId) {
    // جلب بيانات سريعة: عدد الأبناء واجتماعات والنسخة الأخيرة من التقييم
    const [childrenRes, meetingsRes, latestEvalRes] = await Promise.all([
        supabase.from('students').select('id, firstname, lastname').eq('parent_id', parentId),
        supabase.from('meetings').select('id').contains('participants', [parentId]),
        // جلب أحدث تقييم من بين أبنائك
        (async () => {
            // أولاً جلب أولاد الوالد
            const { data: kids } = await supabase.from('students').select('id').eq('parent_id', parentId);
            const kidIds = (kids || []).map(k => k.id);
            if (kidIds.length === 0) return { data: [] };
            return supabase
                .from('student_evaluations')
                .select(`
                    id,
                    evaluation_date,
                    final_score,
                    overall_grade,
                    student_id,
                    students(firstname, lastname),
                    evaluation_networks(activity_name, subjects(name))
                `)
                .in('student_id', kidIds)
                .order('evaluation_date', { ascending: false })
                .limit(1);
        })()
    ]);

    const childrenCount = childrenRes.data?.length || 0;
    const meetingsCount = meetingsRes.data?.length || 0;
    const latest = (latestEvalRes.data && latestEvalRes.data[0]) || null;

    // بناء HTML اللوحة الرئيسية مع بطاقة آخر تقييم
    const latestCardHtml = latest ? (() => {
        const studentName = `${escapeHtml(latest.students?.firstname || '')} ${escapeHtml(latest.students?.lastname || '')}`.trim();
        const subject = escapeHtml(latest.evaluation_networks?.subjects?.name || '-');
        const activity = escapeHtml(latest.evaluation_networks?.activity_name || '-');
        const date = fmtDate(latest.evaluation_date);
        const score = latest.final_score ?? latest.overall_grade ?? '-';
        const badge = performanceBadge(latest.final_score, latest.overall_grade);

        return `
        <div class="bg-white p-4 rounded shadow mb-4" style="direction:rtl">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
            <div style="min-width:220px">
              <div style="font-size:0.95rem;color:#374151;margin-bottom:6px">${subject} — ${activity}</div>
              <div style="font-size:1.1rem;font-weight:600;color:#0f172a">${studentName}</div>
              <div style="color:#6b7280;margin-top:6px">التاريخ: <strong style="color:#111">${date}</strong></div>
            </div>

            <div style="text-align:center;flex:1">
              <div style="font-size:2.2rem;font-weight:800;color:#0f172a">${escapeHtml(String(score))} <span style="font-size:0.8rem;font-weight:600;color:#6b7280">/20</span></div>
              <div style="margin-top:10px">
                <span style="${badge.style}">${escapeHtml(badge.label)}</span>
              </div>
            </div>

            <div style="min-width:180px;display:flex;flex-direction:column;align-items:flex-end;gap:8px">
              <button id="view-latest-details" class="btn" style="background:#2563eb;color:#fff;border:none;padding:8px 12px;border-radius:6px;cursor:pointer">عرض التفاصيل</button>
              <button id="request-meeting" class="btn" style="background:#f3f4f6;border:none;padding:8px 12px;border-radius:6px;cursor:pointer">طلب اجتماع</button>
            </div>
          </div>
        </div>
        `;
    })() : `<div class="bg-white p-4 rounded shadow mb-4">لا توجد تقييمات حتى الآن.</div>`;

    pageContent.innerHTML = `
        <h1 style="margin-bottom:14px">${t('title_dashboard')}</h1>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
          <div style="background:#fff;padding:12px;border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,0.05);min-width:160px;text-align:center">
            <div style="font-size:12px;color:#6b7280">${t('stat_children')}</div>
            <div style="font-size:20px;font-weight:700;color:#0f172a">${childrenCount}</div>
          </div>
          <div style="background:#fff;padding:12px;border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,0.05);min-width:160px;text-align:center">
            <div style="font-size:12px;color:#6b7280">${t('stat_grade')}</div>
            <div style="font-size:20px;font-weight:700;color:#0f172a">${latest ? (latest.final_score ?? latest.overall_grade ?? '-') : '-'}</div>
          </div>
          <div style="background:#fff;padding:12px;border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,0.05);min-width:160px;text-align:center">
            <div style="font-size:12px;color:#6b7280">${t('stat_meetings')}</div>
            <div style="font-size:20px;font-weight:700;color:#0f172a">${meetingsCount}</div>
          </div>
        </div>

        ${latestCardHtml}

        <!-- باقي محتوى لوحة التحكم يمكن إضافته هنا -->
    `;

    // أحداث الأزرار داخل البطاقة
    document.getElementById('view-latest-details')?.addEventListener('click', () => {
        if (latest) {
            // إن كانت دالة عرض التفاصيل موجودة (تعريف في renderParentEvaluations) استخدمها مباشرة
            if (typeof window.showParentEvalDetails === 'function') {
                window.showParentEvalDetails(latest);
            } else {
                // وإلا انتقل إلى صفحة التقييمات حيث يمكن عرض التفاصيل
                loadPage('grades');
            }
        }
    });

    document.getElementById('request-meeting')?.addEventListener('click', () => {
        // سلوك مبدئي: فتح صفحة الاجتماعات أو إظهار نموذج طلب اجتماع
        loadPage('meetings');
    });
}

// ====== دالة مساعدة: عرض الأبناء ======
async function renderChildrenList(parentId) {
    const { data: kids } = await supabase
        .from("students")
        .select("firstname, lastname, gender, level")
        .eq('parent_id', parentId);

    pageContent.innerHTML = `
        <h1>${t('title_children')}</h1>
        <div class="child-list">
          ${kids?.length
            ? kids.map(k => `
              <div class="child-card">
                <i class="fa-solid fa-user"></i>
                <div>
                  <h4>${k.firstname} ${k.lastname}</h4> 
                  <p>${k.gender || t('not_available')}</p>
                  <small>${t('level')}: ${k.level || t('not_available')}</small>
                </div>
              </div>`).join("")
            : `<p style="text-align: center;">${t('no_children')}</p>`}
        </div>
    `;
}

// ====== دالة مساعدة: عرض الاجتماعات ======
async function renderMeetings(parentId) {
    const { data: meetList } = await supabase
        .from("meetings")
        .select("subject, meeting_date, meeting_time, status")
        .contains('participants', [parentId]) // يجب أن يكون parentId ضمن قائمة المشاركين
        .order("meeting_date", { ascending: false });

    pageContent.innerHTML = `
        <h1>${t('title_meetings')}</h1>
        <div class="meeting-list">
          ${meetList?.length
            ? meetList.map(m => `
              <div class="meeting-card"><i class="fa-solid fa-calendar"></i>
                <div>
                  <h4>${m.subject}</h4> 
                  <p>${m.meeting_date} - ${m.meeting_time}</p>
                  <small>الحالة: ${m.status || t('not_available')}</small>
                </div>
              </div>`).join("")
            : `<p style="text-align: center;">${t('no_meetings')}</p>`}
        </div>
    `;
}

// ====== دالة مساعدة: عرض الملف الشخصي ======
function renderProfile() {
    const parent = currentParentProfile;
    
    const parentData = parent ? `
        <h1>${t('title_profile')}</h1>
        <div class="profile-cards-grid">
          <div class="card profile-card-large" style="grid-column: span 2;">
            <i class="fa-solid fa-user-circle"></i>
            <h2>${parent.full_name || t('not_available')}</h2>
            <p><strong>${t('field_role')}:</strong> ${parent.current_role === 'parent' ? t('parent_role') : parent.current_role || t('not_available')}</p>
          </div>
          <div class="card">
            <i class="fa-solid fa-envelope"></i>
            <h4>${t('field_email')}</h4>
            <p>${parent.email || t('not_available')}</p>
          </div>
          <div class="card">
            <i class="fa-solid fa-phone"></i>
            <h4>${t('field_phone')}</h4>
            <p>${parent.phone || t('not_available')}</p>
          </div>
          <div class="card">
            <i class="fa-solid fa-location-dot"></i>
            <h4>${t('field_address')}</h4>
            <p>${parent.address || t('not_available')}</p>
          </div>
          <div class="card">
            <i class="fa-solid fa-graduation-cap"></i>
            <h4>${t('field_degree')}</h4>
            <p>${parent.degree || t('not_available')}</p>
          </div>
        </div>
    ` : `<p style="text-align: center; margin-top: 50px;"><i class="fa-solid fa-triangle-exclamation" style="color: #d80000; font-size: 1.5rem;"></i>${t('no_profile')}</p>`;

    pageContent.innerHTML = parentData;
}


// ====================================================================
// ====== 4. دالة عرض تقييمات الأبناء (renderParentEvaluations) ======
// ====================================================================

async function renderParentEvaluations(parentId) {
    const container = document.getElementById('page-content');
    container.innerHTML = `<h1>${t('title_grades')}</h1><div id="parent-evals-container"></div>`;
    const out = document.getElementById('parent-evals-container');
    out.innerHTML = `<div class="card">${t('loading')}</div>`;

    try {
        // 1. جلب الأبناء
        const { data: children } = await supabase.from('students').select('id, firstname, lastname').eq('parent_id', parentId);
        if (!children || children.length === 0) {
            out.innerHTML = `<div class="card">${t('no_children')}</div>`;
            return;
        }
        const studentIds = children.map(c => c.id);
        
        // 2. جلب التقييمات التفصيلية للأبناء (باستخدام اسماء الجداول الصحيحة: student_evaluations)
        const { data: evals, error } = await supabase
            .from('student_evaluations')
            .select(`
                id,
                evaluation_date,
                final_score,
                overall_grade,
                student_id,
                students(firstname, lastname),
                evaluation_networks(activity_name, subjects(name)),
                student_criteria_grades(id, grade, comment, network_criteria(criteria_text))
            `)
            .in('student_id', studentIds)
            .order('evaluation_date', { ascending: false });

        if (error) throw error;
        if (!evals || evals.length === 0) {
            out.innerHTML = `<div class="card">${t('no_evals')}</div>`;
            return;
        }

        // 3. تجميع التقييمات حسب اسم الطفل
        const grouped = {};
        evals.forEach(ev => {
            const name = ev.students ? `${ev.students.firstname} ${ev.students.lastname}` : 'تلميذ';
            grouped[name] = grouped[name] || [];
            grouped[name].push(ev);
        });

        // 4. بناء هيكل HTML للعرض
        out.innerHTML = `<div class="grade-section">` + Object.keys(grouped).map(childName => `
            <div class="child-card">
                <h3 class="font-semibold" style="color: #1e4fa1; text-align: center;">${escapeHtml(childName)}</h3>
                <div class="subject-list">
                ${grouped[childName].map(ev => {
                    const evJson = JSON.stringify(ev).replace(/'/g,"&#39;"); 
                    const subjectName = ev.evaluation_networks?.subjects?.name || t('not_available');
                    const activityName = ev.evaluation_networks?.activity_name || t('evaluation_network');
                    return `
                        <div class="subject-card" onclick='window.showParentEvalDetails(${evJson})'>
                            <div style="font-weight: bold; margin-bottom: 5px;">${escapeHtml(activityName)} - (${escapeHtml(subjectName)})</div>
                            <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                                <span>${t('latest_grade')}: <strong>${ev.overall_grade ?? ev.final_score ?? '-'}</strong></span>
                                <span>${t('grade_date')}: ${ev.evaluation_date ? new Date(ev.evaluation_date).toLocaleDateString() : '-'}</span>
                            </div>
                        </div>
                    `;
                }).join('')}
                </div>
            </div>
        `).join('') + `</div>`;

        // دالة لفتح مودال تفاصيل التقييم (متاحة عالمياً)
        window.showParentEvalDetails = function(ev) {
            const evaluation = typeof ev === 'string' ? JSON.parse(ev) : ev;
            
            const modalHtml = `
                <span class="close-btn" onclick="document.getElementById('parent-eval-modal')?.remove()">&times;</span>
                <div class="modal-card">
                    <h3 style="font-size: 1.5rem; color: #1e4fa1;">${t('subject_details')}: ${escapeHtml(evaluation.evaluation_networks?.subjects?.name || t('not_available'))}</h3>
                    <div style="margin-bottom: 5px;"><strong>${t('evaluation_network')}:</strong> ${escapeHtml(evaluation.evaluation_networks?.activity_name || t('not_available'))}</div>
                        <div style="font-size: 1.4rem; font-weight: bold; color: #d80000; margin-bottom: 15px;">${t('latest_grade')}: ${evaluation.overall_grade ?? evaluation.final_score ?? '-'}</div>
                        <hr style="margin: 20px 0; border-top: 1px solid #ddd;"/>
                    <h4 style="color: #1e4fa1; margin-bottom: 12px; font-size: 1.2rem;">تفاصيل المعايير:</h4>
                    ${(evaluation.student_criteria_grades || []).map(c => `
                        <div class="p-2 border rounded mb-3" style="border: 1px solid #dce6f7; padding: 12px; border-radius: 8px; background: #f9f9f9;">
                            <div><strong>${escapeHtml(c.network_criteria?.criteria_text || t('unknown_criterion'))}</strong></div>
                            <div style="color: #d80000; font-weight: bold; margin-top: 5px;">التقييم: ${c.grade} / 5 (${"⭐".repeat(c.grade || 0)})</div>
                            <div class="text-sm text-muted" style="font-size: 0.9rem; color: #666; margin-top: 5px;">ملاحظة: ${escapeHtml(c.comment || t('no_comment'))}</div>
                        </div>
                    `).join('')}
                    <div class="text-center mt-5"><button class="btn" style="background: #ccc; color: #333; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;" onclick="document.getElementById('parent-eval-modal')?.remove()">${t('close')}</button></div>
                </div>
            `;
            
            let m = document.getElementById('parent-eval-modal');
            if (m) m.remove();
            m = document.createElement('div');
            m.id = 'parent-eval-modal';
            m.className = 'modal'; 
            m.innerHTML = `<div class="modal-content">${modalHtml}</div>`; 
            document.body.appendChild(m);
        };

    } catch (err) {
        console.error("Error in renderParentEvaluations:", err);
        out.innerHTML = `<div class="card text-red-500">حدث خطأ أثناء تحميل التقييمات. يرجى التحقق من الكونسول.</div>`;
    }
}