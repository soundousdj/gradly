// js/pages/reports.js

// افتراض أن كائن supabase ومكتبات (Chart.js, jsPDF, XLSX) متاحة عالميًا
// أو يتم استيرادها

// --- 1. تعريف المتغيرات العامة للوحدة ---
let reportChart = null; // لتخزين كائن المخطط البياني لتدميره عند إعادة التوليد
let currentReportData = []; // لتخزين بيانات التقرير الحالي للتصدير
let currentReportHeaders = []; // لتخزين عناوين التقرير الحالي
let currentReportTitle = ""; // لتخزين عنوان التقرير الحالي

// --- 2. دوال جلب البيانا ت من Supabase ---

async function getScopeOptions(reportType) {
    let options = '';
    try {
        const directorId = window.currentDirectorId;
        if (!directorId) return '<option value="">-- يجب تسجيل الدخول كمدير --</option>';

        if (reportType === 'academic' || reportType === 'attendance') {
            options += '<option value="all_students">كل التلاميذ</option>';
            const { data: groups, error: groupError } = await window.supabaseClient
                .from('class_groups')
                .select('id, name')
                .eq('director_id', directorId);
            if (groupError) throw groupError;
            (groups || []).forEach(g => {
                options += `<option value="group-${g.id}">الفوج: ${g.name}</option>`;
            });

            const { data: students, error: studentError } = await window.supabaseClient
                .from('students')
                .select('id, firstname, lastname')
                .eq('director_id', directorId);
            if (studentError) throw studentError;
            (students || []).forEach(s => {
                options += `<option value="student-${s.id}">التلميذ: ${s.firstname} ${s.lastname}</option>`;
            });
 
        } else if (reportType === 'teacher_eval') {
            options += '<option value="all_teachers">كل المعلمين</option>';
            const { data: teachers, error } = await window.supabaseClient
                .from('profiles')
                .select('id, full_name')
                .eq('role', 'teacher')
                .eq('director_id', directorId);
            if (error) throw error;
            (teachers || []).forEach(t => {
                options += `<option value="teacher-${t.id}">المعلم: ${t.full_name}</option>`;
            });
        }
    } catch (error) {
        console.error('Failed to populate scope select:', error.message || error);
        return '<option value="">-- خطأ في التحميل --</option>';
    }
    return options;
}

// --- 3. دوال توليد وعرض التقارير ---

// هذه دالة وهمية، استبدلها بمنطق جلب البيانات الفعلي من جداولك
async function fetchAcademicData(scope) {
    try {
        const directorId = window.currentDirectorId;
        if (!directorId) {
            console.warn('currentDirectorId غير معرف، لا يمكن جلب التقرير.');
            return [];
        }

        // حصر التلاميذ المرتبطين بالمدير
        const { data: directorStudents, error: stuErr } = await window.supabaseClient
            .from('students')
            .select('id')
            .eq('director_id', directorId);
        if (stuErr) throw stuErr;
        const studentIds = (directorStudents || []).map(s => s.id);
        if (studentIds.length === 0) return [];

        // لو تم اختيار فوج محدد، تأكد أنه يخص المدير ثم فلتر حسب الفوج
        let query = window.supabaseClient
            .from('grades')
            .select(`id, grade, date, student:student_id (id, firstname, lastname), subject:subject_id (id, name), group:group_id (id, name)`);

        if (scope && scope.startsWith('group-')) {
            const groupId = scope.replace('group-', '');
            // تحقق أن الفوج يخص المدير
            const { data: group, error: gErr } = await window.supabaseClient
                .from('class_groups')
                .select('id')
                .eq('id', groupId)
                .eq('director_id', directorId)
                .single();
            if (gErr || !group) return []; // لا تسمح بالوصول لفوج غير مملوك
            query = query.eq('group_id', groupId).in('student_id', studentIds);
        } else if (scope && scope.startsWith('student-')) {
            const studentId = parseInt(scope.replace('student-', ''), 10);
            if (!studentIds.includes(studentId)) return []; // منع الوصول لتلميذ خارج المدير
            query = query.eq('student_id', studentId);
        } else {
            // كل التلاميذ: حصر بالمعرفات المملوكة للمدير
            query = query.in('student_id', studentIds);
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(row => ({
            student_name: row.student ? `${row.student.firstname} ${row.student.lastname}` : '',
            subject: row.subject ? row.subject.name : '',
            grade: row.grade,
            date: row.date ? (row.date.split ? row.date.split('T')[0] : row.date) : ''
        }));
    } catch (error) {
        console.error('خطأ في جلب بيانات الأداء الأكاديمي:', error.message || error);
        return [];
    }
}

function displayReport(title, headers, data) {
    const reportDisplayContainer = document.getElementById('report-display-container');
    const reportTitleEl = document.getElementById('report-title');
    const reportOutput = document.getElementById('report-output');

    reportTitleEl.textContent = title;
    
    // إنشاء الجدول
    let tableHTML = `<table class="report-table w-full text-center"><thead><tr>`;
    headers.forEach(h => tableHTML += `<th class="p-2 bg-gray-100">${h}</th>`);
    tableHTML += `</tr></thead><tbody>`;
    data.forEach(row => {
        tableHTML += `<tr>`;
        Object.values(row).forEach(val => {
           tableHTML += `<td class="p-2 border-b">${val || ''}</td>`;
        });
        tableHTML += `</tr>`;
    });
    tableHTML += `</tbody></table>`;
    reportOutput.innerHTML = tableHTML;

    // تدمير المخطط القديم إن وجد
    if (reportChart) {
        reportChart.destroy();
    }

    // عرض المخطط البياني
    const ctx = document.getElementById('report-chart').getContext('2d');
    const labels = data.map(d => `${d.student_name} (${d.subject})`);
    const grades = data.map(d => d.grade);
    reportChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'الدرجات',
                data: grades,
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: { scales: { y: { beginAtZero: true, max: 100 } } }
    });

    reportDisplayContainer.classList.remove('hidden');
}


// --- 4. دوال التصدير ---

function exportToPDF() {
    if (currentReportData.length === 0) return alert("لا يوجد تقرير لتصديره.");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // ملاحظة: لدعم العربية بشكل صحيح، ستحتاج لإضافة خط. هذا مثال مبسط.
    doc.text(currentReportTitle, 10, 10);
    doc.autoTable({ html: '.report-table', startY: 20 });
    doc.save(`${currentReportTitle}.pdf`);
}

function exportToExcel() {
    if (currentReportData.length === 0) return alert("لا يوجد تقرير لتصديره.");
    const ws = XLSX.utils.json_to_sheet(currentReportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${currentReportTitle}.xlsx`);
}

// --- 5. دالة التهيئة الرئيسية ---

export async function initReportsPage() {
    // --- الحصول على عناصر الواجهة ---
    const typeSelect = document.getElementById('report-type-select');
    const scopeSelect = document.getElementById('report-scope-select');
    const generateBtn = document.getElementById('generate-report-btn');
    const exportPdfBtn = document.getElementById('export-pdf-btn');
    const exportExcelBtn = document.getElementById('export-excel-btn');

    // منع التشغيل إذا لم يُحدد مدير
    if (!window.currentDirectorId) {
        const container = document.getElementById('report-display-container');
        if (container) {
            container.classList.remove('hidden');
            container.innerHTML = '<div class="p-4 text-red-600">يجب تسجيل الدخول كمدير لعرض تقارير خاصة به.</div>';
        }
        return;
    }

    // --- ربط الأحداث ---
    typeSelect.onchange = async function() {
        scopeSelect.innerHTML = '<option value="">-- جاري تحميل النطاقات --</option>';
        scopeSelect.disabled = true;
        
        const optionsHTML = await getScopeOptions(this.value);
        scopeSelect.innerHTML = optionsHTML;
        scopeSelect.disabled = false;
    };

    generateBtn.onclick = async function() {
        this.disabled = true;
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التوليد...';

        const reportType = typeSelect.value;
        const scope = scopeSelect.value;
        
        // إعادة تعيين المتغيرات العامة
        currentReportData = [];
        currentReportHeaders = [];
        currentReportTitle = "تقرير";

        if (reportType === 'academic') {
            currentReportTitle = `تقرير الأداء الأكاديمي لـِ (${scopeSelect.options[scopeSelect.selectedIndex].text})`;
            currentReportHeaders = ['التلميذ', 'المادة', 'الدرجة', 'تاريخ التقييم'];
            currentReportData = await fetchAcademicData(scope);
        }
        // أضف الشروط الأخرى لأنواع التقارير هنا (attendance, teacher_eval)
        
        displayReport(currentReportTitle, currentReportHeaders, currentReportData);

        this.disabled = false;
        this.innerHTML = '<i class="fas fa-cogs"></i> توليد التقرير';
    };

    exportPdfBtn.onclick = exportToPDF;
    exportExcelBtn.onclick = exportToExcel;

    // --- التشغيل الأولي ---
    typeSelect.dispatchEvent(new Event('change')); // تفعيل تحميل النطاق للتقرير الافتراضي
}