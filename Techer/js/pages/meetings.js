// js/pages/meetings.js (النسخة النهائية والصحيحة للمعلم)

import { supabase } from '../supabaseClient.js';

// نافذة منبثقة لعرض تفاصيل الاجتماع
function showMeetingModal(meeting) {
    // أنشئ عنصر للنافذة إذا لم يكن موجوداً
    let modal = document.getElementById('meeting-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'meeting-modal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50';
        modal.innerHTML = `<div id="meeting-modal-content"></div>`;
        document.body.appendChild(modal);
    }
    // تعبئة تفاصيل الاجتماع
    document.getElementById('meeting-modal-content').innerHTML = `
        <div class="bg-white rounded-lg shadow-lg p-6 w-full max-w-md relative">
            <button onclick="closeMeetingModal()" class="absolute top-2 left-2 text-gray-400 hover:text-red-500 text-xl">&times;</button>
            <h2 class="font-bold text-xl mb-2 text-indigo-700">${meeting.subject}</h2>
            <div class="mb-2"><strong>التاريخ:</strong> ${meeting.meeting_date}</div>
            <div class="mb-2"><strong>الوقت:</strong> ${meeting.meeting_time}</div>
            <div class="mb-2"><strong>الحالة:</strong> ${meeting.status}</div>
            <div class="mb-2"><strong>الوصف:</strong> ${meeting.description || '-'}</div>
            <div class="mb-2"><strong>التقرير:</strong> ${meeting.report || '-'}</div>
        </div>
    `;
    modal.style.display = 'flex';
}

// دالة إغلاق النافذة
window.closeMeetingModal = function() {
    const modal = document.getElementById('meeting-modal');
    if (modal) modal.style.display = 'none';
};

export async function initMeetingsPage(teacherId) {
    const meetingsListDiv = document.getElementById('meetings-list');
    if (!meetingsListDiv) return;

    meetingsListDiv.innerHTML = `<p class="text-center p-4">جاري تحميل الاجتماعات...</p>`;

    // استعلام لجلب الاجتماعات التي تحتوي على ID المعلم في مصفوفة المشاركين
    const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .contains('participants', [teacherId]) // هذا هو الاستعلام الصحيح للبحث في مصفوفة
        .order('meeting_date', { ascending: false });

    if (error) {
        console.error("Error fetching meetings:", error);
        meetingsListDiv.innerHTML = `<p class="text-red-500 text-center p-4">فشل تحميل الاجتماعات. تحقق من Console.</p>`;
        return;
    }

    if (!data || data.length === 0) {
        meetingsListDiv.innerHTML = `<p class="text-gray-500 text-center p-4">لا توجد اجتماعات مجدولة لك.</p>`;
        return;
    }
    
    // بناء جدول الاجتماعات مع إمكانية النقر على الصف
    const tableHTML = `
        <div class="overflow-x-auto bg-white rounded shadow">
            <table class="w-full text-center">
                <thead class="bg-gray-100">
                    <tr>
                        <th class="p-3 text-right">الموضوع</th>
                        <th class="p-3">التاريخ</th>
                        <th class="p-3">الوقت</th>
                        <th class="p-3">الحالة</th>
                        <th class="p-3 text-right">الوصف</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(meeting => {
                        // تحديد لون الحالة
                        let statusClass = 'bg-gray-200 text-gray-800';
                        if (meeting.status === 'مكتمل') statusClass = 'bg-green-200 text-green-800';
                        if (meeting.status === 'ملغى') statusClass = 'bg-red-200 text-red-800';

                        // عند الضغط على الصف تظهر نافذة التفاصيل
                        return `
                            <tr class="border-b hover:bg-gray-50 cursor-pointer"
                                onclick='window.showMeetingModal(${JSON.stringify(meeting)})'>
                                <td class="p-2 text-right font-semibold">${meeting.subject}</td>
                                <td class="p-2">${meeting.meeting_date}</td>
                                <td class="p-2">${meeting.meeting_time}</td>
                                <td class="p-2">
                                    <span class="px-2 py-1 ${statusClass} rounded-full text-xs">${meeting.status}</span>
                                </td>
                                <td class="p-2 text-right text-sm text-gray-600">${meeting.description || '-'}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    meetingsListDiv.innerHTML = tableHTML;

    // ربط الدالة في النافذة العالمية
    window.showMeetingModal = showMeetingModal;
}