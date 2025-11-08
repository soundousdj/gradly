import { supabase } from '../supabaseClient.js';

export async function initDashboardPage(teacherId) {
    // عرض عدد الأقسام
    const statClassesEl = document.getElementById('stat-classes');
    statClassesEl.textContent = '...';

    // جلب معرفات الأقسام المرتبطة بالمعلم
    const { data: groupLinks, error: groupLinksError } = await supabase
        .from('teacher_class_groups')
        .select('class_id')
        .eq('teacher_id', teacherId);

    if (groupLinksError) {
        statClassesEl.textContent = 'خطأ';
        return;
    }

    statClassesEl.textContent = groupLinks.length;

    const classIds = groupLinks.map(row => row.class_id);

    // عرض عدد التلاميذ
    const statStudentsEl = document.getElementById('stat-students');
    statStudentsEl.textContent = '...';

    if (classIds.length > 0) {
        // جلب عدد التلاميذ المرتبطين بهذه الأقسام من student_enrollments
        const { count: studentCount, error: studentError } = await supabase
            .from('student_enrollments')
            .select('student_id', { count: 'exact', head: true })
            .in('class_group_id', classIds);

        if (studentError) {
            statStudentsEl.textContent = 'خطأ';
        } else {
            statStudentsEl.textContent = studentCount ?? 0;
        }
    } else {
        statStudentsEl.textContent = 0;
    }

    // عرض عدد الاجتماعات
    const statMeetingsEl = document.getElementById('stat-meetings');
    statMeetingsEl.textContent = '...';

    const { count: meetingsCount, error: meetingsError } = await supabase
        .from('meetings')
        .select('id', { count: 'exact', head: true })
        .contains('participants', [teacherId])
        .neq('status', 'مكتمل'); // استثناء الاجتماعات المكتملة

    if (meetingsError) {
        statMeetingsEl.textContent = 'خطأ';
    } else {
        statMeetingsEl.textContent = meetingsCount ?? 0;
    }

    // عرض عدد التقييمات التي لم تكتمل
    const statPendingEl = document.getElementById('stat-pending');
    statPendingEl.textContent = '...';

    const { count: pendingCount, error: pendingError } = await supabase
        .from('student_evaluations')
        .select('id', { count: 'exact', head: true })
        .eq('teacher_id', teacherId)
        .is('final_score', null); // أو يمكنك استخدام شرط آخر حسب منطقك

    if (pendingError) {
        statPendingEl.textContent = 'خطأ';
    } else {
        statPendingEl.textContent = pendingCount ?? 0;
    }

    // ربط زر إدخال الدرجات بعد التأكد من وجوده
    const addGradeBtn = document.getElementById('add-grade-btn');
    if (addGradeBtn) {
        addGradeBtn.onclick = async function() {
            // استدعِ هنا الكود الخاص بفتح نافذة إدخال الدرجات
            // يمكنك نقل الكود من classes.js أو استدعاء دالة عامة
            if (window.openGradeModal) {
                window.openGradeModal(teacherId);
            } else {
                // fallback: يمكنك نسخ الكود الخاص بفتح النافذة هنا
            }
        };
    }

    // === آخر النشاطات (آخر تقييمات قام بها المعلم) ===
    const activitiesDiv = document.getElementById('latest-activities-list');
    if (activitiesDiv) {
        activitiesDiv.innerHTML = 'جاري التحميل...';

        const { data: latestEvals, error: evalsError } = await supabase
            .from('student_evaluations')
            .select(`
                id,
                evaluation_date,
                final_score,
                evaluation_networks(activity_name, subjects(name)),
                students(firstname, lastname)
            `)
            .eq('teacher_id', teacherId)
            .order('evaluation_date', { ascending: false })
            .limit(5);

        if (evalsError || !latestEvals || latestEvals.length === 0) {
            activitiesDiv.innerHTML = 'لا توجد نشاطات حديثة.';
        } else {
            activitiesDiv.innerHTML = latestEvals.map(e =>
                `<div class="mb-3 p-3 border-b flex items-start gap-3">
                   <div class="w-8 text-indigo-600 flex-shrink-0">
                     <i class="fas fa-clipboard-list"></i>
                   </div>
                   <div class="flex-1">
                     <div class="flex items-center gap-2">
                       <span class="font-bold">${e.students ? escapeHtml(e.students.firstname + ' ' + e.students.lastname) : ''}</span>
                       <span class="text-gray-600 text-sm">(${escapeHtml(e.evaluation_networks?.subjects?.name || '')} - ${escapeHtml(e.evaluation_networks?.activity_name || '')})</span>
                     </div>
                     <div class="text-xs text-gray-500 mt-1">بتاريخ: ${escapeHtml(e.evaluation_date || '-')} ${e.final_score ? `• <span class="text-green-700">الدرجة: ${escapeHtml(String(e.final_score))}</span>` : ''}</div>
                   </div>
                 </div>`
            ).join('');
        }
    }

    // === الاجتماعات القادمة ===
    const meetingsDiv = document.getElementById('upcoming-meetings-list');
    if (meetingsDiv) {
        meetingsDiv.innerHTML = 'جاري التحميل...';

        const today = new Date().toISOString().slice(0, 10);
        const { data: meetings, error: meetingsError } = await supabase
            .from('meetings')
            .select('id, subject, meeting_date, meeting_time, status')
            .contains('participants', [teacherId])
            .gte('meeting_date', today)
            .neq('status', 'مكتمل')
            .order('meeting_date', { ascending: true })
            .limit(5);

        if (meetingsError || !meetings || meetings.length === 0) {
            meetingsDiv.innerHTML = 'لا توجد اجتماعات قادمة.';
        } else {
            meetingsDiv.innerHTML = meetings.map(m =>
                `<div class="mb-3 p-3 border-b flex items-start gap-3">
                   <div class="w-8 text-indigo-600 flex-shrink-0"><i class="fas fa-calendar-alt"></i></div>
                   <div class="flex-1">
                     <div class="font-bold">${escapeHtml(m.subject)}</div>
                     <div class="text-xs text-gray-500 mt-1">${escapeHtml(m.meeting_date || '')} • ${escapeHtml(m.meeting_time || '')} ${m.status ? `• <span class="text-blue-700">${escapeHtml(m.status)}</span>` : ''}</div>
                   </div>
                 </div>`
            ).join('');
        }
    }

    // عرض الطلبة المتفوقين
    renderTopStudents(teacherId);
}

// استبدل الدالة renderTopStudents الحالية بالنسخة التالية

async function renderTopStudents(teacherId, limit = 4) {
    // دعم كلا الـ IDs في الـ HTML لضمان عدم فقدان العنصر
    const container = document.getElementById('top-students') || document.getElementById('top-students-list');
    if (!container) {
        console.warn('renderTopStudents: container not found (expected id "top-students" or "top-students-list")');
        return;
    }

    container.innerHTML = `<div class="text-sm text-gray-500 p-3">جاري تحميل الطلبة المتفوقين...</div>`;

    try {
        // جلب التقييمات مع بيانات التلميذ (يتعامل مع حالات عدم وجود علاقة)
        const { data: evals, error } = await supabase
            .from('student_evaluations')
            .select('student_id, final_score, evaluation_date, students(firstname, lastname)')
            .eq('teacher_id', teacherId)
            .not('final_score', 'is', null);

        if (error) throw error;

        if (!evals || evals.length === 0) {
            container.innerHTML = `<div class="text-sm text-gray-500 p-3">لا توجد تقييمات لحساب المتفوقين.</div>`;
            return;
        }

        // تجميع الدرجات لكل تلميذ
        const map = new Map();
        evals.forEach(e => {
            const id = e.student_id;
            if (!map.has(id)) {
                map.set(id, {
                    id,
                    firstname: e.students?.firstname || '',
                    lastname: e.students?.lastname || '',
                    scores: [],
                    lastDate: null
                });
            }
            const rec = map.get(id);
            if (e.final_score !== null && e.final_score !== undefined) {
                const n = Number(e.final_score);
                if (!Number.isNaN(n)) rec.scores.push(n);
            }
            if (e.evaluation_date) {
                const d = new Date(e.evaluation_date);
                if (!rec.lastDate || d > rec.lastDate) rec.lastDate = d;
            }
        });

        if (map.size === 0) {
            container.innerHTML = `<div class="text-sm text-gray-500 p-3">لا توجد بيانات درجات لعرضها.</div>`;
            return;
        }

        // حساب المتوسط والترتيب
        const arr = Array.from(map.values()).map(s => {
            const sum = s.scores.reduce((a, b) => a + b, 0);
            const avg = s.scores.length ? sum / s.scores.length : 0;
            return { ...s, avg, count: s.scores.length, lastDate: s.lastDate };
        }).sort((a, b) => b.avg - a.avg).slice(0, limit);

        // عرض النتائج بطريقة احترافية
        container.innerHTML = arr.map((s, idx) => {
            const avgText = s.count ? s.avg.toFixed(2) : '—';
            // احسب نسبة لشريط التقدم: نفترض مقياس 20 كحد أقصى (عدّل إذا مختلف)
            const pct = s.avg ? Math.min(100, Math.round((s.avg / 20) * 100)) : 0;
            const last = s.lastDate ? s.lastDate.toISOString().split('T')[0] : 'لا تقييمات';
            return `
              <div class="bg-white p-3 rounded shadow-sm">
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">${idx+1}</div>
                    <div>
                      <div class="font-semibold text-sm">${escapeHtml(s.firstname)} ${escapeHtml(s.lastname)}</div>
                      <div class="text-xs text-gray-500">${s.count} تقييم${s.count !== 1 ? 'ات' : ''} • ${escapeHtml(last)}</div>
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="text-lg font-bold text-indigo-700">${avgText}</div>
                    <div class="text-xs text-gray-500">متوسط</div>
                  </div>
                </div>

                <div class="w-full bg-gray-100 h-2 rounded overflow-hidden">
                  <div style="width:${pct}%" class="h-2 bg-indigo-500"></div>
                </div>
              </div>
            `;
        }).join('');

        if (arr.length === 0) {
            container.innerHTML = `<div class="text-sm text-gray-500 p-3">لا توجد نتائج لعرضها.</div>`;
        }

    } catch (err) {
        console.error('renderTopStudents error:', err);
        const msg = err?.message || (typeof err === 'string' ? err : 'غير معروف');
        container.innerHTML = `<div class="text-sm text-red-500 p-3">حدث خطأ أثناء جلب البيانات: ${escapeHtml(msg)}</div>`;
    }
}

// ensure escapeHtml exists or import/define at top of file
function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}