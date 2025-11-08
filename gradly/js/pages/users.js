// js/pages/users.js

// افتراض أن كائن supabase متاح عالميًا أو يتم استيراده
// import { supabase } from '../services/supabaseService.js';

let allRolesCache = [];

// --- 1. تعريف عناصر الواجهة ---
const addUserBtn = document.getElementById('add-user-btn');
const userModal = document.getElementById('user-modal');
const closeModalBtn = document.getElementById('close-user-modal');
const userForm = document.getElementById('user-form');
const usersTableBody = document.getElementById('users-table-body');
const modalTitle = document.getElementById('user-modal-title');
const userIdInput = document.getElementById('user-id');
const saveBtn = document.getElementById('save-user-btn');

// عناصر الفلاتر
const searchInput = document.getElementById('user-search-input');
const roleFilter = document.getElementById('user-role-filter');

let teacherRoleId = null; // معرف دور المعلم

// --- 2. دوال جلب وعرض البيانات ---

/**
 * جلب بيانات مدير النظام وعرض ملخص بسيط أعلى واجهة إدارة المستخدمين
 */
async function fetchDirectorProfile() {
    try {
        if (!window.currentDirectorId) return null;
        const { data: director, error } = await window.supabaseClient
            .from('profiles')
            .select('id, full_name, email, avatar_url, phone, role, is_active')
            .eq('id', window.currentDirectorId)
            .single();
        if (error) throw error;

        // ضع الملخص داخل users-content إن لم يكن موجودًا
        const usersContent = document.getElementById('users-content');
        if (usersContent) {
            let summaryEl = document.getElementById('director-summary');
            if (!summaryEl) {
                summaryEl = document.createElement('div');
                summaryEl.id = 'director-summary';
                summaryEl.className = 'mb-4 p-4 bg-white rounded shadow flex items-center gap-4';
                usersContent.insertBefore(summaryEl, usersContent.firstChild);
            }
            summaryEl.innerHTML = `
                <img src="${director.avatar_url || '../logo.jpg'}" alt="avatar" style="width:56px;height:56px;border-radius:8px;object-fit:cover;">
                <div>
                    <div class="font-bold text-lg">${director.full_name || 'مدير'}</div>
                    <div class="text-sm text-gray-600">${director.email || ''} • ${director.phone || ''}</div>
                    <div class="text-xs mt-1">${director.role ? 'الدور: ' + director.role : ''} ${director.is_active ? '• نشط' : '• معطل'}</div>
                </div>
            `;
        }
        return director;
    } catch (err) {
        console.error('Error fetching director profile:', err);
        return null;
    }
}

/**
 * جلب جميع المستخدمين مع أدوارهم من Supabase (مقيدين بحساب المدير حالياً)
 */
async function fetchAndRenderUsers() {
    usersTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center">جاري تحميل المستخدمين...</td></tr>`;

    try {
        const currentDirectorId = window.currentDirectorId;
        if (!currentDirectorId) {
            usersTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">معرف المدير غير معرف.</td></tr>`;
            return;
        }

        // جلب كل المستخدمين الذين ينتمون لهذا المدير أو الحساب نفسه
        const { data: users, error } = await window.supabaseClient
            .from('profiles')
            .select(`
                id,
                full_name,
                email,
                is_active,
                phone,
                avatar_url,
                user_roles (
                    role_id,
                    roles (
                        role_name
                    )
                )
            `)
            .or(`director_id.eq.${currentDirectorId},id.eq.${currentDirectorId}`)
            .order('full_name', { ascending: true });

        if (error) throw error;

        // تطبيق فلتر البحث والفلتر حسب الدور على الجانب العميل
        let filtered = users || [];
        const searchTerm = (searchInput.value || '').trim().toLowerCase();
        if (searchTerm) {
            filtered = filtered.filter(u =>
                (u.full_name || '').toLowerCase().includes(searchTerm) ||
                (u.email || '').toLowerCase().includes(searchTerm)
            );
        }

        const roleValue = roleFilter.value || 'all';
        if (roleValue !== 'all') {
            // roleValue يمكن أن يكون اسم الدور (مثل 'teacher') أو قيمة أخرى من القوائم
            filtered = filtered.filter(u => {
                const roleNames = (u.user_roles || []).map(r => r.roles?.role_name).filter(Boolean);
                return roleNames.includes(roleValue);
            });
        }

        renderUsersTable(filtered);

    } catch (error) {
        console.error('Error fetching users:', error);
        usersTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">حدث خطأ أثناء تحميل المستخدمين.</td></tr>`;
    }
}

/**
 * عرض بيانات المستخدمين في الجدول
 */
function renderUsersTable(users) {
    usersTableBody.innerHTML = '';
    if (users.length === 0) {
        usersTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-500">لا يوجد مستخدمون يطابقون البحث.</td></tr>`;
        return;
    }

    users.forEach(user => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';

        const roles = user.user_roles.map(r => r.roles.role_name).join(', ') || '<i>بدون دور</i>';
        const status = user.is_active 
            ? '<span class="px-2 py-1 bg-green-200 text-green-800 rounded-full text-xs">نشط</span>'
            : '<span class="px-2 py-1 bg-gray-200 text-gray-800 rounded-full text-xs">معطل</span>';

        row.innerHTML = `
            <td class="p-3 text-right font-semibold">${user.full_name}</td>
            <td class="p-3">${user.email}</td>
            <td class="p-3">${roles}</td>
            <td class="p-3">${status}</td>
            <td class="p-3 flex justify-center gap-2">
                <button title="تعديل المستخدم" class="edit-btn text-yellow-600 hover:text-yellow-800" data-id="${user.id}"><i class="fas fa-edit"></i></button>
                <button title="حذف المستخدم" class="delete-btn text-red-600 hover:text-red-800" data-id="${user.id}"><i class="fas fa-trash-alt"></i></button>
            </td>
        `;
        usersTableBody.appendChild(row);

        // ربط الأحداث بالأزرار الجديدة
        row.querySelector('.edit-btn').addEventListener('click', () => openModalForEdit(user.id));
        row.querySelector('.delete-btn').addEventListener('click', () => handleDelete(user.id, user.full_name));
    });
}

// --- 3. دوال التحكم بالنموذج (Modal) ---

/**
 * تعبئة مربعات الاختيار الخاصة بالأدوار من قاعدة البيانات
 */
async function populateRolesCheckboxes() {
    const container = document.getElementById('user-roles-checkboxes');
    container.innerHTML = 'جاري تحميل الأدوار...';
    try {
        const { data: roles, error } = await window.supabaseClient.from('roles').select('id, role_name');
        if (error) throw error;
        allRolesCache = roles; // تخزين الأدوار
        // حفظ معرف دور المعلم
        const teacherRole = roles.find(r => r.role_name === 'teacher');
        teacherRoleId = teacherRole ? teacherRole.id : null;
        container.innerHTML = '';
        roles.forEach(role => {
            container.innerHTML += `
                <label class="flex items-center gap-2">
                    <input type="checkbox" name="roles" value="${role.id}">
                    <span>${role.role_name}</span>
                </label>
            `;
        });
    } catch (error) {
        console.error('Error populating roles:', error);
        container.innerHTML = '<p class="text-red-500">فشل تحميل الأدوار</p>';
    }
}

function openModalForCreate(preselectedRoleName = null) {
    userForm.reset();
    userIdInput.value = '';
    document.getElementById('user-password').setAttribute('required', 'true');
    modalTitle.textContent = 'إضافة مستخدم جديد';

    // تحديد الدور المسبق
    if (preselectedRoleName && allRolesCache.length > 0) {
        const roleToSelect = allRolesCache.find(r => r.role_name === preselectedRoleName);
        if (roleToSelect) {
            const checkbox = document.querySelector(`#user-roles-checkboxes input[value="${roleToSelect.id}"]`);
            if (checkbox) {
                checkbox.checked = true;
            }
        }
    }

    userModal.classList.remove('hidden');
}

async function openModalForEdit(id) {
    userForm.reset();
    document.getElementById('user-password').removeAttribute('required');

    try {
        const { data: user, error } = await window.supabaseClient
            .from('profiles')
            .select(`*, user_roles(role_id)`)
            .eq('id', id)
            .single();
        if (error) throw error;
        
        // ملء النموذج
        userIdInput.value = user.id;
        document.getElementById('user-fullname').value = user.full_name;
        document.getElementById('user-email').value = user.email;
        document.getElementById('user-email').disabled = true; // لا يمكن تغيير البريد الإلكتروني
        document.getElementById('user-is-active').checked = user.is_active;
        
        // تحديد الأدوار الحالية
        const userRoleIds = user.user_roles.map(r => r.role_id);
        document.querySelectorAll('#user-roles-checkboxes input').forEach(checkbox => {
            checkbox.checked = userRoleIds.includes(parseInt(checkbox.value));
        });
        
        modalTitle.textContent = 'تعديل بيانات المستخدم';
        userModal.classList.remove('hidden');
    } catch (error) {
        console.error('Error fetching user for edit:', error);
        alert('فشل في تحميل بيانات المستخدم.');
    }
}

function closeModal() {
    userModal.classList.add('hidden');
    document.getElementById('user-email').disabled = false;
}

// --- 4. دوال الحفظ والحذف (تعتمد على Edge Functions) ---

/**
 * ملاحظة هامة جداً:
 * الدوال التالية (handleFormSubmit, handleDelete) تفترض أن لديك
 * Edge Functions في Supabase للتعامل مع عمليات المسؤول (Admin).
 * لا يمكنك استدعاء auth.admin مباشرة من الواجهة الأمامية.
 */

async function handleFormSubmit(event) {
    event.preventDefault();
    saveBtn.disabled = true;
    saveBtn.textContent = 'جاري الحفظ...';

    const userId = userIdInput.value;
    const selectedRoleIds = Array.from(document.querySelectorAll('#user-roles-checkboxes input:checked')).map(cb => parseInt(cb.value));

    // طباعة الأدوار المختارة قبل الإرسال
    console.log("Selected roles before sending:", selectedRoleIds);

    const userData = {
        full_name: document.getElementById('user-fullname').value,
        email: document.getElementById('user-email').value,
        password: document.getElementById('user-password').value,
        is_active: document.getElementById('user-is-active').checked,
        roles: selectedRoleIds
    };

    try {
        const functionName = userId ? 'update-user-admin' : 'create-user-admin';
        if (userId) {
            userData.id = userId;
        }

        // طباعة البيانات المرسلة للـ Edge Function
        console.log("Sending data to Edge Function:", functionName, userData);

        const { data, error } = await window.supabaseClient.functions.invoke(functionName, {
            body: userData
        });

        // طباعة نتيجة الاستجابة من الـ Edge Function
        console.log("Edge Function response:", { data, error });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        // بعد نجاح إضافة المستخدم، جلب الأدوار الفعلية من قاعدة البيانات للمستخدم الجديد
        let user_id_to_check = userId;
        if (!userId) {
            // إذا كان إنشاء جديد، جلب المستخدم عبر البريد الإلكتروني
            const { data: userProfile, error: userProfileError } = await window.supabaseClient
                .from('profiles')
                .select('id')
                .eq('email', userData.email)
                .single();
            if (userProfileError) {
                console.error("Error fetching new user profile:", userProfileError);
            } else {
                user_id_to_check = userProfile.id;
            }
        }
        if (user_id_to_check) {
            const { data: userRoles, error: userRolesError } = await window.supabaseClient
                .from('user_roles')
                .select('role_id')
                .eq('user_id', user_id_to_check);
            if (userRolesError) {
                console.error("Error fetching user_roles after save:", userRolesError);
            } else {
                console.log("Roles in user_roles table after save:", userRoles);
            }
        }

        // بعد نجاح إضافة المستخدم
        if (selectedRoleIds.includes(teacherRoleId)) {
            await window.supabaseClient
                .from('profiles')
                .update({ role: 'teacher' })
                .eq('email', userData.email);
        } else {
            await window.supabaseClient
                .from('profiles')
                .update({ role: 'parent' })
                .eq('email', userData.email);
        }

        alert(data.message);
        closeModal();
        fetchAndRenderUsers();

        // إذا كان الدور معلم، افتح نموذج ملء معلومات المعلم تلقائيًا
        if (selectedRoleIds.includes(teacherRoleId)) {
            // استدعِ دالة فتح نموذج المعلم ومرر البريد الإلكتروني أو اسم المستخدم
            if (window.initTeachersPage) {
                await window.initTeachersPage();
            }
            // افتح نموذج إضافة معلم واملأ البريد الإلكتروني تلقائيًا
            const addTeacherModal = document.getElementById('add-teacher-modal');
            const teacherEmailInput = document.getElementById('teacher-email');
            if (addTeacherModal && teacherEmailInput) {
                addTeacherModal.classList.remove('hidden');
                teacherEmailInput.value = userData.email;
            }
        }

    } catch (error) {
        console.error('Error saving user:', error);
        alert(`فشل حفظ المستخدم: ${error.message}`);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'حفظ المستخدم';
    }
}

async function handleDelete(id, name) {
    if (!confirm(`هل أنت متأكد من حذف المستخدم "${name}"؟ هذا الإجراء سيحذف حساب المصادقة الخاص به نهائياً.`)) return;
    
    try {
        // استدعاء دالة Edge Function لحذف المستخدم
        const { data, error } = await window.supabaseClient.functions.invoke('delete-user-admin', {
            body: { id: id }
        });
        if (error) throw error;
        if (data.error) throw new Error(data.error);

        alert(data.message);
        fetchAndRenderUsers();

    } catch (error) {
        console.error('Error deleting user:', error);
        alert(`فشل حذف المستخدم: ${error.message}`);
    }
}

// --- 5. دالة التهيئة  الرئيسية للصفحة ---

export async function initUsersPage() {
    // ربط الأحداث
    addUserBtn.addEventListener('click', openModalForCreate);
    closeModalBtn.addEventListener('click', closeModal);
    userForm.addEventListener('submit', handleFormSubmit);
    searchInput.addEventListener('input', fetchAndRenderUsers);
    roleFilter.addEventListener('change', fetchAndRenderUsers);
    
    // التشغيل الأولي
    await populateRolesCheckboxes();

    // جلب وعرض معلومات المدير أولاً (ملخص)
    await fetchDirectorProfile();

    await fetchAndRenderUsers();

    // ربط نموذج إضافة المعلم
    const addTeacherForm = document.getElementById('add-teacher-form');
    if (addTeacherForm) {
        addTeacherForm.onsubmit = async function(e) {
            e.preventDefault();
            const saveBtn = addTeacherForm.querySelector('button[type="submit"]');
            if (saveBtn) saveBtn.disabled = true;

            // اجمع البيانات من النموذج
            const teacherData = {
                full_name: document.getElementById('teacher-fullname').value,
                email: document.getElementById('teacher-email').value,
                phone: document.getElementById('teacher-phone').value,
                subject: document.getElementById('teacher-subject').value,
                degree: document.getElementById('teacher-degree').value,
                address: document.getElementById('teacher-address').value,
                role: 'teacher',
                director_id: window.currentDirectorId // تأكد من ربط المعلم بالمدير
            };

            try {
                // تحديث بيانات المعلم في profiles حسب البريد الإلكتروني
                const { error } = await window.supabaseClient
                    .from('profiles')
                    .update(teacherData)
                    .eq('email', teacherData.email);

                if (error) throw error;

                alert('تم حفظ بيانات المعلم بنجاح');
                document.getElementById('add-teacher-modal').classList.add('hidden');

                // إعادة تحميل قائمة المستخدمين لتعكس التغييرات
                await fetchAndRenderUsers();
            } catch (err) {
                alert('فشل حفظ بيانات المعلم: ' + err.message);
            } finally {
                if (saveBtn) saveBtn.disabled = false;
            }
        };
    }
}