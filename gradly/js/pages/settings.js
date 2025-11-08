// js/pages/settings.js

// --- 1. دوال مساعدة ---

function setupTabs() {
    const tabs = document.querySelectorAll('.settings-tab');
    const tabContents = document.querySelectorAll('.settings-tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();

            // إزالة التفعيل من الكل
            tabs.forEach(t => t.classList.remove('active-tab'));
            tabContents.forEach(c => c.classList.add('hidden'));

            // تفعيل التبويب المختار
            tab.classList.add('active-tab');
            const targetContent = document.querySelector(tab.getAttribute('href'));
            if (targetContent) {
                targetContent.classList.remove('hidden');
            }
        });
    });
}


// --- 2. منطق تبويب "الحساب الشخصي" ---

async function loadPersonalData() {
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    if (user) {
        document.getElementById('director-email').value = user.email;
        // جلب الاسم من جدول profiles
        const { data: profile, error } = await window.supabaseClient
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();
        if (profile) {
            document.getElementById('director-fullname').value = profile.full_name;
        }
    }
}

async function handleUpdatePassword(e) {
    e.preventDefault();
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-new-password').value;

    if (newPassword.length < 6) {
        return alert('يجب أن تكون كلمة المرور 6 أحرف على الأقل.');
    }
    if (newPassword !== confirmPassword) {
        return alert('كلمتا المرور غير متطابقتين.');
    }

    const { error } = await window.supabaseClient.auth.updateUser({ password: newPassword });
    if (error) {
        alert(`فشل تحديث كلمة المرور: ${error.message}`);
    } else {
        alert('✅ تم تحديث كلمة المرور بنجاح.');
        e.target.reset();
    }
}

// --- 3. منطق تبويب "إعدادات النظام" ---

async function loadGeneralSettings() {
    const yearSelect = document.getElementById('current-academic-year');
    yearSelect.innerHTML = '<option>جاري التحميل...</option>';

    // نفترض أن لديك جدول `settings` لتخزين الإعدادات العامة
    // هذا مثال بسيط، يمكنك تعديله حسب حاجتك
    const { data: setting, error: settingError } = await window.supabaseClient
        .from('settings')
        .select('value')
        .eq('key', 'current_academic_year_id')
        .single();
    
    const currentYearId = setting ? setting.value : null;

    const { data: years, error: yearsError } = await window.supabaseClient
        .from('academic_years')   // تصحيح الاسم من academic_year إلى academic_years
        .select('id, name');
    
    if (years) {
        yearSelect.innerHTML = '';
        years.forEach(year => {
            const option = document.createElement('option');
            option.value = year.id;
            option.textContent = year.name;
            if (year.id == currentYearId) {
                option.selected = true;
            }
            yearSelect.appendChild(option);
        });
    }
}

// --- 4. منطق تبويب "البيانات والنسخ الاحتياطي" ---

async function exportData(tableName, fileName) {
    alert(`جاري تجهيز ملف ${fileName}... قد تستغرق العملية بعض الوقت.`);
    try {
        const { data, error } = await window.supabaseClient.from(tableName).select('*');
        if (error) throw error;
        
        if (data.length === 0) {
            return alert('لا توجد بيانات لتصديرها.');
        }

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, tableName);
        XLSX.writeFile(wb, `${fileName}.xlsx`);

    } catch (err) {
        alert(`❌ فشل تصدير البيانات: ${err.message}`);
    }
}


// --- 5. دالة التهيئة الرئيسية للصفحة ---

let isSettingsPageInitialized = false;

export async function initSettingsPage() {
    if (!isSettingsPageInitialized) {
        setupTabs();
        
        // ربط الأحداث
        document.getElementById('password-change-form').addEventListener('submit', handleUpdatePassword);
        
        document.getElementById('export-all-students-btn').addEventListener('click', () => exportData('students', 'All_Students_Backup'));
        document.getElementById('export-all-teachers-btn').addEventListener('click', () => exportData('teachers', 'All_Teachers_Backup'));
        document.getElementById('export-all-grades-btn').addEventListener('click', () => exportData('student_grade_evaluate', 'All_Grades_Backup'));

        isSettingsPageInitialized = true;
    }

    // تحميل البيانات التي قد تتغير
    await loadPersonalData();
    await loadGeneralSettings();
}