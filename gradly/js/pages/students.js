// js/pages/students.js

// --- 1. دوال مساعدة للتحقق من الصحة وإظهار الخطوات ---

function showStep(stepId) {
    document.querySelectorAll('.student-step').forEach(div => div.classList.add('hidden'));
    document.getElementById(stepId)?.classList.remove('hidden');
}

function validateFields(fieldIds, errorMessage) {
    let isValid = true;
    fieldIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el || !String(el.value || '').trim()) {
            if (el) el.classList.add('border-red-500');
            isValid = false;
        } else {
            if (el) el.classList.remove('border-red-500');
        }
    });
    if (!isValid) {
        alert(errorMessage);
    }
    return isValid;
}

// --- 2. دوال عرض البيانات ---

// هذه الدالة تعرض الطلاب في الجدول وتربط حدث النقر على الصف
function attachStudentRowClick(students) {
    const tableBody = document.getElementById('studentsTable');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    if (!students || students.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-500">لا يوجد تلاميذ حالياً.</td></tr>`;
        return;
    }
    students.forEach((student, index) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-100 cursor-pointer';
        tr.innerHTML = `
            <td class="p-3">${index + 1}</td>
            <td class="p-3 text-right">${student.firstname} ${student.lastname}</td>
            <td class="p-3">${student.dob || 'غير محدد'}</td>
            <td class="p-3">${student.gender || 'غير محدد'}</td>
            <td class="p-3">${student.group_name || 'غير مسجل'}</td>
            <td class="p-3 flex gap-2">
                <button class="edit-student text-blue-600 hover:text-blue-800" title="تعديل"><i class="fas fa-edit"></i></button>
                <button class="delete-student-btn text-red-600 hover:text-red-800" title="حذف"><i class="fas fa-trash"></i></button>
            </td>
        `;
        // عرض التفاصيل عند النقر على الصف (باستثناء الأزرار)
        tr.addEventListener('click', (e) => {
            const targ = e.target;
            if (targ.closest('.edit-student') || targ.closest('.delete-student-btn')) return;
            showStudentDetails(student);
        });

        // زر التعديل
        tr.querySelector('.edit-student')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            await showStudentForm(student);
        });

        // زر الحذف
        tr.querySelector('.delete-student-btn')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`هل أنت متأكد من حذف التلميذ "${student.firstname} ${student.lastname}"؟`)) {
                await deleteStudent(student.id);
                await reloadStudentsTable();
            }
        });

        tableBody.appendChild(tr);
    });
}

// --- 3. دوال التحكم بالنافذة المنبثقة (Modal) ---

async function showStudentForm(student = null) {
    const modal = document.getElementById('studentModal');
    const form = document.getElementById('studentForm');
    if (!modal || !form) return;

    form.reset();
    showStep('step-personal');

    // جلب الأفواج الخاصة بالمدير الحالي
    const classGroupSelect = document.getElementById('classGroup');
    const saveBtn = document.getElementById('save-student-btn');
    if (classGroupSelect) {
        classGroupSelect.innerHTML = '<option value="">اختر الصف</option>';
        try {
            const { data: groups, error } = await window.supabaseClient
                .from('class_groups')
                .select('id, name')
                .eq('director_id', currentDirectorId); // فلترة حسب المدير
            if (error) throw error;
            if (!groups || groups.length === 0) {
                classGroupSelect.innerHTML = '<option value="">لا توجد صفوف متاحة</option>';
                if (saveBtn) saveBtn.disabled = true;
            } else {
                groups.forEach(group => {
                    const option = document.createElement('option');
                    option.value = group.id;
                    option.textContent = group.name;
                    classGroupSelect.appendChild(option);
                });
                if (saveBtn) saveBtn.disabled = false;
            }
        } catch (err) {
            classGroupSelect.innerHTML = '<option value="">تعذر جلب الصفوف</option>';
            if (saveBtn) saveBtn.disabled = true;
            console.error('fetch groups error', err);
        }
    }

    // إذا كانت هناك بيانات طالب، قم بملء النموذج بها
    if (student) {
        document.getElementById('firstname').value = student.firstname || '';
        document.getElementById('lastname').value = student.lastname || '';
        document.getElementById('dob').value = student.dob || '';
        document.getElementById('birthplace').value = student.birthplace || '';
        document.getElementById('gender').value = student.gender || '';
        document.getElementById('brothersCount').value = student.brothers_count || 0;
        document.getElementById('sistersCount').value = student.sisters_count || 0;
        document.getElementById('level').value = student.level || '';
        document.getElementById('emergencyPhone').value = student.emergency_phone || '';
        document.getElementById('registrationDate').value = student.registration_date || '';
        document.getElementById('guardianFullName').value = student.guardian_full_name || '';
        document.getElementById('guardianRelation').value = student.guardian_relation || '';
        document.getElementById('guardianPhone').value = student.guardian_phone || '';
        document.getElementById('guardianEmail').value = student.guardian_email || '';
        document.getElementById('guardianAddress').value = student.guardian_address || '';
        document.getElementById('agentFullName').value = student.agent_full_name || '';
        document.getElementById('agentRelation').value = student.agent_relation || '';
        document.getElementById('agentPhone').value = student.agent_phone || '';
        document.getElementById('agentEmail').value = student.agent_email || '';
        document.getElementById('agentAddress').value = student.agent_address || '';
        document.getElementById('height').value = student.height || '';
        document.getElementById('weight').value = student.weight || '';
        document.getElementById('bloodType').value = student.blood_type || '';
        document.getElementById('description').value = student.description || '';
        document.getElementById('allergies').value = student.allergies || '';
        document.getElementById('medicalConditions').value = student.medical_conditions || '';

        // تحديد الفوج إن وُجد (استعمل student_enrollments)
        if (student.student_enrollments && student.student_enrollments.length > 0) {
            document.getElementById('classGroup').value = student.student_enrollments[0].class_group_id || '';
        }
        form.dataset.editId = student.id || '';
    } else {
        form.dataset.editId = '';
    }

    modal.classList.remove('hidden');
}

function closeStudentForm() {
    const modal = document.getElementById('studentModal');
    if (modal) modal.classList.add('hidden');
}

// --- 4. دالة التهيئة الرئيسية للصفحة (الأهم) ---

let isStudentPageInitialized = false;
let currentDirectorId = null;

export async function initStudentsPage(directorId) {
    if (!directorId) return;
    currentDirectorId = directorId;

    // ربط الأحداث مرة واحدة
    if (!isStudentPageInitialized) {
        const addStudentBtn = document.getElementById('add-student-btn');
        const closeStudentModalBtn = document.getElementById('closeStudentModal');
        const studentForm = document.getElementById('studentForm');

        const nextStep1 = document.getElementById('nextStep1');
        const nextStep2 = document.getElementById('nextStep2');
        const nextStep3 = document.getElementById('nextStep3');
        const prevStep2 = document.getElementById('prevStep2');
        const prevStep3 = document.getElementById('prevStep3');
        const prevStep4 = document.getElementById('prevStep4');

        if (addStudentBtn) addStudentBtn.addEventListener('click', () => showStudentForm(null));
        if (closeStudentModalBtn) closeStudentModalBtn.addEventListener('click', closeStudentForm);

        if (nextStep1) nextStep1.addEventListener('click', () => {
            if (validateFields(['firstname', 'lastname', 'dob', 'gender'], "يرجى ملء الحقول الشخصية.")) showStep('step-academic');
        });
        if (nextStep2) nextStep2.addEventListener('click', () => {
            if (validateFields(['classGroup', 'level', 'emergencyPhone', 'registrationDate'], "يرجى ملء الحقول الأكاديمية.")) showStep('step-guardian');
        });
        if (nextStep3) nextStep3.addEventListener('click', () => {
             if (validateFields(['guardianFullName', 'guardianPhone', 'agentFullName', 'agentPhone'], "يرجى ملء معلومات ولي الأمر والمتكفل.")) showStep('step-health');
        });

        if (prevStep2) prevStep2.addEventListener('click', () => showStep('step-personal'));
        if (prevStep3) prevStep3.addEventListener('click', () => showStep('step-academic'));
        if (prevStep4) prevStep4.addEventListener('click', () => showStep('step-guardian'));

        if (studentForm) studentForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const studentData = {
                firstname: document.getElementById('firstname').value.trim(),
                lastname: document.getElementById('lastname').value.trim(),
                dob: document.getElementById('dob').value || null,
                birthplace: document.getElementById('birthplace').value.trim(),
                gender: document.getElementById('gender').value,
                brothers_count: parseInt(document.getElementById('brothersCount').value) || 0,
                sisters_count: parseInt(document.getElementById('sistersCount').value) || 0,
                level: document.getElementById('level').value.trim(),
                emergency_phone: document.getElementById('emergencyPhone').value.trim(),
                registration_date: document.getElementById('registrationDate').value || null,
                guardian_full_name: document.getElementById('guardianFullName')?.value.trim() || '',
                guardian_relation: document.getElementById('guardianRelation')?.value.trim() || '',
                guardian_phone: document.getElementById('guardianPhone')?.value.trim() || '',
                guardian_email: document.getElementById('guardianEmail')?.value.trim() || '',
                guardian_address: document.getElementById('guardianAddress')?.value.trim() || '',
                agent_full_name: document.getElementById('agentFullName')?.value.trim() || '',
                agent_relation: document.getElementById('agentRelation')?.value.trim() || '',
                agent_phone: document.getElementById('agentPhone')?.value.trim() || '',
                agent_email: document.getElementById('agentEmail')?.value.trim() || '',
                agent_address: document.getElementById('agentAddress')?.value.trim() || '',
                height: parseFloat(document.getElementById('height')?.value) || null,
                weight: parseFloat(document.getElementById('weight')?.value) || null,
                blood_type: document.getElementById('bloodType')?.value || '',
                description: document.getElementById('description')?.value.trim() || '',
                allergies: document.getElementById('allergies')?.value.trim() || '',
                medical_conditions: document.getElementById('medicalConditions')?.value.trim() || ''
            };

            // تأكد من ربط المدير
            studentData.director_id = currentDirectorId;

            // البحث عن ولي الأمر عبر الإيميل إن وُجد
            if (studentData.guardian_email) {
                const { data: parentProfile } = await window.supabaseClient
                    .from('profiles')
                    .select('id')
                    .eq('email', studentData.guardian_email)
                    .single();
                if (parentProfile && parentProfile.id) studentData.parent_id = parentProfile.id;
            }

            const selectedGroupId = document.getElementById('classGroup')?.value;
            const editId = studentForm.dataset.editId;

            if (editId) {
                // تحديث مع حماية director_id
                const { error: updateErr } = await window.supabaseClient
                    .from('students')
                    .update(studentData)
                    .eq('id', editId)
                    .eq('director_id', currentDirectorId);
                if (updateErr) { alert('فشل تعديل التلميذ: ' + updateErr.message); return; }

                // تحديث التسجيل بالفوج (حذف ثم إدراج)
                await window.supabaseClient.from('student_enrollments').delete().eq('student_id', editId);
                if (selectedGroupId) {
                    await window.supabaseClient.from('student_enrollments').insert([{ class_group_id: selectedGroupId, student_id: editId }]);
                }

                await window.supabaseClient.from('activities').insert([{ icon: 'fas fa-user-edit', description: `تم تعديل بيانات التلميذ: ${studentData.firstname} ${studentData.lastname}` }]);
                alert('تم تعديل بيانات التلميذ بنجاح!');
            } else {
                // إنشاء جديد مع director_id
                const { data: inserted, error } = await window.supabaseClient
                    .from('students')
                    .insert([studentData])
                    .select();
                if (error) { alert('فشل حفظ التلميذ: ' + error.message); return; }
                const studentId = inserted && inserted[0] ? inserted[0].id : null;

                if (selectedGroupId && studentId) {
                    await window.supabaseClient.from('student_enrollments').insert([{ class_group_id: selectedGroupId, student_id: studentId }]);
                }

                await window.supabaseClient.from('activities').insert([{ icon: 'fas fa-user-plus', description: `تمت إضافة التلميذ الجديد: ${studentData.firstname} ${studentData.lastname}` }]);
                alert('تم حفظ التلميذ بنجاح!');
            }

            closeStudentForm();
            await reloadStudentsTable();
        });

        isStudentPageInitialized = true;
    }

    // ربط البحث إن وُجد
    const studentSearchInput = document.getElementById('studentSearch');
    if (studentSearchInput) {
        studentSearchInput.oninput = (e) => {
            // يمكنك إضافة فلترة محلية أو طلب جديد مع q parameter
        };
    }

    // جلب التلاميذ المخصّصين لهذا المدير فقط
    const { data: students, error } = await window.supabaseClient
        .from('students')
        .select(`
            *,
            student_enrollments(
                class_group_id,
                class_groups(name, levels(name),
                    academic_years(name),  
                    teacher_class_groups(teacher_id, profiles(full_name)))
            )
        `)
        .eq('director_id', currentDirectorId); // <-- الفلترة الأساسية حسب المدير

    if (error) {
        const tableBody = document.getElementById('studentsTable');
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500">خطأ في جلب البيانات: ${error.message}</td></tr>`;
        return;
    }

    const studentsWithGroup = (students || []).map(s => {
        const enrollment = s.student_enrollments && s.student_enrollments[0];
        const group = enrollment && enrollment.class_groups;
        return {
            ...s,
            group_name: group ? group.name : 'غير مسجل',
            level_name: group && group.levels ? group.levels.name : 'غير محدد',
            year_name: group && group.academic_years ? group.academic_years.name : 'غير محددة',
            teacher_name: (group && group.teacher_class_groups && group.teacher_class_groups[0] && group.teacher_class_groups[0].teachers)
                ? group.teacher_class_groups[0].teachers.full_name
                : 'غير محدد'
        };
    });

    document.getElementById('studentsCount') && (document.getElementById('studentsCount').textContent = studentsWithGroup.length);
    attachStudentRowClick(studentsWithGroup);
}

// دالة لإعادة تحميل جدول التلاميذ
async function reloadStudentsTable() {
    if (!currentDirectorId) return;
    const tableBody = document.getElementById('studentsTable');
    const { data: students, error } = await window.supabaseClient
        .from('students')
        .select(`
            *,
            student_enrollments(
                class_group_id,
                class_groups(name)
            )
        `)
        .eq('director_id', currentDirectorId);

    if (error) {
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500">خطأ في جلب البيانات: ${error.message}</td></tr>`;
        return;
    }

    const studentsWithGroup = (students || []).map(s => ({
        ...s,
        group_name: s.student_enrollments && s.student_enrollments.length > 0
            ? (s.student_enrollments[0].class_groups ? s.student_enrollments[0].class_groups.name : 'غير مسجل')
            : 'غير مسجل'
    }));

    document.getElementById('studentsCount') && (document.getElementById('studentsCount').textContent = studentsWithGroup.length);
    attachStudentRowClick(studentsWithGroup);
}

// عرض تفاصيل الطالب في نافذة منبثقة
function showStudentDetails(student) {
    const modal = document.getElementById('student-info-modal');
    const content = document.getElementById('student-info-content');
    if (!modal || !content || !student) return;

    // معلومات أساسية
    const fullname = `${student.firstname || ''} ${student.lastname || ''}`.trim() || 'غير محدد';
    const dob = student.dob || 'غير محدد';
    const birthplace = student.birthplace || 'غير محدد';
    const gender = student.gender || 'غير محدد';
    const level = student.level || 'غير محدد';
    const avg = (student.average !== undefined && student.average !== null) ? student.average : 'غير محدد';

    // ولي الأمر / المتكفل
    const guardianName = student.guardian_full_name || '-';
    const guardianRelation = student.guardian_relation || '-';
    const guardianPhone = student.guardian_phone || '-';
    const guardianEmail = student.guardian_email || '-';

    const agentName = student.agent_full_name || '-';
    const agentRelation = student.agent_relation || '-';
    const agentPhone = student.agent_phone || '-';
    const agentEmail = student.agent_email || '-';

    // صحّيّة وقياسات
    const height = student.height ?? '-';
    const weight = student.weight ?? '-';
    const bloodType = student.blood_type || '-';
    const allergies = student.allergies || '-';
    const medical = student.medical_conditions || '-';
    const description = student.description || '-';
    const registrationDate = student.registration_date || '-';
    const emergencyPhone = student.emergency_phone || '-';
    const brothers = student.brothers_count ?? 0;
    const sisters = student.sisters_count ?? 0;

    // تسجيلات الفوج (قد تكون متعددة)
    let enrollmentsHtml = '<div class="mb-2 text-sm text-gray-700">لا يوجد تسجيلات بالفوج.</div>';
    if (student.student_enrollments && student.student_enrollments.length > 0) {
        enrollmentsHtml = '<ul class="list-disc list-inside space-y-1">';
        student.student_enrollments.forEach(enr => {
            const grp = enr.class_groups || {};
            const grpName = grp.name || '-';
            const lvl = (grp.levels && grp.levels.name) ? grp.levels.name : '-';
            const year = (grp.academic_years && grp.academic_years.name) ? grp.academic_years.name : '-';
            // المعلم من teacher_class_groups -> profiles
            let teacherName = '-';
            if (grp.teacher_class_groups && grp.teacher_class_groups.length > 0) {
                const tcg = grp.teacher_class_groups[0];
                teacherName = (tcg && tcg.profiles && tcg.profiles.full_name) ? tcg.profiles.full_name : '-';
            }
            enrollmentsHtml += `<li>الفوج: <b>${escapeHtml(grpName)}</b> — السنة: ${escapeHtml(year)} — المستوى: ${escapeHtml(lvl)} — المعلم: ${escapeHtml(teacherName)}</li>`;
        });
        enrollmentsHtml += '</ul>';
    }

    // عرض HTML منسق
    content.innerHTML = `
        <div class="p-4 max-w-3xl">
            <div class="flex items-start justify-between mb-3">
                <h3 class="text-2xl font-bold text-blue-700">${escapeHtml(fullname)}</h3>
                <button id="close-student-info" class="text-gray-500" aria-label="إغلاق">&times;</button>
            </div>

            <section class="mb-3">
                <h4 class="font-semibold">معلومات شخصية</h4>
                <div class="text-sm text-gray-700">
                    <div>تاريخ الميلاد: <b>${escapeHtml(dob)}</b></div>
                    <div>مكان الميلاد: <b>${escapeHtml(birthplace)}</b></div>
                    <div>الجنس: <b>${escapeHtml(gender)}</b></div>
                    <div>المستوى: <b>${escapeHtml(level)}</b></div>
                    <div>المعدل العام: <b>${escapeHtml(String(avg))}</b></div>
                    <div>عدد الأخوة: <b>${escapeHtml(String(brothers))}</b> — الأخوات: <b>${escapeHtml(String(sisters))}</b></div>
                </div>
            </section>

            <section class="mb-3">
                <h4 class="font-semibold">معلومات تسجيل واتصال</h4>
                <div class="text-sm text-gray-700">
                    <div>تاريخ التسجيل: <b>${escapeHtml(registrationDate)}</b></div>
                    <div>هاتف للطوارئ: <b>${escapeHtml(emergencyPhone)}</b></div>
                </div>
            </section>

            <section class="mb-3">
                <h4 class="font-semibold">ولي الأمر / المتكفل</h4>
                <div class="text-sm text-gray-700">
                    <div>الاسم: <b>${escapeHtml(guardianName)}</b></div>
                    <div>صلة القرابة: <b>${escapeHtml(guardianRelation)}</b></div>
                    <div>الهاتف: <b>${escapeHtml(guardianPhone)}</b></div>
                    <div>البريد: <b>${escapeHtml(guardianEmail)}</b></div>
                </div>
            </section>

            <section class="mb-3">
                <h4 class="font-semibold">المتكفل / الوسيط</h4>
                <div class="text-sm text-gray-700">
                    <div>الاسم: <b>${escapeHtml(agentName)}</b></div>
                    <div>صلة: <b>${escapeHtml(agentRelation)}</b></div>
                    <div>الهاتف: <b>${escapeHtml(agentPhone)}</b></div>
                    <div>البريد: <b>${escapeHtml(agentEmail)}</b></div>
                </div>
            </section>

            <section class="mb-3">
                <h4 class="font-semibold">معلومات صحيّة وقياسات</h4>
                <div class="text-sm text-gray-700">
                    <div>الطول: <b>${escapeHtml(String(height))}</b> — الوزن: <b>${escapeHtml(String(weight))}</b></div>
                    <div>فصيلة الدم: <b>${escapeHtml(bloodType)}</b></div>
                    <div>الحساسية: <b>${escapeHtml(allergies)}</b></div>
                    <div>الحالات المرضية: <b>${escapeHtml(medical)}</b></div>
                    <div>ملاحظات: <b>${escapeHtml(description)}</b></div>
                </div>
            </section>

            <section class="mb-3">
                <h4 class="font-semibold">التسجيـلات بالفـوج / السنة / المعلم</h4>
                <div class="text-sm text-gray-700">${enrollmentsHtml}</div>
            </section>

            <section class="mt-4 text-right">
                <button id="close-student-info-btn" class="btn">إغلاق</button>
            </section>
        </div>
    `;

    // ربط أزرار الإغلاق
    const closeBtn = document.getElementById('close-student-info');
    const closeBtn2 = document.getElementById('close-student-info-btn');
    if (closeBtn) closeBtn.onclick = () => modal.classList.add('hidden');
    if (closeBtn2) closeBtn2.onclick = () => modal.classList.add('hidden');

    modal.classList.remove('hidden');
}

// دالة مساعدة صغيرة لحماية النصوص من XSS بسيطة
function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// --- 5. دالة حذف التلميذ ---

async function deleteStudent(studentId) {
    if (!currentDirectorId) return;
    try {
        await UI.safeFetch(() => window.supabaseClient.from('student_enrollments').delete().eq('student_id', studentId));
        await UI.safeFetch(() => window.supabaseClient.from('students').delete().eq('id', studentId).eq('director_id', currentDirectorId));
        UI.showToast('تم حذف التلميذ بنجاح', 'info');
    } catch (err) {
        UI.showToast('فشل حذف التلميذ: ' + (err.message || ''), 'error');
    }
}

// مثال: عرض جميع التلاميذ مع المستوى والسنة والفوج والمعلم
// pages/students.js

// ... (باقي الكود في الملف)

// مثال: عرض جميع التلاميذ مع المستوى والسنة والفوج والمعلم
async function renderAllStudentsWithDetails() {
    const container = document.getElementById('students-list');
    if (!container) return;

    // ======[  التصحيح هنا  ]======
    // تم تعديل الاستعلام ليعكس العلاقات الصحيحة
    // teacher_class_groups مرتبط بـ profiles وليس teachers
    const { data: students, error } = await window.supabaseClient
        .from('students')
        .select(`
            *,
            student_enrollments (
                class_groups (
                    name,
                    levels (name),
                    academic_years (name),
                    teacher_class_groups (
                        profiles (full_name) 
                    )
                )
            )
        `);
    // ============================

    if (error) {
        console.error("Error fetching students with details:", error);
        container.innerHTML = `<div class="text-red-500">حدث خطأ أثناء جلب التلاميذ: ${error.message}</div>`;
        return;
    }

    if (!students || students.length === 0) {
        container.innerHTML = '<div class="text-gray-500">لا يوجد تلاميذ.</div>';
        return;
    }
    
    // ... (باقي الكود لعرض الجدول HTML)
    // الآن منطق استخراج البيانات سيعمل بشكل صحيح

    let html = `...`; // كود الجدول
    students.forEach(s => {
        const enrollment = s.student_enrollments?.[0];
        const group = enrollment?.class_groups;
        const level = group?.levels?.name || '-';
        const year = group?.academic_years?.name || '-';
        const groupName = group?.name || 'غير مسجل';
        
        let teacherName = '-';
        if (group?.teacher_class_groups?.length > 0) {
            // الوصول إلى اسم المعلم عبر profiles
            teacherName = group.teacher_class_groups[0].profiles?.full_name || '-';
        }

        html += `<tr>
            <td class="border px-2 py-1">${s.firstname || ''} ${s.lastname || ''}</td>
            <td class="border px-2 py-1">${level}</td>
            <td class="border px-2 py-1">${year}</td>
            <td class="border px-2 py-1">${groupName}</td>
            <td class="border px-2 py-1">${teacherName}</td>
        </tr>`;
    });
    // ...
}

// on create:
async function createStudent(student) {
    student.director_id = currentDirectorId;
    await window.supabaseClient.from('students').insert([student]);
}
