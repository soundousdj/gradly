// js/pages/meetings.js

// افتراض أن كائن supabase متاح عالميًا أو يتم استيراده
// import { supabase } from '../services/supabaseService.js';

// دالة بسيطة لعرض التنبيهات (Toast)
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`; // تحتاج لإضافة تنسيق CSS لهذه الفئات
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// دالة التهيئة الرئيسية لصفحة الاجتماعات
export async function initMeetingsPage() {
    // --- 1. الحصول على عناصر الواجهة ---
    const addMeetingBtn = document.getElementById('add-meeting-btn');
    const meetingModal = document.getElementById('meeting-modal');
    const closeModalBtn = document.getElementById('close-meeting-modal');
    const meetingForm = document.getElementById('meeting-form');
    const meetingsTableBody = document.getElementById('meetings-table-body');
    const modalTitle = document.getElementById('meeting-modal-title');
    const meetingIdInput = document.getElementById('meeting-id');
    const saveBtn = document.getElementById('save-meeting-btn');

    // عناصر الفلاتر
    const searchInput = document.getElementById('meeting-search-input');
    const statusFilter = document.getElementById('meeting-status-filter');
    const dateFilter = document.getElementById('meeting-date-filter');
    const participantSearchInput = document.getElementById('participant-search');
    const participantsDropdown = document.getElementById('participants-dropdown');
    const selectedPillsContainer = document.getElementById('selected-participants-pills');

    let allParticipants = []; // قائمة كل المشاركين (معلمين وأولياء)
    let selectedParticipants = new Set();

    // دالة إنشاء pill
    function createParticipantPill(id, name) {
        const pill = document.createElement('div');
        pill.className = 'participant-pill';
        pill.dataset.id = id;
        pill.innerHTML = `
            <span>${name}</span>
            <button type="button" class="remove-pill-btn">&times;</button>
        `;
        pill.querySelector('.remove-pill-btn').addEventListener('click', () => {
            selectedParticipants.delete(id);
            pill.remove();
            updateDropdownState();
        });
        return pill;
    }

    function updateDropdownState() {
        const items = participantsDropdown.querySelectorAll('.dropdown-item');
        items.forEach(item => {
            if (selectedParticipants.has(item.dataset.id)) {
                item.classList.add('disabled');
            } else {
                item.classList.remove('disabled');
            }
        });
    }

    function renderDropdown(participants) {
        if (participants.length === 0) {
            participantsDropdown.innerHTML = `<div class="p-2 text-gray-500">لا توجد نتائج.</div>`;
        } else {
            participantsDropdown.innerHTML = participants.map(p => `
                <div class="dropdown-item" data-id="${p.id}" data-name="${p.name}">
                    ${p.name} <span class="text-xs text-gray-400">(${p.type})</span>
                </div>
            `).join('');
        }
        updateDropdownState();
        participantsDropdown.classList.remove('hidden');

        participantsDropdown.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                if (item.classList.contains('disabled')) return;
                const id = item.dataset.id;
                const name = item.dataset.name;
                if (!selectedParticipants.has(id)) {
                    selectedParticipants.add(id);
                    const pill = createParticipantPill(id, name);
                    selectedPillsContainer.appendChild(pill);
                }
                participantSearchInput.value = '';
                participantsDropdown.classList.add('hidden');
                updateDropdownState();
            });
        });
    }

    // *** التعديل الأول: جلب المشاركين مع الـ UUID فقط ***
    async function populateAllParticipants() {
        try {
            const { data: teachers } = await window.supabaseClient.from('profiles').select('id, full_name').eq('role', 'teacher');
            const { data: parents } = await window.supabaseClient.from('profiles').select('id, full_name').eq('role', 'parent');
            allParticipants = [
                ...teachers.map(t => ({ id: t.id, name: `أ. ${t.full_name}`, type: 'معلم' })),
                ...parents.map(p => ({ id: p.id, name: p.full_name, type: 'ولي أمر' }))
            ];
        } catch (error) {
            showToast('فشل تحميل قائمة المشاركين', 'error');
        }
    }

    // --- 2. تعبئة القوائم المنسدلة ---
    async function populateParticipantsSelect() {
        const select = document.getElementById('meeting-participants');
        select.innerHTML = ''; // تفريغ الخيارات القديمة

        // إضافة خيار "لا أحد"
        select.innerHTML += `<option value="">لا أحد</option>`;

        try {
            // جلب الأساتذة
            const { data: teachers, error: teacherError } = await window.supabaseClient
                .from('profiles')
                .select('id, full_name')
                .eq('role', 'teacher').eq('director_id', window.currentDirectorId);
            if (teacherError) throw teacherError;
            teachers.forEach(t => {
                select.innerHTML += `<option value="teacher-${t.id}">أ. ${t.full_name}</option>`;
            });

            // جلب أولياء الأمور
            const { data: parents, error: parentError } = await window.supabaseClient
                .from('profiles')
                .select('id, full_name')
                .eq('role', 'parent').eq('director_id', window.currentDirectorId);
            if (parentError) throw parentError;
            parents.forEach(p => {
                select.innerHTML += `<option value="parent-${p.id}">ولي أمر: ${p.full_name}</option>`;
            });

        } catch (error) {
            console.error('Failed to populate participants:', error);
            showToast('فشل تحميل قائمة المشاركين', 'error');
        }
    }

    // --- 3. دوال عرض البيانات ---
    async function fetchAndRenderMeetings() {
        meetingsTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center">جاري تحميل الاجتماعات...</td></tr>`;

        try {
            let query = window.supabaseClient.from('meetings').select('*').eq('director_id', window.currentDirectorId).order('meeting_date', { ascending: false });
            if (statusFilter.value !== 'all') query = query.eq('status', statusFilter.value);
            if (dateFilter.value) query = query.eq('meeting_date', dateFilter.value);
            if (searchInput.value.trim()) query = query.ilike('subject', `%${searchInput.value.trim()}%`);
            const { data: meetings, error } = await query;
            if (error) throw error;

            // تحديث حالة الاجتماعات المنتهية
            const now = new Date();
            for (const meeting of meetings) {
                const meetingDateTime = new Date(`${meeting.meeting_date}T${meeting.meeting_time}`);
                if (meeting.status !== 'مكتمل' && meetingDateTime < now) {
                    await window.supabaseClient
                        .from('meetings')
                        .update({ status: 'مكتمل' })
                        .eq('id', meeting.id);
                    meeting.status = 'مكتمل';
                }
            }

            meetingsTableBody.innerHTML = '';
            if (meetings.length === 0) {
                meetingsTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-500">لا توجد اجتماعات تطابق البحث.</td></tr>`;
                return;
            }

            meetings.forEach(meeting => {
                // تحويل معرفات المشاركين إلى أسماء باستخدام allParticipants
                const names = (meeting.participants || []).map(participantId => {
                    const participant = allParticipants.find(p => p.id === participantId);
                    return participant ? participant.name : 'مشارك محذوف';
                }).filter(Boolean);

                let statusClass = 'bg-gray-200 text-gray-800';
                if (meeting.status === 'مكتمل') statusClass = 'bg-green-200 text-green-800';
                if (meeting.status === 'ملغى') statusClass = 'bg-red-200 text-red-800';

                const row = document.createElement('tr');
                row.className = 'hover:bg-gray-50 cursor-pointer';
                row.innerHTML = `
                    <td class="p-3 text-right font-semibold">${meeting.subject}</td>
                    <td class="p-3">${meeting.meeting_date} في ${meeting.meeting_time}</td>
                    <td class="p-3 text-sm">${names.join(', ')}</td>
                    <td class="p-3"><span class="px-2 py-1 ${statusClass} rounded-full text-xs">${meeting.status}</span></td>
                    <td class="p-3 flex justify-center gap-2">
                        <button title="تعديل الاجتماع" class="edit-btn text-yellow-600 hover:text-yellow-800" data-id="${meeting.id}"><i class="fas fa-edit"></i></button>
                        <button title="حذف الاجتماع" class="delete-btn text-red-600 hover:text-red-800" data-id="${meeting.id}"><i class="fas fa-trash-alt"></i></button>
                    </td>
                `;
                meetingsTableBody.appendChild(row);

                row.querySelector('.edit-btn').addEventListener('click', e => {
                    e.stopPropagation();
                    openModalForEdit(meeting.id);
                });
                row.querySelector('.delete-btn').addEventListener('click', e => {
                    e.stopPropagation();
                    handleDelete(meeting.id);
                });
                row.addEventListener('click', () => showMeetingDetailsModal(meeting, names));
            });
        } catch (error) {
            meetingsTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">حدث خطأ.</td></tr>`;
            showToast('فشل تحميل الاجتماعات', 'error');
        }
    }

    // --- 4. دوال التحكم بالنموذج (Modal) ---
    function openModalForCreate() {
        meetingForm.reset();
        meetingIdInput.value = '';
        selectedParticipants.clear();
        selectedPillsContainer.innerHTML = '';
        participantSearchInput.value = '';
        participantsDropdown.classList.add('hidden');
        modalTitle.textContent = 'جدولة اجتماع جديد';
        meetingModal.classList.remove('hidden');
    }

    // *** التعديل الثالث: فتح نافذة التعديل ***
    async function openModalForEdit(id) {
        openModalForCreate();
        try {
            const { data: meeting, error } = await window.supabaseClient.from('meetings').select('*').eq('id', id).single();
            if (error) throw error;
            meetingIdInput.value = meeting.id;
            document.getElementById('meeting-subject').value = meeting.subject;
            document.getElementById('meeting-date').value = meeting.meeting_date;
            document.getElementById('meeting-time').value = meeting.meeting_time;
            document.getElementById('meeting-description').value = meeting.description;
            document.getElementById('meeting-report').value = meeting.report;
            document.getElementById('meeting-status').value = meeting.status;
            if (meeting.participants && meeting.participants.length > 0) {
                meeting.participants.forEach(participantId => {
                    const participantData = allParticipants.find(p => p.id === participantId);
                    if (participantData) {
                        selectedParticipants.add(participantId);
                        const pill = createParticipantPill(participantId, participantData.name);
                        selectedPillsContainer.appendChild(pill);
                    }
                });
            }
            modalTitle.textContent = 'تعديل بيانات الاجتماع';
            meetingModal.classList.remove('hidden');
        } catch (error) {
            showToast('فشل في تحميل بيانات الاجتماع للتعديل', 'error');
        }
    }

    function closeModal() {
        meetingModal.classList.add('hidden');
    }

    // *** التعديل الرابع: الحفظ ***
    async function handleFormSubmit(event) {
        event.preventDefault();
        saveBtn.disabled = true;
        saveBtn.textContent = 'جاري الحفظ...';
        const meetingData = {
            subject: document.getElementById('meeting-subject').value,
            meeting_date: document.getElementById('meeting-date').value,
            meeting_time: document.getElementById('meeting-time').value,
            description: document.getElementById('meeting-description').value,
            report: document.getElementById('meeting-report').value,
            status: document.getElementById('meeting-status').value,
            participants: Array.from(selectedParticipants),
            director_id: window.currentDirectorId,
        };
        try {
            const meetingId = meetingIdInput.value;
            let error;
            if (meetingId) {
                const { error: updateError } = await window.supabaseClient.from('meetings').update(meetingData).eq('id', meetingId).eq('director_id', currentDirectorId);
                error = updateError;
            } else {
                const { error: insertError } = await window.supabaseClient.from('meetings').insert([meetingData]);
                error = insertError;
            }
            if (error) throw error;
            showToast(meetingId ? 'تم تحديث الاجتماع بنجاح' : 'تم جدولة الاجتماع بنجاح', 'success');
            closeModal();
            fetchAndRenderMeetings();
        } catch (error) {
            showToast(`فشل حفظ الاجتماع: ${error.message}`, 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'حفظ الاجتماع';
        }
    }

    async function handleDelete(id) {
        if (!confirm('هل أنت متأكد من حذف هذا الاجتماع؟ لا يمكن التراجع عن هذا الإجراء.')) return;

        try {
            const { error } = await window.supabaseClient.from('meetings').delete().eq('id', id);
            if (error) throw error;
            showToast('تم حذف الاجتماع بنجاح', 'success');
            fetchAndRenderMeetings();
        } catch (error) {
            console.error('Error deleting meeting:', error);
            showToast('فشل حذف الاجتماع', 'error');
        }
    }

    // --- 6. ربط الأحداث  بالواجهة ---
    addMeetingBtn.addEventListener('click', openModalForCreate);
    closeModalBtn.addEventListener('click', closeModal);
    meetingForm.addEventListener('submit', handleFormSubmit);

    // ربط الفلاتر
    searchInput.addEventListener('input', fetchAndRenderMeetings);
    statusFilter.addEventListener('change', fetchAndRenderMeetings);
    dateFilter.addEventListener('change', fetchAndRenderMeetings);

    // البحث في المشاركين
    participantSearchInput.addEventListener('input', () => {
        const searchTerm = participantSearchInput.value.toLowerCase();
        const filtered = allParticipants.filter(p => p.name.toLowerCase().includes(searchTerm));
        renderDropdown(filtered);
    });
    participantSearchInput.addEventListener('focus', () => {
        if (participantSearchInput.value.trim() === '') {
            renderDropdown(allParticipants);
        }
    });
    document.addEventListener('click', (e) => {
        if (!document.getElementById('participants-container').contains(e.target)) {
            participantsDropdown.classList.add('hidden');
        }
    });

    // --- 7. التشغيل الأولي ---
    await populateAllParticipants();
    await fetchAndRenderMeetings();
}

function showMeetingDetailsModal(meeting, teacherNames) {
    // أنشئ أو استخدم نافذة التفاصيل
    let detailsModal = document.getElementById('meeting-details-modal');
    if (!detailsModal) {
        detailsModal = document.createElement('div');
        detailsModal.id = 'meeting-details-modal';
        detailsModal.className = 'fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50';
        detailsModal.innerHTML = `
            <div class="bg-white rounded-lg p-6 w-full max-w-md relative">
                <button id="close-meeting-details" class="absolute top-2 left-2 text-gray-500 hover:text-red-600 text-xl">&times;</button>
                <h2 class="text-xl font-bold mb-4">تفاصيل الاجتماع</h2>
                <div id="meeting-details-content"></div>
            </div>
        `;
        document.body.appendChild(detailsModal);
    }
    detailsModal.querySelector('#meeting-details-content').innerHTML = `
        <p><strong>الموضوع:</strong> ${meeting.subject}</p>
        <p><strong>التاريخ:</strong> ${meeting.meeting_date}</p>
        <p><strong>الوقت:</strong> ${meeting.meeting_time}</p>
        <p><strong>الحالة:</strong> ${meeting.status}</p>
        <p><strong>الوصف:</strong> ${meeting.description || '-'}</p>
        <p><strong>التقرير:</strong> ${meeting.report || '-'}</p>
        <strong>المشاركون:</strong>
        <ul style="margin-top:8px;">
            ${teacherNames.length ? teacherNames.map(name => `<li style="margin-bottom:4px;">${name}</li>`).join('') : '<li>لا أحد</li>'}
        </ul>
    `;
    detailsModal.style.display = 'flex';
    detailsModal.querySelector('#close-meeting-details').onclick = () => {
        detailsModal.style.display = 'none';
    };
}