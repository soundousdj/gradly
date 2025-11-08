// js/pages/evaluation.js

// --- 1. تعريف المتغيرات  العامة للوحدة ---
let currentCriteria = []; // لتخزين المعايير المadded حاليًا في النافذة
let editingNetworkId = null; // لتحديد ما إذا كنا في وضع الإضافة أو التعديل
let isEvaluationPageInitialized = false; // لمنع إعادة ربط الأحداث

// --- 2. دوال التعامل مع Supabase (CRUD) ---

/**
 * دالة لجلب كل الشبكات والمعايير المرتبطة بها من Supabase
 */
async function fetchAndRenderNetworks() {
    const networksDisplay = document.getElementById('networks-display');
    networksDisplay.innerHTML = '<p class="text-center text-gray-500 mt-4">جاري تحميل الشبكات...</p>';

    try {
         // نجلب الشبكات مع المعايير الخاصة بها في استعلام واحد متداخل
        const { data: networks, error } = await window.supabaseClient
            .from('evaluation_networks')
            .select(`*,
                academic_years(name),
                levels(name),
                subjects(name),
                network_criteria(id, criteria_text)
            `)
            .eq('director_id', window.currentDirectorId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        renderAllNetworks(networks);

    } catch (err) {
        console.error("❌ خطأ في جلب الشبكات:", err.message);
        networksDisplay.innerHTML = '<p class="text-red-500 text-center">فشل تحميل البيانات. تحقق من الكونسول.</p>';
    }
}

/**
 * دالة لحذف شبكة من قاعدة البيانات
 */
async function handleDeleteNetwork(networkId) {
    if (!confirm('هل أنت متأكد من حذف هذه الشبكة؟ سيتم حذف جميع معاييرها أيضًا.')) return;
    
    try {
        // Supabase سيقوم بحذف المعايير المرتبطة تلقائيًا إذا تم إعداد 'ON DELETE CASCADE'
        const { error } = await window.supabaseClient
            .from('evaluation_networks')
            .delete()
            .eq('id', networkId);

        if (error) throw error;
        
        alert('✅ تم حذف الشبكة بنجاح.');
        await fetchAndRenderNetworks(); // إعادة تحميل القائمة

    } catch (err) {
        console.error("❌ خطأ في حذف الشبكة:", err.message);
        alert('فشل حذف الشبكة.');
    }
}


// --- 3. دوال عرض الواجهة والمساعدة ---

/**
 * عرض المعايير الحالية داخل النافذة المنبثقة
 */
function renderCurrentCriteria() {
    const criteriaList = document.getElementById('criteria-list');
    criteriaList.innerHTML = '';
    if (currentCriteria.length === 0) {
        criteriaList.innerHTML = '<li class="text-gray-500">لم تتم إضافة معايير بعد.</li>';
    } else {
        currentCriteria.forEach((criteriaText, index) => {
            const li = document.createElement('li');
            li.textContent = criteriaText;
            // إضافة زر حذف صغير بجانب كل معيار
            li.innerHTML += ` <button type="button" class="text-red-500 hover:text-red-700 ml-2" data-index="${index}">×</button>`;
            criteriaList.appendChild(li);
        });
        // ربط حدث الحذف للمعايير
        criteriaList.querySelectorAll('button').forEach(btn => {
            btn.onclick = (e) => {
                const indexToRemove = parseInt(e.target.dataset.index);
                currentCriteria.splice(indexToRemove, 1);
                renderCurrentCriteria();
            };
        });
    }
}

/**
 * دالة مساعدة لتجميع الشبكات في هيكل هرمي: السنة -> المستوى -> [الشبكات]
 */
function groupNetworksByYearAndLevel(networks) {
    return networks.reduce((acc, network) => {
        // استخدم أسماء السنة والمستوى من العلاقات (وليس النصوص القديمة)
        const year = network.academic_years?.name || 'سنوات غير محددة';
        const level = network.levels?.name || 'مستويات غير محددة';

        if (!acc[year]) acc[year] = {};
        if (!acc[year][level]) acc[year][level] = [];
        acc[year][level].push(network);
        return acc;
    }, {});
}

/**
 * عرض جميع الشبكات المحفوظة بشكل هرمي (سنة -> مستوى -> بطاقات)
 */
function renderAllNetworks(networks) {
    const networksDisplay = document.getElementById('networks-display');
    networksDisplay.innerHTML = '';

    if (!networks || networks.length === 0) {
        networksDisplay.innerHTML = '<p class="text-center text-gray-500 mt-4">لا توجد شبكات تقييم تطابق الفلاتر الحالية.</p>';
        return;
    }

    // 1. تجميع البيانات في هيكل منظم
    const groupedData = groupNetworksByYearAndLevel(networks);

    // 2. عرض البيانات المجمعة
    const sortedYears = Object.keys(groupedData).sort().reverse();

    for (const year of sortedYears) {
        const levels = groupedData[year];
        const yearElement = document.createElement('details');
        yearElement.className = 'year-group';
        yearElement.open = true;

        yearElement.innerHTML = `<summary>${year}</summary>`;
        const levelsContainer = document.createElement('div');
        levelsContainer.className = 'levels-container';

        const sortedLevels = Object.keys(levels).sort();

        for (const level of sortedLevels) {
            const networkList = levels[level];
            const levelElement = document.createElement('details');
            levelElement.className = 'level-group';
            levelElement.open = true;

            levelElement.innerHTML = `<summary>${level} (${networkList.length} شبكة)</summary>`;

            const cardsContainer = document.createElement('div');
            cardsContainer.className = 'network-cards-container';

            networkList.forEach(network => {
                const networkCard = document.createElement('div');
                networkCard.className = 'network-card bg-white p-4 rounded shadow-md border-l-4 border-blue-500';

                const criteriaHtml = network.network_criteria.map(c => `<li>${c.criteria_text}</li>`).join('');

                networkCard.innerHTML = `
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="font-bold text-lg text-blue-800">${network.subjects?.name || 'مادة غير مسماة'} - ${network.activity_name || 'نشاط غير مسمى'}</h4>
                        </div>
                        <div class="flex gap-2">
                            <button class="edit-btn text-blue-600 hover:text-blue-800" title="تعديل" data-id="${network.id}">✏️</button>
                            <button class="delete-btn text-red-600 hover:text-red-800" title="حذف" data-id="${network.id}">🗑️</button>
                        </div>
                    </div>
                    <div class="mt-2 text-sm space-y-1">
                        <p><strong>ختامية:</strong> ${network.competency_final}</p>
                        <p><strong>مرحلية:</strong> ${network.competency_stage}</p>
                        <p class="font-bold mt-2">المعايير:</p>
                        <ul class="list-disc list-inside pr-4">${criteriaHtml || '<li>لا توجد معايير.</li>'}</ul>
                    </div>
                `;
                networkCard.querySelector('.edit-btn').addEventListener('click', () => handleEditNetwork(network.id));
                networkCard.querySelector('.delete-btn').addEventListener('click', () => handleDeleteNetwork(network.id));

                cardsContainer.appendChild(networkCard);
            });

            levelElement.appendChild(cardsContainer);
            levelsContainer.appendChild(levelElement);
        }

        yearElement.appendChild(levelsContainer);
        networksDisplay.appendChild(yearElement);
    }
}

// --- 4. دوال التحكم بالنافذة المنبثقة (Modal) ---

function openModalForCreate() {
    const modal = document.getElementById('network-modal');
    const form = document.getElementById('network-form');
    form.reset();
    currentCriteria = [];
    renderCurrentCriteria();
    editingNetworkId = null;
    modal.style.display = 'block';
}

async function handleEditNetwork(networkId) {
    const modal = document.getElementById('network-modal');
    try {
        const { data: network, error } = await window.supabaseClient
            .from('evaluation_networks')
            .select(`*, network_criteria (id, criteria_text)`)
            .eq('id', networkId)
            .single();
        if (error) throw error;

        // ملء حقول النموذج
        document.getElementById('subject-name').value = network.subject_name;
        document.getElementById('activity-name').value = network.activity_name;
        document.getElementById('competency-final').value = network.competency_final;
        document.getElementById('competency-stage').value = network.competency_stage;
        document.getElementById('competency-sub').value = network.competency_sub;
        document.getElementById('academic-year').value = network.academic_year || '';
        document.getElementById('education-stage').value = network.education_stage || '';
        document.getElementById('level-network').value = network.level || '';
        
        currentCriteria = network.network_criteria.map(c => c.criteria_text);
        renderCurrentCriteria();

        editingNetworkId = networkId;
        modal.style.display = 'block';

    } catch(err) {
        console.error("❌ خطأ في جلب بيانات الشبكة للتعديل:", err.message);
        alert('فشل في تحميل بيانات الشبكة.');
    }
}

// --- 5. دالة التهيئة الرئيسية للصفحة ---

export async function initEvaluationPage() {
    if (isEvaluationPageInitialized) {
        await fetchAndRenderNetworks();
        return;
    }

    const openModalBtn = document.getElementById('open-network-modal-btn');
    const modal = document.getElementById('network-modal');
    const closeModalBtn = document.getElementById('close-network-modal');
    const networkForm = document.getElementById('network-form');
    const addCriteriaBtn = document.getElementById('add-criteria-btn');
    const criteriaInput = document.getElementById('criteria-input');

    openModalBtn.addEventListener('click', openModalForCreate);
    closeModalBtn.addEventListener('click', () => modal.style.display = 'none');
    
    addCriteriaBtn.addEventListener('click', () => {
        const newCriteriaText = criteriaInput.value.trim();
        if (newCriteriaText) {
            currentCriteria.push(newCriteriaText);
            criteriaInput.value = '';
            renderCurrentCriteria();
            criteriaInput.focus();
        }
    });
    
    criteriaInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addCriteriaBtn.click();
        }
    });

    networkForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (currentCriteria.length === 0) {
            alert('يجب إضافة معيار واحد على الأقل.');
            return;
        }

        const networkData = {
            year_id: document.getElementById('network-form-year').value,
            level_id: document.getElementById('network-form-level').value,
            subject_id: document.getElementById('network-form-subject').value,
            activity_name: document.getElementById('activity-name').value,
            competency_final: document.getElementById('competency-final').value,
            competency_stage: document.getElementById('competency-stage').value,
            competency_sub: document.getElementById('competency-sub').value,
            director_id: window.currentDirectorId
        };

        try {
            if (editingNetworkId) {
                // وضع التعديل
                const { error: updateError } = await window.supabaseClient.from('evaluation_networks').update(networkData).eq('id', editingNetworkId);
                if (updateError) throw updateError;
                
                const { error: deleteCriteriaError } = await window.supabaseClient.from('network_criteria').delete().eq('network_id', editingNetworkId);
                if (deleteCriteriaError) throw deleteCriteriaError;
                
                const criteriaToInsert = currentCriteria.map(text => ({ criteria_text: text, network_id: editingNetworkId }));
                const { error: insertCriteriaError } = await window.supabaseClient.from('network_criteria').insert(criteriaToInsert);
                if (insertCriteriaError) throw insertCriteriaError;

                alert('✅ تم تحديث الشبكة بنجاح!');

            } else {
                // وضع الإضافة
                const { data: newNetwork, error: insertError } = await window.supabaseClient.from('evaluation_networks').insert([networkData]).select().single();
                if (insertError) throw insertError;
                
                const criteriaToInsert = currentCriteria.map(text => ({ criteria_text: text, network_id: newNetwork.id }));
                const { error: criteriaError } = await window.supabaseClient.from('network_criteria').insert(criteriaToInsert);
                if (criteriaError) throw criteriaError;

                alert('✅ تم حفظ الشبكة بنجاح!');
            }

            modal.style.display = 'none';
            await fetchAndRenderNetworks();

        } catch (err) {
            console.error("❌ خطأ في حفظ الشبكة:", err.message);
            alert('فشل حفظ البيانات. تحقق من الكونسول.');
        }
    });
    
    isEvaluationPageInitialized = true;
    await fetchAndRenderNetworks();
    await populateEvaluationFormDropdowns();
}

/**
 * دالة لتعبئة قوائم السنة الدراسية، المستوى، والمادة في نموذج الشبكة
 */
async function populateEvaluationFormDropdowns() {
    const yearSelect = document.getElementById('network-form-year');
    const levelSelect = document.getElementById('network-form-level');
    const subjectSelect = document.getElementById('network-form-subject');

    // تفريغ القوائم أولاً
    yearSelect.innerHTML = '<option value="">-- اختر السنة --</option>';
    levelSelect.innerHTML = '<option value="">-- اختر المستوى --</option>';
    subjectSelect.innerHTML = '<option value="">-- اختر المادة --</option>';

    try {
        // جلب السنوات الدراسية
        const { data: years } = await window.supabaseClient.from('academic_years').select('id, name');
        years?.forEach(year => yearSelect.innerHTML += `<option value="${year.id}">${year.name}</option>`);

        // جلب المستويات
        const { data: levels } = await window.supabaseClient.from('levels').select('id, name');
        levels?.forEach(level => levelSelect.innerHTML += `<option value="${level.id}">${level.name}</option>`);

        // جلب المواد
        const { data: subjects } = await window.supabaseClient.from('subjects').select('id, name');
        subjects?.forEach(subject => subjectSelect.innerHTML += `<option value="${subject.id}">${subject.name}</option>`);
    } catch (error) {
        console.error("❌ خطأ في تعبئة القوائم:", error.message);
    }
}