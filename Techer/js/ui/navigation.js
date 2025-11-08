// js/ui/navigation.js (النسخة الكاملة والصحيحة)

let pageLoaderCallback = null;

/**
 * إعداد أحداث النقر على القائمة الجانبية.
 * @param {function} loader - الدالة التي سيتم استدعاؤها لتحميل بيانات الصفحة.
 */
export function setupNavigation(loader) {
    pageLoaderCallback = loader; // تخزين الدالة

    document.querySelectorAll('.sidebar-menu li').forEach(item => {
        // إزالة أي مستمعي أحداث قدامى لمنع التكرار
        item.replaceWith(item.cloneNode(true));
    });
    
    // إضافة مستمعي الأحداث الجدد
    document.querySelectorAll('.sidebar-menu li').forEach(item => {
        item.addEventListener('click', function() {
            navigateToPage(this.dataset.page);
        });
    });
}

/**
 * الانتقال إلى صفحة محددة وتفعيلها.
 * @param {string} pageId - معرف الصفحة (ID).
 */
export function navigateToPage(pageId) {
    // إخفاء جميع الصفحات (نستخدم نفس صنف المخفي في HTML)
    document.querySelectorAll('.content-area, .tab-content').forEach(area => area.classList.add('hidden'));
    
    // إظهار الصفحة المطلوبة
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.remove('hidden');
    }

    // تحديث الحالة النشطة في القائمة الجانبية
    document.querySelectorAll('.sidebar-menu li').forEach(li => {
        li.classList.remove('active');
        if (li.dataset.page === pageId) {
            li.classList.add('active');
        }
    });

    // استدعاء دالة تحميل البيانات إذا كانت موجودة
    if (pageLoaderCallback) {
        pageLoaderCallback(pageId);
    }
}