// تحسين وظائف الترجمة والـ theme لتكون احترافية، تحافظ على الأيقونات، وتحدث الـ placeholders والـ aria labels

// استبدل/أدخل هذه الدوال في الملف (تحسين applyTranslations, applyTheme, toggleMode, getPreferredTheme)
function applyTranslations(lang) {
    document.documentElement.lang = lang;
    const isRTL = (lang === 'ar');
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    localStorage.setItem('lang', lang);

    const map = translations[lang] || {};

    document.querySelectorAll("[data-translate]").forEach(el => {
        const key = el.getAttribute("data-translate");
        const translated = map[key] || key;

        // تحديث placeholders, title, aria-label
        if (el.hasAttribute('placeholder')) el.setAttribute('placeholder', translated);
        if (el.hasAttribute('title')) el.setAttribute('title', translated);
        if (el.hasAttribute('aria-label')) el.setAttribute('aria-label', translated);

        // إذا لا يحتوي على عناصر داخلية نكتب النص بالكامل
        if (el.children.length === 0) {
            el.textContent = translated;
            return;
        }

        // حافظ على الأيقونات أو العناصر الداخلية، حدّث/أضف عنصر نصي منفصل
        let span = el.querySelector('.translated-text');
        if (!span) {
            span = document.createElement('span');
            span.className = 'translated-text';
            // ضع المسافة المناسبة حسب اتجاه الصفحة (CSS يمكنه التعامل أيضاً)
            span.style.marginInlineStart = '0.5rem';
            // إذا كان RTL نضع المسافة من الناحية المعاكسة
            if (isRTL) span.style.marginInlineEnd = '0.5rem';
            el.appendChild(span);
        }
        span.textContent = translated;
    });

    // تحديث عناصر ديناميكية أخرى إذا لزم
    document.getElementById('language-btn')?.setAttribute('aria-label', map['اللغة'] || 'اللغة');
}

function applyTheme(theme) {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    // CSS variables لتصميم احترافي قابل للتعديل
    if (theme === 'dark') {
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

    // انتقال ناعم
    root.style.transition = 'background-color 200ms ease, color 200ms ease, border-color 200ms ease';
}

// احفظ/استعد الثيم من LocalStorage
function getPreferredTheme() {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
}

function toggleMode() {
    const current = document.documentElement.getAttribute('data-theme') || getPreferredTheme();
    applyTheme(current === 'dark' ? 'light' : 'dark');
}

// init عند تحميل الصفحة
applyTheme(getPreferredTheme());
const savedLang = localStorage.getItem('lang') || document.documentElement.lang || 'ar';
applyTranslations(savedLang);