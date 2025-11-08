// دالة تهيئة صفحة المعلمين: ربط الأحداث وجلب البيانات
export async function initTeachersPage() {
    // إظهار قائمة المعلمين وإخفاء الملف الشخصي
    const listView = document.getElementById('teachers-list-view');
    const profileView = document.getElementById('teacher-profile-view');
    if (listView) listView.style.display = 'block';
    if (profileView) profileView.style.display = 'none';

    // ربط زر إضافة معلم
    const addTeacherBtn = document.getElementById('add-teacher-btn');
    const addTeacherModal = document.getElementById('add-teacher-modal');
    const closeAddTeacherModal = document.getElementById('close-add-teacher-modal');
    const cancelAddTeacher = document.getElementById('cancel-add-teacher');
    if (addTeacherBtn && addTeacherModal) {
        addTeacherBtn.onclick = () => addTeacherModal.classList.remove('hidden');
    }
    if (closeAddTeacherModal && addTeacherModal) {
        closeAddTeacherModal.onclick = () => addTeacherModal.classList.add('hidden');
    }
    if (cancelAddTeacher && addTeacherModal) {
        cancelAddTeacher.onclick = (e) => {
            e.preventDefault();
            addTeacherModal.classList.add('hidden');
        };
    }


    // جلب المعلمين وعرضهم كبطاقات مع معالجة الأخطاء وحالة عدم وجود بيانات
    const { data: teachers, error } = await window.supabaseClient
        .from('profiles')
        .select('*')
        .eq('role', 'teacher')
        // فلترة على المدير إن كان محددًا
        .eq('director_id', window.currentDirectorId || null);

    const container = document.getElementById('teachers-cards-container');
    if (error) {
        if (container) container.innerHTML = '<div class="text-red-600 text-center py-8">حدث خطأ أثناء جلب المعلمين من قاعدة البيانات: ' + error.message + '</div>';
        return;
    }
    if (!teachers || teachers.length === 0) {
        if (container) container.innerHTML = '<div class="text-gray-500 text-center py-8">لا يوجد معلمون في قاعدة البيانات.</div>';
        return;
    }
    renderTeacherCards(teachers);

    // بعد جلب المعلمين، جلب المواد الفريدة
    const subjects = [...new Set(teachers.map(t => t.subject).filter(Boolean))];
    const filterContainer = document.getElementById('subjects-filter-container');
    if (filterContainer) {
        filterContainer.innerHTML = '';
        const select = document.createElement('select');
        select.id = 'subjects-filter-select';
        select.className = 'p-2 border rounded';

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'كل المواد';
        select.appendChild(defaultOption);

        subjects.forEach(subject => {
            const opt = document.createElement('option');
            opt.value = subject;
            opt.textContent = subject;
            select.appendChild(opt);
        });

        select.addEventListener('change', (e) => {
            const value = e.target.value;
            if (!value) {
                renderTeacherCards(teachers);
            } else {
                renderTeacherCards(teachers.filter(t => t.subject === value));
            }
        });

        filterContainer.appendChild(select);
    }

    // ربط البحث
    const searchInput = document.getElementById('teacherSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = teachers.filter(t =>
                (t.full_name || '').toLowerCase().includes(term) ||
                (t.email && t.email.toLowerCase().includes(term))
            );
            renderTeacherCards(filtered);
        });
    }
}

// دالة مساعدة لعرض بطاقات المعلمين
function renderTeacherCards(teachers) {
    const container = document.getElementById('teachers-cards-container');
    if (!container) return;
    container.innerHTML = '';
    teachers.forEach(teacher => {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-lg shadow p-4 flex flex-col items-center text-center cursor-pointer hover:shadow-xl transition-shadow';
        card.dataset.teacherId = teacher.id;
        card.innerHTML = `
            <div class="w-24 h-24 rounded-full mb-3 overflow-hidden border-2 border-blue-500">
                <img src="${teacher.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(teacher.full_name)}" alt="${teacher.full_name}" class="w-full h-full object-cover">
            </div>
            <h4 class="font-bold text-lg">${teacher.full_name}</h4>
            <p class="text-gray-600">${teacher.subject}</p>
        `;
        card.addEventListener('click', () => {
            previousPageId = document.querySelector('.content-area:not([style*="display:none"])')?.id || 'teachers-list-view';
            showTeacherProfileFromDB(teacher.id);
        });
        container.appendChild(card);
    });
}
// بيانات وهمية للمعلم للتجربة


// جلب جميع المعلمين من قاعدة البيانات
export async function fetchAllTeachersFromDB() {
    const { data, error } = await window.supabaseClient
        .from('profiles')
        .select('*')
        .eq('role', 'teacher')
        .eq('director_id', window.currentDirectorId || null);
    if (error) {
        console.error('خطأ في جلب المعلمين:', error.message);
        return [];
    }
    return data;
}

// جلب معلم واحد حسب id
export async function fetchTeacherById(id) {
    const { data, error } = await window.supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', id)
        .eq('role', 'teacher')
        .single();
    if (error) {
        console.error('خطأ في جلب بيانات المعلم:', error.message);
        return null;
    }
    return data;
}

// عرض ملف المعلم من قاعدة البيانات
export async function showTeacherProfileFromDB(id) {
    const teacher = await fetchTeacherById(id);
    if (teacher) {
        renderTeacherProfile(teacher);
    } else {
        const container = document.getElementById('teachers-content');
        if (container) container.innerHTML = '<div class="text-center text-red-600 mt-10">تعذر جلب بيانات المعلم!</div>';
    }
}

// دالة عرض صفحة ملف المعلم
export function renderTeacherProfile(teacher) {
    const profileView = document.getElementById('teacher-profile-view');
    if (!profileView) return;

    profileView.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <button id="back-to-list" class="text-blue-700 hover:underline flex items-center gap-1 text-lg font-semibold"><span>←</span> العودة إلى القائمة</button>
            <div class="flex gap-2">
                <button id="edit-teacher-btn" class="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded">تعديل البيانات</button>
                <button id="toggle-teacher-btn" class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded">${teacher.is_active ? 'تعطيل الحساب' : 'تفعيل الحساب'}</button>
                <button id="print-teacher-btn" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">طباعة الملف الشخصي</button>
            </div>
        </div>
        <div class="flex flex-col md:flex-row gap-8">
            <div class="flex flex-col items-center md:w-1/3">
                <div class="w-32 h-32 rounded-full border-4 border-blue-600 flex items-center justify-center overflow-hidden mb-4">
                    <img src="${teacher.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(teacher.full_name)}" alt="صورة المعلم" class="w-full h-full object-cover" />
                </div>
                <h3 class="text-2xl font-bold mb-1">${teacher.full_name}</h3>
                <div class="text-blue-700 font-semibold mb-1">${teacher.subject}</div>
                <div class="text-gray-500 mb-2">${teacher.degree}</div>
            </div>
            <div class="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h4 class="font-bold text-lg mb-2">معلومات الاتصال</h4>
                    <ul class="mb-4">
                        <li><strong>البريد الإلكتروني:</strong> ${teacher.email}</li>
                        <li><strong>الهاتف:</strong> ${teacher.phone}</li>
                        <li><strong>العنوان:</strong> ${teacher.address}</li>
                        <li><strong>تاريخ التعيين:</strong> ${formatDate(teacher.hireDate)}</li>
                    </ul>
                    <h4 class="font-bold text-lg mb-2">الوصف</h4>
                    <div class="bg-gray-100 p-3 rounded">${teacher.description || ''}</div>
                </div>
                <div>
                    <h4 class="font-bold text-lg mb-2">الأداء الشهري</h4>
                    <canvas id="teacher-performance-chart" style="width:100%;max-width:400px;height:220px;"></canvas>
                </div>
            </div>
        </div>
    `;

    // إظهار الملف الشخصي وإخفاء القائمة
    document.getElementById('teachers-list-view').style.display = 'none';
    profileView.style.display = 'block';

    // ربط الأحداث
    document.getElementById('back-to-list').onclick = () => {
        profileView.style.display = 'none';
        document.getElementById('teachers-list-view').style.display = 'block';
    };
    document.getElementById('edit-teacher-btn').onclick = () => {
        openEditTeacherModal(teacher);
    };
    document.getElementById('toggle-teacher-btn').onclick = async () => {
        await window.supabaseClient
            .from('profiles')
            .update({ is_active: !teacher.is_active })
            .eq('id', teacher.id);
        showTeacherProfileFromDB(teacher.id);
    };
    document.getElementById('print-teacher-btn').onclick = () => window.print();

    setTimeout(() => renderPerformanceChart(teacher.performance), 100);
}

// رسم مخطط الأداء الشهري
function renderPerformanceChart(performance) { 
    if (typeof Chart === 'undefined') return;
    const ctx = document.getElementById('teacher-performance-chart');
    if (!ctx) return;
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: performance.map(p => p.month),
            datasets: [{
                label: 'تقييم الأداء',
                data: performance.map(p => p.score),
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37,99,235,0.1)',
                fill: true,
                tension: 0.3,
                pointRadius: 5,
                pointBackgroundColor: '#2563eb',
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: true }
            },
            scales: {
                y: { min: 0, max: 5, title: { display: true, text: 'النقاط' } },
                x: { title: { display: true, text: 'الشهر' } }
            }
        }
    });
}

// تنسيق التاريخ العربي
function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
}

function openEditTeacherModal(teacher) {
    const modal = document.getElementById('add-teacher-modal');
    const form = document.getElementById('add-teacher-form');
    if (!modal || !form) return;

    document.getElementById('teacher-fullname').value = teacher.full_name || '';
    document.getElementById('teacher-email').value = teacher.email || '';
    document.getElementById('teacher-phone').value = teacher.phone || '';
    document.getElementById('teacher-subject').value = teacher.subject || '';
    document.getElementById('teacher-degree').value = teacher.degree || '';
    document.getElementById('teacher-address').value = teacher.address || '';

    form.dataset.editId = teacher.id;
    modal.classList.remove('hidden');
}

// إضافة معلم جديد أو تعديل معلم موجود
const addTeacherForm = document.getElementById('add-teacher-form');
if (addTeacherForm) {
    addTeacherForm.onsubmit = async function(e) {
        e.preventDefault();
        const teacherData = {
            full_name: document.getElementById('teacher-fullname').value,
            email: document.getElementById('teacher-email').value,
            phone: document.getElementById('teacher-phone').value,
            subject: document.getElementById('teacher-subject').value,
            degree: document.getElementById('teacher-degree').value,
            address: document.getElementById('teacher-address').value,
            role: 'teacher',
            is_active: true
        };

        if (addTeacherForm.dataset.editId) {
            // تعديل
            await window.supabaseClient
                .from('profiles')
                .update(teacherData)
                .eq('id', addTeacherForm.dataset.editId);

            // بعد التعديل: أعد عرض ملف المعلم المحدث إذا كان ظاهرًا
            const teacherId = addTeacherForm.dataset.editId;
            addTeacherForm.dataset.editId = '';
            document.getElementById('add-teacher-modal').classList.add('hidden');
            addTeacherForm.reset();
            if (document.getElementById('teacher-profile-view')?.style.display === 'block') {
                showTeacherProfileFromDB(teacherId);
            } else {
                initTeachersPage();
            }
        } else {
            // إضافة جديد
            await window.supabaseClient
                .from('profiles')
                .insert([teacherData]);
            document.getElementById('add-teacher-modal').classList.add('hidden');
            addTeacherForm.reset();
            initTeachersPage();
        }
    };
}

let previousPageId = null;

