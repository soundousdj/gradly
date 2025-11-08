export async function renderDashboardStats(directorId) {
    if (!window.supabaseClient || !directorId) return;
    const { count: studentCount } = await window.supabaseClient
        .from('students')
        .select('*', { head: true, count: 'exact' })
        .eq('director_id', directorId);

    // جلب عدد المعلمين
    const { count: teacherCount } = await window.supabaseClient
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'teacher')
        .eq('director_id', directorId);


    // جلب عدد الاجتماعات
    const { count: meetingCount } = await window.supabaseClient
        .from('meetings')
        .select('*', { count: 'exact', head: true })
        .eq('director_id', directorId);

    // جلب عدد التقييمات
    const { count: evaluationCount } = await window.supabaseClient
        .from('evaluation_networks')
        .select('*', { count: 'exact', head: true })
        .eq('director_id', directorId);

    // جلب عدد الإناث والذكور
    const { data: students } = await window.supabaseClient
        .from('students')
        .select('gender')
        .eq('director_id', directorId);
        const femaleCount = students?.filter(s => s.gender === 'أنثى').length || 0;
        const maleCount = students?.filter(s => s.gender === 'ذكر').length || 0;

    // تحديث عناصر الداشبورد في الصفحة
    document.querySelector('.stat-card:nth-child(1) .stat-number').textContent = studentCount || 0;
    document.querySelector('.stat-card:nth-child(2) .stat-number').textContent = teacherCount || 0;
    document.querySelector('.stat-card:nth-child(3) .stat-number').textContent = evaluationCount || 0;
    document.querySelector('.stat-card:nth-child(4) .stat-number').textContent = meetingCount || 0;
    document.querySelector('.stat-card:nth-child(5) .stat-number').textContent = femaleCount || 0;
    document.querySelector('.stat-card:nth-child(6) .stat-number').textContent = maleCount || 0;
}

// ========== 2. عرض آخر النشاطات ==========
export async function renderRecentActivities(directorId) {
    if (!window.supabaseClient) return;
    const list = document.querySelector('.activity-list');
    if (!list) return;
    
    list.innerHTML = '<li>جاري تحميل النشاطات...</li>';

    try {
        let query = window.supabaseClient
            .from('activities')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        if (directorId) query = query.eq('director_id', directorId);

        const { data: activities, error } = await query;

        if (error) throw error;
        if (!activities || activities.length === 0) {
            list.innerHTML = '<li>لا توجد نشاطات لعرضها.</li>';
            return;
        }

        list.innerHTML = '';
        activities.forEach(activity => {
            let iconClass = 'fas fa-bell';
            if (activity.type === 'meeting') iconClass = 'fas fa-users';
            else if (activity.type === 'student') iconClass = 'fas fa-user-graduate';
            else if (activity.type === 'teacher') iconClass = 'fas fa-chalkboard-teacher';
            else if (activity.type === 'evaluation') iconClass = 'fas fa-star';

            list.innerHTML += `
                <li class="activity-item flex items-center gap-3 mb-4">
                    <div class="activity-icon text-xl text-blue-600">
                        <i class="${activity.icon || iconClass}"></i>
                    </div>
                    <div class="activity-details">
                        <p class="font-medium text-gray-800">${activity.description}</p>
                        <span class="activity-time text-xs text-gray-500 block mt-1">${timeAgo(activity.created_at)}</span>
                    </div>
                </li>
            `;
        });
    } catch (error) {
        console.error("Failed to load activities:", error.message);
        list.innerHTML = '<li>حدث خطأ في جلب النشاطات.</li>';
    }
}

// ========== 3. عرض الاجتماعات القادمة ==========
// أضفنا معلمة directorId واستخدمناها في الفلترة
export async function renderUpcomingMeetings(directorId) {
    if (!window.supabaseClient) return;
    const list = document.querySelector('.meeting-list');
    if (!list) return;

    list.innerHTML = '<li>جاري تحميل الاجتماعات...</li>';

    try {
        const today = new Date().toISOString().split('T')[0]; // تاريخ اليوم
        let query = window.supabaseClient
            .from('meetings')
            .select('subject, meeting_date, meeting_time')
            .gte('meeting_date', today)
            .order('meeting_date', { ascending: true })
            .order('meeting_time', { ascending: true })
            .limit(3);

        if (directorId) query = query.eq('director_id', directorId);

        const { data: meetings, error } = await query;

        if (error) throw error;

        if (!meetings || meetings.length === 0) {
            list.innerHTML = '<li>لا توجد اجتماعات قادمة.</li>';
            return;
        }

        list.innerHTML = '';
        meetings.forEach(meeting => {
            const date = new Date(meeting.meeting_date);
            const time = (meeting.meeting_time || '').substring(0, 5); // لعرض HH:MM
            list.innerHTML += `
                <li class="meeting-item">
                    <div class="meeting-date">
                        <span class="day">${date.getUTCDate()}</span>
                        <span class="month">${date.toLocaleString('ar', { month: 'short' })}</span>
                    </div>
                    <div class="meeting-details">
                        <h4>${meeting.subject}</h4>
                        <p>${time}</p>
                    </div>
                </li>
            `;
        });
    } catch (error) {
        console.error("Failed to load meetings:", error.message);
        list.innerHTML = '<li>حدث خطأ في جلب الاجتماعات.</li>';
    }
}

// ========== 4. عرض التلاميذ المتفوقين ==========
export async function renderTopStudents(directorId) {
    if (!window.supabaseClient || !directorId) return;
    const list = document.querySelector('.student-list');
    if(!list) return;

    list.innerHTML = '<li>جاري تحميل القائمة...</li>';

    try {
        // نعتمد على عمود "average" الذي أضفناه
        const { data: students, error } = await window.supabaseClient
            .from('students')
            .select('firstname, lastname, level, average, gender')
            .eq('director_id', directorId)
            .order('average', { ascending: false }) // الأعلى معدلاً أولاً
            .limit(4); // جلب أفضل 4

        if (error) throw error;
        
        if (!students || students.length === 0) {
            list.innerHTML = '<li>لا توجد بيانات كافية لعرض التلاميذ المتفوقين.</li>';
            return;
        }

        list.innerHTML = '';
        students.forEach((student, idx) => {
            // أيقونة مختلفة حسب الجنس
            const avatarIcon = student.gender === 'أنثى' ? 'fa-user-tie' : 'fa-user-graduate';
            list.innerHTML += `
                <li class="student-item">
                    <div class="student-rank">${idx + 1}</div>
                    <div class="student-avatar">
                        <i class="fas ${avatarIcon}"></i>
                    </div>
                    <div class="student-details">
                        <h4>${student.firstname} ${student.lastname}</h4>
                        <p>المستوى ${student.level || 'غير محدد'} - معدل: ${student.average ?? 0}%</p>
                    </div>
                    <div class="student-trend">
                        <i class="fas fa-arrow-up text-green-500"></i>
                    </div>
                </li>
            `;
        });
    } catch (error) {
        console.error("Failed to load top students:", error.message);
        list.innerHTML = '<li>حدث خطأ في جلب قائمة المتفوقين.</li>';
    }
}

// دالة مساعدة لحساب الوقت
function timeAgo(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'الآن';
    if (diff < 3600) return `منذ ${Math.floor(diff/60)} دقيقة`;
    if (diff < 86400) return `منذ ${Math.floor(diff/3600)} ساعة`;
    return `منذ ${Math.floor(diff/86400)} يوم`;
}
