// --- START OF FILE groups.js ---

// ========== هيكل الصفحة الرئيسي ==========
// هذه الدالة هي المنسق الرئيسي، تستدعي دوال العرض لكل قسم بالبيانات الصحيحة
export function renderGroupsPage({students, academic_years, class_groups, teachers, levels}) {
    // 1. عرض التلاميذ غير المسجلين
    renderUnassignedStudents(students);
    
    // 2. عرض السنوات الدراسية والأفواج داخلها
    renderAcademicYearsGroups(academic_years, class_groups, teachers, levels);
    
    // 3. ربط جميع الأحداث (الأزرار، البحث، إلخ) بالصفحة
    setupGroupsPageEvents({students, academic_years, class_groups, teachers, levels});
}

// ========== دالة تهيئة الصفحة (الدالة الأهم) ==========
// وظيفتها: جلب كل البيانات من قاعدة البيانات ثم بدء عملية العرض
export async function initGroupsPage(directorId) {
    console.log("initGroupsPage START");

    // حدد معرف المدير محلياً وعالمياً إذا مرّ كمُعامل
    if (directorId) window.currentDirectorId = directorId;
    const currentDirectorId = window.currentDirectorId;
    if (!currentDirectorId) {
        console.error('currentDirectorId غير محدد');
        return;
    }

    // الخطوة 1: جلب التلاميذ
    const { data: studentsData, error: studentsError } = await window.supabaseClient
        .from('students')
        .select('*, student_enrollments(class_group_id)')
        .eq('director_id', currentDirectorId);
    if (studentsError) {
        console.error('خطأ في جلب التلاميذ:', studentsError.message);
    }
    const studentsWithGroup = (studentsData || []).map(s => ({
        ...s,
        current_group_id: s.student_enrollments && s.student_enrollments.length > 0
            ? s.student_enrollments[0].class_group_id
            : undefined
    }));

    // الخطوة 2: جلب السنوات الدراسية
    // لن يتوقف التنفيذ هنا حتى لو كانت النتيجة فارغة
    const { data: academic_years_data, error: yearsError } = await window.supabaseClient
        .from('academic_years')
        .select('*')
        .eq('director_id', currentDirectorId);
    if (yearsError) {
        console.error('خطأ في جلب السنوات الدراسية:', yearsError.message);
        return;
    }
    const academic_years = academic_years_data || [];

    // الخطوة 3: جلب الأفواج
    // لن يتوقف التنفيذ هنا حتى لو كانت النتيجة فارغة
    const { data: class_groups_data, error: groupsError } = await window.supabaseClient
        .from('class_groups')
        .select('*')
        .eq('director_id', currentDirectorId);
    if (groupsError) {
        console.error('خطأ في جلب الأفواج:', groupsError.message);
        return;
    }
    const class_groups = class_groups_data || [];

    // الخطوة 4: جلب المعلمين
    const { data: teachers_data, error: teachersError } = await window.supabaseClient
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'teacher')
        .eq('director_id', currentDirectorId);
    if (teachersError) {
        console.error('خطأ في جلب المعلمين:', teachersError.message);
        return;
    }
    const teachers = teachers_data || [];

    // الخطوة 2.1: جلب المستويات الدراسية
    const { data: levels_data, error: levelsError } = await window.supabaseClient
        .from('levels')
        .select('*');
    if (levelsError) {
        console.error('خطأ في جلب المستويات الدراسية:', levelsError.message);
        return;
    }
    const levels = levels_data || [];

    // الخطوة 5: بعد جلب كل البيانات بنجاح، استدعاء دالة العرض الرئيسية
    console.log("تم جلب جميع البيانات، جاري عرض الصفحة...");
    console.log("Academic years:", academic_years);
    renderGroupsPage({ students: studentsWithGroup, academic_years, class_groups, teachers, levels });
    console.log("initGroupsPage END");
}

// ========== عرض قسم التلاميذ غير المسجلين ==========
function renderUnassignedStudents(students) {
    const list = document.getElementById('unassigned-students-list');
    if (!list) return;

    list.innerHTML = '';
    const unassigned = students.filter(s => !s.current_group_id);

    if (unassigned.length === 0) {
        list.innerHTML = '<div class="text-gray-500 text-center py-4">لا يوجد تلاميذ غير مسجلين في أي فوج.</div>';
        return;
    }

    unassigned.forEach(student => {
        const card = document.createElement('div');
        card.className = 'bg-gray-100 rounded p-2 shadow cursor-move';
        card.draggable = true;
        card.dataset.studentId = student.id;
        card.innerHTML = `<span class="font-bold">${student.firstname} ${student.lastname}</span>`;
        list.appendChild(card);
    });
}

// ========== عرض قسم السنوات الدراسية والأفواج ==========
function renderAcademicYearsGroups(academic_years, class_groups, teachers, levels) {
    const container = document.getElementById('years-groups-list');
    container.innerHTML = '';

    academic_years.forEach(year => {
        // عنوان السنة الأكاديمية مع زر إضافة مستوى
        const yearDiv = document.createElement('div');
        yearDiv.className = 'mb-6';
        yearDiv.innerHTML = `
            <div class="flex items-center gap-2 mb-2">
                <h2 class="text-xl font-bold text-blue-700">${year.name}</h2>
                <button class="add-level-btn bg-green-500 text-white px-2 py-1 rounded text-xs" data-year-id="${year.id}" title="إضافة مستوى"><i class="fas fa-plus"></i></button>
            </div>
        `;

        levels.forEach(level => {
            // الأفواج الخاصة بهذه السنة وهذا المستوى
            const groupsForLevel = class_groups.filter(
                g => g.year_id === year.id && g.level_id === level.id
            );

            // عنوان المستوى الدراسي مع زر حذف مستوى
            const levelDiv = document.createElement('div');
            levelDiv.className = 'mb-4 pl-4';
            levelDiv.innerHTML = `
                <div class="flex items-center gap-2 mb-2">
                    <h3 class="text-lg font-semibold text-gray-700">${level.name}</h3>
                    <button class="add-group-btn bg-blue-500 text-white px-2 py-1 rounded text-xs" data-year-id="${year.id}" data-level-id="${level.id}" title="إضافة فوج"><i class="fas fa-plus"></i></button>
                    <button class="delete-level-btn bg-red-500 text-white px-2 py-1 rounded text-xs" data-level-id="${level.id}" title="حذف المستوى"><i class="fas fa-trash"></i></button>
                </div>
            `;

            // قائمة الأفواج
            const groupsList = document.createElement('div');
            groupsList.className = 'flex flex-wrap gap-4';
            groupsForLevel.forEach(group => {
                const groupCard = document.createElement('div');
                groupCard.className = 'bg-white border rounded p-3 min-w-[180px] shadow cursor-pointer';
                groupCard.innerHTML = `
                    <div class="font-bold">${group.name}</div>
                    <div class="flex gap-2 mt-2">
                        <button class="btn btn-xs btn-warning edit-group-btn" data-group-id="${group.id}">تعديل</button>
                        <button class="btn btn-xs btn-danger delete-group-btn" data-group-id="${group.id}">حذف</button>
                        <button class="btn btn-xs btn-primary add-teacher-btn" data-group-id="${group.id}">إضافة أستاذ</button>
                    </div>
                `;
                // عند الضغط على اسم الفوج، عرض قائمة التلاميذ
                groupCard.querySelector('.font-bold').onclick = () => showGroupDetailsModal(group.id, class_groups, teachers);
                groupsList.appendChild(groupCard);
            });

            levelDiv.appendChild(groupsList);
            yearDiv.appendChild(levelDiv);
        });

        container.appendChild(yearDiv);
    });

    // أحداث إضافة مستوى
    setTimeout(() => {
        document.querySelectorAll('.add-level-btn').forEach(btn => {
            btn.onclick = async function() {
                const levelName = prompt('أدخل اسم المستوى الدراسي الجديد:');
                if (levelName && levelName.trim() !== '') {
                    await window.supabaseClient.from('levels').insert([{ name: levelName.trim() }]);
                    await initGroupsPage();
                }
            };
        });
        document.querySelectorAll('.delete-level-btn').forEach(btn => {
            btn.onclick = async function() {
                if (confirm('هل أنت متأكد من حذف هذا المستوى؟')) {
                    await window.supabaseClient.from('levels').delete().eq('id', this.getAttribute('data-level-id'));
                    await initGroupsPage();
                }
            };
        });
        document.querySelectorAll('.add-group-btn').forEach(btn => {
            btn.onclick = function() {
                const yearId = this.getAttribute('data-year-id');
                const levelId = this.getAttribute('data-level-id');
                showAddGroupModal(yearId, teachers, levels, levelId);
            };
        });
        document.querySelectorAll('.add-teacher-btn').forEach(btn => {
            btn.onclick = function() {
                const groupId = this.getAttribute('data-group-id');
                showAddTeacherToGroupModal(groupId, teachers);
            };
        });
    }, 0);
}

// ========== إعداد جميع أحداث الصفحة ==========
function setupGroupsPageEvents({students, academic_years, class_groups, teachers}) {
    // حدث البحث عن التلاميذ
    const searchInput = document.getElementById('unassigned-search');
    if (searchInput) {
        searchInput.oninput = function() {
            const val = this.value.trim().toLowerCase();
            const filteredStudents = students.filter(s => !s.current_group_id && (`${s.firstname} ${s.lastname}`.toLowerCase().includes(val)));
            renderUnassignedStudents(filteredStudents);
        };
    }

    // حدث زر "إضافة سنة دراسية جديدة"
    const addYearBtn = document.getElementById('add-year-btn');
    if (addYearBtn && !addYearBtn.dataset.listenerAdded) {
        addYearBtn.onclick = async function() {
            const yearName = prompt('أدخل اسم السنة الدراسية الجديدة (مثال: 2024-2025):');
            if (yearName && yearName.trim() !== '') {
                const success = await addNewYearToDB(yearName.trim());
                if (success) {
                    alert('تمت إضافة السنة بنجاح.');
                    await initGroupsPage(); // تحديث الصفحة بسلاسة
                } else {
                    alert('حدث خطأ أثناء إضافة السنة.');
                }
            }
        };
        addYearBtn.dataset.listenerAdded = 'true'; // لمنع إضافة الحدث أكثر من مرة
    }

    // أحداث أزرار "إضافة فوج"
    document.querySelectorAll('.add-group-btn').forEach(btn => {
        btn.onclick = function() {
            const yearId = this.getAttribute('data-year-id');
            showAddGroupModal(yearId, teachers, levels);
        };
    });
    
    // أحداث أزرار الحذف والتعديل
    document.querySelectorAll('.delete-group-btn').forEach(btn => {
        btn.onclick = async function() {
            const groupId = this.getAttribute('data-group-id');
            if (confirm('هل أنت متأكد من حذف هذا الفوج؟ سيتم فك ارتباط جميع التلاميذ به.')) {
                // حذف جميع التسجيلات من student_enrollments
                await window.supabaseClient
                    .from('student_enrollments')
                    .delete()
                    .eq('class_group_id', groupId);
                // حذف الفوج نفسه
                await window.supabaseClient
                    .from('class_groups')
                    .delete()
                    .eq('id', groupId);
                await initGroupsPage(window.currentDirectorId);
            }
        };
    });
    document.querySelectorAll('.edit-group-btn').forEach(btn => {
        btn.onclick = function() {
            const groupId = this.getAttribute('data-group-id');
            showEditGroupModal(groupId, class_groups, teachers);
        };
    });


    // --- أحداث النافذة المنبثقة (Modal) لإضافة فوج ---
    const addGroupModal = document.getElementById('add-group-modal');
    const addGroupForm = document.getElementById('add-group-form');
    const closeGroupModalBtn = document.getElementById('close-group-modal-btn');
    
    if (closeGroupModalBtn) {
        closeGroupModalBtn.onclick = () => addGroupModal.classList.add('hidden');
    }

    if (addGroupForm) {
        addGroupForm.onsubmit = async function(e) {
            e.preventDefault();
            const groupData = {
                name: document.getElementById('group-name').value,
                teacher_id: document.getElementById('group-teacher').value,
                year_id: document.getElementById('group-year-id').value,
                level_id: document.getElementById('group-level').value,
                director_id: window.currentDirectorId
            };

            if (!groupData.name || !groupData.teacher_id || !groupData.year_id) {
                alert("يرجى ملء جميع الحقول.");
                return;
            }

            if (addGroupForm.dataset.editId) {
                // تعديل
                await window.supabaseClient
                    .from('class_groups')
                    .update(groupData)
                    .eq('id', addGroupForm.dataset.editId);
                alert('تم تعديل الفوج بنجاح!');
                addGroupForm.dataset.editId = '';
            } else {
                // إضافة
                const success = await addGroupToDB(groupData);
                if (success) {
                    alert('تمت إضافة الفوج بنجاح!');
                } else {
                    alert('حدث خطأ أثناء إضافة الفوج.');
                }
            }
            addGroupModal.classList.add('hidden');
            addGroupForm.reset();
            await initGroupsPage();
        };
    }

    // --- أحداث النافذة المنبثقة (Modal) لإضافة أستاذ لفوج ---
    const addTeacherGroupForm = document.getElementById('add-teacher-group-form');
    const addTeacherGroupModal = document.getElementById('add-teacher-group-modal');
    const closeTeacherModalBtn = document.getElementById('close-teacher-modal-btn');
    
    if (closeTeacherModalBtn) {
        closeTeacherModalBtn.onclick = () => addTeacherGroupModal.classList.add('hidden');
    }

    if (addTeacherGroupForm) {
        addTeacherGroupForm.onsubmit = async function(e) {
            e.preventDefault();
            const groupId = addTeacherGroupForm.dataset.groupId;
            const teacherId = document.getElementById('teacher-group-select').value;
            // مرّر null إذا لم تُحدد مادة
            const rawSubjectVal = document.getElementById('teacher-group-subject').value;
            const subjectId = (rawSubjectVal === '' || rawSubjectVal === null || rawSubjectVal === undefined) ? null : rawSubjectVal;
            const success = await addTeacherToGroup(groupId, teacherId, subjectId);
            if (success) {
                alert('تمت إضافة الأستاذ للفوج!');
                document.getElementById('add-teacher-group-modal').classList.add('hidden');
                await initGroupsPage();
            }
        };
    }
}

// ========== دوال مساعدة للتفاعل مع قاعدة البيانات والنوافذ ==========

function showAddGroupModal(yearId, teachers, levels, preselectedLevelId = null) {
    const modal = document.getElementById('add-group-modal');
    const form = document.getElementById('add-group-form');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('group-year-id').value = yearId;

    // تعبئة قائمة المعلمين
    const teacherSelect = document.getElementById('group-teacher');
    teacherSelect.innerHTML = '<option value="" disabled selected>-- اختر معلمًا --</option>';
    (teachers || []).forEach(teacher => {
        const option = document.createElement('option');
        option.value = teacher.id;
        option.textContent = teacher.full_name;
        teacherSelect.appendChild(option);
    });

    // تعبئة قائمة المستويات
    const levelSelect = document.getElementById('group-level');
    levelSelect.innerHTML = '<option value="" disabled selected>-- اختر المستوى الدراسي --</option>';
    (levels || []).forEach(level => {
        const option = document.createElement('option');
        option.value = level.id;
        option.textContent = level.name;
        if (preselectedLevelId && level.id == preselectedLevelId) option.selected = true;
        levelSelect.appendChild(option);
    });

    modal.classList.remove('hidden');
}

function showEditGroupModal(groupId, class_groups, teachers) {
    const modal = document.getElementById('add-group-modal');
    const form = document.getElementById('add-group-form');
    if (!modal || !form) return;

    // جلب بيانات الفوج
    const group = class_groups.find(g => g.id == groupId);
    if (!group) return;

    // تعبئة الحقول
    document.getElementById('group-name').value = group.name;
    document.getElementById('group-year-id').value = group.year_id;

    const teacherSelect = document.getElementById('group-teacher');
    teacherSelect.innerHTML = '<option value="" disabled>-- اختر معلمًا --</option>';
    (teachers || []).forEach(teacher => {
        const option = document.createElement('option');
        option.value = teacher.id;
        option.textContent = teacher.full_name;
        if (teacher.id == group.teacher_id) option.selected = true;
        teacherSelect.appendChild(option);
    });

    // ضع معرف الفوج في form.dataset.editId
    form.dataset.editId = groupId;

    modal.classList.remove('hidden');
}

function showAddTeacherToGroupModal(groupId, teachers) {
    const modal = document.getElementById('add-teacher-group-modal');
    const form = document.getElementById('add-teacher-group-form');
    if (!modal || !form) return;

    form.reset();
    form.dataset.groupId = groupId;

    // تعبئة قائمة المعلمين مع المادة الخاصة بكل معلم
    const teacherSelect = document.getElementById('teacher-group-select');
    teacherSelect.innerHTML = '<option value="" disabled selected>-- اختر أستاذًا --</option>';
    (teachers || []).forEach(teacher => {
        const option = document.createElement('option');
        option.value = teacher.id;
        // إذا كان لديك بيانات المادة مع كل معلم أضفها هنا
        // مثال: teacher.subject_id
        if (teacher.subject_id) {
            option.dataset.subjectId = teacher.subject_id;
        }
        option.textContent = teacher.full_name;
        teacherSelect.appendChild(option);
    });

    // تعبئة قائمة المواد
    const subjectSelect = document.getElementById('teacher-group-subject');
    subjectSelect.innerHTML = '<option value="" disabled selected>-- اختر المادة --</option>';
    // جلب المواد من قاعدة البيانات
    window.supabaseClient.from('subjects').select('id, name').then(({ data: subjects }) => {
        (subjects || []).forEach(subject => {
            const option = document.createElement('option');
            option.value = subject.id;
            option.textContent = subject.name;
            subjectSelect.appendChild(option);
        });
    });

    // عند تغيير المعلم يتم اختيار المادة تلقائيًا
    teacherSelect.onchange = function() {
        const selectedOption = teacherSelect.options[teacherSelect.selectedIndex];
        const subjectId = selectedOption.dataset.subjectId;
        if (subjectId) {
            subjectSelect.value = subjectId;
        } else {
            subjectSelect.value = '';
        }
    };

    modal.classList.remove('hidden');
}

async function addNewYearToDB(yearName) {
    try {
        const { error } = await window.supabaseClient
            .from('academic_years')
            .insert([{ name: yearName, director_id: currentDirectorId }]);
        if (error) {
            console.error('Supabase error (addNewYearToDB):', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Error adding new year:', e);
        return false;
    }
}


async function addGroupToDB(groupData) {
    try {
        const { error } = await window.supabaseClient
            .from('class_groups')
            .insert([groupData]);
        if (error) {
            console.error('Supabase error (addGroupToDB):', error.message);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Error adding new group:', e);
        return false;
    }
}

async function showGroupDetailsModal(groupId, class_groups, teachers) {
  console.log("فتح نافذة تفاصيل الفوج", groupId);
  const modal = document.getElementById('group-details-modal');
  const content = document.getElementById('group-details-content'); // أضف هذا السطر
  if (!modal || !content) return;

  // جلب بيانات الفوج
  const group = class_groups.find(g => g.id == groupId);

  // جلب التلاميذ في هذا الفوج
  const { data: enrollments } = await window.supabaseClient
      .from('student_enrollments')
      .select('student_id, students(firstname, lastname, gender, level)')
      .eq('class_group_id', groupId);

  const studentsList = (enrollments || []).map(e => e.students);

  // جلب التلاميذ غير المسجلين في أي فوج
  const { data: allStudents } = await window.supabaseClient
      .from('students')
      .select('id, firstname, lastname')
  const { data: allEnrollments } = await window.supabaseClient
      .from('student_enrollments')
      .select('student_id');
  const assignedIds = (allEnrollments || []).map(e => e.student_id);
  const unassignedStudents = (allStudents || []).filter(s => !assignedIds.includes(s.id));

  // جلب الأساتذة مع المواد (subject_id) لهذا الفوج
  const { data: teachersInGroup } = await window.supabaseClient
      .from('teacher_class_groups')
      .select('teacher_id, subject_id')
      .eq('class_id', groupId);

  // جلب جميع المواد مرة واحدة
  const { data: subjects } = await window.supabaseClient
      .from('subjects')
      .select('id, name');

  // بناء قائمة الأساتذة مع اسم المادة — الآن يدعم الحقل group.teacher_id ويجلب المعلمين المفقودين
  const teachersMap = {};
  (teachers || []).forEach(t => { teachersMap[String(t.id)] = t; });

  const subjectsMap = {};
  (subjects || []).forEach(s => { subjectsMap[String(s.id)] = s; });

  // تجميع مدخلات المعلمين: من teacher_class_groups وأيضاً من حقل class_groups.teacher_id
  const teacherEntries = [];
  if (Array.isArray(teachersInGroup) && teachersInGroup.length > 0) {
      teachersInGroup.forEach(tg => {
          teacherEntries.push({ teacher_id: String(tg.teacher_id), subject_id: tg.subject_id ? String(tg.subject_id) : null });
      });
  }
  if (group && group.teacher_id) {
      const mainTeacherId = String(group.teacher_id);
      if (!teacherEntries.find(e => e.teacher_id === mainTeacherId)) {
          // ضع المعلم المسؤول أولاً إن لم يكن موجوداً
          teacherEntries.unshift({ teacher_id: mainTeacherId, subject_id: null });
      }
  }

  // جلب أي معلمين مذكورين لكن غير موجودين في teachers الممررة
  const missingIds = [...new Set(teacherEntries.map(e => e.teacher_id).filter(id => !teachersMap[id]))];
  if (missingIds.length > 0) {
      const { data: fetchedTeachers, error: fetchErr } = await window.supabaseClient
          .from('profiles')
          .select('id, full_name')
          .in('id', missingIds);
      if (!fetchErr && Array.isArray(fetchedTeachers)) {
          fetchedTeachers.forEach(t => { teachersMap[String(t.id)] = t; });
      } else {
          console.warn('فشل جلب المعلمين المفقودين:', fetchErr);
      }
  }

  // بناء عناصر العرض
  const teacherNames = teacherEntries.map(entry => {
      const teacher = teachersMap[String(entry.teacher_id)];
      const subject = entry.subject_id ? subjectsMap[String(entry.subject_id)] : null;
      const teacherText = teacher ? teacher.full_name : '(مجهول)';
      const subjectText = subject ? subject.name : (group && String(group.teacher_id) === entry.teacher_id ? '(المعلم المسؤول)' : '(بدون مادة)');
      return `<li>${teacherText}${subjectText ? ' - ' + subjectText : ''}</li>`;
  });

  content.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
        <h3 class="font-bold mb-2">الفوج: ${group.name}</h3>
        <button id="close-group-details-x" style="font-size: 22px; font-weight: bold; color: #e53e3e; background: none; border: none; cursor: pointer;">&times;</button>
    </div>
    <button id="export-group-students" class="bg-green-500 text-white px-2 py-1 rounded mb-2">تصدير التلاميذ إلى Excel</button>
    <h4 class="font-semibold mb-2">الأساتذة:</h4>
    <ul>
        ${teacherNames.length > 0 ? teacherNames.join('') : '<li>لا يوجد أساتذة</li>'}
    </ul>
    <h4 class="font-semibold mb-2">التلاميذ:</h4>
    <ul>
        ${(Array.isArray(studentsList) && studentsList.length > 0) ? studentsList.map(s => `<li>${s.firstname || ''} ${s.lastname || ''}</li>`).join('') : '<li>لا يوجد تلاميذ</li>'}
    </ul>
    <div class="my-2">
        <label>إضافة تلميذ للفوج:</label>
        <select id="add-student-to-group-select" class="border rounded px-2 py-1">
            <option value="">-- اختر تلميذاً --</option>
            ${unassignedStudents.map(s => `<option value="${s.id}">${s.firstname} ${s.lastname}</option>`).join('')}
        </select>
        <button id="add-student-to-group-btn" class="bg-blue-500 text-white px-2 py-1 rounded ml-2">إضافة</button>
    </div>
  `;
  modal.classList.remove('hidden');
  // احذف السطر التالي لأنه غير ضروري ويسبب خطأ:
  // document.getElementById('close-group_details').onclick = () => modal.classList.add('hidden');

  // زر تصدير Excel
  document.getElementById('export-group-students').onclick = function() {
      exportGroupStudentsToExcel(group.name, studentsList);
  };

  // زر إضافة تلميذ للفوج
  document.getElementById('add-student-to-group-btn').onclick = async function() {
      const studentId = document.getElementById('add-student-to-group-select').value;
      if (!studentId) return alert('اختر تلميذاً أولاً');
      await window.supabaseClient.from('student_enrollments').insert([{ class_group_id: groupId, student_id: studentId }]);
      alert('تمت إضافة التلميذ للفوج!');
      modal.classList.add('hidden');
      await initGroupsPage();
  };

  // زر إغلاق (X)
  document.getElementById('close-group-details-x').onclick = () => modal.classList.add('hidden');
}

function exportGroupStudentsToExcel(groupName, studentsList) {
    if (!studentsList || studentsList.length === 0) {
        alert('لا يوجد تلاميذ للتصدير.');
        return;
    }
    const ws_data = [
        ['الاسم', 'الجنس', 'المستوى'],
        ...studentsList.map(s => [s.firstname + ' ' + s.lastname, s.gender || '', s.level || ''])
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    XLSX.utils.book_append_sheet(wb, ws, groupName);
    XLSX.writeFile(wb, `قائمة تلاميذ ${groupName}.xlsx`);
}

// عند تحميل الصفحة، اعرض المعلومات تلقائيًا
// window.addEventListener('DOMContentLoaded', initGroupsPage);

async function addTeacherToGroup(groupId, teacherId, subjectId) {
    try {
        // تحويل الأنواع بشكل آمن
        const classId = (typeof groupId === 'string' && /^\d+$/.test(groupId)) ? Number(groupId) : groupId;
        const teacher = teacherId || null;
        let subjId = null;
        if (subjectId !== null && subjectId !== undefined && subjectId !== '') {
            // إذا وصل كقيمة رقمية نصية، نحولها لرقم
            if (typeof subjectId === 'string' && /^\d+$/.test(subjectId)) {
                subjId = Number(subjectId);
            } else if (typeof subjectId === 'number') {
                subjId = subjectId;
            } else {
                // وصل اسم مادة بالخطأ -> حاول إيجاد المعرف بحسب الاسم (حسّاس للحروف)
                const { data: found, error: findErr } = await window.supabaseClient
                    .from('subjects')
                    .select('id')
                    .ilike('name', subjectId) // يسمح بمطابقة غير حسّاسة لحالة الأحرف
                    .limit(1);
                if (findErr) {
                    console.warn('خطأ عند البحث عن معرف المادة:', findErr);
                } else if (found && found.length > 0) {
                    subjId = found[0].id;
                } else {
                    // إذا لم نجده نتركه null (يمكنك تغيير السلوك لإظهار خطأ)
                    subjId = null;
                }
            }
        }

        // تحقق من صحة القيم الأساسية
        if (!classId) {
            alert('معرّف الفوج غير صالح.');
            return false;
        }
        if (!teacher) {
            alert('معرّف الأستاذ غير صالح.');
            return false;
        }

        // تحقق من وجود صف الفوج نفسه
        const { data: groupExists, error: groupErr } = await window.supabaseClient
            .from('class_groups')
            .select('id')
            .eq('id', classId)
            .limit(1);
        if (groupErr) {
            console.error('خطأ عند التحقق من وجود الفوج:', groupErr);
            alert('فشل التحقق من الفوج. راجع Console.');
            return false;
        }
        if (!groupExists || groupExists.length === 0) {
            alert('الفوج غير موجود.');
            return false;
        }

        // تحقق من تواجد المعلم في profiles
        const { data: teacherExists, error: teacherErr } = await window.supabaseClient
            .from('profiles')
            .select('id')
            .eq('id', teacher)
            .limit(1);
        if (teacherErr) {
            console.error('خطأ عند التحقق من وجود المعلم:', teacherErr);
            alert('فشل التحقق من المعلم. راجع Console.');
            return false;
        }
        if (!teacherExists || teacherExists.length === 0) {
            alert('المعلم المختار غير موجود في النظام.');
            return false;
        }

        // تحقق من الازدواجية:
        // - إذا تم تحديد مادة: لا تسمح بوجود سجل بنفس (class_id + subject_id)
        // - إذا لم تُحدد مادة: لا تسمح بوجود سجل بنفس (class_id + teacher_id)
        if (subjId !== null) {
            const { data: existing, error: exErr } = await window.supabaseClient
                .from('teacher_class_groups')
                .select('id')
                .eq('class_id', classId)
                .eq('subject_id', subjId)
                .limit(1);
            if (exErr) {
                console.error('خطأ عند فحص الازدواجية بالمادة:', exErr);
                alert('فشل التحقق من الازدواجية. راجع Console.');
                return false;
            }
            if (existing && existing.length > 0) {
                alert('يوجد بالفعل أستاذ مرتبط بهذه المادة في هذا الفوج.');
                return false;
            }
        } else {
            const { data: existing, error: exErr } = await window.supabaseClient
                .from('teacher_class_groups')
                .select('id')
                .eq('class_id', classId)
                .eq('teacher_id', teacher)
                .limit(1);
            if (exErr) {
                console.error('خطأ عند فحص الازدواجية بالمعلم:', exErr);
                alert('فشل التحقق من الازدواجية. راجع Console.');
                return false;
            }
            if (existing && existing.length > 0) {
                alert('المعلم مرتبط بالفعل بهذا الفوج.');
                return false;
            }
        }

        // الإدخال الفعلي
        const payload = { class_id: classId, teacher_id: teacher };
        if (subjId !== null) payload.subject_id = subjId;

        const { error: insertError } = await window.supabaseClient
            .from('teacher_class_groups')
            .insert([payload]);

        if (insertError) {
            console.error('فشل إضافة الأستاذ للفوج:', insertError);
            alert('حدث خطأ أثناء الإضافة. راجع Console.');
            return false;
        }

        return true;
    } catch (e) {
        console.error('خطأ غير متوقع في addTeacherToGroup:', e);
        alert('حدث خطأ غير متوقع أثناء إضافة الأستاذ.');
        return false;
    }
}