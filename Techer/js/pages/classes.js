import { supabase } from '../supabaseClient.js';

let currentTeacherId = null;
let teacherClassesCache = []; // أضف هذا في أعلى الملف

// ========== دوال تهيئة الصفحات الأصلية (ابقها كما هي) ==========
export async function initClassesPage(teacherId) {
    console.log('initClassesPage', teacherId);
    const classListDiv = document.getElementById('classes-list');
    classListDiv.innerHTML = `<p>جاري تحميل الأقسام...</p>`;

    if (!teacherId) {
        classListDiv.innerHTML = `<p class="text-red-500">معرف المعلم غير معرف.</p>`;
        return;
    }

    // جلب معرفات الأقسام المرتبطة بالمعلم
    const { data: groupLinks, error: groupLinksError } = await supabase
        .from('teacher_class_groups')
        .select('class_id')
        .eq('teacher_id', teacherId);

    if (groupLinksError) {
        classListDiv.innerHTML = `<p class="text-red-500">فشل تحميل الأقسام.</p>`;
        return;
    }

    const classIds = groupLinks.map(row => row.class_id);
    if (classIds.length === 0) {
        classListDiv.innerHTML = `<p>لم يتم إسناد أي قسم لك.</p>`;
        return;
    }

    // جلب بيانات الأقسام من جدول class_groups
    const { data: classes, error: classesError } = await supabase
        .from('class_groups')
        .select('id, name')
        .in('id', classIds);

    if (classesError) {
        classListDiv.innerHTML = `<p class="text-red-500">فشل تحميل بيانات الأقسام.</p>`;
        return;
    }

    teacherClassesCache = classes;
    renderClassCards();
}

function renderClassCards() {
    const classListDiv = document.getElementById('classes-list');
    if (!classListDiv) return;
    if (!teacherClassesCache || teacherClassesCache.length === 0) {
        classListDiv.innerHTML = `<p>لم يتم إسناد أي قسم لك.</p>`;
        return;
    }

    // أنشئ البطاقات مع data attribute بدلاً من inline onclick
    classListDiv.innerHTML = teacherClassesCache.map(cls => `
        <div class="bg-white p-4 rounded-lg shadow cursor-pointer hover:bg-indigo-50" data-class-id="${cls.id}" tabindex="0">
            <h3 class="font-bold text-lg text-indigo-700">${escapeHtml(cls.name)}</h3>
        </div>
    `).join('');

    // اربط مستمعي النقر ولوحة المفاتيح لكل بطاقة
    classListDiv.querySelectorAll('[data-class-id]').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.classId;
            if (window.selectClass) window.selectClass(Number(id), card);
        });
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                card.click();
            }
        });
    });
}

export async function renderCoursesForClass(classId) {
    const coursesListDiv = document.getElementById('courses-list');
    coursesListDiv.innerHTML = `<p>جاري تحميل المقررات...</p>`;

    // جلب بيانات القسم لمعرفة السنة الدراسية والمستوى
    const { data: classData, error: classError } = await supabase
        .from('class_groups')
        .select('year_id, level_id')
        .eq('id', classId)
        .single();

    if (classError || !classData) {
        coursesListDiv.innerHTML = `<p class="text-red-500">فشل تحميل بيانات القسم.</p>`;
        return;
    }

    // جلب المواد المرتبطة بالسنة والمستوى من جدول evaluation_networks
    const { data: networks, error: networksError } = await supabase
        .from('evaluation_networks')
        .select('subject_id')
        .eq('year_id', classData.year_id)
        .eq('level_id', classData.level_id);

    if (networksError || !networks || networks.length === 0) {
        coursesListDiv.innerHTML = `<p>لا توجد مقررات لهذا القسم.</p>`;
        return;
    }

    const subjectIds = [...new Set(networks.map(n => n.subject_id))];

    // جلب أسماء المواد من جدول subjects
    const { data: subjects, error: subjectsError } = await supabase
        .from('subjects')
        .select('id, name')
        .in('id', subjectIds);

    if (subjectsError || !subjects || subjects.length === 0) {
        coursesListDiv.innerHTML = `<p>لا توجد مقررات لهذا القسم.</p>`;
        return;
    }

    coursesListDiv.innerHTML = subjects.map(sub =>
        `<div class="bg-white p-4 rounded-lg shadow mb-2 cursor-pointer hover:bg-indigo-50"
              onclick="onCourseClick(${sub.id}, '${sub.name.replace(/'/g, "\\'")}')">
            <h3 class="font-bold text-indigo-700">${sub.name}</h3>
        </div>`
    ).join('');
}

// عند اختيار قسم، استدعِ الدالة لعرض مقرراته
window.selectClass = async function(classId, element) {
    classId = Number(classId);
    // تأكد من وجود حاوية التلاميذ داخل classes-content، وأنشئها ديناميكياً إن لم تكن موجودة
    let studentsSection = document.getElementById('students-section');
    if (!studentsSection) {
        const classesContent = document.getElementById('classes-content');
        if (!classesContent) {
            console.warn('selectClass: #classes-content غير موجود');
            return;
        }
        studentsSection = document.createElement('div');
        studentsSection.id = 'students-section';
        studentsSection.className = 'mt-6';
        studentsSection.innerHTML = `
            <div class="section-title">التلاميذ في الفوج</div>
            <div id="students-list" class="grid gap-3"></div>
        `;
        classesContent.appendChild(studentsSection);
    }

    // تظليل العنصر المحدد بصرياً
    document.querySelectorAll('#classes-list [data-class-id]').forEach(div => div.classList.remove('ring-2', 'ring-indigo-500'));
    if (element) element.classList.add('ring-2', 'ring-indigo-500');

    const studentListDiv = document.getElementById('students-list');
    if (!studentListDiv) return;
    studentListDiv.innerHTML = `<p>جاري تحميل التلاميذ...</p>`;

    try {
        // جلب معرفات الطلاب المرتبطين بالقسم من student_enrollments
        const { data: enrollments, error: enrollmentsError } = await supabase
            .from('student_enrollments')
            .select('student_id')
            .eq('class_group_id', classId);

        if (enrollmentsError) {
            studentListDiv.innerHTML = `<p class="text-red-500">فشل تحميل التلاميذ.</p>`;
            console.error('selectClass enrollmentsError', enrollmentsError);
            return;
        }

        const studentIds = (enrollments || []).map(row => row.student_id).filter(Boolean);
        if (studentIds.length === 0) {
            studentListDiv.innerHTML = `<p>لا يوجد تلاميذ في هذا القسم.</p>`;
            return;
        }

        // جلب بيانات الطلاب من جدول students
        const { data: students, error: studentsError } = await supabase
            .from('students')
            .select('id, firstname, lastname')
            .in('id', studentIds);

        if (studentsError) {
            studentListDiv.innerHTML = `<p class="text-red-500">فشل تحميل بيانات التلاميذ.</p>`;
            console.error('selectClass studentsError', studentsError);
            return;
        }

        // عرض البطاقات
        studentListDiv.innerHTML = (students || []).map(student => `
            <div class="bg-white p-3 rounded-lg shadow flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0"></div>
                <div>
                    <h4 class="font-bold">${escapeHtml(student.firstname)} ${escapeHtml(student.lastname)}</h4>
                    <p class="text-xs text-gray-500">الرقم: ${escapeHtml(student.id)}</p>
                </div>
                <button class="ml-auto bg-gray-200 px-3 py-1 text-xs rounded-full hover:bg-indigo-200"
                        onclick="showStudentProfile(${student.id})">عرض الملف</button>
            </div>
        `).join('');
    } catch (e) {
        console.error('selectClass unexpected error', e);
        studentListDiv.innerHTML = `<p class="text-red-500">حدث خطأ أثناء جلب التلاميذ.</p>`;
    }
}

// تعديل دالة showStudentProfile
window.showStudentProfile = async function(studentId) {
    const { data: student, error } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .single();

    if (error || !student) {
        showStudentModal(`
            <div class="p-6">
                <div class="text-red-600">حدث خطأ في تحميل بيانات التلميذ</div>
            </div>
        `);
        return;
    }

    showStudentModal(`
        <div class="p-6 max-w-4xl mx-auto">
            <!-- رأس الملف -->
            <div class="flex items-center justify-between mb-6 pb-4 border-b">
                <h2 class="text-2xl font-bold text-indigo-700">ملف التلميذ</h2>
                <button onclick="closeStudentModal()" class="text-gray-400 hover:text-red-500">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>

            <!-- المعلومات الأساسية -->
            <div class="bg-indigo-50 p-4 rounded-lg mb-6 flex items-center gap-4">
                <div class="w-16 h-16 bg-indigo-200 rounded-full flex items-center justify-center">
                    <i class="fas fa-user-graduate text-2xl text-indigo-600"></i>
                </div>
                <div>
                    <h3 class="text-xl font-bold text-indigo-900">${student.firstname || ''} ${student.lastname || ''}</h3>
                    <p class="text-indigo-700">رقم التسجيل: ${student.id}</p>
                </div>
            </div>

            <!-- بطاقات المعلومات -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- المعلومات الشخصية -->
                <div class="bg-white p-4 rounded-lg shadow-sm">
                    <h4 class="font-bold text-lg mb-3 text-gray-700">
                        <i class="fas fa-info-circle text-indigo-500 mr-2"></i>
                        المعلومات الشخصية
                    </h4>
                    <div class="space-y-2">
                        <p><span class="font-semibold">الجنس:</span> ${student.gender || 'غير محدد'}</p>
                        <p><span class="font-semibold">تاريخ الميلاد:</span> ${student.dob || 'غير متوفر'}</p>
                        <p><span class="font-semibold">مكان الميلاد:</span> ${student.birthplace || 'غير متوفر'}</p>
                        <p><span class="font-semibold">المستوى:</span> ${student.level || 'غير متوفر'}</p>
                    </div>
                </div>

                <!-- معلومات الاتصال -->
                <div class="bg-white p-4 rounded-lg shadow-sm">
                    <h4 class="font-bold text-lg mb-3 text-gray-700">
                        <i class="fas fa-phone-alt text-indigo-500 mr-2"></i>
                        معلومات الاتصال
                    </h4>
                    <div class="space-y-2">
                        <p><span class="font-semibold">هاتف الطوارئ:</span> ${student.emergency_phone || 'غير متوفر'}</p>
                        <p><span class="font-semibold">تاريخ التسجيل:</span> ${student.registration_date || 'غير متوفر'}</p>
                    </div>
                </div>

                <!-- معلومات ولي الأمر -->
                <div class="bg-white p-4 rounded-lg shadow-sm">
                    <h4 class="font-bold text-lg mb-3 text-gray-700">
                        <i class="fas fa-user-tie text-indigo-500 mr-2"></i>
                        ولي الأمر
                    </h4>
                    <div class="space-y-2">
                        <p><span class="font-semibold">الاسم:</span> ${student.guardian_full_name || 'غير متوفر'}</p>
                        <p><span class="font-semibold">صلة القرابة:</span> ${student.guardian_relation || 'غير متوفر'}</p>
                        <p><span class="font-semibold">الهاتف:</span> ${student.guardian_phone || 'غير متوفر'}</p>
                        <p><span class="font-semibold">العنوان:</span> ${student.guardian_address || 'غير متوفر'}</p>
                    </div>
                </div>

                <!-- المعلومات الصحية -->
                <div class="bg-white p-4 rounded-lg shadow-sm">
                    <h4 class="font-bold text-lg mb-3 text-gray-700">
                        <i class="fas fa-heartbeat text-indigo-500 mr-2"></i>
                        المعلومات الصحية
                    </h4>
                    <div class="space-y-2">
                        <p><span class="font-semibold">الطول:</span> ${student.height || 'غير متوفر'}</p>
                        <p><span class="font-semibold">الوزن:</span> ${student.weight || 'غير متوفر'}</p>
                        <p><span class="font-semibold">فصيلة الدم:</span> ${student.blood_type || 'غير متوفر'}</p>
                        <p><span class="font-semibold">الحساسيات:</span> ${student.allergies || 'غير متوفر'}</p>
                        <p><span class="font-semibold">الحالات الطبية:</span> ${student.medical_conditions || 'غير متوفر'}</p>
                    </div>
                </div>
            </div>

            <!-- زر الإغلاق -->
            <div class="mt-6 text-center">
                <button onclick="closeStudentModal()" 
                    class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg transition-colors duration-200">
                    <i class="fas fa-times mr-2"></i> إغلاق
                </button>
            </div>
        </div>
    `);
}

// نافذة منبثقة
function showStudentModal(content) {
    const modal = document.getElementById('studentModal');
    const modalContent = document.getElementById('studentModalContent');
    modalContent.innerHTML = content;
    modal.style.display = 'flex';
}

window.closeStudentModal = function() {
    document.getElementById('studentModal').style.display = 'none';
}

// جلب شبكات التقييم الخاصة بالمعلم
export async function loadEvaluationNetworks(teacherId) {
    const listDiv = document.getElementById('evaluation-networks-list');
    if (!listDiv) return; // أو اعرض رسالة خطأ مناسبة
    listDiv.innerHTML = 'جاري التحميل...';
    const select = document.getElementById('network-select');
    select.innerHTML = '';

    // جلب معرفات المواد التي يدرسها المعلم
    const { data: teacherSubjects, error: teacherSubjectsError } = await supabase
        .from('teacher_class_groups')
        .select('subject_id')
        .eq('teacher_id', teacherId);

    if (teacherSubjectsError || !teacherSubjects || teacherSubjects.length === 0) {
        listDiv.innerHTML = 'لا توجد شبكات تقييم مرتبطة بموادك.';
        return;
    }

    const subjectIds = [...new Set(teacherSubjects.map(ts => ts.subject_id).filter(Boolean))];

    if (subjectIds.length === 0) {
        listDiv.innerHTML = 'لا توجد شبكات تقييم مرتبطة بموادك.';
        return;
    }

    // جلب شبكات التقييم المرتبطة بهذه المواد
    const { data, error } = await supabase
        .from('evaluation_networks')
        .select('*, subjects(name)')
        .in('subject_id', subjectIds);

    if (error || !data || data.length === 0) {
        listDiv.innerHTML = 'لا توجد شبكات تقييم للمواد التي تدرسها.';
        return;
    }

    listDiv.innerHTML = data.map(net =>
        `<div class="bg-white p-3 rounded mb-2 shadow">
            <strong>${net.subjects?.name || ''}</strong> - ${net.activity_name || ''}
            <div class="text-xs text-gray-500">المرحلة: ${net.education_stage || '-'} | الكفاءة: ${net.competency_final || '-'}</div>
        </div>`
    ).join('');

    select.innerHTML = '<option value="">-- اختر شبكة تقييم --</option>' + data.map(net =>
        `<option value="${net.id}" data-subject-id="${net.subject_id}">${net.subjects?.name || ''} - ${net.activity_name}</option>`
    ).join('');
}

// جلب الأقسام والتلاميذ للنموذج
export async function loadClassesAndStudents() {
    // جلب الأقسام
    const { data: classes } = await supabase.from('class_groups').select('id, name');
    const classSelect = document.getElementById('class-select');
    classSelect.innerHTML = classes.map(cls =>
        `<option value="${cls.id}">${cls.name}</option>`
    ).join('');
    // عند تغيير القسم، جلب التلاميذ
    classSelect.onchange = async function() {
        const classId = classSelect.value;
        const { data: enrollments } = await supabase
            .from('student_enrollments')
            .select('student_id')
            .eq('class_group_id', classId);
        const studentIds = enrollments.map(e => e.student_id);
        const { data: students } = await supabase
            .from('students')
            .select('id, firstname, lastname')
            .in('id', studentIds);
        const studentSelect = document.getElementById('student-select');
        studentSelect.innerHTML = students.map(st =>
            `<option value="${st.id}">${st.firstname} ${st.lastname}</option>`
        ).join('');
    };
    classSelect.onchange(); // تعبئة أول قسم تلقائياً
}

// حفظ الدرجة
export async function handleGradeForm(teacherId) {
    const form = document.getElementById('grade-form');
    form.onsubmit = async function(e) {
        e.preventDefault();
        const networkId = document.getElementById('network-select').value;
        const classId = document.getElementById('class-select').value;
        const studentId = document.getElementById('student-select').value;
        const grade = document.getElementById('grade-input').value;
        const comment = document.getElementById('grade-comment').value;

        // جلب subject_id من شبكة التقييم
        const { data: network, error: networkError } = await supabase
            .from('evaluation_networks')
            .select('subject_id')
            .eq('id', networkId)
            .single();

        if (networkError || !network) {
            document.getElementById('grade-form-result').textContent = 'فشل جلب بيانات الشبكة.';
            return;
        }

        const subjectId = network.subject_id;

        const { error } = await supabase.from('grades').insert([{
            student_id: studentId,
            subject_id: subjectId,
            group_id: classId,
            grade: grade,
            comment: comment,
            date: new Date().toISOString().slice(0, 10),
            teacher_id: teacherId
        }]);
        document.getElementById('grade-form-result').textContent = error ? 'حدث خطأ أثناء الحفظ.' : 'تم حفظ الدرجة بنجاح!';
    };
}

// عرض سجل الدرجات
export async function loadGradesBook(teacherId) {
    // تم تعطيل العرض النصي القديم لسجل التقييمات لأن العرض الآن يتم عبر واجهة "سجل الدرجات" والجدول المحسّن.
    const gradesDiv = document.getElementById('grades-list');
    if (!gradesDiv) return;
    gradesDiv.innerHTML = `
      <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 text-sm text-yellow-800 rounded">
        تم تعطيل العرض النصي لسجل التقييمات. استخدم تبويب <strong>سجل الدرجات</strong> لعرض السجل التفصيلي كجدول احترافي.
      </div>
    `;
}

// عرض المقررات التي يدرسها المعلم
export async function renderTeacherCourses(teacherId) {
    const coursesListDiv = document.getElementById('courses-list');
    coursesListDiv.innerHTML = `<p>جاري تحميل المقررات...</p>`;

    // جلب معرفات المواد من teacher_class_groups
    const { data: teacherSubjects, error: teacherSubjectsError } = await supabase
        .from('teacher_class_groups')
        .select('subject_id')
        .eq('teacher_id', teacherId);

    if (teacherSubjectsError || !teacherSubjects || teacherSubjects.length === 0) {
        coursesListDiv.innerHTML = `<p>لم يتم إسناد أي مقررات لك.</p>`;
        return;
    }

    const subjectIds = [...new Set(teacherSubjects.map(ts => ts.subject_id).filter(Boolean))];

    if (subjectIds.length === 0) {
        coursesListDiv.innerHTML = `<p>لم يتم تحديد مقررات في الأفواج المسندة إليك.</p>`;
        return;
    }

    // جلب أسماء المواد من جدول subjects
    const { data: subjects, error: subjectsError } = await supabase
        .from('subjects')
        .select('id, name')
        .in('id', subjectIds);

    if (subjectsError || !subjects || subjects.length === 0) {
        coursesListDiv.innerHTML = `<p>لم يتم العثور على أسماء المواد.</p>`;
        return;
    }

    coursesListDiv.innerHTML = subjects.map(sub =>
        `<div class="bg-white p-4 rounded-lg shadow mb-2 cursor-pointer hover:bg-indigo-50"
              onclick="onCourseClick(${sub.id}, '${sub.name.replace(/'/g, "\\'")}')">
            <h3 class="font-bold text-indigo-700">${sub.name}</h3>
        </div>`
    ).join('');
}

export async function renderTeacherCoursesForClass(teacherId, classId) {
    const coursesListDiv = document.getElementById('courses-list');
    coursesListDiv.innerHTML = `<p>جاري تحميل المقررات...</p>`;

    // جلب المواد التي يدرسها المعلم لهذا الفوج فقط
    const { data: teacherSubjects, error: teacherSubjectsError } = await supabase
        .from('teacher_class_groups')
        .select('subject_id')
        .eq('teacher_id', teacherId)
        .eq('class_id', classId);

    if (teacherSubjectsError || !teacherSubjects || teacherSubjects.length === 0) {
        coursesListDiv.innerHTML = `<p>لم يتم إسناد أي مقررات لك في هذا الفوج.</p>`;
        return;
    }

    const subjectIds = [...new Set(teacherSubjects.map(ts => ts.subject_id).filter(Boolean))];

    if (subjectIds.length === 0) {
        coursesListDiv.innerHTML = `<p>لم يتم تحديد مقررات في هذا الفوج.</p>`;
        return;
    }

    // جلب أسماء المواد من جدول subjects
    const { data: subjects, error: subjectsError } = await supabase
        .from('subjects')
        .select('id, name')
        .in('id', subjectIds);

    if (subjectsError || !subjects || subjects.length === 0) {
        coursesListDiv.innerHTML = `<p>لم يتم العثور على أسماء المواد.</p>`;
        return;
    }

    coursesListDiv.innerHTML = subjects.map(sub =>
        `<div class="bg-white p-4 rounded-lg shadow mb-2 cursor-pointer hover:bg-indigo-50"
              onclick="onCourseClick(${sub.id}, '${sub.name.replace(/'/g, "\\'")}')">
            <h3 class="font-bold text-indigo-700">${sub.name}</h3>
        </div>`
    ).join('');
}

// عرض شبكات التقييم الخاصة بالمعلم
export async function renderTeacherEvaluations(teacherId) {
    if (!teacherId) return;
    const evalDiv = document.getElementById('teacher-evaluations-list');
    evalDiv.innerHTML = 'جاري تحميل شبكات التقييم...';

    const { data: teacherSubjects, error: teacherSubjectsError } = await supabase
        .from('teacher_class_groups')
        .select('subject_id')
        .eq('teacher_id', teacherId);

    if (teacherSubjectsError || !teacherSubjects || teacherSubjects.length === 0) {
        evalDiv.innerHTML = 'لا توجد مواد مسندة لك.';
        return;
    }

    const subjectIds = [...new Set(teacherSubjects.map(ts => ts.subject_id).filter(Boolean))];
    if (subjectIds.length === 0) {
        evalDiv.innerHTML = 'لا توجد مواد مسندة لك.';
        return;
    }

    const { data: networks, error: networksError } = await supabase
        .from('evaluation_networks')
        .select('id, activity_name, competency_final, competency_sub, education_stage, description, subject_id, subjects(name)')
        .in('subject_id', subjectIds);

    if (networksError || !networks || networks.length === 0) {
        evalDiv.innerHTML = 'لا توجد شبكات تقييم للمواد التي تدرسها.';
        return;
    }

    evalDiv.innerHTML = networks.map(net =>
        `<div class="bg-white p-3 rounded mb-2 shadow cursor-pointer hover:bg-indigo-50"
            onclick='window.showEvaluationModal(${JSON.stringify(net)})'>
            <strong>${net.subjects?.name || ''}</strong> - ${net.activity_name || ''}
            <div class="text-xs text-gray-500">المرحلة: ${net.education_stage || '-'} | الكفاءة: ${net.competency_final || '-'}</div>
        </div>`
    ).join('');

    window.showEvaluationModal = showEvaluationModal;
}

// نافذة منبثقة لعرض تفاصيل شبكة التقييم
function showEvaluationModal(network) {
    let modal = document.getElementById('evaluation-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'evaluation-modal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50';
        modal.innerHTML = `<div id="evaluation-modal-content"></div>`;
        document.body.appendChild(modal);
    }
    document.getElementById('evaluation-modal-content').innerHTML = `
        <div class="bg-white rounded-lg shadow-lg p-6 w-full max-w-md relative">
            <button onclick="closeEvaluationModal()" class="absolute top-2 left-2 text-gray-400 hover:text-red-500 text-xl">&times;</button>
            <h2 class="font-bold text-xl mb-2 text-indigo-700">${network.subjects?.name || ''}</h2>
            <div class="mb-2"><strong>النشاط:</strong> ${network.activity_name || '-'}</div>
            <div class="mb-2"><strong>المرحلة:</strong> ${network.education_stage || '-'}</div>
            <div class="mb-2"><strong>الكفاءة النهائية:</strong> ${network.competency_final || '-'}</div>
            <div class="mb-2"><strong>الكفاءة الجزئية:</strong> ${network.competency_sub || '-'}</div>
            <div class="mb-2"><strong>الوصف:</strong> ${network.description || '-'}</div>
        </div>
    `;
    modal.style.display = 'flex';
}
window.closeEvaluationModal = function() {
    const modal = document.getElementById('evaluation-modal');
    if (modal) modal.style.display = 'none';
};

// ========== نظام التقييم الجديد خطوة بخطوة ==========
export async function initGradingFlow(teacherId) {
    currentTeacherId = teacherId;

    // أنشئ المودال إذا لم يكن موجوداً
    let modal = document.getElementById('evaluation-flow-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'evaluation-flow-modal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-40 hidden z-50 flex items-center justify-center';
        modal.innerHTML = `
            <div id="evaluation-flow-panel" class="bg-white rounded-lg shadow-lg w-full max-w-2xl mx-4 relative p-4" style="max-height:90vh;overflow:auto;">
                <button id="evaluation-flow-close" aria-label="إغلاق" style="position:absolute;top:10px;left:12px;font-size:22px;background:transparent;border:none;cursor:pointer;">&times;</button>
                <div id="evaluation-flow-content"></div>
            </div>
        `;
        document.body.appendChild(modal);

        // إغلاق عند النقر على الخلفية أو زر الإغلاق
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
                document.body.style.overflow = '';
            }
        });
        document.getElementById('evaluation-flow-close').addEventListener('click', () => {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        });
    }

    const container = document.getElementById('grades-tab');
    container.innerHTML = `
        <div class="section-title">تقييم تلميذ جديد</div>
        <p class="mb-4">اتبع الخطوات لتقييم أداء تلميذ بناءً على معايير شبكة التقييم.</p>
        <button id="start-evaluation-btn" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded shadow">
            <i class="fas fa-play"></i> ابدأ عملية التقييم
        </button>
    `;

    document.getElementById('start-evaluation-btn').addEventListener('click', () => {
        // عرض المودال أولاً
        const m = document.getElementById('evaluation-flow-modal');
        if (m) {
            m.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
        // ابدأ الخطوة الأولى
        showEvaluationStep1_Classes();
    });
}

// الخطوة 1: اختيار الفوج
async function showEvaluationStep1_Classes() {
    const modal = document.getElementById('evaluation-flow-modal');
    const content = document.getElementById('evaluation-flow-content');
    content.innerHTML = `<h3 class="font-bold text-lg mb-4">الخطوة 1: اختر الفوج</h3><div id="flow-class-list" class="text-center">جاري تحميل الأفواج...</div>`;
    modal.classList.remove('hidden');

    const { data: groupLinks, error } = await supabase
        .from('teacher_class_groups')
        .select('class_groups(id, name)')
        .eq('teacher_id', currentTeacherId);

    if (error || !groupLinks) {
        content.innerHTML = '<p class="text-red-500">فشل تحميل الأفواج.</p>';
        return;
    }
    const uniqueClasses = Array.from(new Map(groupLinks.map(link => [link.class_groups.id, link.class_groups])).values());
    const classListContainer = document.getElementById('flow-class-list');
    classListContainer.innerHTML = uniqueClasses.map(cls => `
        <div class="bg-gray-100 p-3 rounded mb-2 cursor-pointer hover:bg-indigo-100" 
             onclick="window.procs.selectClassForGrading(${cls.id})">
            ${cls.name}
        </div>
    `).join('');
}

// الخطوة 2: اختيار التلميذ
async function showEvaluationStep2_Students(classId) {
    const content = document.getElementById('evaluation-flow-content');
    content.innerHTML = `<h3 class="font-bold text-lg mb-4">الخطوة 2: اختر التلميذ</h3><div id="flow-student-list" class="text-center">جاري تحميل التلاميذ...</div>`;

    const { data: enrollments, error } = await supabase
        .from('student_enrollments')
        .select('students(id, firstname, lastname)')
        .eq('class_group_id', classId);

    if (error || !enrollments) {
        content.innerHTML = '<p class="text-red-500">فشل تحميل التلاميذ.</p>';
        return;
    }
    const students = enrollments.map(e => e.students);
    const studentListContainer = document.getElementById('flow-student-list');
    studentListContainer.innerHTML = students.map(st => `
        <div class="bg-gray-100 p-3 rounded mb-2 cursor-pointer hover:bg-indigo-100" 
             onclick="window.procs.selectStudentForGrading(${classId}, ${st.id})">
            ${st.firstname} ${st.lastname}
        </div>
    `).join('');
}

// الخطوة 3: اختيار المادة
async function showEvaluationStep3_Subjects(classId, studentId) {
    const content = document.getElementById('evaluation-flow-content');
    content.innerHTML = `<h3 class="font-bold text-lg mb-4">الخطوة 3: اختر المادة</h3><div id="flow-subject-list" class="text-center">جاري تحميل المواد...</div>`;

    const { data: subjectsData, error } = await supabase
        .from('teacher_class_groups')
        .select('subject_id, subjects(id, name)')
        .eq('teacher_id', currentTeacherId)
        .eq('class_id', classId);

    if (error || !subjectsData) {
        content.innerHTML = '<p class="text-red-500">فشل تحميل المواد.</p>';
        return;
    }
    const uniqueSubjects = Array.from(new Map(subjectsData.filter(s => s.subjects).map(s => [s.subjects.id, s.subjects])).values());
    const subjectListContainer = document.getElementById('flow-subject-list');
    subjectListContainer.innerHTML = uniqueSubjects.map(sub => `
        <div class="bg-gray-100 p-3 rounded mb-2 cursor-pointer hover:bg-indigo-100" 
             onclick="window.procs.selectSubjectForGrading(${studentId}, ${sub.id})">
            ${sub.name}
        </div>
    `).join('');
}

// الخطوة 4: اختيار شبكة التقييم
async function showEvaluationStep4_Networks(studentId, subjectId) {
    const content = document.getElementById('evaluation-flow-content');
    content.innerHTML = `<h3 class="font-bold text-lg mb-4">الخطوة 4: اختر شبكة التقييم</h3><div id="flow-network-list" class="text-center">جاري تحميل الشبكات...</div>`;
    const { data, error } = await supabase
        .from('evaluation_networks')
        .select(`*, network_criteria(id, criteria_text)`)
        .eq('subject_id', subjectId);

    if (error || !data || data.length === 0) {
        content.innerHTML = '<p class="text-red-500">لا توجد شبكات تقييم لهذه المادة.</p>';
        return;
    }
    const networkListContainer = document.getElementById('flow-network-list');
    networkListContainer.innerHTML = data.map(net => `
        <div class="bg-gray-100 p-3 rounded mb-2 cursor-pointer hover:bg-indigo-100" 
             onclick='window.procs.selectNetworkForGrading(${studentId}, ${JSON.stringify(net)})'>
            ${net.activity_name} (${net.competency_final})
        </div>
    `).join('');
}

// الخطوة 5: تقييم المعايير
function showEvaluationStep5_Criteria(studentId, network) {
    const content = document.getElementById('evaluation-flow-content');
    const criteriaHTML = network.network_criteria.map(crit => `
        <div class="mb-4 p-3 border rounded">
            <label class="block font-semibold mb-2" for="crit-${crit.id}">${crit.criteria_text}</label>
            <div class="flex gap-2">
                <input type="radio" name="grade-${crit.id}" value="أ" id="crit-${crit.id}-a" required><label for="crit-${crit.id}-a">أ</label>
                <input type="radio" name="grade-${crit.id}" value="ب" id="crit-${crit.id}-b"><label for="crit-${crit.id}-b">ب</label>
                <input type="radio" name="grade-${crit.id}" value="ج" id="crit-${crit.id}-c"><label for="crit-${crit.id}-c">ج</label>
                <input type="radio" name="grade-${crit.id}" value="د" id="crit-${crit.id}-d"><label for="crit-${crit.id}-d">د</label>
            </div>
            <textarea class="w-full mt-2 p-2 border rounded text-sm" data-comment-for="${crit.id}" placeholder="ملاحظات (اختياري)"></textarea>
        </div>
    `).join('');
    content.innerHTML = `
        <h3 class="font-bold text-lg mb-4">الخطوة 5: تقييم المعايير</h3>
        <p class="mb-2">الشبكة: <strong>${network.activity_name}</strong></p>
        <form id="criteria-grading-form">
            ${criteriaHTML}
            <div class="mt-4">
                <label for="final-score" class="block font-semibold">الدرجة النهائية (اختياري)</label>
                <input type="number" id="final-score" class="w-full p-2 border rounded" min="0" max="20" step="0.25">
            </div>
            <div class="text-left mt-6">
                <button type="submit" class="bg-green-600 hover:bg-green-700 text-white px-8 py-2 rounded">حفظ التقييم</button>
            </div>
        </form>
    `;
    document.getElementById('criteria-grading-form').addEventListener('submit', (e) => {
        e.preventDefault();
        saveEvaluation(studentId, network);
    });
}

// دوال مساعدة لحساب ملخّص التقييمات من مصفوفة student_criteria_grades
function gradeLetterToScore(letter) {
    // أ = أعلى قيمة (4)، د = أدنى (1)
    switch ((letter || '').trim()) {
        case 'أ': return 4;
        case 'ب': return 3;
        case 'ج': return 2;
        case 'د': return 1;
        default: return 0;
    }
}

function computeEvaluationSummary(criteriaGrades) {
    const counts = { 'أ': 0, 'ب': 0, 'ج': 0, 'د': 0, other: 0 };
    let achieved = 0;
    const n = (criteriaGrades || []).length;
    criteriaGrades.forEach(c => {
        const g = (c.grade || '').trim();
        if (['أ','ب','ج','د'].includes(g)) {
            counts[g] = (counts[g] || 0) + 1;
            achieved += gradeLetterToScore(g);
        } else {
            counts.other += 1;
        }
    });
    const maxPerCriterion = 4;
    const totalPossible = Math.max(1, n * maxPerCriterion);
    const percent = (achieved / totalPossible) * 100;
    const finalScore20 = Math.round((achieved / totalPossible) * 20 * 100) / 100; // على مقياس 20 مع تقطيع لرقمين
    // تصنيف نصّي بحسب النسبة (يمكن تعديل العتبات حسب الدليل)
    let overall = 'تحكّم أدنى';
    if (percent >= 87.5) overall = 'تحكّم أقصى';
    else if (percent >= 62.5) overall = 'تحكّم مقبول';
    else if (percent >= 37.5) overall = 'تحكّم جزئي';
    else overall = 'تحكّم أدنى';
    return { counts, achieved, totalPossible, percent: Math.round(percent*100)/100, finalScore20, overall, n };
}

// الحفظ النهائي
async function saveEvaluation(studentId, network) {
    const form = document.getElementById('criteria-grading-form');

    // أدخل التقييم الرئيسي بدون final_score (نملأه لاحقاً) ثم نحفظ تفاصيل المعايير ثم نحدّث final_score و overall_grade
    const insertPayload = {
        evaluation_network_id: network.id,
        student_id: studentId,
        teacher_id: currentTeacherId,
        evaluation_date: new Date().toISOString().slice(0, 10),
        final_score: null,
        overall_grade: null
    };

    const { data: mainEval, error: mainEvalError } = await supabase
        .from('student_evaluations')
        .insert(insertPayload)
        .select()
        .single();

    if (mainEvalError || !mainEval) {
        alert('فشل حفظ التقييم الرئيسي: ' + (mainEvalError?.message || 'خطأ غير معروف'));
        return;
    }

    const criteriaGrades = network.network_criteria.map(crit => {
        const selected = form.querySelector(`input[name="grade-${crit.id}"]:checked`);
        const comment = form.querySelector(`textarea[data-comment-for="${crit.id}"]`);
        return {
            student_evaluation_id: mainEval.id,
            criteria_id: crit.id,
            grade: selected ? selected.value : null,
            comment: comment ? comment.value.trim() : ''
        };
    });

    const { error: criteriaError, data: insertedCriteria } = await supabase
        .from('student_criteria_grades')
        .insert(criteriaGrades);

    if (criteriaError) {
        alert('فشل حفظ تفاصيل المعايير: ' + criteriaError.message);
        // تنظيف السجل الرئيسي عند فشل حفظ التفاصيل
        await supabase.from('student_evaluations').delete().eq('id', mainEval.id);
        return;
    }

    // احسب الملخّص من البيانات المحفوظة (نستخدم insertedCriteria إن وفّرها الخادم)
    const summary = computeEvaluationSummary(insertedCriteria || criteriaGrades);

    // حدّث السجل الرئيسي بالدرجة المحسوبة والتصنيف النصي
    const { error: updErr } = await supabase
        .from('student_evaluations')
        .update({
            final_score: summary.finalScore20,
            overall_grade: summary.overall
        })
        .eq('id', mainEval.id);

    if (updErr) {
        console.warn('تعذّر تحديث الدرجة النهائية/التصنيف:', updErr);
    }

    // إعلام المستخدم بالملخّص بدلاً من alert بسيط
    const summaryMsg = `تم حفظ التقييم. الدرجة النهائية: ${summary.finalScore20} /20 — النسبة: ${summary.percent}% — التصنيف: ${summary.overall}
    (ح: أ=${summary.counts['أ'] || 0}, ب=${summary.counts['ب'] || 0}, ج=${summary.counts['ج'] || 0}, د=${summary.counts['د'] || 0})`;
    alert(summaryMsg);

    document.getElementById('evaluation-flow-modal').classList.add('hidden');
    await loadGradesBook(currentTeacherId);
}

// تهيئة تبويب "التقييمات والدرجات" — يُستدعى من main.js
export async function initAssessmentsPage(teacherId) {
    currentTeacherId = teacherId;
    const tabsContainer = document.getElementById('assessments-content');
    if (!tabsContainer) return;

    // اربط أزرار التبويبات (نستخدم onclick لاستبدال أي مستمع سابق)
    tabsContainer.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = async function() {
            // تحديث الحالة البصرية
            tabsContainer.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            // إخفاء كل المحتويات ثم إظهار الهدف
            tabsContainer.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
            const targetId = this.dataset.tab;
            const targetEl = document.getElementById(targetId);
            if (targetEl) targetEl.style.display = 'block';

            // تحميل البيانات المناسبة لكل تبويب
            if (targetId === 'grids-tab') {
                if (typeof loadEvaluationNetworks === 'function') await loadEvaluationNetworks(currentTeacherId);
            } else if (targetId === 'grades-tab') {
                if (typeof initGradingFlow === 'function') await initGradingFlow(currentTeacherId);
            } else if (targetId === 'gradebook-tab') {
                if (typeof renderEvaluationsFilterTable === 'function') await renderEvaluationsFilterTable(currentTeacherId);
                if (typeof loadGradesBook === 'function') await loadGradesBook(currentTeacherId);
            }
        };
    });

    // حالة افتراضية: افتح تبويب الشبكات
    const defaultBtn = tabsContainer.querySelector('.tab-btn[data-tab="grids-tab"]');
    if (defaultBtn) defaultBtn.click();
}

// ===================== سجل التقييمات - واجهة احترافية =====================
export async function renderEvaluationsFilterTable(teacherId) {
    const container = document.getElementById('evaluations-filter');
    if (!container) return;
    container.innerHTML = `<div class="bg-white p-4 rounded-lg shadow-md"><i class="fas fa-spinner fa-spin mr-2"></i> جارِ تحميل الأفواج...</div>`;

    const { data: groupLinks, error } = await supabase
        .from('teacher_class_groups')
        .select('class_groups(id, name)')
        .eq('teacher_id', teacherId);

    if (error || !groupLinks) {
        container.innerHTML = `<div class="bg-white p-4 rounded-lg shadow-md text-red-500">فشل تحميل الأفواج.</div>`;
        return;
    }

    const uniqueClasses = Array.from(new Map(groupLinks.map(l => l.class_groups && l.class_groups.id ? [l.class_groups.id, l.class_groups] : []).filter(Boolean)).values());
    if (uniqueClasses.length === 0) {
        container.innerHTML = `<div class="bg-white p-4 rounded-lg shadow-md text-gray-500">لم يتم إسناد أي أفواج لك بعد.</div>`;
        return;
    }

    container.innerHTML = `
        <div class="bg-white rounded-lg shadow-md">
            <div class="flex flex-col md:flex-row">
                <div class="md:w-1/4 p-4 border-b md:border-b-0 md:border-l border-gray-200">
                    <h4 class="font-bold mb-3 text-indigo-800 flex items-center gap-2">
                        <i class="fas fa-layer-group"></i>
                        <span>الأفواج</span>
                    </h4>
                    <input id="eval-class-search" placeholder="ابحث..." class="w-full p-2 mb-3 border rounded text-sm" />
                    <div id="eval-filter-classes" class="space-y-1 max-h-56 overflow-auto"></div>
                </div>

                <div id="eval-filter-table" class="flex-1 p-4">
                    <div class="h-full flex flex-col items-center justify-center text-center text-gray-400">
                        <i class="fas fa-arrow-left text-4xl mb-4"></i>
                        <p class="font-semibold">الرجاء اختيار فوج من القائمة لعرض سجل التقييمات.</p>
                        <p class="text-sm">سيتم عرض جدول يحتوي على أسماء التلاميذ وأحدث درجاتهم لكل معيار.</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    const classesContainer = document.getElementById('eval-filter-classes');
    classesContainer.innerHTML = uniqueClasses.map(c => `
        <div class="p-2 rounded cursor-pointer hover:bg-indigo-50 transition" data-class-id="${c.id}" onclick="window.teacherFuncs.selectClassForTable(${c.id}, this)">
            ${escapeHtml(c.name)}
        </div>
    `).join('');

    // بحث في القائمة
    const searchInput = document.getElementById('eval-class-search');
    searchInput.addEventListener('input', (e) => {
        const q = (e.target.value || '').toLowerCase();
        classesContainer.querySelectorAll('[data-class-id]').forEach(div => {
            div.style.display = div.textContent.toLowerCase().includes(q) ? 'block' : 'none';
        });
    });
}

// بناء جدول التقييمات للفوج (محسّن)
async function loadClassEvaluationsTable(classId) {
    const tableContainer = document.getElementById('eval-filter-table');
    if (!tableContainer) return;
    tableContainer.dataset.currentClass = classId;
    tableContainer.innerHTML = `<div class="text-center p-8"><i class="fas fa-spinner fa-spin text-2xl text-indigo-600"></i><p class="mt-2">جاري تحميل بيانات التقييمات...</p></div>`;

    // جلب التلاميذ في الفوج
    const { data: enrollments, error: enrollErr } = await supabase
        .from('student_enrollments')
        .select('students(id, firstname, lastname)')
        .eq('class_group_id', classId);

    if (enrollErr) {
        tableContainer.innerHTML = `<p class="text-red-500">فشل تحميل التلاميذ.</p>`;
        return;
    }
    const students = (enrollments || []).map(e => e.students).filter(Boolean);
    if (!students.length) {
        tableContainer.innerHTML = `<p class="text-gray-500 text-center mt-8">لا يوجد تلاميذ في هذا الفوج.</p>`;
        return;
    }
    const studentIds = students.map(s => s.id);

    // جلب معرفات التقييمات ثم درجات المعايير
    const evalsRes = await supabase.from('student_evaluations').select('id, student_id, evaluation_date').in('student_id', studentIds);
    const evalIds = evalsRes.data?.map(d => d.id) || [];
    if (evalIds.length === 0) {
        tableContainer.innerHTML = `<p class="text-gray-500 text-center mt-8">لا توجد تقييمات لهذا الفوج بعد.</p>`;
        return;
    }

    const { data: criteriaGrades, error: critErr } = await supabase
        .from('student_criteria_grades')
        .select('grade, comment, network_criteria(id, criteria_text), student_evaluations(id, student_id, evaluation_date)')
        .in('student_evaluation_id', evalIds);

    if (critErr) {
        tableContainer.innerHTML = `<p class="text-red-500">فشل تحميل درجات المعايير.</p>`;
        return;
    }
    if (!criteriaGrades || criteriaGrades.length === 0) {
        tableContainer.innerHTML = `<p class="text-gray-500 text-center mt-8">لا توجد درجات محفوظة لهذا الفوج بعد.</p>`;
        return;
    }

    // تجميع المعايير الفريدة
    const criteriaMap = new Map();
    criteriaGrades.forEach(cg => {
        if (cg.network_criteria && cg.network_criteria.id) criteriaMap.set(cg.network_criteria.id, cg.network_criteria.criteria_text);
    });
    const criteriaList = Array.from(criteriaMap.entries()); // [ [id, text], ... ]

    // اختيار أحدث درجة لكل تلميذ/معيار
    const studentGrades = {}; // { studentId: { criteriaId: { grade, date, comment } } }
    criteriaGrades.forEach(cg => {
        const se = cg.student_evaluations;
        if (!se || !cg.network_criteria) return;
        const sid = se.student_id;
        const cid = cg.network_criteria.id;
        const d = se.evaluation_date ? new Date(se.evaluation_date) : new Date(0);
        studentGrades[sid] = studentGrades[sid] || {};
        const exist = studentGrades[sid][cid];
        if (!exist || d > exist.date) {
            studentGrades[sid][cid] = { grade: cg.grade, date: d, comment: cg.comment || '' };
        }
    });

    // بناء جدول احترافي: رؤوس لاصقة وعمود تلميذ لاصق يسهل القراءة
    const headerCols = criteriaList.map(([_, text]) =>
        `<th style="position:sticky;top:0;background:#f8fafc;border-bottom:1px solid #e6e9ef;padding:10px;text-align:center;min-width:140px">${escapeHtml(text)}</th>`
    ).join('');

    const rowsHtml = students.map(st => {
        const cells = criteriaList.map(([cid]) => {
            const gd = studentGrades[st.id] ? studentGrades[st.id][cid] : null;
            if (!gd) return `<td style="padding:10px;border-bottom:1px solid #f1f5f9;text-align:center;color:#9aa0a6">-</td>`;
            const dateStr = gd.date instanceof Date && !isNaN(gd.date) ? gd.date.toISOString().split('T')[0] : '';
            const commentAttr = gd.comment ? ` title="${escapeHtml(gd.comment)}"` : '';
            const badge = gradeBadgeHtml(gd.grade);
            return `<td style="padding:10px;border-bottom:1px solid #f1f5f9;text-align:center" ${commentAttr}>
                        <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
                          ${badge}
                          <small style="color:#94a3b8">${escapeHtml(dateStr)}</small>
                        </div>
                    </td>`;
        }).join('');
        return `<tr class="hover:bg-gray-50">
                    <td style="position:sticky;left:0;background:#fff;border-right:1px solid #eef2f7;padding:10px;font-weight:600;min-width:220px">${escapeHtml(st.firstname)} ${escapeHtml(st.lastname)}</td>
                    ${cells}
                </tr>`;
    }).join('');

    tableContainer.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="color:#64748b;font-size:14px">عرض ${students.length} تلميذ • ${criteriaList.length} معيار</div>
        <div style="display:flex;gap:8px">
          <button id="refresh-current-table" style="padding:6px 10px;border-radius:6px;background:#f3f4f6;border:1px solid #e5e7eb">تحديث</button>
          <button id="export-evals-btn" style="padding:6px 10px;border-radius:6px;background:#10b981;color:#fff;border:none;display:flex;align-items:center;gap:8px">
            <i class="fas fa-file-excel"></i> تصدير Excel
          </button>
        </div>
      </div>
      <div style="overflow:auto;border:1px solid #e6eef6;border-radius:8px">
        <table style="width:100%;border-collapse:collapse;min-width:900px">
          <thead>
            <tr>
              <th style="position:sticky;left:0;top:0;background:#f1f5f9;padding:12px;border-bottom:1px solid #e6e9ef;text-align:right;min-width:220px">التلميذ</th>
              ${headerCols}
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;

    document.getElementById('refresh-current-table').onclick = () => loadClassEvaluationsTable(classId);
    document.getElementById('export-evals-btn').onclick = () => exportTableToExcel(students, criteriaList, studentGrades);
}

// badge helper: إرجاع HTML لشارة ملونة اعتمادًا على الدرجة
function gradeBadgeHtml(value) {
    const num = Number(value);
    if (!isNaN(num)) {
        if (num >= 16) return `<span style="padding:6px 10px;border-radius:999px;background:linear-gradient(90deg,#bbf7d0,#86efac);color:#065f46;font-weight:700">${escapeHtml(String(value))}</span>`;
        if (num >= 12) return `<span style="padding:6px 10px;border-radius:999px;background:linear-gradient(90deg,#fff7c2,#fde68a);color:#92400e;font-weight:700">${escapeHtml(String(value))}</span>`;
        return `<span style="padding:6px 10px;border-radius:999px;background:linear-gradient(90deg,#ffd6d6,#fda4af);color:#7f1d1d;font-weight:700">${escapeHtml(String(value))}</span>`;
    }
    // للقيم الوصفية
    const v = (value || '').trim();
    if (v) return `<span style="padding:6px 10px;border-radius:999px;background:#eef2ff;color:#1e3a8a;font-weight:700">${escapeHtml(v)}</span>`;
    return `<span style="padding:6px 10px;border-radius:999px;background:#eef2ff;color:#1e3a8a;font-weight:700">-</span>`;
}

// دالة مساعدة بسيطة للهروب من HTML
function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

// ربط دالة اختيار الفوج بالنافذة لتستدعى من الـ HTML
window.teacherFuncs = window.teacherFuncs || {};
window.teacherFuncs.selectClassForTable = (classId, element) => {
    // تظليل العنصر بصرياً
    document.querySelectorAll('#eval-filter-classes [data-class-id]').forEach(d => d.classList.remove('bg-indigo-50', 'font-semibold'));
    if (element) element.classList.add('bg-indigo-50', 'font-semibold');
    // استدعاء تحميل الجدول
    loadClassEvaluationsTable(classId);
};

// ربط خطوات التقييم (تعريف window.procs المستخدم في HTML داخل الـ modal)
window.procs = window.procs || {};
window.procs.selectClassForGrading = (classId) => {
    showEvaluationStep2_Students(classId);
};
window.procs.selectStudentForGrading = (classId, studentId) => {
    showEvaluationStep3_Subjects(classId, studentId);
};
window.procs.selectSubjectForGrading = (studentId, subjectId) => {
    showEvaluationStep4_Networks(studentId, subjectId);
};
window.procs.selectNetworkForGrading = (studentId, network) => {
    showEvaluationStep5_Criteria(studentId, network);
};

// إضافة دالة onCourseClick في نطاق window
window.onCourseClick = async function(subjectId, subjectName) {
    const courseModal = document.createElement('div');
    courseModal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
    courseModal.id = 'courseModal';
    
    // جلب معلومات إضافية عن المقرر
    const { data: subject, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('id', subjectId)
        .single();

    if (error) {
        console.error('Error fetching subject details:', error);
        return;
    }

    courseModal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl">
            <div class="p-6">
                <!-- رأس النافذة -->
                <div class="flex justify-between items-center mb-6 pb-4 border-b">
                    <h2 class="text-2xl font-bold text-indigo-700">${subjectName}</h2>
                    <button onclick="closeCourseModal()" class="text-gray-400 hover:text-red-500">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>

                <!-- محتوى المقرر -->
                <div class="space-y-4">
                    <!-- معلومات المقرر -->
                    <div class="bg-indigo-50 p-4 rounded-lg">
                        <h3 class="font-bold text-lg mb-2">معلومات المقرر</h3>
                        <p>${subject.description || 'لا يوجد وصف متاح'}</p>
                    </div>

                    <!-- المعاملات والساعات -->
                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-green-50 p-4 rounded-lg">
                            <h3 class="font-bold mb-2">المعامل</h3>
                            <p>${subject.coefficient || '-'}</p>
                        </div>
                        <div class="bg-blue-50 p-4 rounded-lg">
                            <h3 class="font-bold mb-2">عدد الساعات</h3>
                            <p>${subject.hours_per_week || '-'} ساعة/أسبوع</p>
                        </div>
                    </div>
                </div>

                <!-- زر الإغلاق -->
                <div class="mt-6 text-center">
                    <button onclick="closeCourseModal()" 
                            class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg transition-colors duration-200">
                        <i class="fas fa-times mr-2"></i> إغلاق
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(courseModal);
};

// إضافة دالة لإغلاق النافذة المنبثقة
window.closeCourseModal = function() {
    const modal = document.getElementById('courseModal');
    if (modal) {
        modal.remove();
    }
};