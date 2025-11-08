// login_page.js - النسخة النهائية المصححة 100%

// =================================================================
// ==              I. التهيئة الأولية والمتغيرات العامة           ==
// =================================================================
const { createClient } = supabase;
const SUPABASE_URL = 'https://rrkesmaombznchqhtvqh.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJya2VzbWFvbWJ6bmNocWh0dnFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3ODE1NjUsImV4cCI6MjA2ODM1NzU2NX0.VBD-XmhhgcbXaMB7IqvfABsf4yt6q4SdLZYxrj5Pv_4';
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// =================================================================
// ==         II. النقطة الرئيسية لتشغيل الصفحة                  ==
// =================================================================
document.addEventListener("DOMContentLoaded", () => {
    checkIfAlreadyLoggedIn();
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
});

// =================================================================
// ==         III. الدوال الأساسية لعملية تسجيل الدخول            ==
// =================================================================

async function handleLogin(event) {
    event.preventDefault();
    const emailInput = document.getElementById('username').value.trim();
    const passwordInput = document.getElementById('password').value.trim();
    const errorElement = document.getElementById('errorBox');
    const loginButton = event.target.querySelector('button[type="submit"]');

    loginButton.disabled = true;
    loginButton.textContent = 'جاري التحقق...';
    errorElement.style.display = 'none';

    try {
        const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
            email: emailInput,
            password: passwordInput
        });
        if (authError) throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
        
        const userId = authData.user.id;

        // جلب current_role من profiles
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('current_role')
            .eq('id', userId)
            .single();

        if (profileError) throw new Error('لا يمكن جلب ملف المستخدم.');

        let selectedRole = profile.current_role;

        // إذا لم يكن هناك دور حالي، اختر أول دور متاح وحدثه في قاعدة البيانات
        if (!selectedRole) {
            const { data: userRoles, error: rolesError } = await supabaseClient
                .from('user_roles')
                .select('roles(role_name)')
                .eq('user_id', userId);

            if (rolesError || !userRoles || userRoles.length === 0) {
                await supabaseClient.auth.signOut();
                throw new Error('لم يتم تعيين أي دور لهذا المستخدم.');
            }

            selectedRole = userRoles[0].roles.role_name;

            await supabaseClient
                .from('profiles')
                .update({ current_role: selectedRole })
                .eq('id', userId);
        }

        redirectToRolePage(selectedRole);

    } catch (err) {
        showError(err.message);
    } finally {
        loginButton.disabled = false;
        loginButton.textContent = 'دخول';
    }
}

async function checkIfAlreadyLoggedIn() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('current_role')
            .eq('id', session.user.id)
            .single();

        if (profile && profile.current_role) {
            redirectToRolePage(profile.current_role);
        }
    }
}

function redirectToRolePage(role) {
    if (role === 'admin' || role === 'director') {
        window.location.href = 'gradly/director.html';
    } else if (role === 'teacher') {
        window.location.href = 'Techer/teacher.html';
    } else if (role === 'parent') {
        window.location.href = 'parent/index.html';
    } else {
        showError("دورك غير مدعوم في النظام. لا يمكنك الدخول.");
        supabaseClient.auth.signOut();
    }
}

function showError(message) {
    const errorElement = document.getElementById('errorBox');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
}

// =================================================================
// ==         IV. الدوال الأساسية لعملية تسجيل المستخدمين         ==
// =================================================================

async function handleSignUp(event) {
    event.preventDefault();
    const emailInput = document.getElementById('username').value.trim();
    const passwordInput = document.getElementById('password').value.trim();
    const errorElement = document.getElementById('errorBox');
    const signUpButton = event.target.querySelector('button[type="submit"]');

    signUpButton.disabled = true;
    signUpButton.textContent = 'جاري التحقق...';
    errorElement.style.display = 'none';

    try {
        // [1] محاولة تسجيل الدخول
        const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
            email: emailInput,
            password: passwordInput
        });
        if (authError) throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة.');

        // [2] جلب كل أدوار المستخدم من user_roles
        const { data: userRoles, error: rolesError } = await supabaseClient
            .from('user_roles')
            .select('roles(role_name)')
            .eq('user_id', authData.user.id);

        if (rolesError || !userRoles || userRoles.length === 0) {
            await supabaseClient.auth.signOut();
            throw new Error('لم يتم العثور على أدوار للمستخدم. يرجى مراجعة المدير.');
        }
        
        // [3] إذا كان للمستخدم أكثر من دور، اعرض له اختيار الدور
        let selectedRole = localStorage.getItem('currentRole') || userRoles[0].roles.role_name;
        if (!userRoles.some(r => r.roles.role_name === selectedRole)) {
            selectedRole = userRoles[0].roles.role_name;
        }
        localStorage.setItem('currentRole', selectedRole);

        // [4] توجيه المستخدم حسب الدور المختار
        redirectToRolePage(selectedRole);

    } catch (err) {
        showError(err.message);
    } finally {
        signUpButton.disabled = false;
        signUpButton.textContent = 'تسجيل';
    }
}

async function handleSignUpWithGoogle(event) {
    event.preventDefault();
    const errorElement = document.getElementById('errorBox');
    const signUpButton = event.target.querySelector('button[type="submit"]');

    signUpButton.disabled = true;
    signUpButton.textContent = 'جاري التحقق...';
    errorElement.style.display = 'none';

    try {
        // [1] محاولة تسجيل الدخول
        const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
            email: "test@example.com",
            password: "yourStrongPassword"
        });
        if (authError) throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة.');

        // [2] جلب كل أدوار المستخدم من user_roles
        const { data: userRoles, error: rolesError } = await supabaseClient
            .from('user_roles')
            .select('roles(role_name)')
            .eq('user_id', authData.user.id);

        if (rolesError || !userRoles || userRoles.length === 0) {
            await supabaseClient.auth.signOut();
            throw new Error('لم يتم العثور على أدوار للمستخدم. يرجى مراجعة المدير.');
        }
        
        // [3] إذا كان للمستخدم أكثر من دور، اعرض له اختيار الدور
        let selectedRole = localStorage.getItem('currentRole') || userRoles[0].roles.role_name;
        if (!userRoles.some(r => r.roles.role_name === selectedRole)) {
            selectedRole = userRoles[0].roles.role_name;
        }
        localStorage.setItem('currentRole', selectedRole);

        // [4] توجيه المستخدم حسب الدور المختار
        redirectToRolePage(selectedRole);

    } catch (err) {
        showError(err.message);
    } finally {
        signUpButton.disabled = false;
        signUpButton.textContent = 'تسجيل';
    }
}