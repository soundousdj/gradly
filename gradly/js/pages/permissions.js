// js/pages/permissions.js

// --- 1. تعريف عناصر الواجهة ---
const rolesList = document.getElementById('roles-list');
const permissionsPanel = document.getElementById('permissions-panel');
const permissionsPlaceholder = document.getElementById('permissions-placeholder');
const selectedRoleName = document.getElementById('selected-role-name');
const permissionsCheckboxes = document.getElementById('permissions-checkboxes');
const savePermissionsBtn = document.getElementById('save-permissions-btn');

let selectedRoleId = null;
let allPermissions = []; // لتخزين كل الصلاحيات المتاحة لتجنب استدعاءات متكررة

// --- 2. دوال جلب البيانات ---

async function fetchAllRoles() {
    try {
        const { data: roles, error } = await window.supabaseClient.from('roles').select('*');
        if (error) throw error;
        return roles;
    } catch (error) {
        console.error('Error fetching roles:', error.message);
        return [];
    }
}

async function fetchAllPermissions() {
    if (allPermissions.length > 0) return allPermissions; // استخدم البيانات المخزنة إذا كانت موجودة
    try {
        const { data, error } = await window.supabaseClient.from('permissions').select('*');
        if (error) throw error;
        allPermissions = data; // خزن البيانات للاستخدام المستقبلي
        return data;
    } catch (error) {
        console.error('Error fetching permissions:', error.message);
        return [];
    }
}

async function fetchPermissionsForRole(roleId) {
    try {
        const { data, error } = await window.supabaseClient
            .from('role_permissions')
            .select('permission_id')
            .eq('role_id', roleId);
        if (error) throw error;
        // إرجاع مصفوفة من IDs فقط
        return data.map(item => item.permission_id);
    } catch (error) {
        console.error(`Error fetching permissions for role ${roleId}:`, error.message);
        return [];
    }
}


// --- 3. دوال عرض الواجهة ---

function renderRolesList(roles) {
    rolesList.innerHTML = '';
    if (roles.length === 0) {
        rolesList.innerHTML = '<p class="text-gray-500">لا توجد أدوار.</p>';
        return;
    }
    roles.forEach(role => {
        const li = document.createElement('li');
        li.className = 'p-2 cursor-pointer rounded hover:bg-blue-100 transition-colors';
        li.textContent = role.role_name;
        li.dataset.roleId = role.id;
        li.dataset.roleName = role.role_name;

        li.addEventListener('click', () => {
            // إزالة التظليل من كل العناصر
            document.querySelectorAll('#roles-list li').forEach(item => item.classList.remove('bg-blue-200', 'font-bold'));
            // تظليل العنصر المختار
            li.classList.add('bg-blue-200', 'font-bold');
            
            selectedRoleId = role.id;
            renderPermissionsPanel(role.id, role.role_name);
        });
        rolesList.appendChild(li);
    });
}

async function renderPermissionsPanel(roleId, roleName) {
    permissionsPlaceholder.classList.add('hidden');
    permissionsPanel.classList.remove('hidden');
    selectedRoleName.textContent = roleName;
    permissionsCheckboxes.innerHTML = 'جاري تحميل الصلاحيات...';

    const allPerms = await fetchAllPermissions();
    const assignedPermIds = await fetchPermissionsForRole(roleId);
    
    permissionsCheckboxes.innerHTML = '';
    if (allPerms.length === 0) {
        permissionsCheckboxes.innerHTML = '<p class="text-red-500">لم يتم تعريف أي صلاحيات في النظام.</p>';
        return;
    }

    
    allPerms.forEach(perm => {
        const isChecked = assignedPermIds.includes(perm.id);
        const label = document.createElement('label');
        label.className = 'flex items-center gap-2 p-2 rounded hover:bg-gray-100';
        label.innerHTML = `
            <input type="checkbox" value="${perm.id}" ${isChecked ? 'checked' : ''}>
            <span>${perm.description || perm.permission_name}</span>
        `;
        permissionsCheckboxes.appendChild(label);
    });
}


// --- 4. دالة حفظ التغييرات ---

async function handleSaveChanges() {
    if (!selectedRoleId) return alert('الرجاء اختيار دور أولاً.');

    savePermissionsBtn.disabled = true;
    savePermissionsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

    const selectedPermissionIds = Array.from(permissionsCheckboxes.querySelectorAll('input:checked'))
        .map(cb => parseInt(cb.value));

    try {
        // 1. حذف جميع الصلاحيات القديمة لهذا الدور (أسهل طريقة للمزامنة)
        const { error: deleteError } = await window.supabaseClient
            .from('role_permissions')
            .delete()
            .eq('role_id', selectedRoleId);
        if (deleteError) throw deleteError;
        
        // 2. إدراج الصلاحيات الجديدة المحددة
        if (selectedPermissionIds.length > 0) {
            const newPermissionsData = selectedPermissionIds.map(permId => ({
                role_id: selectedRoleId,
                permission_id: permId
            }));

            const { error: insertError } = await window.supabaseClient
                .from('role_permissions')
                .insert(newPermissionsData);
            if (insertError) throw insertError;
        }

        alert('✅ تم حفظ الصلاحيات بنجاح!');

    } catch (error) {
        console.error('Error saving permissions:', error.message);
        alert('❌ فشل حفظ الصلاحيات.');
    } finally {
        savePermissionsBtn.disabled = false;
        savePermissionsBtn.textContent = '💾 حفظ التغييرات';
    }
}


// --- 5. دالة التهيئة الرئيسية ---

export async function initPermissionsPage() {
    permissionsPanel.classList.add('hidden');
    permissionsPlaceholder.classList.remove('hidden');
    selectedRoleId = null;
    
    savePermissionsBtn.addEventListener('click', handleSaveChanges);
    
    const roles = await fetchAllRoles();
    renderRolesList(roles);
}