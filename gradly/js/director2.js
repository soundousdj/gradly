const translations = {
    ar: {
        "إدارة التلاميذ": "إدارة التلاميذ",
        "إضافة تلميذ": "إضافة تلميذ",
        "بحث": "بحث...",
        // أضف بقية الكلمات هنا
    },
    en: {
        "إدارة التلاميذ": "Students Management",
        "إضافة تلميذ": "Add Student",
        "بحث": "Search...",
    }
};
/**
 * UI & App Configuration Manager
 * هذا الملف يدير الترجمة، الوضع الليلي، والتعامل مع أخطاء قاعدة البيانات
 */

const UI = {
    // 1. وظائف الترجمة (حفظ الأيقونات وتحديث النصوص)
    applyTranslations: function(lang) {
        document.documentElement.lang = lang;
        const isRTL = (lang === 'ar');
        document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
        localStorage.setItem('lang', lang);

        // تأكد من وجود قاموس الترجمة لتجنب الأخطاء
        const map = (typeof translations !== 'undefined') ? translations[lang] : {};

        document.querySelectorAll("[data-translate]").forEach(el => {
            const key = el.getAttribute("data-translate");
            const translated = map[key] || key;

            // تحديث النوافذ المنبثقة والوصف
            if (el.hasAttribute('placeholder')) el.setAttribute('placeholder', translated);
            if (el.hasAttribute('title')) el.setAttribute('title', translated);
            if (el.hasAttribute('aria-label')) el.setAttribute('aria-label', translated);

            // إذا كان العنصر نصياً فقط
            if (el.children.length === 0) {
                el.textContent = translated;
                return;
            }

            // إذا كان يحتوي على أيقونات (حافظ عليها وحدد النص فقط)
            let span = el.querySelector('.translated-text');
            if (!span) {
                span = document.createElement('span');
                span.className = 'translated-text';
                span.style.marginInlineStart = '0.5rem';
                el.appendChild(span);
            }
            span.textContent = translated;
        });

        // تحديث نص زر اللغة إذا وُجد
        const langBtn = document.getElementById('language-btn');
        if (langBtn) langBtn.setAttribute('aria-label', map['اللغة'] || 'اللغة');
    },

    // 2. وظائف الثيم (الوضع الليلي والعادي)
    applyTheme: function(theme) {
        const root = document.documentElement;
        root.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);

        // إعداد متغيرات CSS للثيم
        if (theme === 'light') {
            root.style.setProperty('--bg', '#0b1020');
            root.style.setProperty('--surface', '#0f1724');
            root.style.setProperty('--muted', '#9aa4b2');
            root.style.setProperty('--text', '#e6eef8');
            root.style.setProperty('--accent', '#3b82f6');
            root.style.setProperty('--card-shadow', 'rgba(2,6,23,0.6)');
            document.body.classList.add('dark-mode');
        } else {
            root.style.setProperty('--bg', '#ffffff');
            root.style.setProperty('--surface', '#ffffff');
            root.style.setProperty('--muted', '#6b7280');
            root.style.setProperty('--text', '#0f1724');
            root.style.setProperty('--accent', '#2563eb');
            root.style.setProperty('--card-shadow', 'rgba(15,23,42,0.06)');
            document.body.classList.remove('dark-mode');
        }

        root.style.transition = 'background-color 200ms ease, color 200ms ease';
    },

    getPreferredTheme: function() {
        const saved = localStorage.getItem('theme');
        if (saved) return saved;
        return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    },

    toggleMode: function() {
        const current = document.documentElement.getAttribute('data-theme') || this.getPreferredTheme();
        this.applyTheme(current === 'dark' ? 'light' : 'dark');
    },

    // 3. وظائف الإشعارات والتعامل مع قاعدة البيانات (مهمة لملف students.js)
    showToast: function(message, type = 'info') {
        // يمكنك استبدال alert بـ SweetAlert أو أي مكتبة أخرى لاحقاً
        alert(`${type.toUpperCase()}: ${message}`);
    },

    // دالة لجلب البيانات وحذفها بأمان من سوبا بيز
    safeFetch: async function(callback) {
        try {
            const response = await callback();
            if (response && response.error) throw response.error;
            return response ? response.data : null;
        } catch (err) {
            console.error("Database Error:", err);
            this.showToast(err.message || "حدث خطأ أثناء الاتصال بقاعدة البيانات", "error");
            throw err;
        }
    }
};

// 4. التهيئة عند تحميل الصفحة (Initialization)
document.addEventListener('DOMContentLoaded', () => {
    // تشغيل الثيم
    UI.applyTheme(UI.getPreferredTheme());
    
    // تشغيل اللغة
    const savedLang = localStorage.getItem('lang') || document.documentElement.lang || 'ar';
    UI.applyTranslations(savedLang);

    // ربط زر تبديل الوضع إذا وُجد في الصفحة
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => UI.toggleMode());
    }
});

// جعل الكائن متاحاً لجميع ملفات المشروع الأخرى
window.UI = UI;