// ==========================================
// DATA UTAMA & STATE APLIKASI
// ==========================================
let accountsList = [
    { name: "Process Engineer", email: "process@piping.com", role: "Process Engineer", pass: "pass123" },
    { name: "Lead Process", email: "leadprocess@piping.com", role: "Lead Process Engineer", pass: "pass123" },
    { name: "Piping Engineer", email: "piping@piping.com", role: "Piping Engineer", pass: "pass123" },
    { name: "Lead Piping", email: "leadpiping@piping.com", role: "Lead Piping Engineer", pass: "pass123" },
    { name: "Stress Engineer", email: "stress@piping.com", role: "Stress Engineer", pass: "pass123" },
    { name: "Designer Team", email: "designer@piping.com", role: "Designer", pass: "pass123" },
    { name: "QA/QC Team", email: "qaqc@piping.com", role: "QA/QC", pass: "pass123" },
    { name: "Project Manager", email: "pm@piping.com", role: "Project Manager", pass: "pass123" },
    { name: "Admin Studio", email: "admin@piping.com", role: "System Administrator", pass: "pass123" }
];

let currentUser = null;

// Mode revisi per line. Hanya line yang sudah mendapat keputusan yang dapat
// dibuka kembali oleh Engineer melalui tombol Edit Data.
const workflowEditState = { process: {}, piping: {} };
// Baris yang dipilih untuk kebutuhan batch/action oleh Lead Process, Lead Piping, dan PM.
const approvalSelection = { process: new Set(), piping: new Set(), manager: new Set() };
let editingProjectRulesIndex = null;

// Status/revisi dokumen mengikuti matriks revision pada prosedur engineering.
// Disimpan per-project agar pilihan tetap ada setelah refresh browser.
const REVISION_OPTIONS = [
    { code: 'IDC', label: 'Inter Discipline Check', format: 'A.0; A.1; A.2; A.3; ...; A.n', defaultNumber: 'A.0', status: 'Inter Discipline Check' },
    { code: 'IFR', label: 'Issued for Review', format: 'A; B; C; ...; continue', defaultNumber: 'A', status: 'Issued for Review' },
    { code: 'IFA', label: 'Issued for Approval', format: 'B; C; D; ...; continue', defaultNumber: 'B', status: 'Issued for Approval' },
    { code: 'IFC', label: 'Issued for Construction', format: '0; 1; 2; ...; n', defaultNumber: '0', status: 'Issued for Construction' },
    { code: 'IFU', label: 'Issued for Use', format: 'Approval result only', defaultNumber: '', status: 'Issued for Use', resultOnly: true },
    { code: 'ASB', label: 'As-Built', format: '1; 2; 3; ...; n', defaultNumber: '1', status: 'As-Built' },
    { code: 'IFI', label: 'Issued for Information', format: '0, 1, 2, 3, ...; n', defaultNumber: '0', status: 'Issued for Information' }
];
const REVISION_STORAGE_KEY = 'masterLineListRevisionState_v3_clean_0901';
const APPROVAL_STORAGE_KEY = 'masterLineListApprovalState_v5_cycle_history_persistent_0903';

function loadApprovalState() {
    try { return JSON.parse(localStorage.getItem(APPROVAL_STORAGE_KEY) || '{}'); }
    catch (e) { return {}; }
}

function getLineApprovalBucket(line, cycle) {
    if (!line) return null;
    if (!line.approvalsByCycle || typeof line.approvalsByCycle !== 'object') line.approvalsByCycle = {};
    const key = String(Number(cycle || 1));
    if (!line.approvalsByCycle[key]) {
        line.approvalsByCycle[key] = {
            processApproval: 'Pending',
            pipingApproval: 'Pending',
            pmApproval: 'Pending',
            submissionStatus: line.submissionStatus || 'Draft',
            submitted: line.submitted === true,
            submittedAt: line.submittedAt || null
        };
    } else {
        const bucket = line.approvalsByCycle[key];
        if (!bucket.pmApproval) bucket.pmApproval = 'Pending';
        if (!bucket.submissionStatus) bucket.submissionStatus = line.submissionStatus || 'Draft';
        if (typeof bucket.submitted !== 'boolean') bucket.submitted = line.submitted === true;
        if (!bucket.submittedAt && line.submittedAt) bucket.submittedAt = line.submittedAt;
        // Data lama yang masih Pending/Pending/Pending dan belum memiliki
        // penanda pengiriman harus kembali menjadi Draft. Process Approval
        // tidak boleh muncul sebelum Engineer menekan Sent.
        if (bucket.submitted !== true && !bucket.submittedAt &&
            bucket.processApproval === 'Pending' &&
            bucket.pipingApproval === 'Pending' &&
            bucket.pmApproval === 'Pending') {
            bucket.submissionStatus = 'Draft';
        }
    }
    return line.approvalsByCycle[key];
}

function syncCurrentCycleApproval(line, cycle) {
    const bucket = getLineApprovalBucket(line, cycle);
    line.processApproval = bucket?.processApproval || 'Pending';
    line.pipingApproval = bucket?.pipingApproval || 'Pending';
    line.pmApproval = bucket?.pmApproval || 'Pending';
    line.submissionStatus = bucket?.submissionStatus || 'Pending Approval (sementara)';
    return bucket;
}

function saveApprovalState() {
    try {
        const state = {};
        projectsData.forEach(p => {
            state[p.id] = {
                currentCycle: Number(p.currentCycle || 1),
                lines: {}
            };
            (p.lines || []).forEach((line, index) => {
                const id = String(line.id ?? index + 1);
                const currentBucket = getLineApprovalBucket(line, p.currentCycle);
                state[p.id].lines[id] = {
                    processApproval: currentBucket?.processApproval || line.processApproval || 'Pending',
                    pipingApproval: currentBucket?.pipingApproval || line.pipingApproval || 'Pending',
                    pmApproval: currentBucket?.pmApproval || line.pmApproval || 'Pending',
                    submissionStatus: currentBucket?.submissionStatus || line.submissionStatus || 'Draft',
                    submitted: currentBucket?.submitted === true,
                    submittedAt: currentBucket?.submittedAt || null,
                    approvalsByCycle: JSON.parse(JSON.stringify(line.approvalsByCycle || {}))
                };
            });
        });
        localStorage.setItem(APPROVAL_STORAGE_KEY, JSON.stringify(state));
    } catch (e) { console.warn('Approval state tidak dapat disimpan:', e); }
}

function hydrateApprovalState() {
    const saved = loadApprovalState();
    projectsData.forEach(p => {
        const cycle = Number(p.currentCycle || 1);
        (p.lines || []).forEach((line, index) => {
            const legacy = saved[p.id]?.lines?.[String(line.id ?? index + 1)]
                || saved[p.id]?.[String(line.id ?? index + 1)]
                || {};
            if (!line.approvalsByCycle || typeof line.approvalsByCycle !== 'object') line.approvalsByCycle = {};
            if (legacy.approvalsByCycle && typeof legacy.approvalsByCycle === 'object') {
                line.approvalsByCycle = JSON.parse(JSON.stringify(legacy.approvalsByCycle));
            }
            const bucket = getLineApprovalBucket(line, cycle);
            if (legacy.processApproval) bucket.processApproval = legacy.processApproval;
            if (legacy.pipingApproval) bucket.pipingApproval = legacy.pipingApproval;
            if (legacy.pmApproval) bucket.pmApproval = legacy.pmApproval;
            if (typeof legacy.submitted === 'boolean') bucket.submitted = legacy.submitted;
            if (legacy.submittedAt) bucket.submittedAt = legacy.submittedAt;
            if (legacy.submissionStatus) bucket.submissionStatus = legacy.submissionStatus;
            syncCurrentCycleApproval(line, cycle);
        });
    });
}

function loadRevisionState() {
    try { return JSON.parse(localStorage.getItem(REVISION_STORAGE_KEY) || '{}'); }
    catch (e) { return {}; }
}

function saveRevisionState() {
    try {
        const state = {};
        projectsData.forEach(p => {
            state[p.id] = {
                revisionStatus: p.revisionStatus || 'IFR',
                revisionNumber: p.revisionNumber || getRevisionOption(p.revisionStatus || 'IFR').defaultNumber,
                documentStatus: getRevisionOption(p.revisionStatus || 'IFR').label,
                currentCycle: Number(p.currentCycle || 1),
                cycleRules: Array.isArray(p.cycleRules) ? p.cycleRules : [],
                cycleHistory: Array.isArray(p.cycleHistory) ? p.cycleHistory : [],
                cycleSnapshots: Array.isArray(p.cycleSnapshots) ? p.cycleSnapshots : [],
                finalApproval: p.finalApproval || null
            };
        });
        localStorage.setItem(REVISION_STORAGE_KEY, JSON.stringify(state));
    } catch (e) { console.warn('Revision state tidak dapat disimpan:', e); }
}

function getRevisionOption(code) {
    return REVISION_OPTIONS.find(o => o.code === code) || REVISION_OPTIONS[1];
}

function getCycleApprovalState(proj) {
    const lines = proj?.lines || [];
    const cycle = Number(proj?.currentCycle || 1);
    lines.forEach(line => syncCurrentCycleApproval(line, cycle));

    // Hanya line yang benar-benar sudah dikirim Engineer yang masuk proses approval.
    // Baris baru yang masih "Pending Approval (sementara)" tidak boleh menghambat PM.
    const submittedLines = lines.filter(line => {
        const bucket = getLineApprovalBucket(line, cycle);
        return bucket?.submissionStatus === 'Waiting Approval Lead & PM' ||
               bucket?.submissionStatus === 'Waiting Approval PM' ||
               bucket?.submissionStatus === 'Approved';
    });

    const processApproved = submittedLines.length > 0 && submittedLines.every(l => (l.processApproval || 'Pending') === 'Approved');
    const pipingApproved = submittedLines.length > 0 && submittedLines.every(l => (l.pipingApproval || 'Pending') === 'Approved');
    const allApproved = processApproved && pipingApproved;
    const pmLinesApproved = submittedLines.length > 0 && submittedLines.every(l => ['Ready for Final Approval', 'Approved'].includes(l.pmApproval || 'Pending'));
    const pmApproved = proj?.finalApproval?.role === 'Project Manager' &&
        proj?.finalApproval?.status === 'Approved' &&
        Number(proj?.finalApproval?.cycle) === cycle;
    return { processApproved, pipingApproved, allApproved, pmApproved, submittedLines, pmLinesApproved };
}

function getActiveCycleRule(proj) {
    if (!proj || !Array.isArray(proj.cycleRules) || !proj.cycleRules.length) return null;
    const cycle = Math.max(1, Number(proj.currentCycle || 1));
    return proj.cycleRules[cycle - 1] || null;
}

// SETTING RULE adalah sumber kebenaran untuk label REV/STATUS setiap project.
// Tidak boleh ada workflow approval yang meng-hard-code IFC/IFR/IFA atau revisi
// tertentu. Jika project memiliki cycleRules, seluruh label harus mengambil
// revision dan status dari rule cycle yang sedang aktif.
function getConfiguredCycleDisplay(proj) {
    const rule = getActiveCycleRule(proj);
    return {
        rule,
        revision: String(rule?.revision || proj?.revisionNumber || 'A').trim().toUpperCase(),
        status: String(rule?.status || proj?.revisionStatus || 'IFR').trim().toUpperCase()
    };
}

function hydrateRevisionState() {
    const fallbackCode = 'IFR';
    const saved = loadRevisionState();
    projectsData.forEach((p, index) => {
        // Jika project memiliki Setting Rule, rule project adalah satu-satunya sumber
        // revision/status untuk cycle aktif. Fallback hanya dipakai untuk project lama
        // yang memang belum memiliki Setting Rule.
        const state = saved[p.id] || {};
        if (Array.isArray(state.cycleRules) && state.cycleRules.length) p.cycleRules = normalizeProjectRules(state.cycleRules);
        if (Number.isFinite(Number(state.currentCycle)) && Number(state.currentCycle) >= 1) p.currentCycle = Number(state.currentCycle);
        if (Array.isArray(state.cycleHistory)) p.cycleHistory = state.cycleHistory;
        if (Array.isArray(state.cycleSnapshots)) p.cycleSnapshots = state.cycleSnapshots;
        if (state.finalApproval) p.finalApproval = state.finalApproval;
        if (Array.isArray(p.cycleRules) && p.cycleRules.length) {
            const activeRule = getActiveCycleRule(p);
            p.revisionStatus = activeRule?.status || p.revisionStatus || fallbackCode;
            p.revisionNumber = activeRule?.revision || p.revisionNumber || getRevisionOption(p.revisionStatus).defaultNumber;
        } else {
            p.revisionStatus = state.revisionStatus || p.revisionStatus || fallbackCode;
            p.revisionNumber = state.revisionNumber || p.revisionNumber || getRevisionOption(p.revisionStatus).defaultNumber;
        }
        p.documentStatus = getRevisionOption(p.revisionStatus).label;
        if (!Array.isArray(p.cycleHistory)) p.cycleHistory = [];
        if (!Array.isArray(p.cycleSnapshots)) p.cycleSnapshots = [];
        if (!Number.isFinite(Number(p.currentCycle)) || Number(p.currentCycle) < 1) p.currentCycle = 1;
        p.cycleCompleted = !!p.cycleCompleted;
    });
}

let projectsData = [
    {
        id: "proj-1",
        name: "CPO STORAGE & TRANSFER FACILITY (DATA 1)",
        docNumber: "B2401-190-A1501",
        revisionStatus: "IFC",
        revisionNumber: "0",
        documentStatus: "Issued for Construction",
        leftLogo: "",
        rightLogo: "",
        lines: [
            { id: 1, size: "8", fluid_id: "CP", spec: "B1", seq: "190016", ins_type: "-", ins_thick: "-", complete_no: "8''-CP-B1-190016", pid: "B2401-190-A1501", from: "CPO Tank-1", to: "Inlet CPO Intertank Transfer Pump (190GM-1)", service: "CPO", phase: "Liquid", mass: "162360", vol: "180", press_op: "1.42", press_des: "5.33", temp_op: "50", temp_des: "90", density: "902.0", visc: "25.1", nde_rt: "0.05", nde_pt: "0.05", test_med: "Hydro", test_press: "7.995", painting: "1F2CS", pwht: "No", stress_critical: "Medium", stress_calc_no: "-", remarks: "-", processApproval: "Approved" },
            { id: 2, size: "4", fluid_id: "CP", spec: "B1", seq: "190011", ins_type: "-", ins_thick: "-", complete_no: "4''-CP-B1-190011", pid: "B2401-190-A1501", from: "Empty Out Product CPO Tank-1 (190D-1)", to: "-", service: "CPO", phase: "Liquid", mass: "Normally No Flow", vol: "Normally No Flow", press_op: "ATM", press_des: "5.33", temp_op: "AMB", temp_des: "50", density: "902.0", visc: "25.1", nde_rt: "0.05", nde_pt: "0.05", test_med: "Hydro", test_press: "7.995", painting: "1F2CS", pwht: "No", stress_critical: "Low", stress_calc_no: "-", remarks: "-", processApproval: "Approved" },
            { id: 3, size: "4", fluid_id: "CP", spec: "B1", seq: "190012", ins_type: "-", ins_thick: "-", complete_no: "4''-CP-B1-190012", pid: "B2401-190-A1501", from: "Drain CPO Tank-1 (190D-1)", to: "-", service: "CPO", phase: "Liquid", mass: "Normally No Flow", vol: "Normally No Flow", press_op: "ATM", press_des: "5.33", temp_op: "AMB", temp_des: "50", density: "902.0", visc: "25.1", nde_rt: "0.05", nde_pt: "0.05", test_med: "Hydro", test_press: "7.995", painting: "1F2CS", pwht: "No", stress_critical: "Low", stress_calc_no: "-", remarks: "-", processApproval: "Approved" },
            { id: 4, size: "4", fluid_id: "CP", spec: "B1", seq: "190013", ins_type: "-", ins_thick: "-", complete_no: "4''-CP-B1-190013", pid: "B2401-190-A1501", from: "Overflow CPO Tank-1 (190D-1)", to: "-", service: "CPO", phase: "Liquid", mass: "Normally No Flow", vol: "Normally No Flow", press_op: "ATM", press_des: "5.33", temp_op: "AMB", temp_des: "50", density: "902.0", visc: "25.1", nde_rt: "0.05", nde_pt: "0.05", test_med: "Hydro", test_press: "7.995", painting: "1F2CS", pwht: "No", stress_critical: "Low", stress_calc_no: "-", remarks: "-", processApproval: "Approved" },
            { id: 5, size: "2", fluid_id: "CP", spec: "B1", seq: "190014", ins_type: "-", ins_thick: "-", complete_no: "2''-CP-B1-190014", pid: "B2401-190-A1501", from: "Sampling CPO Tank-1 (190D-1)", to: "-", service: "CPO", phase: "Liquid", mass: "Normally No Flow", vol: "Normally No Flow", press_op: "ATM", press_des: "5.33", temp_op: "AMB", temp_des: "50", density: "902.0", visc: "25.1", nde_rt: "0.05", nde_pt: "0.05", test_med: "Hydro", test_press: "7.995", painting: "1F2CS", pwht: "No", stress_critical: "Low", stress_calc_no: "-", remarks: "-", processApproval: "Approved" },
            { id: 6, size: "24", fluid_id: "VENT", spec: "B1", seq: "190015", ins_type: "-", ins_thick: "-", complete_no: "24''-VENT-B1-190015", pid: "B2401-190-A1501", from: "Flame Arrester CPO Tank-1 (190D-1)", to: "-", service: "Tank Vent", phase: "Gas", mass: "Normally No Flow", vol: "Normally No Flow", press_op: "ATM", press_des: "5.33", temp_op: "AMB", temp_des: "50", density: "1.2", visc: "0.018", nde_rt: "0.05", nde_pt: "0.05", test_med: "Hydro", test_press: "7.995", painting: "1F2CS", pwht: "No", stress_critical: "Low", stress_calc_no: "-", remarks: "-", processApproval: "Approved" },
            { id: 7, size: "8", fluid_id: "CP", spec: "B1", seq: "190017", ins_type: "-", ins_thick: "-", complete_no: "8''-CP-B1-190017", pid: "B2401-190-A1501", from: "Discharge CPO Intertank Transfer Pump (190GM-1)", to: "CPO Tank-2", service: "CPO", phase: "Liquid", mass: "162360", vol: "180", press_op: "5.33", press_des: "10.0", temp_op: "50", temp_des: "90", density: "902.0", visc: "25.1", nde_rt: "0.05", nde_pt: "0.05", test_med: "Hydro", test_press: "15.0", painting: "1F2CS", pwht: "No", stress_critical: "Medium", stress_calc_no: "-", remarks: "-", processApproval: "Approved" },
            { id: 8, size: "3", fluid_id: "CP", spec: "B1", seq: "190018", ins_type: "-", ins_thick: "-", complete_no: "3''-CP-B1-190018", pid: "B2401-190-A1501", from: "CPO Intertank Transfer Pump (190GM-1)", to: "CPO Intertank Transfer Pump (190GM-1)", service: "CPO", phase: "Liquid", mass: "Normally No Flow", vol: "Normally No Flow", press_op: "5.33", press_des: "10.0", temp_op: "50", temp_des: "90", density: "902.0", visc: "25.1", nde_rt: "0.05", nde_pt: "0.05", test_med: "Hydro", test_press: "15.0", painting: "1F2CS", pwht: "No", stress_critical: "Low", stress_calc_no: "-", remarks: "-", processApproval: "Approved" },
            { id: 9, size: "8", fluid_id: "CP", spec: "B1", seq: "190026", ins_type: "-", ins_thick: "-", complete_no: "8''-CP-B1-190026", pid: "B2401-190-A1501", from: "CPO Tank-2", to: "Inlet CPO Intertank Transfer Pump (190GM-1)", service: "CPO", phase: "Liquid", mass: "162360", vol: "180", press_op: "1.42", press_des: "5.33", temp_op: "50", temp_des: "90", density: "902.0", visc: "25.1", nde_rt: "0.05", nde_pt: "0.05", test_med: "Hydro", test_press: "7.995", painting: "1F2CS", pwht: "No", stress_critical: "Medium", stress_calc_no: "-", remarks: "-", processApproval: "Approved" },
            { id: 10, size: "4", fluid_id: "CP", spec: "B1", seq: "190021", ins_type: "-", ins_thick: "-", complete_no: "4''-CP-B1-190021", pid: "B2401-190-A1501", from: "Empty Out Product CPO Tank-2 (190D-2)", to: "-", service: "CPO", phase: "Liquid", mass: "Normally No Flow", vol: "Normally No Flow", press_op: "ATM", press_des: "5.33", temp_op: "AMB", temp_des: "50", density: "902.0", visc: "25.1", nde_rt: "0.05", nde_pt: "0.05", test_med: "Hydro", test_press: "7.995", painting: "1F2CS", pwht: "No", stress_critical: "Low", stress_calc_no: "-", remarks: "-", processApproval: "Approved" }
        ]
    },
    {
        id: "proj-2",
        name: "STEAM & CONDENSATE SYSTEM (DATA 2)",
        docNumber: "B2401-190-A1501",
        revisionStatus: "IFR",
        revisionNumber: "A",
        documentStatus: "Issued for Review",
        leftLogo: "",
        rightLogo: "",
        lines: [
            { id: 1, size: "2", fluid_id: "LS", spec: "B1", seq: "190303", ins_type: "IH", ins_thick: "40", complete_no: "2''-LS-B1-190303-IH-40", pid: "B2401-190-A1501", from: "LP Steam CPO Tank-1 (190D-1)", to: "Steam Trap-2 CPO Tank-1 (190D-1)", service: "Low Pressure Steam", phase: "Gas", mass: "364.21", vol: "136.15", press_op: "4", press_des: "6", temp_op: "151.94", temp_des: "164.96", density: "2.675", visc: "0.0149", nde_rt: "0.05", nde_pt: "0.05", test_med: "Hydro", test_press: "9", painting: "1F4CS", pwht: "No", stress_critical: "Low", stress_calc_no: "-", remarks: "-", processApproval: "Pending" },
            { id: 2, size: "2", fluid_id: "CD", spec: "B1", seq: "190304", ins_type: "IH", ins_thick: "40", complete_no: "2''-CD-B1-190304-IH-40", pid: "B2401-190-A1501", from: "Steam Trap-1 CPO Tank-1 (190D-1)", to: "Condensate CPO Tank-1 (190D-1)", service: "Condensate", phase: "Liquid", mass: "364.21", vol: "0.386", press_op: "1", press_des: "4.5", temp_op: "120.4", temp_des: "155.47", density: "942.2", visc: "0.229", nde_rt: "0.05", nde_pt: "0.05", test_med: "Hydro", test_press: "6.75", painting: "1F4CS", pwht: "No", stress_critical: "Low", stress_calc_no: "-", remarks: "-", processApproval: "Pending" },
            { id: 3, size: "2", fluid_id: "CD", spec: "B1", seq: "190305", ins_type: "IH", ins_thick: "40", complete_no: "2''-CD-B1-190305-IH-40", pid: "B2401-190-A1501", from: "Steam Trap-2 CPO Tank-1 (190D-1)", to: "Condensate CPO Tank-1 (190D-1)", service: "Condensate", phase: "Liquid", mass: "364.21", vol: "0.386", press_op: "1", press_des: "4.5", temp_op: "120.4", temp_des: "155.47", density: "942.2", visc: "0.229", nde_rt: "0.05", nde_pt: "0.05", test_med: "Hydro", test_press: "6.75", painting: "1F4CS", pwht: "No", stress_critical: "Low", stress_calc_no: "-", remarks: "-", processApproval: "Pending" },
            { id: 4, size: "3", fluid_id: "CD", spec: "B1", seq: "190306", ins_type: "IH", ins_thick: "40", complete_no: "3''-CD-B1-190306-IH-40", pid: "B2401-190-A1501", from: "Condensate CPO Tank-1 (190D-1)", to: "Condensate Header", service: "Condensate", phase: "Liquid", mass: "728.42", vol: "0.773", press_op: "1", press_des: "4.5", temp_op: "120.4", temp_des: "155.47", density: "942.2", visc: "0.229", nde_rt: "0.05", nde_pt: "0.05", test_med: "Hydro", test_press: "6.75", painting: "1F4CS", pwht: "No", stress_critical: "Low", stress_calc_no: "-", remarks: "-", processApproval: "Pending" },
            { id: 5, size: "2", fluid_id: "LS", spec: "B1", seq: "190309", ins_type: "IH", ins_thick: "40", complete_no: "2''-LS-B1-190309-IH-40", pid: "B2401-190-A1501", from: "LP Steam Header", to: "LP Steam CPO Tank-2 (190D-2)", service: "Low Pressure Steam", phase: "Gas", mass: "364.21", vol: "136.15", press_op: "4", press_des: "6", temp_op: "151.94", temp_des: "164.96", density: "2.675", visc: "0.0149", nde_rt: "0.05", nde_pt: "0.05", test_med: "Hydro", test_press: "9", painting: "1F4CS", pwht: "No", stress_critical: "Low", stress_calc_no: "-", remarks: "-", processApproval: "Pending" },
            { id: 6, size: "2", fluid_id: "LS", spec: "B1", seq: "190310", ins_type: "IH", ins_thick: "40", complete_no: "2''-LS-B1-190310-IH-40", pid: "B2401-190-A1501", from: "LP Steam CPO Tank-2 (190D-2)", to: "Steam Trap-1 CPO Tank-2 (190D-2)", service: "Low Pressure Steam", phase: "Gas", mass: "364.21", vol: "136.15", press_op: "4", press_des: "6", temp_op: "151.94", temp_des: "164.96", density: "2.675", visc: "0.0149", nde_rt: "0.05", nde_pt: "0.05", test_med: "Hydro", test_press: "9", painting: "1F4CS", pwht: "No", stress_critical: "Low", stress_calc_no: "-", remarks: "-", processApproval: "Pending" },
            { id: 7, size: "2", fluid_id: "LS", spec: "B1", seq: "190311", ins_type: "IH", ins_thick: "40", complete_no: "2''-LS-B1-190311-IH-40", pid: "B2401-190-A1501", from: "LP Steam CPO Tank-2 (190D-2)", to: "Steam Trap-2 CPO Tank-2 (190D-2)", service: "Low Pressure Steam", phase: "Gas", mass: "364.21", vol: "136.15", press_op: "4", press_des: "6", temp_op: "151.94", temp_des: "164.96", density: "2.675", visc: "0.0149", nde_rt: "0.05", nde_pt: "0.05", test_med: "Hydro", test_press: "9", painting: "1F4CS", pwht: "No", stress_critical: "Low", stress_calc_no: "-", remarks: "-", processApproval: "Pending" },
            { id: 8, size: "2", fluid_id: "CD", spec: "B1", seq: "190312", ins_type: "IH", ins_thick: "40", complete_no: "2''-CD-B1-190312-IH-40", pid: "B2401-190-A1501", from: "Steam Trap-1 CPO Tank-2 (190D-2)", to: "Condensate CPO Tank-2 (190D-2)", service: "Condensate", phase: "Liquid", mass: "364.21", vol: "0.386", press_op: "1", press_des: "4.5", temp_op: "120.4", temp_des: "155.47", density: "942.2", visc: "0.229", nde_rt: "0.05", nde_pt: "0.05", test_med: "Hydro", test_press: "6.75", painting: "1F4CS", pwht: "No", stress_critical: "Low", stress_calc_no: "-", remarks: "-", processApproval: "Pending" },
            { id: 9, size: "2", fluid_id: "CD", spec: "B1", seq: "190313", ins_type: "IH", ins_thick: "40", complete_no: "2''-CD-B1-190313-IH-40", pid: "B2401-190-A1501", from: "Steam Trap-2 CPO Tank-2 (190D-2)", to: "Condensate CPO Tank-2 (190D-2)", service: "Condensate", phase: "Liquid", mass: "364.21", vol: "0.386", press_op: "1", press_des: "4.5", temp_op: "120.4", temp_des: "155.47", density: "942.2", visc: "0.229", nde_rt: "0.05", nde_pt: "0.05", test_med: "Hydro", test_press: "6.75", painting: "1F4CS", pwht: "No", stress_critical: "Low", stress_calc_no: "-", remarks: "-", processApproval: "Pending" },
            { id: 10, size: "3", fluid_id: "CD", spec: "B1", seq: "190314", ins_type: "IH", ins_thick: "40", complete_no: "3''-CD-B1-190314-IH-40", pid: "B2401-190-A1501", from: "Condensate CPO Tank-2 (190D-2)", to: "Condensate Header", service: "Condensate", phase: "Liquid", mass: "728.42", vol: "0.773", press_op: "1", press_des: "4.5", temp_op: "120.4", temp_des: "155.47", density: "942.2", visc: "0.229", nde_rt: "0.05", nde_pt: "0.05", test_med: "Hydro", test_press: "6.75", painting: "1F4CS", pwht: "No", stress_critical: "Low", stress_calc_no: "-", remarks: "-", processApproval: "Pending" }
        ]
    },
    {
        id: "proj-3",
        name: "TANK FARM UTILITY DISTRIBUTION (DATA 3)",
        docNumber: "B2401-190-A1502",
        leftLogo: "",
        rightLogo: "",
        lines: [
            { id: 1, size: "4", fluid_id: "LS", spec: "B1", seq: "140012", ins_type: "IH", ins_thick: "40", complete_no: "4''-LS-B1-140012-IH-40", pid: "B2401-190-A1502", from: "Tank Farm LP Steam Header", to: "-", service: "Low Pressure Steam", phase: "Gas", mass: "364.21", vol: "136.15", press_op: "4", press_des: "6", temp_op: "151.94", temp_des: "164.96", density: "2.675", visc: "0.0149", nde_rt: "0.05", nde_pt: "0.05", test_med: "Hydro", test_press: "9", painting: "1F4CS", pwht: "No", stress_critical: "Low", stress_calc_no: "-", remarks: "-", processApproval: "Pending" },
            { id: 2, size: "2", fluid_id: "LS", spec: "B1", seq: "190310", ins_type: "IH", ins_thick: "40", complete_no: "2''-LS-B1-190310-IH-40", pid: "B2401-190-A1502", from: "LP Steam CPO Tank-2 (190D-2)", to: "Steam Trap-1 CPO Tank-2 (190D-2)", service: "Low Pressure Steam", phase: "Gas", mass: "364.21", vol: "136.15", press_op: "4", press_des: "6", temp_op: "151.94", temp_des: "164.96", density: "2.675", visc: "0.0149", nde_rt: "0.05", nde_pt: "0.05", test_med: "Hydro", test_press: "9", painting: "1F4CS", pwht: "No", stress_critical: "Low", stress_calc_no: "-", remarks: "-", processApproval: "Pending" },
            { id: 3, size: "2", fluid_id: "LS", spec: "B1", seq: "190311", ins_type: "IH", ins_thick: "40", complete_no: "2''-LS-B1-190311-IH-40", pid: "B2401-190-A1502", from: "LP Steam CPO Tank-2 (190D-2)", to: "Steam Trap-2 CPO Tank-2 (190D-2)", service: "Low Pressure Steam", phase: "Gas", mass: "364.21", vol: "136.15", press_op: "4", press_des: "6", temp_op: "151.94", temp_des: "164.96", density: "2.675", visc: "0.0149", nde_rt: "0.05", nde_pt: "0.05", test_med: "Hydro", test_press: "9", painting: "1F4CS", pwht: "No", stress_critical: "Low", stress_calc_no: "-", remarks: "-", processApproval: "Pending" },
            { id: 4, size: "2", fluid_id: "CD", spec: "B1", seq: "190312", ins_type: "IH", ins_thick: "40", complete_no: "2''-CD-B1-190312-IH-40", pid: "B2401-190-A1502", from: "Steam Trap-1 CPO Tank-2 (190D-2)", to: "Condensate CPO Tank-2 (190D-2)", service: "Condensate", phase: "Liquid", mass: "364.21", vol: "0.386", press_op: "1", press_des: "4.5", temp_op: "120.4", temp_des: "155.47", density: "942.2", visc: "0.229", nde_rt: "0.05", nde_pt: "0.05", test_med: "Hydro", test_press: "6.75", painting: "1F4CS", pwht: "No", stress_critical: "Low", stress_calc_no: "-", remarks: "-", processApproval: "Pending" },
            { id: 5, size: "2", fluid_id: "CD", spec: "B1", seq: "190313", ins_type: "IH", ins_thick: "40", complete_no: "2''-CD-B1-190313-IH-40", pid: "B2401-190-A1502", from: "Steam Trap-2 CPO Tank-2 (190D-2)", to: "Condensate CPO Tank-2 (190D-2)", service: "Condensate", phase: "Liquid", mass: "364.21", vol: "0.386", press_op: "1", press_des: "4.5", temp_op: "120.4", temp_des: "155.47", density: "942.2", visc: "0.229", nde_rt: "0.05", nde_pt: "0.05", test_med: "Hydro", test_press: "6.75", painting: "1F4CS", pwht: "No", stress_critical: "Low", stress_calc_no: "-", remarks: "-", processApproval: "Pending" },
            { id: 6, size: "3", fluid_id: "CD", spec: "B1", seq: "190314", ins_type: "IH", ins_thick: "40", complete_no: "3''-CD-B1-190314-IH-40", pid: "B2401-190-A1502", from: "Condensate CPO Tank-2 (190D-2)", to: "Condensate Header", service: "Condensate", phase: "Liquid", mass: "728.42", vol: "0.773", press_op: "1", press_des: "4.5", temp_op: "120.4", temp_des: "155.47", density: "942.2", visc: "0.229", nde_rt: "0.05", nde_pt: "0.05", test_med: "Hydro", test_press: "6.75", painting: "1F4CS", pwht: "No", stress_critical: "Low", stress_calc_no: "-", remarks: "-", processApproval: "Pending" },
            { id: 7, size: "4", fluid_id: "LS", spec: "B1", seq: "190315", ins_type: "IH", ins_thick: "40", complete_no: "4''-LS-B1-190315-IH-40", pid: "B2401-190-A1502", from: "Header", to: "User", service: "Low Pressure Steam", phase: "Gas", mass: "500", vol: "150", press_op: "4", press_des: "6", temp_op: "151.94", temp_des: "164.96", density: "2.675", visc: "0.0149", nde_rt: "0.05", nde_pt: "0.05", test_med: "Hydro", test_press: "9", painting: "1F4CS", pwht: "No", stress_critical: "Low", stress_calc_no: "-", remarks: "-", processApproval: "Pending" },
            { id: 8, size: "2", fluid_id: "CD", spec: "B1", seq: "190316", ins_type: "IH", ins_thick: "40", complete_no: "2''-CD-B1-190316-IH-40", pid: "B2401-190-A1502", from: "Trap", to: "Return", service: "Condensate", phase: "Liquid", mass: "200", vol: "0.2", press_op: "1", press_des: "4.5", temp_op: "120.4", temp_des: "155.47", density: "942.2", visc: "0.229", nde_rt: "0.05", nde_pt: "0.05", test_med: "Hydro", test_press: "6.75", painting: "1F4CS", pwht: "No", stress_critical: "Low", stress_calc_no: "-", remarks: "-", processApproval: "Pending" },
            { id: 9, size: "6", fluid_id: "PW", spec: "B1", seq: "190401", ins_type: "-", ins_thick: "-", complete_no: "6''-PW-B1-190401", pid: "B2401-190-A1502", from: "Utility Area", to: "Tank Farm", service: "Process Water", phase: "Liquid", mass: "1000", vol: "1.0", press_op: "3", press_des: "5", temp_op: "30", temp_des: "40", density: "1000", visc: "1.0", nde_rt: "0.05", nde_pt: "0.05", test_med: "Hydro", test_press: "7.5", painting: "1F2CS", pwht: "No", stress_critical: "Low", stress_calc_no: "-", remarks: "-", processApproval: "Pending" },
            { id: 10, size: "2", fluid_id: "IA", spec: "B1", seq: "190402", ins_type: "-", ins_thick: "-", complete_no: "2''-IA-B1-190402", pid: "B2401-190-A1502", from: "Instrument Air Header", to: "Actuators", service: "Instrument Air", phase: "Gas", mass: "50", vol: "40", press_op: "7", press_des: "10", temp_op: "35", temp_des: "50", density: "1.2", visc: "0.018", nde_rt: "0.05", nde_pt: "0.05", test_med: "Air", test_press: "15", painting: "1F2CS", pwht: "No", stress_critical: "Low", stress_calc_no: "-", remarks: "-", processApproval: "Pending" }
        ]
    }
];

let currentProjectIndex = 0;
let currentProject = 0; // Menyesuaikan acuan untuk updateProjectDropdownOptions
let tableFilters = {};

// Kondisi awal file ini bersih untuk testing: tidak membawa approval dari versi sebelumnya.
// Storage key v2_clean juga mengisolasi state browser lama.
const CLEAN_TEST_BOOTSTRAP_KEY = 'masterLineListCleanBootstrap_v3_0901';
if (!localStorage.getItem(CLEAN_TEST_BOOTSTRAP_KEY)) {
    projectsData.forEach(project => {
        project.currentCycle = 1;
        project.cycleHistory = [];
        project.cycleSnapshots = [];
        project.finalApproval = null;
        project.cycleCompleted = false;
        (project.lines || []).forEach(line => {
            line.processApproval = 'Pending';
            line.pipingApproval = 'Pending';
            line.pmApproval = 'Pending';
            line.submissionStatus = 'Pending Approval (sementara)';
            line.pmRevisionRequested = false;
            line.approvalsByCycle = {};
        });
    });
    localStorage.removeItem('masterLineListRevisionState_v1');
    localStorage.removeItem('masterLineListApprovalState_v1');
    localStorage.setItem(CLEAN_TEST_BOOTSTRAP_KEY, '1');
}
hydrateApprovalState();
saveApprovalState();

// Sinkronkan Complete Line No. lama dengan format otomatis saat aplikasi pertama kali dibuka.
// Tidak mengubah data sumber selain membentuk field Complete Line No. dari kolom sumbernya.
hydrateRevisionState();
saveRevisionState();

projectsData.forEach(project => {
    project.name = String(project.name ?? '').trim().toUpperCase();
    project.docNumber = String(project.docNumber ?? '').trim();
    project.lines.forEach((line, index) => {
        line.ins_type = String(line.ins_type ?? '').trim().toUpperCase();
        // Insulation Thickness boleh berisi apa pun, termasuk "-".
        // Nilai "-" adalah nilai valid dan tidak boleh dikosongkan otomatis.
        line.ins_thick = String(line.ins_thick ?? '').trim();
        line.seq = String(line.seq ?? '').replace(/\D/g, '');
        line.spec = String(line.spec ?? '').trim().toUpperCase();
        line.service = String(line.service ?? '').trim();
        line.complete_no = buildCompleteLineNo(line, project.lines, index);
    });
});

document.addEventListener('DOMContentLoaded', () => {
    // Event Listener untuk Form Login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value.trim();
            const pass = document.getElementById('loginPassword').value.trim();
            const found = accountsList.find(acc => acc.email === email && acc.pass === pass);
            if (found) {
                currentUser = found;
                
                // --- DIUBAH: Langsung masuk ke halaman Dashboard Utama ---
                document.getElementById('loginPage').classList.add('hidden');
                document.getElementById('dashboardPage').classList.remove('hidden');
                
                setupUserInterfaceByRole();
                renderDashboard();
                // ---------------------------------------------------------

            } else {
                showModal("Login Gagal", "Email atau Password disiplin kerja salah. Coba gunakan: process@piping.com / pass123", "error");
            }
        });
    }

    const addNewRowBtn = document.getElementById('addNewRowBtn');
    if (addNewRowBtn) addNewRowBtn.addEventListener('click', addLineRow);
    const projectNameInput = document.getElementById('newProjectNameInput');
    if (projectNameInput) projectNameInput.addEventListener('input', () => { projectNameInput.value = projectNameInput.value.toUpperCase(); });


    const adminAddAccountForm = document.getElementById('adminAddAccountForm');
    if (adminAddAccountForm) {
        adminAddAccountForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('adminRegName').value.trim();
            const email = document.getElementById('adminRegEmail').value.trim();
            const role = document.getElementById('adminRegRole').value;
            const pass = document.getElementById('adminRegPassword').value.trim();
            if (accountsList.some(acc => acc.email === email)) {
                showModal("Peringatan", "Email akun tersebut sudah terdaftar di Studio.", "warning");
                return;
            }
            accountsList.push({ name, email, role, pass });
            closeAddAccountModal();
            showModal("Berhasil", `Akun baru untuk ${name} (${role}) berhasil ditambahkan!`, "success");
            adminAddAccountForm.reset();
        });
    }

    const excelFileInput = document.getElementById('excelFileInput');
    if (excelFileInput) excelFileInput.addEventListener('change', handleExcelImport);

    const customModalClose = document.getElementById('customModalClose');
    if (customModalClose) {
        customModalClose.addEventListener('click', () => {
            document.getElementById('customModal').classList.add('hidden');
        });
    }

    // Modal informasi dapat ditutup cepat dengan Enter atau Space, seperti menekan OK.
    document.addEventListener('keydown', (event) => {
        const modal = document.getElementById('customModal');
        if (!modal || modal.classList.contains('hidden')) return;
        if (event.key === 'Enter' || event.key === ' ' || event.code === 'Space') {
            event.preventDefault();
            event.stopPropagation();
            document.getElementById('customModalClose')?.click();
        }
    });
});

// Logout kembali ke halaman login utama tanpa userDashboardHub
function handleLogout() {
    currentUser = null;
    document.getElementById('dashboardPage').classList.add('hidden');
    document.getElementById('loginPage').classList.remove('hidden');
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.reset();
}

function setupUserInterfaceByRole() {
    if (!currentUser) return;

    document.getElementById('sidebarUserName').innerText = currentUser.name;
    document.getElementById('sidebarUserRole').innerText = currentUser.role;

    // Team & Roles hanya boleh terlihat dan diakses oleh System Administrator.
    const teamMenuBtn = document.getElementById('menuBtnTeam');
    const teamTab = document.getElementById('tabContentTeam');

    const isAdmin = currentUser.role === 'System Administrator';

    if (teamMenuBtn) {
        teamMenuBtn.classList.toggle('hidden', !isAdmin);
        teamMenuBtn.style.display = isAdmin ? '' : 'none';
    }

    if (!isAdmin && teamTab) {
        teamTab.classList.add('hidden');
    }

    // Tombol + biru di header sengaja dihapus.
    // Penambahan akun hanya dilakukan dari halaman Team & Roles milik Admin.

    // Lead Process/Lead Piping berfungsi sebagai approver. Lead Process tetap
    // dapat mengubah Remarks; keduanya tidak menambah/import/menghapus line.
    const isLeadProcessOnly = ['Lead Process Engineer', 'Lead Piping Engineer'].includes(currentUser.role);
    const isProjectManager = currentUser.role === 'Project Manager';
    const addBtn = document.getElementById('addNewRowBtn');
    const importBtn = document.getElementById('importExcelAction');
    const importTopBtn = document.getElementById('importExcelTopAction');

    if (addBtn) {
        // Project Manager dan Lead tidak boleh menambah Pipe Line.
        const cannotAddLine = isLeadProcessOnly || isProjectManager;
        addBtn.classList.toggle('hidden', cannotAddLine);
        addBtn.disabled = cannotAddLine;
        addBtn.setAttribute('aria-disabled', String(cannotAddLine));
        addBtn.title = isProjectManager ? 'Project Manager tidak dapat menambah Pipe Line' : '';
    }

    // Project Manager tidak diperbolehkan melakukan Import Excel.
    // Tombol import disembunyikan baik di header maupun di footer.
    if (importBtn) {
        const hideImport = isLeadProcessOnly || isProjectManager;
        importBtn.classList.toggle('hidden', hideImport);
        importBtn.style.display = hideImport ? 'none' : '';
    }
    if (importTopBtn) {
        importTopBtn.classList.toggle('hidden', isProjectManager);
        importTopBtn.style.display = isProjectManager ? 'none' : '';
    }

    // Project Manager tidak diperbolehkan membuat project baru.
    // Sembunyikan tombol pada dropdown sidebar dan pastikan fungsi
    // openAddProjectModal() juga memiliki guard sebagai pengaman kedua.
    const sidebarAddProjectBtn = document.getElementById('sidebarAddProjectBtn');
    if (sidebarAddProjectBtn) {
        sidebarAddProjectBtn.classList.toggle('hidden', isProjectManager);
        sidebarAddProjectBtn.style.display = isProjectManager ? 'none' : '';
    }
}

// Fungsi untuk menangani perubahan pada dropdown project header[cite: 10]
function handleProjectSwitcherChange(selectElement) {
    const selectedValue = selectElement.value;
    
    // Jika pengguna memilih opsi khusus untuk menambah project baru[cite: 10]
    if (selectedValue === "__ADD_NEW_PROJECT__") {
        // Kembalikan pilihan dropdown ke project aktif sebelumnya agar tidak membingungkan[cite: 10]
        if (typeof currentProject !== 'undefined') {
            selectElement.value = currentProject;
        }
        // Buka modal tambah project[cite: 10]
        openAddProjectModal();
        return;
    }
    
    // Jika memilih project biasa, jalankan fungsi switch project[cite: 10]
    if (typeof switchProjectFromHeader === 'function') {
        switchProjectFromHeader(selectedValue);
    }
}

function switchProjectFromHeader(val) {
    currentProjectIndex = parseInt(val);
    currentProject = currentProjectIndex;
    renderDashboard();
}

function renderDashboard() {
    const proj = projectsData[currentProjectIndex];
    proj.name = String(proj.name ?? '').trim().toUpperCase();
    document.getElementById('breadcrumbProject').innerText = proj.name;
    document.getElementById('headerProjectName').value = proj.name;
    proj.docNumber = String(proj.docNumber || '').replace(/\s+/g, '').trim().toUpperCase();
    document.getElementById('headerDocNumber').value = proj.docNumber;
    const sidebarActive = document.getElementById('activeProjectText');
    if (sidebarActive) sidebarActive.innerText = proj.name;
    if (typeof initProjectNameMarquee === 'function') initProjectNameMarquee();

    // Perbarui fungsi render dropdown project agar menyisipkan opsi Add Project di akhir[cite: 10]
    updateProjectDropdownOptions();

    renderLogos(proj);
    renderRevisionHeader(proj);
    renderTableRows(proj);

    const totalCard = document.getElementById('totalLineCountCard');
    if (totalCard) totalCard.innerText = proj.lines.length;
}

// Perbarui fungsi render dropdown project agar menyisipkan opsi Add Project di akhir[cite: 10]
function updateProjectDropdownOptions() {
    const switcher = document.getElementById('headerProjectSwitcher');
    if (!switcher) return;

    let optionsHTML = '';
    // Menggunakan projectsData sebagai acuan daftar project
    if (typeof projectsData !== 'undefined') {
        projectsData.forEach((proj, idx) => {
            const isSelected = idx === currentProjectIndex ? 'selected' : '';
            optionsHTML += `<option value="${idx}" ${isSelected}>${proj.name}</option>`;
        });
    }

    // Project Manager hanya dapat memilih project yang sudah ada.
    // Opsi Add New Project disembunyikan untuk PM dan tetap tersedia untuk role lain.
    if (currentUser?.role !== 'Project Manager') {
        optionsHTML += `<option disabled>──────────────</option>`;
        optionsHTML += `<option value="__ADD_NEW_PROJECT__" class="font-bold text-emerald-600">+ Add New Project...</option>`;
    }

    switcher.innerHTML = optionsHTML;
}

function renderLogos(proj) {
    const leftImg = document.getElementById('leftLogoImg');
    const leftPlaceholder = document.getElementById('leftLogoPlaceholder');
    const leftUploadBtn = document.getElementById('leftLogoUploadBtn');

    const rightImg = document.getElementById('rightLogoImg');
    const rightPlaceholder = document.getElementById('rightLogoPlaceholder');
    const rightUploadBtn = document.getElementById('rightLogoUploadBtn');

    if (proj.leftLogo) {
        leftImg.src = proj.leftLogo;
        leftImg.classList.remove('hidden');
        leftPlaceholder.classList.add('hidden');
    } else {
        leftImg.classList.add('hidden');
        leftPlaceholder.classList.remove('hidden');
    }

    if (proj.rightLogo) {
        rightImg.src = proj.rightLogo;
    } else {
        rightImg.src = 'tripatra-logo.png';
        rightImg.onerror = function () { this.onerror = null; this.src = 'tripatra-logo.png'; };
    }
    rightImg.classList.remove('hidden');
    rightPlaceholder.classList.add('hidden');

    if (currentUser && currentUser.role === 'System Administrator') {
        leftUploadBtn.classList.remove('hidden');
        leftUploadBtn.classList.add('flex');
    } else {
        leftUploadBtn.classList.add('hidden');
        leftUploadBtn.classList.remove('flex');
    }
    if (rightUploadBtn) {
        rightUploadBtn.classList.add('hidden');
        rightUploadBtn.classList.remove('flex');
    }
}

function uploadLogo(event, position) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        if (position === 'left') {
            projectsData[currentProjectIndex].leftLogo = e.target.result;
        } else {
            projectsData[currentProjectIndex].rightLogo = e.target.result;
        }
        renderLogos(projectsData[currentProjectIndex]);
        showModal("Berhasil", "Logo proyek berhasil diperbarui.", "success");
    };
    reader.readAsDataURL(file);
}

function getRevisionValues(code) {
    // Revision number mengikuti Revision Number Format pada prosedur:
    // IDC: A.0; A.1; A.2; ...; A.n
    // IFR: A; B; C; ...; continue
    // IFA: B; C; D; ...; continue
    // IFC: 0; 1; 2; ...; n
    // ASB: 1; 2; 3; ...; n
    // IFI: 0, 1, 2, 3, ...; n
    const letters = (start) => Array.from({length: 26}, (_, i) => String.fromCharCode(start.charCodeAt(0) + i));
    if (code === 'IDC') return Array.from({length: 21}, (_, i) => `A.${i}`);
    if (code === 'IFR') return letters('A');
    if (code === 'IFA') return letters('B');
    if (code === 'IFC') return Array.from({length: 21}, (_, i) => String(i));
    if (code === 'ASB') return Array.from({length: 20}, (_, i) => String(i + 1));
    if (code === 'IFI') return Array.from({length: 21}, (_, i) => String(i));
    return ['0'];
}

function renderRevisionHeader(proj) {
    const container = document.getElementById('headerRevStatusContainer');
    if (!container) return;

    const option = getRevisionOption(proj.revisionStatus || 'IFR');
    const approvedCount = proj.lines.filter(l => l.processApproval === 'Approved').length;
    const totalCount = proj.lines.length;
    const isFinalAfc = proj.revisionStatus === 'IFC' && approvedCount === totalCount && totalCount > 0;
    // Header revision/status dibuat interaktif agar dapat diuji dari semua role.
    // Hak approval final tetap dikontrol oleh workflow AFC di fungsi approval.
    const canChangeRevision = !(Array.isArray(proj.cycleRules) && proj.cycleRules.length);
    const activeRule = getActiveCycleRule(proj);
    const currentRevision = activeRule?.revision || proj.revisionNumber || option.defaultNumber;
    const revisionValues = activeRule ? [String(currentRevision)] : getRevisionValues(option.code);

    // Tabel acuan mentor dipisahkan menjadi:
    // REVISI = nilai revision number (A.0/A/B/C/0/1/2/dst.)
    // STATUS = Description (Inter Discipline Check, Issued for Review, dst.)
    const revisionOptions = revisionValues.map(value => `
        <option value="${escapeHtml(value)}" ${String(value) === String(currentRevision) ? 'selected' : ''}>${escapeHtml(value)}</option>
    `).join('');

    // STATUS mengikuti format tabel mentor: CODE - Description
    // Contoh: IFC - Issued for Construction
    const statusOptions = REVISION_OPTIONS.filter(item => !item.resultOnly).map(item => `
        <option value="${item.code}" ${item.code === option.code ? 'selected' : ''}>${escapeHtml(item.code + ' - ' + item.label)}</option>
    `).join('');

    const revisionBadgeCode = option.code === 'IFC' ? 'AFC' : option.code;
    const cycleBadge = Array.isArray(proj.cycleRules) && proj.cycleRules.length ? `CYCLE ${Number(proj.currentCycle || 1)}` : '';
    const revisionBadge = `${cycleBadge ? cycleBadge + ' • ' : ''}REV ${escapeHtml(currentRevision)} (${revisionBadgeCode})`;

    container.innerHTML = `
        <div class="revision-header-grid">
            <div class="revision-field revision-field-left">
                <span class="revision-field-label">REVISI :</span>
                <select id="headerRevisionSelect"
                    ${canChangeRevision ? '' : 'disabled'}
                    onchange="changeRevisionNumber(this.value)"
                    class="revision-status-select revision-number-select">
                    ${revisionOptions}
                </select>
            </div>

            <div class="revision-field revision-field-right">
                <span class="revision-field-label">STATUS :</span>
                <select id="headerDocumentStatusSelect"
                    ${canChangeRevision ? '' : 'disabled'}
                    onchange="changeRevisionStatus(this.value)"
                    class="revision-document-status-select">
                    ${statusOptions}
                </select>
            </div>
        </div>

        <div class="revision-approval-badge">
            <span class="revision-badge-title">${revisionBadge}:</span>
            <span class="revision-badge-value">${approvedCount} Lines Approved</span>
        </div>
        ${Array.isArray(proj.cycleHistory) && proj.cycleHistory.length ? (() => {
            const last = proj.cycleHistory[proj.cycleHistory.length - 1];
            const previousStatus = String(last.configuredStatus || last.finalStatus || '').trim().toUpperCase();
            return `<div class="revision-final-result" title="Revisi sebelumnya telah dikunci setelah Final Approval PM">
                <i class="fa-solid fa-lock"></i> Lock Rev sebelumnya: <b>Cycle ${escapeHtml(last.cycle)}</b> • <b>Rev ${escapeHtml(last.revision)}</b> • <b>${escapeHtml(previousStatus || 'STATUS')}</b>
            </div>`;
        })() : ''}
    `;
}

function changeRevisionNumber(value) {
    const proj = projectsData[currentProjectIndex];
    if (!proj) return;
    if (Array.isArray(proj.cycleRules) && proj.cycleRules.length) { renderRevisionHeader(proj); return; }
    // Revision dapat dipilih oleh user yang sedang mengelola dokumen.
    // Nilai tetap dibatasi hanya pada format revision yang sesuai dengan STATUS.
    const allowed = getRevisionValues(proj.revisionStatus || 'IFR');
    if (!allowed.includes(String(value))) {
        renderRevisionHeader(proj);
        return;
    }
    proj.revisionNumber = String(value);
    saveRevisionState();
    renderDashboard();
}

function changeRevisionStatus(code) {
    const proj = projectsData[currentProjectIndex];
    const option = getRevisionOption(code);
    if (!proj) return;
    if (Array.isArray(proj.cycleRules) && proj.cycleRules.length) { renderRevisionHeader(proj); return; }

    // STATUS menentukan format/nilai awal REVISI secara otomatis.
    // Tidak dibatasi role di header agar dropdown benar-benar dapat digunakan
    // saat testing workflow oleh Engineer/role lain.
    proj.revisionStatus = option.code;
    proj.revisionNumber = option.defaultNumber;
    proj.documentStatus = option.label;

    // IFC/AFC hanya dapat dipilih setelah seluruh line Approved.
    if (code === 'IFC' && !(proj.lines.length > 0 && proj.lines.every(l => l.processApproval === 'Approved'))) {
        proj.revisionStatus = 'IFA';
        proj.revisionNumber = getRevisionOption('IFA').defaultNumber;
        proj.documentStatus = getRevisionOption('IFA').label;
        showModal('Belum Bisa AFC', 'Semua line harus Approved terlebih dahulu sebelum dokumen dapat berstatus IFC / AFC.', 'warning');
    }

    saveRevisionState();
    renderDashboard();
}


const LINE_SIZE_OPTIONS = [
    "0.5", "0.75", "1", "1.5", "2", "3", "4", "6", "8",
    "10", "12", "16", "18", "20", "24", "28", "30", "32", "34"
];

// Hanya baris yang SEDANG diedit dan menghasilkan duplikat yang ditandai merah.
let duplicateSeqIndex = null;

/**
 * Complete Line No. dibuat OTOMATIS dari data line.
 * Format utama: 8"-CP-B1-190016
 * Jika insulation terisi: 2"-LS-B1-190303-IH-40
 */
function normalizeCompleteLineNo(value) {
    return String(value ?? "").replace(/''/g, '"');
}

function isDuplicateSeq(line, lines, index = -1) {
    const seq = String(line?.seq ?? "").replace(/\D/g, "").trim();
    if (!seq || !Array.isArray(lines)) return false;
    return lines.some((other, otherIndex) =>
        otherIndex !== index &&
        String(other?.seq ?? "").replace(/\D/g, "").trim() === seq
    );
}

function buildCompleteLineNo(line, lines = null, index = -1) {
    const size = String(line?.size ?? "").trim().replace(/["']+$/g, "");
    const fluid = String(line?.fluid_id ?? "").trim().toUpperCase();
    const spec = String(line?.spec ?? "").trim().toUpperCase();
    const seq = String(line?.seq ?? "").replace(/\D/g, "").trim();

    if (!size || !fluid || !spec || !seq) return "";

    let result = `${size}"-${fluid}-${spec}-${seq}`;
    const insType = String(line?.ins_type ?? "").trim().toUpperCase();
    const insThick = String(line?.ins_thick ?? "").trim();

    // Jika Insulation Type = "-", data insulation tidak dipakai pada
    // Complete Line No. Nilai Thickness "-" juga diabaikan.
    // Thickness selain "-" boleh berupa huruf, angka, atau tanda apa pun.
    if (insType && insType !== "-") {
        result += `-${insType}`;
        if (insThick && insThick !== "-") {
            result += `-${insThick}`;
        }
    }
    return result;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function escapeHtmlAttr(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function renderLineSizeSelect(line, index, canEdit) {
    const current = String(line.size ?? "").trim();
    const options = LINE_SIZE_OPTIONS.map(size => {
        const selected = current === size ? " selected" : "";
        return `<option value="${size}"${selected}>${size}"</option>`;
    }).join("");

    // Jangan menghilangkan data lama jika nilainya berada di luar daftar.
    const customOption = current && !LINE_SIZE_OPTIONS.includes(current)
        ? `<option value="${escapeHtmlAttr(current)}" selected>${escapeHtmlAttr(current)}"</option>`
        : "";

    return `
        <select
            onchange="updateLineField(${index}, 'size', this.value)"
            ${!canEditLineField('size', canEdit) ? 'disabled' : ''}
            class="w-full px-1.5 py-1 border rounded text-xs bg-white"
            title="Pilih ukuran pipa (inch)"
        >
            <option value=""${current === "" ? " selected" : ""}>Pilih</option>
            ${customOption}
            ${options}
        </select>
    `;
}

function getDesignerEditableFields() {
    return ['size', 'fluid_id', 'spec', 'seq', 'ins_type', 'ins_thick', 'pid', 'from', 'to'];
}

function canEditLineField(field, canEdit) {
    if (canEdit) return true;
    return currentUser && currentUser.role === 'Designer' && getDesignerEditableFields().includes(field);
}

function fieldDisabledAttr(field, canEdit) {
    return canEditLineField(field, canEdit) ? '' : 'disabled';
}

function normalizeMultiValue(value) {
    return String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function getCompletedCycleApprovalInfos(proj, line, stage) {
    const currentCycle = Number(proj?.currentCycle || 1);
    if (currentCycle <= 1 || !line) return [];

    const historyItems = Array.isArray(proj?.cycleHistory) ? proj.cycleHistory : [];
    const snapshots = Array.isArray(proj?.cycleSnapshots) ? proj.cycleSnapshots : [];
    const rules = Array.isArray(proj?.cycleRules) ? proj.cycleRules : [];
    const lineId = String(line.id ?? '');

    // PENTING: histori approval adalah histori per-cycle yang immutable.
    // Jangan pernah menghapus badge cycle sebelumnya hanya karena cycle baru aktif.
    // Sumber utama: snapshot cycle yang sudah final-approved PM. approvalsByCycle
    // tetap dipakai sebagai fallback agar state lama/localStorage tetap terbaca.
    const findSnapshotLine = (completedCycle) => {
        const snapshot = snapshots.find(item => Number(item?.cycle || 0) === completedCycle);
        if (!snapshot || !Array.isArray(snapshot.lines)) return null;
        let snapshotLine = lineId
            ? snapshot.lines.find(l => String(l?.id ?? '') === lineId)
            : null;
        if (!snapshotLine) {
            snapshotLine = snapshot.lines.find(l =>
                String(l?.seq ?? '') === String(line?.seq ?? '') &&
                String(l?.fluid_id ?? '') === String(line?.fluid_id ?? '') &&
                String(l?.spec ?? '') === String(line?.spec ?? '')
            );
        }
        return snapshotLine || null;
    };

    const results = [];
    for (let completedCycle = 1; completedCycle < currentCycle; completedCycle++) {
        const snapshot = snapshots.find(item => Number(item?.cycle || 0) === completedCycle) || null;
        const history = historyItems.find(item => Number(item?.cycle || 0) === completedCycle) || null;
        const snapshotLine = findSnapshotLine(completedCycle);
        const liveBucket = line?.approvalsByCycle?.[String(completedCycle)] || null;
        const snapshotBucket = snapshotLine?.approvalsByCycle?.[String(completedCycle)] || null;

        // Line harus memang sudah ada pada cycle tersebut. Jika snapshot cycle
        // tersedia, snapshot adalah sumber kebenaran (immutable). Jangan memakai
        // live bucket sebagai bukti keberadaan karena versi lama sempat mengisi
        // approval cycle sebelumnya ke line yang BARU dibuat pada cycle berikutnya.
        // Fallback live bucket hanya dipakai untuk data lama yang belum memiliki
        // snapshot cycle sama sekali.
        const snapshotExistsForCycle = !!snapshot;
        const lineExistedInCycle = snapshotExistsForCycle
            ? !!snapshotLine
            : !!liveBucket;
        if (!lineExistedInCycle) continue;

        // Jika cycle sudah tercatat Final Approved oleh PM, histori cycle tersebut
        // harus tetap muncul untuk line yang ada pada cycle itu. Ini mencegah badge
        // Cycle 1/2/3 hilang ketika bucket line lama tidak lagi tersinkron sempurna.
        const cycleFinalApproved = history?.pmApproval === 'Approved' ||
            snapshotBucket?.pmApproval === 'Approved' ||
            snapshotLine?.pmApproval === 'Approved' ||
            liveBucket?.pmApproval === 'Approved';
        if (!cycleFinalApproved) continue;

        const rule = rules[completedCycle - 1] || {};
        const revision = String(
            history?.revision || snapshot?.revision || rule.revision || ''
        ).trim().toUpperCase();
        const previousStatus = String(
            history?.configuredStatus || history?.finalStatus || snapshot?.status || rule.status || ''
        ).trim().toUpperCase();
        if (!revision || !previousStatus) continue;

        results.push({
            cycle: completedCycle,
            revision,
            status: previousStatus,
            label: `Approved Rev ${revision} ${previousStatus}`
        });
    }

    return results;
}

// Kompatibilitas untuk bagian workflow lama yang hanya membutuhkan histori terakhir.
function getCompletedCycleApprovalInfo(proj, line, stage) {
    const infos = getCompletedCycleApprovalInfos(proj, line, stage);
    return infos.length ? infos[infos.length - 1] : null;
}

// True jika line yang sama sudah pernah Final Approved PM pada cycle sebelumnya.
// Dipakai khusus untuk menjaga Process Approval tetap ada dan Aksi Engineer tetap
// abu-abu/nonaktif ketika Cycle 2, 3, dst. dibuka.
function hasPriorFinalApproval(proj, line) {
    const currentCycle = Number(proj?.currentCycle || 1);
    if (currentCycle <= 1 || !line) return false;
    if (getCompletedCycleApprovalInfos(proj, line, 'process').length > 0) return true;

    const buckets = line?.approvalsByCycle || {};
    return Object.entries(buckets).some(([cycleKey, approval]) =>
        Number(cycleKey) < currentCycle && approval?.pmApproval === 'Approved'
    );
}

function recalculateLeadWorkflowStatus(bucket) {
    if (!bucket) return;
    // Status final hanya boleh dibuat oleh PM. Lead approval tidak pernah
    // mengubah status menjadi Approved. Setelah KEDUA Lead selesai approve,
    // status tunggal yang ditampilkan adalah Waiting Approval PM.
    if (bucket.pmApproval === 'Approved') {
        bucket.submissionStatus = 'Approved';
        return;
    }
    if (bucket.processApproval === 'Approved' && bucket.pipingApproval === 'Approved') {
        bucket.submissionStatus = 'Waiting Approval PM';
        return;
    }
    if (bucket.processApproval === 'Approved' || bucket.pipingApproval === 'Approved') {
        bucket.submissionStatus = 'Waiting Approval Lead & PM';
        return;
    }
}

function getApprovalDisplay(line, proj, stage) {
    const cycle = Number(proj?.currentCycle || 1);
    const bucket = getLineApprovalBucket(line, cycle);
    const currentStatus = stage === 'piping' ? (bucket?.pipingApproval || 'Pending') : (bucket?.processApproval || 'Pending');
    const configuredDisplay = getConfiguredCycleDisplay(proj);
    const currentRevision = configuredDisplay.revision;
    const currentStatusCode = configuredDisplay.status;
    const previousApprovals = getCompletedCycleApprovalInfos(proj, line, stage);
    const previous = previousApprovals.length ? previousApprovals[previousApprovals.length - 1] : null;
    // Gunakan status pada bucket DAN line legacy agar status tetap tampil
    // meskipun data approval berasal dari state versi sebelumnya.
    const effectiveSubmissionStatus = bucket?.submissionStatus || line?.submissionStatus || '';
    // Jangan hanya bergantung pada submissionStatus karena state lama/localStorage
    // bisa belum tersinkron. Status approval harus tetap terlihat berdasarkan
    // keputusan Lead/PM yang tersimpan pada bucket cycle aktif.
    const hasWorkflowState = [
        'Waiting Approval Lead & PM',
        'Waiting Approval PM',
        'Approved'
    ].includes(effectiveSubmissionStatus) ||
        bucket?.processApproval === 'Approved' ||
        bucket?.pipingApproval === 'Approved' ||
        bucket?.pmApproval === 'Ready for Final Approval' ||
        bucket?.pmApproval === 'Approved';
    const submitted = bucket?.submitted === true || !!bucket?.submittedAt ||
        bucket?.processApproval === 'Approved' ||
        bucket?.pipingApproval === 'Approved' ||
        bucket?.pmApproval === 'Ready for Final Approval' ||
        bucket?.pmApproval === 'Approved';
    const processLeadApproved = bucket?.processApproval === 'Approved';
    const pipingLeadApproved = bucket?.pipingApproval === 'Approved';
    const bothLeadsApproved = processLeadApproved && pipingLeadApproved;
    // Status final PM disimpan di bucket agar kolom Process Approval selalu
    // mengikuti state approval yang sama.
    const pmApproved = bucket?.pmApproval === 'Approved';
    if (bothLeadsApproved && !pmApproved) {
        bucket.submissionStatus = 'Waiting Approval PM';
    }
    const isProcessEngineer = currentUser?.role === 'Process Engineer';
    // Yang dipertahankan di kolom Process Approval adalah approval pertama
    // yang sudah final untuk line tersebut (misalnya Cycle 1). Ini menjaga
    // approval Cycle 1 tetap terlihat pada Cycle 2/3 berikutnya, tanpa
    // menumpuk badge final dari setiap cycle sebelumnya.
    const retainedPreviousApproval = previousApprovals.length ? previousApprovals[0] : null;
    const previousBadges = retainedPreviousApproval
        ? `<span class="approval-status-badge approval-approved">${escapeHtml(retainedPreviousApproval.label)}</span>`
        : '';
    const previousBadge = previous
        ? `<span class="approval-status-badge approval-approved">${escapeHtml(previous.label)}</span>`
        : '';
    // Histori approval yang dipertahankan tetap tampil untuk Process Engineer,
    // Lead, dan Project Manager. Badge cycle sebelumnya yang lebih baru tidak
    // ditumpuk kembali pada Cycle berikutnya.
    const withPreviousBadge = (html) => `${previousBadges}${html}`;
    const carriedForward = Number(line?.carriedForwardFromCycle || 0) === Math.max(0, cycle - 1) || bucket?.carriedForward === true;

    // Setelah final approval sebuah cycle, line yang sama dibawa ke cycle berikutnya.
    // Sebelum line tersebut dikirim ulang, Process Approval menampilkan HASIL APPROVAL
    // cycle sebelumnya (contoh: Approved Rev A IFR), bukan status target Rev B IFA.
    if (!submitted && carriedForward && previousApprovals.length) {
        return previousBadges;
    }

    // Baris baru/draft belum dikirim: kolom Process Approval sengaja kosong.
    // Engineer tetap melihat tombol Sent pada kolom Aksi.
    // Jika bucket lama masih Draft tetapi line sudah memiliki status terkirim,
    // jangan menghilangkan status dari kolom Process Approval.
    if (!submitted && (effectiveSubmissionStatus === 'Draft' || !effectiveSubmissionStatus)) {
        return '';
    }

    // Satu line hanya boleh menampilkan SATU status utama.
    // Status "Pending Approval (sementara)" hanya untuk Process Engineer
    // pada data yang belum dikirim ke Lead. Role approval lain tidak melihat
    // placeholder tersebut agar status tidak bertumpuk/menyesatkan.
    if (pmApproved) {
        // Setelah PM Final Approve, tampilkan SEMUA approval dari cycle yang
        // sudah selesai (Cycle 1, 2, 3, dst.) ditambah approval cycle aktif.
        // Ini hanya mengubah tampilan histori Process Approval dan tidak
        // mengubah alur workflow cycle berikutnya.
        return `${previousBadges}<span class="approval-status-badge approval-approved">Approved Rev ${escapeHtml(currentRevision)} ${escapeHtml(currentStatusCode)}</span>`;
    }
    // PM memiliki dua tahap: setelah Lead selesai, line siap di-approve PM;
    // setelah PM melakukan Approve All/per-line approval, line masuk tahap
    // Ready for Final Approval dan baru menjadi Approved saat Final Approval.
    if (bucket?.pmApproval === 'Ready for Final Approval') {
        if (currentUser?.role === 'Project Manager' || currentUser?.role === 'System Administrator') {
            return withPreviousBadge(`<span class="approval-status-badge approval-pm-action">Ready for Final Approval</span>`);
        }
        return withPreviousBadge(`<span class="approval-status-badge approval-pending">Ready for Final Approval</span>`);
    }
    if (bothLeadsApproved) {
        // Setelah Lead Process + Lead Piping selesai, PM mendapat status
        // yang sama dengan badge di area bawah: Ready to Approval.
        if (currentUser?.role === 'Project Manager' || currentUser?.role === 'System Administrator') {
            return withPreviousBadge(`<span class="approval-status-badge approval-pm-action">Ready to Approval</span>`);
        }
        return withPreviousBadge(`<span class="approval-status-badge approval-pending">Waiting Approval PM</span>`);
    }

    // Jika Lead pada discipline yang sedang dilihat sudah approve, tetapi
    // Lead discipline lain belum, status tetap menunjukkan bahwa tahap PM
    // belum final dan masih menunggu alur approval berikutnya.
    if ((stage === 'process' && processLeadApproved) || (stage === 'piping' && pipingLeadApproved)) {
        return withPreviousBadge(`<span class="approval-status-badge approval-pending">Waiting Approval PM</span>`);
    }
    if (submitted) {
        // IMPORTANT: approval by either Lead must NOT finalize the line.
        // Final "Approved Rev ..." is reserved for PM approval only.
        // Until both Lead Process and Lead Piping have approved, keep the
        // single visible status as "Waiting Approval Lead & PM".
        if (currentStatus === 'Rejected') {
            return `<span class="approval-status-badge approval-rejected">Rejected Rev ${escapeHtml(currentRevision)} ${escapeHtml(currentStatusCode)}</span>`;
        }
        if (currentStatus === 'Deleted') {
            return `<span class="approval-status-badge approval-deleted">Deleted Rev ${escapeHtml(currentRevision)} ${escapeHtml(currentStatusCode)}</span>`;
        }
        return withPreviousBadge(`<span class="approval-status-badge approval-pending">Waiting Approval Lead &amp; PM</span>`);
    }

    // Saat cycle baru sudah aktif, line lama yang belum dikirim ulang harus
    // menunjukkan target revisi/cycle baru di kolom Process Approval.
    // Baris baru tetap Draft dan sengaja ditangani di atas agar kolom kosong.
    if (cycle > 1 && currentStatus === 'Pending') {
        return withPreviousBadge(`<span class="approval-status-badge approval-pm-action">Approve Rev ${escapeHtml(currentRevision)} ${escapeHtml(currentStatusCode)}</span>`);
    }

    // Jika line baru mewarisi approval cycle sebelumnya, tampilkan histori saja.
    // Jangan menambahkan "Pending Approval (sementara)" di bawahnya.
    if (previousApprovals.length && currentStatus === 'Pending') {
        return previousBadges;
    }

    if (currentStatus === 'Rejected') {
        return `<span class="approval-status-badge approval-rejected">Rejected Rev ${escapeHtml(currentRevision)} ${escapeHtml(currentStatusCode)}</span>`;
    }
    if (currentStatus === 'Deleted') {
        return `<span class="approval-status-badge approval-deleted">Deleted Rev ${escapeHtml(currentRevision)} ${escapeHtml(currentStatusCode)}</span>`;
    }

    // Hanya Process Engineer yang melihat status sementara sebelum Sent.
    if (isProcessEngineer) {
        return `<span class="approval-status-badge approval-pending">Pending Approval (sementara)</span>`;
    }

    // Untuk Lead Process, Lead Piping, dan PM, line yang belum dikirim
    // ditampilkan sebagai belum dikirim agar tidak terlihat seperti pending approval.
    return `<span class="approval-status-badge approval-neutral">Belum Dikirim Engineer</span>`;
}

function getApprovalSelectionStage() {
    if (currentUser?.role === 'Project Manager') return 'manager';
    if (currentUser?.role === 'Lead Piping Engineer') return 'piping';
    if (currentUser?.role === 'Lead Process Engineer') return 'process';
    return null;
}

function isApprovalSelectionRole() {
    return ['Lead Process Engineer', 'Lead Piping Engineer', 'Project Manager'].includes(currentUser?.role);
}

function toggleApprovalRowSelection(index, checked, stage) {
    const set = approvalSelection[stage];
    if (!set) return;
    if (checked) set.add(Number(index));
    else set.delete(Number(index));
    updateApprovalSelectionHeader(stage);
}

function toggleSelectAllApprovalRows(checked, stage) {
    const proj = projectsData[currentProjectIndex];
    const set = approvalSelection[stage];
    if (!proj || !set) return;

    // Pilih / batalkan semua baris yang sedang tampil.
    // Kedua kondisi (dicentang maupun dilepas) tetap memicu perpindahan
    // horizontal ke kolom paling kanan sesuai kebutuhan workflow approval.
    proj.lines.forEach((line, index) => {
        if (checkRowAgainstFilters(line)) {
            if (checked) set.add(index);
            else set.delete(index);
        }
    });

    renderTableRows(proj);

    // renderTableRows sengaja mengembalikan posisi tabel ke kiri agar frozen
    // columns tetap terlihat. Setelah render selesai, jika checkbox "Semua"
    // ditekan, arahkan user otomatis ke sisi kanan untuk melihat Aksi.
    // Berlaku juga saat checkbox dilepas.
    requestAnimationFrame(() => {
        requestAnimationFrame(() => scrollLineListToRightAnimated(true));
    });
}

function managerRequestRevisionSelected() {
    const proj = projectsData[currentProjectIndex];
    if (!proj) return;
    if (!['Project Manager', 'System Administrator'].includes(currentUser?.role)) {
        showModal('Akses Ditolak', 'Hanya Project Manager yang dapat meminta revisi.', 'warning');
        return;
    }

    const set = approvalSelection.manager;
    const selectedIndexes = Array.from(set || []).filter(index =>
        Number.isInteger(index) && proj.lines[index] && checkRowAgainstFilters(proj.lines[index])
    );

    if (!selectedIndexes.length) {
        showModal('Belum Ada Baris Dipilih', 'Pilih baris terlebih dahulu menggunakan checkbox "Semua" atau checkbox pada masing-masing baris.', 'warning');
        return;
    }

    selectedIndexes.forEach(index => {
        const line = proj.lines[index];
        const bucket = getLineApprovalBucket(line, proj.currentCycle);
        bucket.processApproval = 'Pending';
        syncCurrentCycleApproval(line, proj.currentCycle);
        line.pmRevisionRequested = true;
    });

    set.clear();
    saveApprovalState();
    renderDashboard();
    requestAnimationFrame(() => scrollLineListToRightAnimated(true));

    showModal(
        'Need Revision',
        `${selectedIndexes.length} baris ditandai Need Revision oleh Project Manager. Data tidak dihapus dan menunggu perbaikan Process Engineer.`,
        'info'
    );
}


function confirmApproveAllSelected(stage) {
    const proj = projectsData[currentProjectIndex];
    if (!proj) return;

    const set = approvalSelection[stage];
    const selectedIndexes = Array.from(set || []).filter(index =>
        Number.isInteger(index) &&
        proj.lines[index] &&
        checkRowAgainstFilters(proj.lines[index])
    );
    if (!selectedIndexes.length) {
        showModal('Belum Ada Baris Dipilih', 'Pilih baris terlebih dahulu menggunakan checkbox "Semua" atau checkbox pada masing-masing baris.', 'warning');
        return;
    }

    const eligible = selectedIndexes.filter(index => {
        const b = getLineApprovalBucket(proj.lines[index], proj.currentCycle);
        const isSubmitted = b?.submitted === true || !!b?.submittedAt;
        return isSubmitted && (stage === 'piping' ? b.pipingApproval : b.processApproval) !== 'Approved';
    });
    if (!eligible.length) {
        showModal('Tidak Ada Data', 'Semua baris yang dipilih sudah Approved.', 'info');
        return;
    }

    const rule = getActiveCycleRule(proj);
    const revision = String(rule?.revision || proj.revisionNumber || 'A').toUpperCase();
    const status = String(rule?.status || proj.revisionStatus || 'IFR').toUpperCase();
    const roleLabel = stage === 'piping' ? 'Lead Piping' : 'Lead Process';

    openApprovalConfirm(
        `Approve Rev ${revision} ${status}`,
        `Apakah yakin untuk approve Rev ${revision} ${status} untuk ${eligible.length} baris sebagai ${roleLabel}?`,
        () => approveAllSelected(stage)
    );
}

function approveAllSelected(stage) {
    const proj = projectsData[currentProjectIndex];
    if (!proj) return;

    const role = currentUser?.role;
    const allowed = (stage === 'process' && role === 'Lead Process Engineer') ||
                    (stage === 'piping' && role === 'Lead Piping Engineer') ||
                    role === 'System Administrator';
    if (!allowed) {
        showModal('Akses Ditolak', 'Approve All hanya dapat dijalankan oleh Lead Process, Lead Piping, atau System Administrator.', 'warning');
        return;
    }

    const set = approvalSelection[stage];
    const selectedIndexes = Array.from(set || []).filter(index =>
        Number.isInteger(index) &&
        proj.lines[index] &&
        checkRowAgainstFilters(proj.lines[index])
    );

    if (!selectedIndexes.length) {
        showModal('Belum Ada Baris Dipilih', 'Pilih baris terlebih dahulu menggunakan checkbox "Semua" atau checkbox pada masing-masing baris.', 'warning');
        return;
    }

    const eligibleIndexes = selectedIndexes.filter(index => {
        const bucket = getLineApprovalBucket(proj.lines[index], proj.currentCycle);
        return bucket?.submitted === true || !!bucket?.submittedAt;
    });
    if (!eligibleIndexes.length) {
        showModal('Belum Bisa Approve', 'Line harus dikirim (Sent) oleh Engineer sebelum dapat di-approve.', 'warning');
        return;
    }

    eligibleIndexes.forEach(index => {
        const line = proj.lines[index];
        const bucket = getLineApprovalBucket(line, proj.currentCycle);
        if (stage === 'piping') bucket.pipingApproval = 'Approved';
        else bucket.processApproval = 'Approved';
        recalculateLeadWorkflowStatus(bucket);
        syncCurrentCycleApproval(line, proj.currentCycle);
    });

    set.clear();
    saveApprovalState();
    renderDashboard();

    requestAnimationFrame(() => scrollLineListToRightAnimated(true));

    showModal(
        'Approve All Berhasil',
        `${eligibleIndexes.length} baris berhasil di-approve oleh ${stage === 'piping' ? 'Lead Piping' : 'Lead Process'} pada Cycle ${proj.currentCycle} / Rev ${proj.revisionNumber}.`,
        'success'
    );
}

function updateApprovalSelectionHeader(stage) {
    const header = document.getElementById('thActionFilter');
    if (!header || !isApprovalSelectionRole()) return;
    const proj = projectsData[currentProjectIndex];
    const set = approvalSelection[stage];
    const visibleIndexes = (proj?.lines || []).map((line, index) => checkRowAgainstFilters(line) ? index : -1).filter(i => i >= 0);
    const allSelected = visibleIndexes.length > 0 && visibleIndexes.every(i => set.has(i));
    const checkbox = document.getElementById('selectAllApprovalRows');
    if (checkbox) checkbox.checked = allSelected;
}


// =========================================================
// FIELD OWNERSHIP + SENT READINESS
// =========================================================
// PWHT dan tiga field Stress Analysis hanya boleh diisi oleh Stress Engineer.
// Process/Piping Engineer hanya mengisi field engineering. PWHT + Stress Analysis
// hanya milik Stress Engineer. Tombol Sent baru aktif jika seluruh field input
// wajib dari kedua bagian sudah terisi. Nilai valid seperti "-" / "N/A"
// tetap dianggap terisi.
const STRESS_ONLY_FIELDS = ['pwht', 'stress_critical', 'stress_calc_no'];
// Stress Engineer dapat mengisi tiga kolom Stress/PWHT serta Remarks.
// Remarks dapat diisi oleh Process Engineer dan Stress Engineer, tetapi tidak wajib untuk Sent.
const STRESS_EDITABLE_FIELDS = [...STRESS_ONLY_FIELDS, 'remarks'];

const ENGINEER_REQUIRED_FIELDS = [
    'size', 'fluid_id', 'spec', 'seq', 'ins_type', 'ins_thick',
    'pid', 'from', 'to', 'service', 'phase', 'mass', 'vol',
    'press_op', 'press_des', 'temp_op', 'temp_des', 'density', 'visc',
    'nde_rt', 'nde_pt', 'test_med', 'test_press', 'painting'
];

// Stress/PWHT dikerjakan oleh Stress Engineer, tetapi tetap menjadi bagian
// dari kelengkapan satu line. Sent baru hijau jika seluruh data engineering
// DAN seluruh field Stress sudah terisi.
const SEND_REQUIRED_FIELDS = [...ENGINEER_REQUIRED_FIELDS, ...STRESS_ONLY_FIELDS];

function isStressEngineer() {
    return currentUser?.role === 'Stress Engineer';
}

function isStressOnlyField(field) {
    return STRESS_ONLY_FIELDS.includes(field);
}

function isStressEditableField(field) {
    return STRESS_EDITABLE_FIELDS.includes(field);
}

function canEditTableField(field, canEditRow, stressCanEditRow = false) {
    // Kolom PWHT + Stress Analysis (kotak hitam) hanya dapat diisi oleh Stress Engineer.
    // Process/Piping Engineer tidak boleh mendapatkan input aktif pada kolom tersebut.
    if (isStressOnlyField(field)) return !!stressCanEditRow;
    return !!canEditRow;
}

function getMissingEngineerFields(line) {
    return ENGINEER_REQUIRED_FIELDS.filter(field => {
        const value = String(line?.[field] ?? '').trim();
        return value === '';
    });
}

function getMissingSendFields(line) {
    return SEND_REQUIRED_FIELDS.filter(field => {
        const value = String(line?.[field] ?? '').trim();
        return value === '';
    });
}

function isLineReadyForSend(line) {
    // Complete Line No. dibuat otomatis. Sent hanya hijau jika SEMUA field
    // input wajib, termasuk PWHT + Stress Analysis, sudah terisi.
    // Remarks bersifat opsional untuk Process Engineer maupun Stress Engineer.
    return getMissingSendFields(line).length === 0;
}

function sentButtonHtml(index, line, submitted) {
    const proj = projectsData[currentProjectIndex];
    const currentCycle = Number(proj?.currentCycle || 1);
    const bucket = getLineApprovalBucket(line, currentCycle);
    const alreadySubmitted = submitted || bucket?.submitted === true || !!bucket?.submittedAt ||
        ['Waiting Approval Lead & PM', 'Waiting Approval PM', 'Approved'].includes(bucket?.submissionStatus);

    // Setelah line terkirim, Sent dan Delete harus tetap terlihat tetapi berwarna
    // abu-abu/nonaktif. Ini juga berlaku pada cycle berikutnya setelah line cycle
    // aktif dikirim. Workflow cycle baru tetap dapat dimulai dengan Sent selama line
    // pada cycle tersebut masih Draft.
    if (alreadySubmitted) {
        return `
            <button type="button" class="revision-submit-btn sent-btn-disabled"
                title="Data sudah terkirim" aria-label="Sent" disabled aria-disabled="true">
                <i class="fa-solid fa-paper-plane"></i> Sent
            </button>
            <button type="button" class="px-2 py-1 rounded text-xs sent-btn-disabled"
                title="Delete dinonaktifkan karena data sudah terkirim" disabled aria-disabled="true">
                <i class="fa-solid fa-trash"></i>
            </button>`;
    }

    // Aturan yang sudah ada tetap dipertahankan: Delete Process Engineer
    // terkunci pada Cycle 2 dan seterusnya. Sent tidak dikunci agar tahapan
    // Cycle 1 dapat benar-benar diulang pada Cycle 2, 3, dan seterusnya.
    const processDeleteLocked = currentUser?.role === 'Process Engineer' && currentCycle >= 2;
    const ready = isLineReadyForSend(line);
    const sentDisabled = !ready;
    const title = ready
        ? `Kirim data untuk Cycle ${currentCycle}`
        : 'Lengkapi semua kolom data terlebih dahulu';

    return `
        <button type="button"
            onclick="${sentDisabled ? `showSendValidation(${index})` : `sendLineToLead(${index})`}"
            class="revision-submit-btn ${sentDisabled ? 'sent-btn-disabled' : ''}"
            title="${title}"
            aria-label="Sent"
            ${sentDisabled ? 'disabled aria-disabled="true"' : ''}>
            <i class="fa-solid fa-paper-plane"></i> Sent
        </button>
        <button type="button"
            onclick="${processDeleteLocked ? '' : `deleteLineRow(${index})`}"
            class="px-2 py-1 rounded text-xs ${processDeleteLocked ? 'sent-btn-disabled' : 'bg-rose-100 hover:bg-rose-200 text-rose-700'}"
            title="${processDeleteLocked ? `Delete dinonaktifkan untuk Process Engineer pada Cycle ${currentCycle}` : 'Hapus baris'}"
            ${processDeleteLocked ? 'disabled aria-disabled="true"' : ''}>
            <i class="fa-solid fa-trash"></i>
        </button>`;
}

function showSendValidation(index) {
    const proj = projectsData[currentProjectIndex];
    const line = proj?.lines?.[index];
    if (!line) return;

    const missing = getMissingSendFields(line);
    if (!missing.length) return;

    const labels = {
        size: 'Line Size', fluid_id: 'Process Fluid Identifier', spec: 'Pipe.Spec',
        seq: 'Seq. No', ins_type: 'Insulation Type', ins_thick: 'Insulation Thickness',
        pid: 'P&ID No', from: 'From', to: 'To', service: 'Fluid Service', phase: 'Phase',
        mass: 'Mass Flow', vol: 'Volume Flow', press_op: 'Pressure Operating',
        press_des: 'Pressure Design', temp_op: 'Temperature Operating',
        temp_des: 'Temperature Design', density: 'Density', visc: 'Viscosity',
        nde_rt: 'NDE RT', nde_pt: 'NDE PT', test_med: 'Test Medium',
        test_press: 'Test Pressure', painting: 'Painting Code',
        pwht: 'PWHT', stress_critical: 'Stress Analysis Criticality',
        stress_calc_no: 'Stress Analysis Calculation Number'
    };

    const names = missing.map(field => labels[field] || field).join(', ');
    showModal('Data Belum Lengkap', `Lengkapi: ${names}. Setelah seluruh kolom terisi, tombol Sent akan berubah hijau.`, 'warning');
}

function renderTableRows(proj) {
    const tbody = document.getElementById('lineTableBody');
    tbody.innerHTML = '';

    const approvalHeaderEl = document.getElementById('thProcessApproval');
    if (approvalHeaderEl) {
        approvalHeaderEl.textContent = 'Process Approval';
    }

    const actionFilterEl = document.getElementById('thActionFilter');
    const selectionStage = getApprovalSelectionStage();
    if (actionFilterEl) {
        const canBulkApprove = selectionStage && ['Lead Process Engineer', 'Lead Piping Engineer', 'System Administrator'].includes(currentUser?.role);
        const canBulkRevision = selectionStage === 'manager' && ['Project Manager', 'System Administrator'].includes(currentUser?.role);
        actionFilterEl.innerHTML = isApprovalSelectionRole() && selectionStage ? `
            <div class="approval-header-tools">
                <label class="approval-header-check" title="Pilih semua baris yang sedang tampil">
                    <input id="selectAllApprovalRows" type="checkbox" class="h-4 w-4 accent-blue-600 cursor-pointer" onchange="toggleSelectAllApprovalRows(this.checked, '${selectionStage}')">
                    <span>Semua</span>
                </label>
                ${canBulkApprove ? `
                    <label class="approval-header-check approval-all-check" title="Approve seluruh baris yang sudah dipilih">
                        <input id="approveAllRows" type="checkbox" class="h-4 w-4 accent-emerald-600 cursor-pointer" onchange="if(this.checked){ this.checked=false; confirmApproveAllSelected('${selectionStage}'); }">
                        <span>Approve All</span>
                    </label>` : ''}
                ${selectionStage === 'manager' ? `
                    <label class="approval-header-check approval-all-check" title="Approve PM seluruh baris yang sudah dipilih">
                        <input id="approveAllPMRows" type="checkbox" class="h-4 w-4 accent-emerald-600 cursor-pointer" onchange="if(this.checked){ this.checked=false; confirmApproveAllPMSelected(); }">
                        <span>Approve All</span>
                    </label>` : ''}
                ${canBulkRevision ? `
                    <label class="approval-header-check approval-revision-check" title="Tandai seluruh baris yang sudah dipilih untuk revisi">
                        <input id="needRevisionAllRows" type="checkbox" class="h-4 w-4 accent-rose-600 cursor-pointer" onchange="if(this.checked){ this.checked=false; managerRequestRevisionSelected(); }">
                        <span>Need Revisi</span>
                    </label>` : ''}
            </div>` : '';
    }

    const isLeadProcessOnly = currentUser && currentUser.role === 'Lead Process Engineer';
    const isLeadPiping = currentUser && currentUser.role === 'Lead Piping Engineer';
    const isStress = isStressEngineer();
    const canEdit = currentUser && ['Process Engineer', 'Piping Engineer', 'System Administrator'].includes(currentUser.role);
    const canEditRemarks = !!canEdit || !!isLeadProcessOnly || !!isStress;
    const isProcessLead = currentUser && ['Lead Process Engineer', 'System Administrator'].includes(currentUser.role);
    const isPipingLead = currentUser && ['Lead Piping Engineer', 'System Administrator'].includes(currentUser.role);
    const isManager = currentUser && ['Project Manager', 'System Administrator'].includes(currentUser.role);
    const approvalStage = isLeadPiping || (currentUser && currentUser.role === 'Piping Engineer') ? 'piping' : 'process';
    const approvalHeader = 'Process Approval';
    const canApprove = (approvalStage === 'process' && isProcessLead) || (approvalStage === 'piping' && isPipingLead);
    const engineerRole = approvalStage === 'process' ? 'Process Engineer' : 'Piping Engineer';
    const isStageEngineer = currentUser && currentUser.role === engineerRole;

    const approvalState = getCycleApprovalState(proj);
    let allApproved = approvalState.allApproved;

    // Seq. No. harus unik. Baris dengan Seq. No. duplikat diberi tanda merah.
    const seqCounts = {};
    proj.lines.forEach(l => {
        const s = String(l.seq ?? '').replace(/\D/g, '').trim();
        if (s) seqCounts[s] = (seqCounts[s] || 0) + 1;
    });

    proj.lines.forEach((line, index) => {
        if (!checkRowAgainstFilters(line)) return;

        const tr = document.createElement('tr');
        tr.dataset.lineIndex = String(index);
        // Setiap line harus selalu memiliki status approval yang terlihat.
        // Jika data lama/import tidak memiliki field approval, default-nya Pending.
        if (!['Pending', 'Approved', 'Rejected', 'Deleted'].includes(line.processApproval)) line.processApproval = 'Pending';
        if (!['Pending', 'Approved', 'Rejected', 'Deleted'].includes(line.pipingApproval)) line.pipingApproval = 'Pending';
        const currentStatus = approvalStage === 'piping' ? line.pipingApproval : line.processApproval;
        const bucket = getLineApprovalBucket(line, proj.currentCycle);
        const rowInEditMode = !!workflowEditState[approvalStage]?.[index];
        const submitted = bucket?.submitted === true || !!bucket?.submittedAt || bucket?.processApproval === 'Approved' || bucket?.pipingApproval === 'Approved' || bucket?.pmApproval === 'Ready for Final Approval' || bucket?.pmApproval === 'Approved';
        const canEditRow = !!canEdit && ((currentStatus === 'Pending' && !submitted) || rowInEditMode);
        // Stress Engineer hanya mengisi field Stress Analysis + PWHT.
        // Field lainnya tetap read-only untuk role Stress.
        const stressCanEditRow = !!isStress && bucket?.pmApproval !== 'Approved';
        const canEditRemarksRow = canEditRow || !!isLeadProcessOnly || !!stressCanEditRow;
        const normalizedSeq = String(line.seq ?? '').replace(/\D/g, '').trim();
        const isDuplicateSeq = index === duplicateSeqIndex && !!normalizedSeq && seqCounts[normalizedSeq] > 1;
        tr.className = 'hover:bg-blue-50/50 transition border-b border-slate-100';
        if (isDuplicateSeq) {
            tr.title = `WARNING: Seq. No. ${normalizedSeq} duplikat. Mohon gunakan Seq. No. yang lain.`;
        }

        let actionHtml = '-';
        if (isManager) {
            const managerBucket = getLineApprovalBucket(line, proj.currentCycle);
            const managerCanApproveLine = managerBucket?.processApproval === 'Approved' &&
                managerBucket?.pipingApproval === 'Approved' &&
                !['Ready for Final Approval', 'Approved'].includes(managerBucket?.pmApproval);
            const managerLineFinal = managerBucket?.pmApproval === 'Approved';
            const managerLineReadyFinal = managerBucket?.pmApproval === 'Ready for Final Approval';

            if (managerLineFinal) {
                // Setelah PM final approval, aksi tidak boleh terlihat aktif lagi.
                actionHtml = `
                    <div class="approval-actions engineer-revision-actions">
                        <button type="button" class="approval-btn approval-btn-disabled" disabled title="Approved Rev final" aria-label="Approved Rev final">
                            <i class="fa-solid fa-check"></i>
                        </button>
                    </div>`;
            } else {
                actionHtml = `
                    <div class="approval-actions engineer-revision-actions">
                        ${managerCanApproveLine ? `<button type="button" onclick="managerApproveLine(${index})" class="approval-btn approval-btn-approve" title="Approve PM" aria-label="Approve PM"><i class="fa-solid fa-check"></i></button>` : managerLineReadyFinal ? `<button type="button" class="approval-btn approval-btn-disabled" disabled title="Ready for Final Approval" aria-label="Ready for Final Approval"><i class="fa-solid fa-check"></i></button>` : ''}
                        <button type="button" onclick="managerRequestRevision(${index})" class="revision-need-btn" title="Need Revision" aria-label="Need Revision">
                            <i class="fa-solid fa-arrow-rotate-left"></i>
                        </button>
                    </div>`;
            }
        } else if (canApprove) {
            const leadAlreadyApproved = currentStatus === 'Approved';
            const leadCanAct = submitted && !leadAlreadyApproved;
            actionHtml = `
                <div class="approval-actions" aria-label="Approval actions">
                    <button type="button"
                        onclick="${leadCanAct ? `setApprovalStatus(${index}, 'Approved', '${approvalStage}')` : ''}"
                        class="approval-btn approval-btn-approve ${leadCanAct ? '' : 'approval-btn-disabled'}"
                        title="${leadAlreadyApproved ? 'Sudah Approved' : (submitted ? 'Approve' : 'Belum Dikirim Engineer')}"
                        aria-label="${leadAlreadyApproved ? 'Sudah Approved' : (submitted ? 'Approve' : 'Belum Dikirim Engineer')}"
                        ${leadCanAct ? '' : 'disabled'}>
                        <i class="fa-solid fa-check"></i>
                    </button>
                    <button type="button"
                        onclick="${leadCanAct ? `setApprovalStatus(${index}, 'Rejected', '${approvalStage}')` : ''}"
                        class="approval-btn approval-btn-reject ${leadCanAct ? '' : 'approval-btn-disabled'}"
                        title="${leadAlreadyApproved ? 'Terkunci setelah Approved' : (submitted ? 'Reject' : 'Belum Dikirim Engineer')}"
                        aria-label="${leadAlreadyApproved ? 'Terkunci setelah Approved' : (submitted ? 'Reject' : 'Belum Dikirim Engineer')}"
                        ${leadCanAct ? '' : 'disabled'}>
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                    <button type="button"
                        onclick="${submitted ? `leadRequestRevision(${index}, '${approvalStage}')` : ''}"
                        class="approval-btn approval-btn-revision ${submitted ? '' : 'approval-btn-disabled'}"
                        title="${submitted ? 'Minta Revisi' : 'Belum Dikirim Engineer'}"
                        aria-label="${submitted ? 'Minta Revisi' : 'Belum Dikirim Engineer'}"
                        ${submitted ? '' : 'disabled'}>
                        <i class="fa-solid fa-rotate-left"></i>
                    </button>
                </div>`;
        } else if (isStageEngineer) {
            // Jika PM sudah Final Approved pada cycle aktif, line tersebut sudah
            // final untuk cycle itu. Sent dan Delete harus tetap terlihat namun
            // abu-abu/nonaktif pada Cycle 1, 2, 3, dan seterusnya.
            if (bucket?.pmApproval === 'Approved') {
                actionHtml = `
                    <div class="approval-actions">
                        <button type="button" class="revision-submit-btn sent-btn-disabled"
                            title="Data sudah Approved oleh Project Manager pada Cycle ${Number(proj.currentCycle || 1)}" aria-label="Sent" disabled aria-disabled="true">
                            <i class="fa-solid fa-paper-plane"></i> Sent
                        </button>
                        <button type="button" class="px-2 py-1 rounded text-xs sent-btn-disabled"
                            title="Delete dinonaktifkan karena data sudah Approved oleh Project Manager" disabled aria-disabled="true">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>`;
            } else if (rowInEditMode) {
                const readyForResubmit = isLineReadyForSend(line);
                actionHtml = `
                    <div class="approval-actions engineer-revision-actions">
                        <button type="button" onclick="${readyForResubmit ? `resubmitWorkflowEdit(${index}, '${approvalStage}')` : `showSendValidation(${index})`}" class="revision-submit-btn ${readyForResubmit ? '' : 'sent-btn-disabled'}" title="${readyForResubmit ? 'Kirim kembali ke Lead' : 'Lengkapi semua kolom termasuk PWHT dan Stress Analysis'}" ${readyForResubmit ? '' : 'aria-disabled="true"'}><i class="fa-solid fa-paper-plane"></i> Kirim Ulang</button>
                        <button type="button" onclick="cancelWorkflowEdit(${index}, '${approvalStage}')" class="revision-cancel-btn" title="Batalkan edit"><i class="fa-solid fa-rotate-left"></i></button>
                    </div>`;
            } else if (currentStatus === 'Approved') {
                actionHtml = `
                    <div class="approval-actions engineer-revision-actions">
                        <button type="button" onclick="requestWorkflowRevision(${index}, '${approvalStage}')" class="revision-need-btn" title="Need Revision" aria-label="Need Revision"><i class="fa-solid fa-arrow-left"></i></button>
                    </div>`;
            } else if (currentStatus === 'Rejected') {
                actionHtml = `
                    <div class="approval-actions engineer-revision-actions">
                        <button type="button" onclick="startWorkflowEdit(${index}, '${approvalStage}')" class="revision-edit-btn" title="Edit data untuk revisi"><i class="fa-solid fa-pen-to-square"></i> Edit Data</button>
                    </div>`;
            } else if (submitted) {
                actionHtml = `<span class="text-[10px] text-slate-400 font-semibold">Terkirim</span>`;
            } else {
                // Line yang dibawa dari cycle sebelumnya dan sudah Final Approved PM
                // tetap menampilkan status approval sebelumnya. Karena line tersebut
                // sudah pernah terkirim/final approved, tombol Sent dan Delete
                // ditampilkan abu-abu/nonaktif seperti data terkirim.
                const previousCycleApproval = getCompletedCycleApprovalInfo(proj, line, approvalStage);
                const priorFinalApproved = hasPriorFinalApproval(proj, line);
                const carriedApprovedLine = Number(proj.currentCycle || 1) > 1 &&
                    (priorFinalApproved || !!previousCycleApproval) &&
                    bucket?.submitted !== true && !bucket?.submittedAt &&
                    (bucket?.carriedForward === true ||
                     Number(line?.carriedForwardFromCycle || 0) > 0 ||
                     priorFinalApproved);
                if (carriedApprovedLine) {
                    actionHtml = `
                        <div class="approval-actions">
                            <button type="button" class="revision-submit-btn sent-btn-disabled"
                                title="Data sudah terkirim pada cycle sebelumnya" aria-label="Sent" disabled aria-disabled="true">
                                <i class="fa-solid fa-paper-plane"></i> Sent
                            </button>
                            <button type="button" class="px-2 py-1 rounded text-xs sent-btn-disabled"
                                title="Delete dinonaktifkan karena data sudah terkirim" disabled aria-disabled="true">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>`;
                } else {
                    actionHtml = `
                        <div class="approval-actions">
                            ${sentButtonHtml(index, line, submitted)}
                        </div>`;
                }
            }
        }

        tr.innerHTML = `
            <td class="freeze-col freeze-col-1 text-center font-bold text-slate-500">${index + 1}</td>
            <td class="freeze-col freeze-col-2">${renderLineSizeSelect(line, index, canEditRow)}</td>
            <td class="freeze-col freeze-col-3"><input type="text" value="${line.fluid_id}" oninput="updateLineField(${index}, 'fluid_id', this.value)" ${fieldDisabledAttr('fluid_id', canEditRow)} class="w-full px-1.5 py-1 border rounded text-xs uppercase"></td>
            <td class="freeze-col freeze-col-4"><input type="text" value="${line.spec}" oninput="updateLineField(${index}, 'spec', this.value)" ${fieldDisabledAttr('spec', canEditRow)} class="w-full px-1.5 py-1 border rounded text-xs uppercase"></td>
            <td class="freeze-col freeze-col-5"><input type="number" min="0" step="1" inputmode="numeric" value="${String(line.seq ?? '').replace(/\D/g, '')}" oninput="this.value=this.value.replace(/\D/g,''); updateLineField(${index}, 'seq', this.value)" ${fieldDisabledAttr('seq', canEditRow)} class="w-full px-1.5 py-1 border rounded text-xs font-mono"></td>
            
            <td class="freeze-col freeze-col-6"><input type="text" value="${escapeHtmlAttr(line.ins_type)}" oninput="this.value=this.value.toUpperCase(); updateLineField(${index}, 'ins_type', this.value)" ${fieldDisabledAttr('ins_type', canEditRow)} class="w-full px-1.5 py-1 border rounded text-xs uppercase"></td>
            <td class="freeze-col freeze-col-7"><input type="text" value="${escapeHtmlAttr(String(line.ins_thick ?? ''))}" oninput="updateLineField(${index}, 'ins_thick', this.value)" ${fieldDisabledAttr('ins_thick', canEditRow)} class="w-full px-1.5 py-1 border rounded text-xs font-mono"></td>
            
            <td>
    <input
        type="text"
        value='${escapeHtmlAttr(isDuplicateSeq ? "" : buildCompleteLineNo(line, proj.lines, index))}'
        readonly
        tabindex="0"
        title="Complete Line No. dibuat otomatis dari Line Size, Process Fluid Identifier, Pipe.Spec, Seq. No. dan Insulation."
        class="complete-line-no w-full px-1.5 py-1 border rounded text-xs font-bold font-mono text-blue-700 bg-blue-50/50 cursor-not-allowed"
    >
</td>
            <td>
                <textarea wrap="off" rows="1" oninput="this.value=this.value.toUpperCase(); updateLineField(${index}, 'pid', this.value)" ${fieldDisabledAttr('pid', canEditRow)}
                    class="multi-line-cell w-full px-1.5 py-1 border rounded text-xs uppercase" title="${escapeHtmlAttr(String(line.pid ?? '').toUpperCase())}">${escapeHtml(String(line.pid ?? '').toUpperCase())}</textarea>
            </td>
            <td>
                <textarea wrap="off" rows="1" onchange="updateLineField(${index}, 'from', normalizeMultiValue(this.value))" ${fieldDisabledAttr('from', canEditRow)}
                    class="multi-line-cell w-full px-1.5 py-1 border rounded text-xs" title="${escapeHtmlAttr(line.from)}">${escapeHtml(line.from)}</textarea>
            </td>
            <td>
                <textarea wrap="off" rows="1" onchange="updateLineField(${index}, 'to', normalizeMultiValue(this.value))" ${fieldDisabledAttr('to', canEditRow)}
                    class="multi-line-cell w-full px-1.5 py-1 border rounded text-xs" title="${escapeHtmlAttr(line.to)}">${escapeHtml(line.to)}</textarea>
            </td>
            <td><input type="text" value="${escapeHtmlAttr(String(line.service ?? ''))}" oninput="updateLineField(${index}, 'service', this.value)" ${!canEditRow ? 'disabled' : ''} class="w-full px-1.5 py-1 border rounded text-xs service-normal-case"></td>
            <td><input type="text" value="${line.phase}" onchange="updateLineField(${index}, 'phase', this.value)" ${!canEditRow ? 'disabled' : ''} class="w-full px-1.5 py-1 border rounded text-xs"></td>
            <td><input type="text" value="${line.mass}" onchange="updateLineField(${index}, 'mass', this.value)" ${!canEditRow ? 'disabled' : ''} class="w-full px-1.5 py-1 border rounded text-xs font-mono"></td>
            <td><input type="text" value="${line.vol}" onchange="updateLineField(${index}, 'vol', this.value)" ${!canEditRow ? 'disabled' : ''} class="w-full px-1.5 py-1 border rounded text-xs font-mono"></td>
            <td><input type="text" value="${line.press_op}" onchange="updateLineField(${index}, 'press_op', this.value)" ${!canEditRow ? 'disabled' : ''} class="w-full px-1.5 py-1 border rounded text-xs font-mono"></td>
            <td><input type="text" value="${line.press_des}" onchange="updateLineField(${index}, 'press_des', this.value)" ${!canEditRow ? 'disabled' : ''} class="w-full px-1.5 py-1 border rounded text-xs font-mono"></td>
            <td><input type="text" value="${line.temp_op}" onchange="updateLineField(${index}, 'temp_op', this.value)" ${!canEditRow ? 'disabled' : ''} class="w-full px-1.5 py-1 border rounded text-xs font-mono"></td>
            <td><input type="text" value="${line.temp_des}" onchange="updateLineField(${index}, 'temp_des', this.value)" ${!canEditRow ? 'disabled' : ''} class="w-full px-1.5 py-1 border rounded text-xs font-mono"></td>
            <td><input type="text" value="${line.density}" onchange="updateLineField(${index}, 'density', this.value)" ${!canEditRow ? 'disabled' : ''} class="w-full px-1.5 py-1 border rounded text-xs font-mono"></td>
            <td><input type="text" value="${line.visc}" onchange="updateLineField(${index}, 'visc', this.value)" ${!canEditRow ? 'disabled' : ''} class="w-full px-1.5 py-1 border rounded text-xs font-mono"></td>
            <td><input type="text" value="${line.nde_rt}" onchange="updateLineField(${index}, 'nde_rt', this.value)" ${!canEditRow ? 'disabled' : ''} class="w-full px-1.5 py-1 border rounded text-xs"></td>
            <td><input type="text" value="${line.nde_pt}" onchange="updateLineField(${index}, 'nde_pt', this.value)" ${!canEditRow ? 'disabled' : ''} class="w-full px-1.5 py-1 border rounded text-xs"></td>
            <td><input type="text" value="${line.test_med}" onchange="updateLineField(${index}, 'test_med', this.value)" ${!canEditRow ? 'disabled' : ''} class="w-full px-1.5 py-1 border rounded text-xs"></td>
            <td><input type="text" value="${line.test_press}" onchange="updateLineField(${index}, 'test_press', this.value)" ${!canEditRow ? 'disabled' : ''} class="w-full px-1.5 py-1 border rounded text-xs font-mono"></td>
            <td><input type="text" value="${line.painting}" onchange="updateLineField(${index}, 'painting', this.value)" ${!canEditRow ? 'disabled' : ''} class="w-full px-1.5 py-1 border rounded text-xs"></td>
            <td class="bg-amber-50/30"><input type="text" value="${escapeHtmlAttr(String(line.pwht ?? ''))}" onchange="updateLineField(${index}, 'pwht', this.value)" ${canEditTableField('pwht', canEditRow, stressCanEditRow) ? '' : 'disabled'} class="w-full px-1.5 py-1 border rounded text-xs bg-amber-50/50"></td>
            <td class="bg-amber-50/30"><input type="text" value="${escapeHtmlAttr(String(line.stress_critical ?? ''))}" onchange="updateLineField(${index}, 'stress_critical', this.value)" ${canEditTableField('stress_critical', canEditRow, stressCanEditRow) ? '' : 'disabled'} class="w-full px-1.5 py-1 border rounded text-xs bg-amber-50/50"></td>
            <td class="bg-amber-50/30"><input type="text" value="${escapeHtmlAttr(String(line.stress_calc_no ?? ''))}" onchange="updateLineField(${index}, 'stress_calc_no', this.value)" ${canEditTableField('stress_calc_no', canEditRow, stressCanEditRow) ? '' : 'disabled'} class="w-28 px-1.5 py-1 border rounded text-xs bg-amber-50/50 font-mono"></td>
            <td><input type="text" value="${escapeHtmlAttr(line.remarks)}" onchange="updateLineField(${index}, 'remarks', this.value)" ${!canEditRemarksRow ? 'disabled' : ''} class="w-full px-1.5 py-1 border rounded text-xs" title="${isLeadProcessOnly ? 'Lead Process Engineer hanya dapat mengubah Remarks' : ''}"></td>
            
            <td class="text-center bg-amber-50/40 approval-status-cell">
                ${getApprovalDisplay(line, proj, approvalStage)}
            </td>

            <td class="text-center approval-action-cell">
                <div class="flex items-center justify-center gap-1.5">
                    ${isApprovalSelectionRole() ? `<input type="checkbox" class="approval-row-select h-4 w-4 accent-blue-600 cursor-pointer" ${approvalSelection[getApprovalSelectionStage()]?.has(index) ? 'checked' : ''} onchange="toggleApprovalRowSelection(${index}, this.checked, '${getApprovalSelectionStage()}')" title="Pilih baris ${index + 1}" aria-label="Pilih baris ${index + 1}">` : ''}
                    ${actionHtml}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Reset horizontal position after re-render so the full frozen area is visible from the left.
    const lineListScroll = document.querySelector(".line-list-scroll");
    if (lineListScroll) lineListScroll.scrollLeft = 0;
    if (selectionStage) updateApprovalSelectionHeader(selectionStage);

    const managerArea = document.getElementById('managerApprovalArea');
    const managerApprovalText = document.getElementById('managerApprovalText');
    const managerApprovalStatusBadge = document.getElementById('managerApprovalStatusBadge');
    const managerFinalApproveBtn = document.getElementById('managerFinalApproveBtn');
    if (isManager && managerArea) {
        managerArea.classList.remove('hidden');
        const cycle = Number(proj.currentCycle || 1);
        const configuredDisplay = getConfiguredCycleDisplay(proj);
        const rule = configuredDisplay.rule;
        const revision = configuredDisplay.revision;
        const docStatus = configuredDisplay.status;
        // Label tombol PM selalu mengikuti REV/STATUS pada Setting Rule cycle aktif.
        const pmApproveLabel = `Approve Rev ${revision} ${docStatus}`;
        const pmApproved = approvalState.pmApproved;

        managerArea.classList.toggle('manager-pm-approved', pmApproved);
        if (pmApproved) {
            if (managerApprovalStatusBadge) {
                managerApprovalStatusBadge.textContent = `${docStatus} • LOCKED`;
                managerApprovalStatusBadge.className = 'manager-status-badge bg-slate-100 text-slate-600 border border-slate-200';
            }
            if (managerApprovalText) managerApprovalText.textContent = `Rev ${revision} / ${docStatus} sudah Final Approved oleh Project Manager dan terkunci.`;
            if (managerFinalApproveBtn) {
                managerFinalApproveBtn.disabled = true;
                managerFinalApproveBtn.className = 'px-4 py-2 bg-slate-300 text-slate-500 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-not-allowed';
                const span = managerFinalApproveBtn.querySelector('span');
                if (span) span.textContent = `Rev ${revision} ${docStatus} • Locked`;
            }
        } else if (!approvalState.allApproved) {
            const missing = [];
            if (!approvalState.processApproved) missing.push('Lead Process');
            if (!approvalState.pipingApproved) missing.push('Lead Piping');
            if (managerApprovalStatusBadge) {
                managerApprovalStatusBadge.textContent = 'PENDING PM';
                managerApprovalStatusBadge.className = 'manager-status-badge bg-amber-50 text-amber-700 border border-amber-200';
            }
            if (managerApprovalText) managerApprovalText.textContent = `Rev ${revision} / ${docStatus} belum siap di-approve PM. Menunggu: ${missing.join(' dan ')}.`;
            if (managerFinalApproveBtn) {
                managerFinalApproveBtn.disabled = true;
                managerFinalApproveBtn.className = 'px-4 py-2 bg-slate-300 text-slate-500 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-not-allowed';
                const span = managerFinalApproveBtn.querySelector('span');
                if (span) span.textContent = pmApproveLabel;
            }
        } else {
            if (managerApprovalStatusBadge) {
                managerApprovalStatusBadge.textContent = approvalState.pmLinesApproved ? 'Ready for Final Approval' : 'Ready to Approval';
                managerApprovalStatusBadge.className = 'manager-status-badge bg-emerald-50 text-emerald-700 border border-emerald-200';
            }
            if (managerApprovalText) managerApprovalText.textContent = approvalState.pmLinesApproved
                ? `Rev ${revision} / ${docStatus}. Semua line yang dikirim sudah fully approved sampai PM.`
                : `Rev ${revision} / ${docStatus}. Lead Process dan Lead Piping sudah Approved; lakukan approval PM per line atau Approve All.`;
            if (managerFinalApproveBtn) {
                managerFinalApproveBtn.disabled = false;
                managerFinalApproveBtn.className = 'px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center space-x-1.5';
                const span = managerFinalApproveBtn.querySelector('span');
                if (span) span.textContent = pmApproveLabel;
            }
        }
    } else if (managerArea) {
        managerArea.classList.add('hidden');
    }

    // Setelah tbody selesai dibuat, hitung ulang lebar kolom FROM berdasarkan
    // teks terpanjang agar tidak terpotong.
    scheduleLineListAutoFit();
}

function refreshSentButtonForRow(index) {
    const proj = projectsData[currentProjectIndex];
    const line = proj?.lines?.[index];
    const row = document.querySelector(`#lineTableBody tr[data-line-index="${index}"]`);
    if (!line || !row) return;

    const button = row.querySelector('.revision-submit-btn');
    if (!button || button.textContent.includes('Kirim Ulang')) return;

    const bucket = getLineApprovalBucket(line, Number(proj.currentCycle || 1));
    const alreadySubmitted = bucket?.submitted === true || !!bucket?.submittedAt ||
        ['Waiting Approval Lead & PM', 'Waiting Approval PM', 'Approved'].includes(bucket?.submissionStatus);
    if (alreadySubmitted) {
        button.classList.add('sent-btn-disabled');
        button.setAttribute('title', 'Data sudah terkirim');
        button.removeAttribute('onclick');
        button.setAttribute('disabled', 'disabled');
        button.setAttribute('aria-disabled', 'true');
        return;
    }
    const ready = isLineReadyForSend(line);
    button.classList.toggle('sent-btn-disabled', !ready);
    button.setAttribute('title', ready ? 'Kirim data ke Lead' : 'Lengkapi semua kolom data termasuk PWHT dan Stress Analysis');
    if (ready) {
        button.setAttribute('onclick', `sendLineToLead(${index})`);
        button.removeAttribute('aria-disabled');
        button.removeAttribute('disabled');
    } else {
        button.setAttribute('onclick', `showSendValidation(${index})`);
        button.setAttribute('aria-disabled', 'true');
        button.setAttribute('disabled', 'disabled');
    }
}

function updateLineField(index, field, val) {
    const line = projectsData[currentProjectIndex].lines[index];

    if (currentUser && currentUser.role === 'Lead Process Engineer' && field !== 'remarks') {
        renderDashboard();
        showModal("Akses Ditolak", "Lead Process Engineer hanya dapat mengubah kolom Remarks.", "warning");
        return;
    }

    if (currentUser && currentUser.role === 'Designer' && !getDesignerEditableFields().includes(field)) {
        renderDashboard();
        showModal('Akses Ditolak', 'Designer hanya dapat mengisi Line Size, Process Fluid Identifier, Pipe Spec, Seq No, Insulation Type, Insulation Thickness, P&ID No, From, dan To.', 'warning');
        return;
    }

    // Field Stress/PWHT adalah milik Stress Engineer saja.
    // Guard ini tetap berlaku walaupun seseorang mencoba memanggil
    // updateLineField() langsung dari browser console.
    if (isStressOnlyField(field) && currentUser?.role !== 'Stress Engineer') {
        renderDashboard();
        showModal('Akses Ditolak', 'Kolom PWHT dan Stress Analysis hanya dapat diisi oleh Stress Engineer.', 'warning');
        return;
    }

    // Stress Engineer hanya boleh mengubah PWHT, Stress Analysis, dan Remarks.
    if (currentUser?.role === 'Stress Engineer' && !isStressEditableField(field)) {
        renderDashboard();
        showModal('Akses Ditolak', 'Stress Engineer hanya dapat mengisi PWHT, Stress Analysis Criticality, Stress Analysis Calculation Number, dan Remarks.', 'warning');
        return;
    }

    if (field === 'seq') {
        val = String(val ?? '').replace(/\D/g, '');
    }

    if (field === 'ins_type') {
        val = String(val ?? '').toUpperCase();
    }

    if (field === 'service') {
        val = String(val ?? '');
    }

    if (field === 'pid') {
        val = String(val ?? '').toUpperCase();
    }

    if (field === 'ins_thick') {
        // Thickness [mm] menerima huruf, angka, tanda, dan nilai "-".
        val = String(val ?? '');
    }

    line[field] = val;

    const currentLines = projectsData[currentProjectIndex].lines;

    // Hanya baris yang sedang diedit yang ditandai merah saat duplikat.
    if (field === 'seq') {
        const normalized = String(val ?? '').replace(/\D/g, '').trim();
        const duplicateLines = normalized
            ? currentLines.filter((l, i) =>
                i !== index && String(l.seq ?? '').replace(/\D/g, '').trim() === normalized)
            : [];

        const row = document.querySelector(`#lineTableBody tr[data-line-index="${index}"]`);
        const seqInput = row ? row.querySelector('input[type="number"], input[inputmode="numeric"]') : null;

        if (duplicateLines.length) {
            // Tandai HANYA baris yang sedang diedit. Baris lama tetap normal.
            duplicateSeqIndex = index;
            if (row) row.classList.remove('duplicate-seq-row');
            if (seqInput) {
                seqInput.classList.add('duplicate-seq-input');
                seqInput.title = `WARNING: Seq. No. ${normalized} sudah digunakan pada line lain. Mohon gunakan Seq. No. yang lain.`;
            }
            line.complete_no = '';
            showModal('Duplikat Seq. No.', `Seq. No. ${normalized} sudah digunakan pada line lain. Mohon gunakan Seq. No. yang lain.`, 'warning');
        } else {
            if (duplicateSeqIndex === index) duplicateSeqIndex = null;
            if (row) row.classList.remove('duplicate-seq-row');
            if (seqInput) {
                seqInput.classList.remove('duplicate-seq-input');
                seqInput.title = '';
            }
        }
    }

    // Regenerasi Complete Line No hanya untuk baris yang valid.
    currentLines.forEach((item, itemIndex) => {
        if (itemIndex === duplicateSeqIndex) {
            const s = String(item.seq ?? '').replace(/\D/g, '').trim();
            const hasOtherSameSeq = s && currentLines.some((other, otherIndex) =>
                otherIndex !== itemIndex && String(other.seq ?? '').replace(/\D/g, '').trim() === s
            );
            item.complete_no = hasOtherSameSeq ? '' : buildCompleteLineNo(item, currentLines, itemIndex);
        } else if (item.complete_no === '' || field !== 'seq' || itemIndex === index) {
            item.complete_no = buildCompleteLineNo(item, currentLines, itemIndex);
        }
    });

    // Update hanya baris yang terlibat; tidak me-render ulang seluruh tabel.
    document.querySelectorAll('#lineTableBody tr[data-line-index]').forEach(rowEl => {
        const rowIndex = Number(rowEl.dataset.lineIndex);
        const completeInput = rowEl.querySelector('.complete-line-no');
        const seqInputEl = rowEl.querySelector('input[type="number"], input[inputmode="numeric"]');

        // Tidak ada row merah. Hanya input Seq. No. yang sedang diedit.
        rowEl.classList.remove('duplicate-seq-row');
        const isCurrentDuplicate = rowIndex === duplicateSeqIndex;
        if (seqInputEl) seqInputEl.classList.toggle('duplicate-seq-input', isCurrentDuplicate);

        if (completeInput && currentLines[rowIndex]) {
            completeInput.value = currentLines[rowIndex].complete_no || '';
        }
    });

    // Warna/aksi Sent diperbarui langsung saat field terakhir diisi.
    refreshSentButtonForRow(index);
}

function addLineRow() {
    if (currentUser && ['Lead Process Engineer', 'Lead Piping Engineer', 'Project Manager'].includes(currentUser.role)) {
        const roleLabel = currentUser.role === 'Project Manager' ? 'Project Manager' : currentUser.role;
        showModal("Akses Ditolak", `${roleLabel} tidak memiliki akses untuk menambah Pipe Line.`, "warning");
        return;
    }
    const proj = projectsData[currentProjectIndex];

    // Baris baru harus benar-benar kosong agar user mengisi data sendiri.
    // Hanya No dan status approval yang dihasilkan oleh sistem.
    proj.lines.push({
        id: proj.lines.length + 1,
        size: "",
        fluid_id: "",
        spec: "",
        seq: "",
        ins_type: "",
        ins_thick: "",
        complete_no: "",
        pid: "",
        from: "",
        to: "",
        service: "",
        phase: "",
        mass: "",
        vol: "",
        press_op: "",
        press_des: "",
        temp_op: "",
        temp_des: "",
        density: "",
        visc: "",
        nde_rt: "",
        nde_pt: "",
        test_med: "",
        test_press: "",
        painting: "",
        pwht: "",
        stress_critical: "",
        stress_calc_no: "",
        remarks: "",
        processApproval: "Pending",
        pipingApproval: "Pending",
        pmApproval: "Pending",
        submissionStatus: "Draft",
        approvalsByCycle: {}
    });

    // Line yang BARU dibuat pada cycle aktif tidak boleh mewarisi approval
    // cycle sebelumnya. Hanya line yang memang ada pada cycle lama yang boleh
    // menampilkan histori approval Cycle 1, Cycle 2, dan seterusnya.
    // Dengan demikian Process Approval pada line baru tidak muncul sebagai
    // "Approved Rev ..." secara salah.
    const newLine = proj.lines[proj.lines.length - 1];
    const activeCycle = Number(proj.currentCycle || 1);

    getLineApprovalBucket(newLine, activeCycle);
    syncCurrentCycleApproval(newLine, activeCycle);

    saveApprovalState();
    renderDashboard();

    // Setelah baris baru dibuat, langsung arahkan viewport tabel ke BARIS TERAKHIR.
    // Tidak perlu user melakukan scroll manual ke bawah.
    requestAnimationFrame(() => {
        const tableScroll = document.querySelector(".line-list-scroll");
        const tbody = document.getElementById("lineTableBody");

        if (tableScroll) {
            // Pastikan posisi horizontal tetap di awal/freeze columns.
            tableScroll.scrollLeft = 0;

            // Geser vertikal sampai baris terakhir benar-benar terlihat.
            tableScroll.scrollTop = tableScroll.scrollHeight;

            // Fokus ke input pertama pada baris baru tanpa mengubah posisi halaman.
            const lastRow = tbody ? tbody.lastElementChild : null;
            if (lastRow) {
                const firstInput = lastRow.querySelector("input, select, textarea");
                if (firstInput) firstInput.focus({ preventScroll: true });
            }
        }
    });

    showModal("Berhasil", "Baris pipa kosong berhasil ditambahkan dan tabel otomatis menuju baris terakhir.", "success");
}

function scrollLineListToRightAnimated(keepAtRight = true) {
    const scroller = document.querySelector('.line-list-scroll');
    if (!scroller) return;

    const move = () => {
        const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
        if (maxScroll <= 0) return;
        // Gunakan native smooth scroll supaya perpindahan ke kolom kanan
        // benar-benar terlihat bergerak, bukan sekadar lompat posisi.
        scroller.scrollTo({ left: maxScroll, behavior: 'smooth' });
    };

    requestAnimationFrame(() => {
        move();
        // Render/autofit tabel dapat mengubah scrollWidth. Pastikan target
        // kanan dihitung ulang setelah layout stabil.
        requestAnimationFrame(() => {
            move();
            if (keepAtRight) {
                setTimeout(() => {
                    const current = document.querySelector('.line-list-scroll');
                    if (!current) return;
                    const maxScroll = Math.max(0, current.scrollWidth - current.clientWidth);
                    current.scrollTo({ left: maxScroll, behavior: 'smooth' });
                }, 180);
            }
        });
    });
}

function requestWorkflowRevision(index, stage) {
    const expectedRole = stage === 'process' ? 'Process Engineer' : 'Piping Engineer';
    if (currentUser?.role !== expectedRole && currentUser?.role !== 'System Administrator') {
        showModal('Akses Ditolak', `Hanya ${expectedRole} yang dapat meminta revisi pada tahap ini.`, 'warning');
        return;
    }

    // Tombol panah/back pada line yang sudah Approved berarti NEED REVISION.
    // Data tidak dihapus dan status Approved tidak langsung diubah; Engineer
    // masuk ke mode edit terlebih dahulu. Status baru menjadi Pending saat
    // tombol "Kirim Ulang" ditekan setelah perbaikan selesai.
    workflowEditState[stage][index] = true;
    renderDashboard();

    requestAnimationFrame(() => {
        const scroller = document.querySelector('.line-list-scroll');
        const row = document.querySelector(`#lineTableBody tr[data-line-index=\"${index}\"]`);
        if (!scroller) return;
        if (row) {
            const scrollerRect = scroller.getBoundingClientRect();
            const rowRect = row.getBoundingClientRect();
            if (rowRect.top < scrollerRect.top) scroller.scrollTop -= (scrollerRect.top - rowRect.top);
            else if (rowRect.bottom > scrollerRect.bottom) scroller.scrollTop += (rowRect.bottom - scrollerRect.bottom);
        }
        scrollLineListToRightAnimated(true);
    });

    showModal('Need Revision', `Line ${index + 1} berstatus Approved dan dibuka kembali untuk revisi. Setelah diperbaiki, klik \"Kirim Ulang\" untuk mengirim kembali ke Lead ${stage === 'process' ? 'Process' : 'Piping'}.`, 'info');
}

function startWorkflowEdit(index, stage) {
    const expectedRole = stage === 'process' ? 'Process Engineer' : 'Piping Engineer';
    if (currentUser?.role !== expectedRole && currentUser?.role !== 'System Administrator') {
        showModal('Akses Ditolak', `Hanya ${expectedRole} yang dapat memperbaiki data pada tahap ini.`, 'warning');
        return;
    }

    workflowEditState[stage][index] = true;
    renderDashboard();

    // Saat Edit Data dibuka dari kolom kanan (Process/Piping Approval),
    // tabel otomatis kembali ke sisi kiri agar kolom input pertama langsung terlihat.
    // Berlaku sama untuk Process Engineer dan Piping Engineer.
    requestAnimationFrame(() => {
        const scroller = document.querySelector('.line-list-scroll');
        const row = document.querySelector(`#lineTableBody tr[data-line-index="${index}"]`);

        if (scroller) {
            // Hanya ubah posisi horizontal; posisi vertikal tetap mengikuti baris yang diedit.
            scroller.scrollLeft = 0;
        }

        if (scroller && row) {
            const scrollerRect = scroller.getBoundingClientRect();
            const rowRect = row.getBoundingClientRect();

            if (rowRect.top < scrollerRect.top) {
                scroller.scrollTop -= (scrollerRect.top - rowRect.top);
            } else if (rowRect.bottom > scrollerRect.bottom) {
                scroller.scrollTop += (rowRect.bottom - scrollerRect.bottom);
            }
        }

        // Pastikan tetap di paling kiri setelah browser menyelesaikan layout.
        requestAnimationFrame(() => {
            if (scroller) scroller.scrollLeft = 0;
        });
    });
}

function cancelWorkflowEdit(index, stage) {
    delete workflowEditState[stage][index];
    renderDashboard();
}

function resubmitWorkflowEdit(index, stage) {
    const expectedRole = stage === 'process' ? 'Process Engineer' : 'Piping Engineer';
    if (currentUser?.role !== expectedRole && currentUser?.role !== 'System Administrator') {
        showModal('Akses Ditolak', `Hanya ${expectedRole} yang dapat mengirim ulang data.`, 'warning');
        return;
    }
    const proj = projectsData[currentProjectIndex];
    const line = proj?.lines?.[index];
    if (!line) return;
    const seq = String(line.seq ?? '').replace(/\D/g, '').trim();
    if (!seq) {
        showModal('Data Belum Lengkap', 'Seq. No. wajib diisi sebelum data dikirim kembali.', 'warning');
        return;
    }
    const missing = getMissingSendFields(line);
    if (missing.length) {
        showSendValidation(index);
        return;
    }
    const bucket = getLineApprovalBucket(line, proj.currentCycle);
    if (stage === 'process') {
        bucket.processApproval = 'Pending';
    } else {
        bucket.pipingApproval = 'Pending';
    }
    bucket.pmApproval = 'Pending';
    bucket.submitted = true;
    delete line.carriedForwardFromCycle;
    bucket.carriedForward = false;
    bucket.submittedAt = new Date().toISOString();
    bucket.submissionStatus = 'Waiting Approval Lead & PM';
    syncCurrentCycleApproval(line, proj.currentCycle);
    delete workflowEditState[stage][index];
    saveApprovalState();
    renderDashboard();

    // Setelah data diperbaiki dan dikirim ulang, tabel harus bergerak otomatis
    // ke ujung kanan. Gunakan helper yang sama dengan Need Revision supaya
    // perilakunya benar-benar konsisten dan tidak perlu scroll manual.
    scrollLineListToRightAnimated(true);

    showModal('Berhasil Dikirim Ulang', `Line ${index + 1} sudah diperbaiki dan dikirim kembali ke Lead ${stage === 'process' ? 'Process' : 'Piping'} untuk pemeriksaan ulang.`, 'success');
}

function sendLineToLead(index) {
    const proj = projectsData[currentProjectIndex];
    const line = proj?.lines?.[index];
    if (!proj || !line || !['Process Engineer', 'Piping Engineer', 'System Administrator'].includes(currentUser?.role)) {
        showModal('Akses Ditolak', 'Hanya Engineer yang dapat mengirim data ke Lead.', 'warning');
        return;
    }
    // Cycle 2, 3, dan seterusnya mengulang tahapan Cycle 1. Karena itu Engineer
    // tetap dapat mengirim line yang sudah lengkap pada setiap cycle.
    const missing = getMissingSendFields(line);
    if (missing.length) {
        showSendValidation(index);
        return;
    }
    const bucket = getLineApprovalBucket(line, proj.currentCycle);
    if (!['Draft', '', 'Pending Approval (sementara)'].includes(bucket.submissionStatus)) {
        showModal('Data Sudah Dikirim', 'Line ini sudah berada dalam proses approval dan tidak perlu dikirim ulang.', 'info');
        return;
    }
    bucket.processApproval = 'Pending';
    bucket.pipingApproval = 'Pending';
    bucket.pmApproval = 'Pending';
    bucket.submitted = true;
    delete line.carriedForwardFromCycle;
    bucket.carriedForward = false;
    bucket.submittedAt = new Date().toISOString();
    bucket.submissionStatus = 'Waiting Approval Lead & PM';
    line.pmRevisionRequested = false;
    syncCurrentCycleApproval(line, proj.currentCycle);
    saveApprovalState();
    renderDashboard();
    requestAnimationFrame(() => scrollLineListToRightAnimated(true));
    showModal('Data Terkirim', `Line ${index + 1} berhasil dikirim ke Lead. Status berubah menjadi "Waiting Approval Lead & PM".`, 'success');
}

function deleteLineRow(index) {
    const proj = projectsData[currentProjectIndex];
    const line = proj?.lines?.[index];
    const bucket = line ? getLineApprovalBucket(line, Number(proj?.currentCycle || 1)) : null;
    const alreadySubmitted = bucket?.submitted === true || !!bucket?.submittedAt ||
        ['Waiting Approval Lead & PM', 'Waiting Approval PM', 'Approved'].includes(bucket?.submissionStatus);
    if (alreadySubmitted) {
        showModal('Akses Dikunci', 'Data yang sudah terkirim tidak dapat dihapus pada cycle aktif.', 'warning');
        return;
    }
    if (currentUser?.role === 'Process Engineer' && Number(proj?.currentCycle || 1) >= 2) {
        showModal('Akses Dikunci', `Tombol Delete Process Engineer dinonaktifkan pada Cycle ${proj.currentCycle}.`, 'warning');
        return;
    }
    if (currentUser && currentUser.role === 'Lead Process Engineer') {
        showModal("Akses Ditolak", "Lead Process Engineer tidak memiliki akses untuk menghapus Pipe Line.", "warning");
        return;
    }
    projectsData[currentProjectIndex].lines.splice(index, 1);
    saveApprovalState();
    renderDashboard();
    showModal("Informasi", "Baris pipa telah dihapus.", "info");
}


function leadRequestRevision(index, stage = 'process') {
    const proj = projectsData[currentProjectIndex];
    const line = proj?.lines?.[index];
    const role = currentUser?.role;
    const allowed = (stage === 'process' && role === 'Lead Process Engineer') ||
                    (stage === 'piping' && role === 'Lead Piping Engineer') ||
                    role === 'System Administrator';
    if (!proj || !line || !allowed) {
        showModal('Akses Ditolak', 'Hanya Lead terkait yang dapat meminta revisi.', 'warning');
        return;
    }

    const bucket = getLineApprovalBucket(line, proj.currentCycle);
    const stageLabel = stage === 'piping' ? 'Lead Piping' : 'Lead Process';
    if (bucket?.pmApproval === 'Approved') {
        showModal('Line Sudah Final', 'Line yang sudah di-approve PM tidak dapat diminta revisi pada cycle aktif.', 'warning');
        return;
    }

    if (stage === 'piping') bucket.pipingApproval = 'Rejected';
    else bucket.processApproval = 'Rejected';
    bucket.pmApproval = 'Pending';
    bucket.submitted = true;
    delete line.carriedForwardFromCycle;
    bucket.carriedForward = false;
    bucket.submittedAt = new Date().toISOString();
    bucket.submissionStatus = 'Waiting Approval Lead & PM';
    line.pmRevisionRequested = false;

    syncCurrentCycleApproval(line, proj.currentCycle);
    saveApprovalState();
    renderDashboard();
    requestAnimationFrame(() => scrollLineListToRightAnimated(true));

    showModal(
        'Revisi Diminta',
        `Line ${index + 1} diminta revisi oleh ${stageLabel}. Engineer dapat memperbaiki data lalu mengirim ulang.`,
        'info'
    );
}

function setApprovalStatus(index, status, stage = 'process') {
    const proj = projectsData[currentProjectIndex];
    const line = proj?.lines?.[index];
    if (!line) return;

    const role = currentUser?.role;
    const allowed = (stage === 'process' && role === 'Lead Process Engineer') ||
                    (stage === 'piping' && role === 'Lead Piping Engineer') ||
                    role === 'System Administrator';
    if (!allowed) {
        showModal('Akses Ditolak', 'Hanya Lead Process untuk Process Approval dan Lead Piping untuk Piping Approval yang dapat menjalankan aksi ini.', 'warning');
        return;
    }

    const bucket = getLineApprovalBucket(line, proj.currentCycle);
    const isSubmitted = bucket?.submitted === true || !!bucket?.submittedAt;
    if (!isSubmitted) {
        showModal('Belum Bisa Approve', 'Line harus dikirim (Sent) oleh Engineer sebelum dapat di-approve atau direvisi oleh Lead.', 'warning');
        return;
    }
    if (stage === 'piping') {
        bucket.pipingApproval = status;
    } else {
        bucket.processApproval = status;
    }
    if (status === 'Rejected') {
        bucket.submissionStatus = 'Waiting Approval Lead & PM';
    } else {
        recalculateLeadWorkflowStatus(bucket);
    }
    syncCurrentCycleApproval(line, proj.currentCycle);

    saveApprovalState();
    renderDashboard();

    // Setelah Lead Process / Lead Piping memberi keputusan, otomatis
    // geser tabel ke sisi kanan agar status Approval dan kolom Aksi
    // langsung terlihat tanpa user harus melakukan scroll manual.
    requestAnimationFrame(() => {
        const scroller = document.querySelector('.line-list-scroll');
        if (!scroller) return;

        // Tunggu satu frame lagi supaya lebar tabel sudah selesai dihitung
        // setelah render ulang, lalu lakukan perpindahan horizontal yang halus.
        requestAnimationFrame(() => {
            const maxScrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
            scroller.scrollTo({
                left: maxScrollLeft,
                behavior: 'smooth'
            });
        });
    });

    const stageLabel = stage === 'piping' ? 'Piping Approval' : 'Process Approval';
    let modalMessage;
    if (status === 'Approved') {
        if (bucket.processApproval === 'Approved' && bucket.pipingApproval === 'Approved') {
            modalMessage = `${stageLabel} line ${index + 1} sudah Approved oleh kedua Lead. Status Process Approval sekarang \"Waiting Approval PM\". PM harus melakukan approval final.`;
        } else {
            modalMessage = `${stageLabel} line ${index + 1} sudah Approved oleh ${stage === 'piping' ? 'Lead Piping' : 'Lead Process'}. Status Process Approval tetap \"Waiting Approval Lead & PM\" sampai kedua Lead selesai approve.`;
        }
    } else {
        modalMessage = `${stageLabel} line ${index + 1} menjadi ${status}.`;
    }
    showModal('Status Diperbarui', modalMessage, status === 'Approved' ? 'success' : status === 'Rejected' ? 'warning' : 'info');
}

// Kompatibilitas untuk pemanggilan lama.
function toggleProcessApproval(index) {
    const line = projectsData[currentProjectIndex].lines[index];
    const next = line?.processApproval === 'Approved' ? 'Pending' : 'Approved';
    setApprovalStatus(index, next, 'process');
}

function managerApproveLine(index) {
    const proj = projectsData[currentProjectIndex];
    const line = proj?.lines?.[index];
    if (!proj || !line || !['Project Manager', 'System Administrator'].includes(currentUser?.role)) {
        showModal('Akses Ditolak', 'Hanya Project Manager yang dapat memberikan approval PM.', 'warning');
        return;
    }
    const bucket = getLineApprovalBucket(line, proj.currentCycle);
    if (bucket.processApproval !== 'Approved' || bucket.pipingApproval !== 'Approved') {
        showModal('Belum Bisa Approve', 'Line harus sudah Approved oleh Lead Process dan Lead Piping.', 'warning');
        return;
    }
    bucket.pmApproval = 'Ready for Final Approval';
    bucket.submissionStatus = 'Waiting Approval PM';
    syncCurrentCycleApproval(line, proj.currentCycle);
    saveApprovalState();
    renderDashboard();
    requestAnimationFrame(() => scrollLineListToRightAnimated(true));
    showModal('Approval PM Berhasil', `Line ${index + 1} sudah di-approve PM dan masuk tahap Ready for Final Approval.`, 'success');
}


function confirmApproveAllPMSelected() {
    const proj = projectsData[currentProjectIndex];
    if (!proj) return;
    const set = approvalSelection.manager;
    const selectedIndexes = Array.from(set || []).filter(index =>
        Number.isInteger(index) && proj.lines[index] && checkRowAgainstFilters(proj.lines[index])
    );
    const eligible = selectedIndexes.filter(index => {
        const b = getLineApprovalBucket(proj.lines[index], proj.currentCycle);
        return b.processApproval === 'Approved' && b.pipingApproval === 'Approved' && !['Ready for Final Approval', 'Approved'].includes(b.pmApproval);
    });
    if (!eligible.length) {
        showModal('Belum Bisa Approve', 'Tidak ada baris yang siap untuk approval PM.', 'warning');
        return;
    }
    const rule = getActiveCycleRule(proj);
    const revision = String(rule?.revision || proj.revisionNumber || 'A').toUpperCase();
    const status = String(rule?.status || proj.revisionStatus || 'IFR').toUpperCase();
    openApprovalConfirm(
        `Approve Rev ${revision} ${status}`,
        `Apakah yakin untuk approve Rev ${revision} ${status} untuk ${eligible.length} baris sebagai Project Manager?`,
        () => approveAllPMSelected()
    );
}

function approveAllPMSelected() {
    const proj = projectsData[currentProjectIndex];
    if (!proj || !['Project Manager', 'System Administrator'].includes(currentUser?.role)) {
        showModal('Akses Ditolak', 'Hanya Project Manager yang dapat menggunakan Approve All.', 'warning');
        return;
    }
    const set = approvalSelection.manager;
    const selectedIndexes = Array.from(set || []).filter(index => Number.isInteger(index) && proj.lines[index] && checkRowAgainstFilters(proj.lines[index]));
    if (!selectedIndexes.length) {
        showModal('Belum Ada Baris Dipilih', 'Pilih baris terlebih dahulu.', 'warning');
        return;
    }
    const eligible = selectedIndexes.filter(index => {
        const b = getLineApprovalBucket(proj.lines[index], proj.currentCycle);
        return b.processApproval === 'Approved' && b.pipingApproval === 'Approved' && !['Ready for Final Approval', 'Approved'].includes(b.pmApproval);
    });
    if (!eligible.length) {
        showModal('Belum Bisa Approve', 'Tidak ada baris yang sudah Approved oleh Lead Process dan Lead Piping.', 'warning');
        return;
    }
    eligible.forEach(index => {
        const line = proj.lines[index];
        const b = getLineApprovalBucket(line, proj.currentCycle);
        b.pmApproval = 'Ready for Final Approval';
        b.submissionStatus = 'Waiting Approval PM';
        syncCurrentCycleApproval(line, proj.currentCycle);
    });
    set.clear();
    saveApprovalState();
    renderDashboard();
    requestAnimationFrame(() => scrollLineListToRightAnimated(true));
    showModal('Approve All Berhasil', `${eligible.length} baris sudah masuk tahap Ready for Final Approval. Klik Approve Rev ${String(getActiveCycleRule(proj)?.revision || proj.revisionNumber || 'A').toUpperCase()} ${String(getActiveCycleRule(proj)?.status || proj.revisionStatus || 'IFR').toUpperCase()} untuk final approval.`, 'success');
}

function managerRequestRevision(index) {
    const proj = projectsData[currentProjectIndex];
    if (!proj || !proj.lines?.[index]) return;
    if (!['Project Manager', 'System Administrator'].includes(currentUser?.role)) {
        showModal('Akses Ditolak', 'Hanya Project Manager yang dapat meminta revisi.', 'warning');
        return;
    }

    const line = proj.lines[index];
    const bucket = getLineApprovalBucket(line, proj.currentCycle);
    bucket.processApproval = 'Pending';
    bucket.pmApproval = 'Pending';
    bucket.submitted = true;
    delete line.carriedForwardFromCycle;
    bucket.carriedForward = false;
    bucket.submittedAt = new Date().toISOString();
    bucket.submissionStatus = 'Waiting Approval Lead & PM';
    syncCurrentCycleApproval(line, proj.currentCycle);
    line.pmRevisionRequested = true;
    saveApprovalState();
    renderDashboard();
    showModal(
        'Need Revision',
        `Line ${index + 1} ditandai Need Revision oleh Project Manager. Data tidak dihapus dan menunggu perbaikan Process Engineer.`,
        'info'
    );
}

function managerFinalApproval() {
    // Saat PM menekan tombol ungu Final Approval, langsung arahkan tabel
    // ke sisi paling kanan agar Process Approval + Aksi terlihat.
    if (currentUser?.role === 'Project Manager') {
        requestAnimationFrame(() => scrollLineListToRightAnimated(true));
    }

    const proj = projectsData[currentProjectIndex];
    const role = currentUser?.role;
    if (!proj || !proj.lines.length) {
        showModal('Belum Bisa Approve', 'Belum ada line list yang dapat di-approve.', 'warning');
        return;
    }
    if (!['Project Manager', 'System Administrator'].includes(role)) {
        showModal('Akses Ditolak', 'Hanya Project Manager yang dapat memberikan Final Approval.', 'warning');
        return;
    }

    const approvalState = getCycleApprovalState(proj);
    if (approvalState.pmApproved) {
        showModal('Sudah Di-approve', `Cycle ${proj.currentCycle} / Rev ${proj.revisionNumber} sudah Final Approved oleh Project Manager.`, 'info');
        return;
    }
    if (!approvalState.processApproved || !approvalState.pipingApproved) {
        const missing = [];
        if (!approvalState.processApproved) missing.push('Lead Process');
        if (!approvalState.pipingApproved) missing.push('Lead Piping');
        showModal('Belum Bisa Approve', `Final Approval belum dapat dilakukan. Menunggu approval: ${missing.join(' dan ')}.`, 'warning');
        return;
    }
    if (!approvalState.pmLinesApproved) {
        showModal('Belum Bisa Approve', 'Semua line yang sudah dikirim harus terlebih dahulu di-approve oleh PM.', 'warning');
        return;
    }

    if (Array.isArray(proj.cycleRules) && proj.cycleRules.length) {
        const oldCycle = Number(proj.currentCycle || 1);
        const oldDisplay = getConfiguredCycleDisplay(proj);
        const oldRule = oldDisplay.rule;
        const oldRevision = oldDisplay.revision;

        // Final Approval mengubah seluruh line yang sudah masuk tahap PM menjadi Approved.
        // Tahap sebelumnya hanya Ready for Final Approval agar status final tidak muncul
        // sebelum tombol Approve Rev XX XXX benar-benar ditekan.
        (proj.lines || []).forEach(line => {
            const b = getLineApprovalBucket(line, oldCycle);
            if (b?.pmApproval === 'Ready for Final Approval') {
                b.pmApproval = 'Approved';
                b.submissionStatus = 'Approved';
            }
            syncCurrentCycleApproval(line, oldCycle);
        });

        // Simpan snapshot immutable dari cycle yang baru selesai. Snapshot ini menjadi histori
        // sehingga perubahan pada cycle berikutnya tidak pernah mengubah data cycle sebelumnya.
        if (!Array.isArray(proj.cycleSnapshots)) proj.cycleSnapshots = [];
        proj.cycleSnapshots.push({
            cycle: oldCycle,
            revision: oldRevision,
            status: oldRule?.status || proj.revisionStatus || 'IFR',
            frozenAt: new Date().toISOString(),
            lines: JSON.parse(JSON.stringify(proj.lines || []))
        });

        // Final approval PM mengikuti STATUS yang dipilih user pada Setting Rule.
        // Jangan pernah mengganti hasil menjadi IFU secara hard-coded.
        const configuredFinalStatus = oldDisplay.status;
        proj.finalApproval = {
            role: 'Project Manager',
            status: 'Approved',
            resultStatus: configuredFinalStatus,
            revision: oldRevision,
            cycle: oldCycle,
            approvedAt: new Date().toISOString()
        };

        if (!Array.isArray(proj.cycleHistory)) proj.cycleHistory = [];
        proj.cycleHistory.push({
            cycle: oldCycle,
            revision: oldRevision,
            configuredStatus: oldRule?.status || proj.revisionStatus || 'IFR',
            finalStatus: configuredFinalStatus,
            processApproval: 'Approved',
            pipingApproval: 'Approved',
            pmApproval: 'Approved',
            approvedAt: new Date().toISOString()
        });

        // Setelah final approval, tetap tampilkan REV/STATUS yang dipilih
        // pada Setting Rule. Jika masih ada cycle berikutnya, cycle tersebut
        // baru dibuka setelah state cycle aktif disimpan.
        proj.revisionNumber = oldRevision;
        proj.revisionStatus = configuredFinalStatus;
        proj.documentStatus = getRevisionOption(configuredFinalStatus).label;
        saveRevisionState();
        saveApprovalState();

        if (oldCycle >= proj.cycleRules.length) {
            proj.cycleCompleted = true;
            renderDashboard();
            requestAnimationFrame(() => scrollLineListToRightAnimated(true));
            showModal('Final Approval Selesai', `Rev ${oldRevision} / ${configuredFinalStatus} telah disetujui Lead Process, Lead Piping, dan Project Manager. Semua cycle project telah selesai.`, 'success');
            return;
        }

        // Hanya setelah PM approve cycle aktif sesuai Setting Rule, cycle berikutnya dibuka.
        // Data cycle sebelumnya sudah dibekukan di cycleSnapshots; cycle berikutnya bekerja
        // pada salinan baru sehingga histori tidak pernah ikut berubah.
        const nextCycle = oldCycle;
        const nextCycleLines = JSON.parse(JSON.stringify(proj.lines || []));
        const nextCycleNumber = oldCycle + 1;
        nextCycleLines.forEach(line => {
            if (!line.approvalsByCycle || typeof line.approvalsByCycle !== 'object') line.approvalsByCycle = {};

            // Line yang sudah fully approved pada cycle sebelumnya dibawa ke
            // revisi berikutnya sebagai approved. Dengan demikian setelah
            // tombol final approval (mis. Approve Rev A IFC) ditekan, kolom
            // Process Approval langsung menampilkan hasil revisi berikutnya
            // (mis. Approved Rev B IFR). Line baru tetap Draft dan harus
            // melalui workflow approval dari awal.
            // Line yang sudah Final Approved pada cycle mana pun sebelumnya harus
            // tetap dianggap carried-forward pada cycle berikutnya. Jangan hanya
            // mengecek approval cycle aktif, karena line Cycle 1 yang tidak ikut
            // submit di Cycle 2 tetap harus mempertahankan histori dan Aksi abu-abu
            // saat Cycle 3 (dan seterusnya) dibuka.
            const wasFullyApproved = line.pmApproval === 'Approved' ||
                (line.processApproval === 'Approved' && line.pipingApproval === 'Approved') ||
                Object.entries(line.approvalsByCycle || {}).some(([cycleKey, approval]) =>
                    Number(cycleKey) <= oldCycle && approval?.pmApproval === 'Approved'
                );

            // Approval cycle baru selalu dimulai dari Draft. Jika line sudah fully
            // approved pada cycle sebelumnya, tandai sebagai carried-forward agar
            // kolom Process Approval dapat menampilkan hasil cycle sebelumnya sampai
            // Engineer menekan Sent untuk cycle yang baru.
            line.approvalsByCycle[String(nextCycleNumber)] = {
                processApproval: 'Pending',
                pipingApproval: 'Pending',
                pmApproval: 'Pending',
                submissionStatus: 'Draft',
                submitted: false,
                submittedAt: null,
                carriedForward: wasFullyApproved
            };
            if (wasFullyApproved) {
                line.carriedForwardFromCycle = oldCycle;
            } else {
                delete line.carriedForwardFromCycle;
            }

            const nextBucket = line.approvalsByCycle[String(nextCycleNumber)];
            line.processApproval = nextBucket.processApproval;
            line.pipingApproval = nextBucket.pipingApproval;
            line.pmApproval = nextBucket.pmApproval;
            line.submissionStatus = nextBucket.submissionStatus;
            line.pmRevisionRequested = false;
        });
        proj.lines = nextCycleLines;
        applyProjectCycle(proj, nextCycleNumber - 1);
        proj.finalApproval = null;
        proj.cycleCompleted = false;
        saveApprovalState();
        saveRevisionState();
        renderDashboard();

        const nextRule = getActiveCycleRule(proj);
        showModal('Cycle Berikutnya Aktif', `Rev ${oldRevision} / ${configuredFinalStatus} telah disetujui. Sekarang Cycle ${proj.currentCycle} / Rev ${nextRule.revision} / ${getRevisionOption(nextRule.status).label} aktif dan menunggu approval baru.`, 'success');
        return;
    }

    // Project tanpa Setting Rule: gunakan status aktif project.
    const revision = proj.revisionNumber || 'A';
    const configuredStatus = String(proj.revisionStatus || 'IFR').toUpperCase();
    proj.documentStatus = getRevisionOption(configuredStatus).label;
    proj.finalApproval = {
        role: 'Project Manager',
        status: 'Approved',
        resultStatus: configuredStatus,
        revision,
        approvedAt: new Date().toISOString()
    };
    saveRevisionState();
    renderDashboard();
    showModal('Final Approval Selesai', `Rev ${revision} / ${configuredStatus} telah disetujui Lead Process, Lead Piping, dan Project Manager.`, 'success');
}

function filterByColumn(colKey, val) {
    tableFilters[colKey] = val.toLowerCase();
    renderDashboard();
}

function checkRowAgainstFilters(line) {
    for (let key in tableFilters) {
        const filterVal = tableFilters[key];
        if (!filterVal) continue;
        const lineVal = String(line[key] || '').toLowerCase();
        if (!lineVal.includes(filterVal)) return false;
    }
    return true;
}

function toggleExportMenu() {
    const menu = document.getElementById('exportMenu');
    if (menu) menu.classList.toggle('hidden');
}

function closeExportMenu() {
    const menu = document.getElementById('exportMenu');
    if (menu) menu.classList.add('hidden');
}

document.addEventListener('click', (event) => {
    const wrapper = document.getElementById('exportMenuWrapper');
    if (wrapper && !wrapper.contains(event.target)) closeExportMenu();
});

function showDownloadToast(message) {
    const old = document.getElementById('downloadToast');
    if (old) old.remove();
    const toast = document.createElement('div');
    toast.id = 'downloadToast';
    toast.className = 'fixed top-5 right-5 z-[100] bg-white border border-emerald-200 shadow-xl rounded-xl px-4 py-3 flex items-center gap-3 text-xs font-bold text-slate-700';
    toast.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-600 text-base"></i><span>' + message + '</span>';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}

function exportToExcel() {
    const proj = projectsData[currentProjectIndex];
    const dataToExport = proj.lines.map((l, idx) => ({
        "No": idx + 1,
        "Line Size (Inch)": l.size,
        "Process Fluid ID": l.fluid_id,
        "Pipe Spec": l.spec,
        "Seq No": l.seq,
        "Insulation Type": l.ins_type,
        "Insulation Thickness [mm]": l.ins_thick,
        "Complete Line No": normalizeCompleteLineNo(l.complete_no),
        "P&ID No": l.pid,
        "From": l.from,
        "To": l.to,
        "Fluid Service": l.service,
        "Phase": l.phase,
        "Mass Flow [kg/h]": l.mass,
        "Volume Flow [m3/h]": l.vol,
        "Press Op [Barg]": l.press_op,
        "Press Des [Barg]": l.press_des,
        "Temp Op [°C]": l.temp_op,
        "Temp Des [°C]": l.temp_des,
        "Density [kg/m3]": l.density,
        "Viscosity [cP]": l.visc,
        "NDE RT": l.nde_rt,
        "NDE PT": l.nde_pt,
        "Test Medium": l.test_med,
        "Test Pressure [Barg]": l.test_press,
        "Painting Code": l.painting,
        "PWHT": l.pwht,
        "Stress Criticality": l.stress_critical,
        "Stress Calculation No": l.stress_calc_no,
        "Remarks": l.remarks,
        "Process Approval": l.processApproval
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Line List");
    XLSX.writeFile(workbook, `${proj.name.replace(/\s+/g, '_')}_LineList.xlsx`);
    showDownloadToast('Excel berhasil diunduh.');
}

function handleExcelImport(e) {
    // Pengamanan tambahan: PM tidak boleh mengimpor Excel
    // meskipun fungsi dipanggil secara programatik.
    if (currentUser && currentUser.role === 'Project Manager') {
        e.target.value = '';
        showModal('Akses Ditolak', 'Project Manager tidak memiliki akses untuk Import Excel.', 'warning');
        return;
    }

    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const json = XLSX.utils.sheet_to_json(worksheet);

            if (json.length > 0) {
                const importedLines = json.map((row, idx) => ({
                    id: idx + 1,
                    size: String(row["Line Size (Inch)"] || "4"),
                    fluid_id: String(row["Process Fluid Identifier"] || row["Process Fluid ID"] || "CP"),
                    spec: String(row["Pipe.Spec"] || row["Pipe Spec"] || "B1"),
                    seq: String(row["Seq. No"] || row["Seq No"] || (190000 + idx)),
                    ins_type: String(row["Insulation"] || row["Insulation Type"] || "-"),
                    ins_thick: String(row["Unnamed: 6"] || row["Insulation Thickness [mm]"] || "-"),
                    complete_no: String(row["Complete Line No."] || row["Complete Line No"] || "Line-Import"),
                    pid: String(row["P&ID No"] || "PID-01"),
                    from: String(row["From"] || "-"),
                    to: String(row["To"] || "-"),
                    service: String(row["Fluid Service "] || row["Fluid Service"] || "Service"),
                    phase: String(row["Phase"] || "Liquid"),
                    mass: String(row["Mass Flow\n[kg/h]"] || row["Mass Flow [kg/h]"] || "0"),
                    vol: String(row["Volume Flow\n[m3/h]"] || row["Volume Flow [m3/h]"] || "0"),
                    press_op: String(row["Pressure [Barg]"] || "0"),
                    press_des: String(row["Unnamed: 16"] || "0"),
                    temp_op: String(row["Temperature [oC]"] || "0"),
                    temp_des: String(row["Unnamed: 18"] || "0"),
                    density: String(row["Density\n[kg/m3]"] || "0"),
                    visc: String(row["Viscosity\n[cP]"] || "0"),
                    nde_rt: String(row["NDE"] || "0.05"),
                    nde_pt: String(row["Unnamed: 22"] || "0.05"),
                    test_med: String(row["Pressure Test"] || "Hydro"),
                    test_press: String(row["Unnamed: 24"] || "0"),
                    painting: String(row["Painting Code"] || "1F2CS"),
                    pwht: String(row["PWHT"] || "No"),
                    stress_critical: String(row["Stress Criticality"] || "Low"),
                    stress_calc_no: String(row["Stress Calculation No"] || "-"),
                    remarks: String(row["Remarks"] || "-"),
                    processApproval: "Pending"
                }));

                importedLines.forEach(line => {
                    line.ins_type = String(line.ins_type ?? '').trim().toUpperCase();
                    // Jangan menghapus "-" atau karakter lain dari Thickness.
                    line.ins_thick = String(line.ins_thick ?? '').trim();
                    line.seq = String(line.seq ?? '').replace(/\D/g, '');
                    line.service = String(line.service ?? '').trim();
                    line.complete_no = '';
                });
                importedLines.forEach((line, index) => {
                    line.complete_no = buildCompleteLineNo(line, importedLines, index);
                });

                projectsData[currentProjectIndex].lines = importedLines;
                renderDashboard();
                showModal("Import Berhasil", `Berhasil mengimpor ${importedLines.length} baris data dari Excel!`, "success");
            }
        } catch (err) {
            showModal("Error Import", "Gagal memproses file Excel.", "error");
        }
    };
    reader.readAsArrayBuffer(file);
}

function openPdfModal() {
    document.getElementById('pdfModal').classList.remove('hidden');
}

function closePdfModal() {
    document.getElementById('pdfModal').classList.add('hidden');
}

// PDF logos embedded directly so export does not depend on local file paths.
const PDF_ARC_LOGO = "data:image/jpeg;base64,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";
const PDF_TRIPATRA_LOGO = "data:image/png;base64,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";

async function generatePDF() {
    closePdfModal();
    const { jsPDF } = window.jspdf;
    const pageSize = document.getElementById('pdfPageSize').value || 'a3';
    const doc = new jsPDF({ orientation: 'landscape', format: pageSize, unit: 'mm' });
    const proj = projectsData[currentProjectIndex];

    const green = [38, 122, 92];
    const dark = [20, 25, 35];
    const navy = [19, 43, 95];
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const headers = [
        'No','Line Size\\n(Inch)','Process Fluid\\nIdentifier','Pipe.Spec','Seq.\\nNo','Insulation\\nType','Insulation\\nThickness\\n[mm]','Complete Line\\nNo.','P&ID No','From','To','Fluid\\nService','Phase','Mass\\nFlow\\n[kg/h]','Volume\\nFlow\\n[m3/h]','Pressure [Barg]\\nOperating','Pressure [Barg]\\nDesign','Temperature [°C]\\nOperating','Temperature [°C]\\nDesign','Density\\n[kg/m³]','Viscosity\\n[cP]','NDE RT','NDE PT','Pressure\\nTest','Test\\nPressure','Painting\\nCode','PWHT','Stress\\nCriticality','Stress Analysis\\nCalculation Number','Remarks','Process\\nApproval'
    ];

    const rows = proj.lines.map((l, idx) => [
        idx + 1, l.size, l.fluid_id, l.spec, l.seq, l.ins_type, l.ins_thick, normalizeCompleteLineNo(l.complete_no), l.pid,
        l.from, l.to, l.service, l.phase, l.mass, l.vol, l.press_op, l.press_des, l.temp_op, l.temp_des,
        l.density, l.visc, l.nde_rt, l.nde_pt, l.test_med, l.test_press, l.painting, l.pwht,
        l.stress_critical, l.stress_calc_no, l.remarks, l.processApproval
    ]);

    // Header dokumen dibuat konsisten di SETIAP halaman PDF.
    // Layout mengikuti format corporate sheet: logo kiri/kanan, judul tengah,
    // metadata ringkas, garis pemisah, lalu tabel memenuhi lebar halaman.
    const drawPageHeader = (pageNo) => {
        // Logo ARC — kecil, tidak mengambil ruang tabel.
        try {
            doc.addImage(PDF_ARC_LOGO, 'JPEG', 10, 9, 25, 8.2);
        } catch (e) {
            console.error('Gagal menambahkan logo ARC ke PDF:', e);
        }

        // Logo Tripatra — versi lengkap namun proporsional.
        try {
            // Pertahankan aspect ratio asli logo agar tidak gepeng/terdistorsi.
            // Sumber PDF_TRIPATRA_LOGO = 343 x 385 px.
            const logoH = 18;
            const logoW = logoH * (343 / 385);
            doc.addImage(PDF_TRIPATRA_LOGO, 'PNG', pageWidth - logoW - 10, 7, logoW, logoH, undefined, 'FAST');
        } catch (e) {
            console.error('Gagal menambahkan logo Tripatra ke PDF:', e);
        }

        // Judul dan identitas dokumen.
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(...dark);
        doc.text('MASTER LINE LIST WEBAPP', pageWidth / 2, 13, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.2);
        doc.text(`PROJECT: ${proj.name}`, pageWidth / 2, 18, { align: 'center' });
        doc.text(
            `DOCUMENT NUMBER: ${proj.docNumber}   |   REVISION: ${proj.revisionStatus || 'IFR'} (${proj.revisionNumber || getRevisionOption(proj.revisionStatus || 'IFR').defaultNumber})   |   STATUS: ${proj.documentStatus || getRevisionOption(proj.revisionStatus || 'IFR').status}`,
            pageWidth / 2, 23, { align: 'center' }
        );

        // Garis pemisah seperti lembar engineering report.
        doc.setDrawColor(...navy);
        doc.setLineWidth(0.35);
        doc.line(10, 35.5, pageWidth - 10, 35.5);

        // Penanda halaman kecil, tetap bersih dan tidak mengganggu tabel.
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5);
        doc.setTextColor(90, 100, 105);
        doc.text(`Page ${pageNo}`, pageWidth - 10, 39, { align: 'right' });
    };

    doc.autoTable({
        head: [headers],
        body: rows,
        startY: 41,
        margin: { top: 41, left: 10, right: 10, bottom: 8 },
        theme: 'grid',
        showHead: 'everyPage',
        styles: {
            font: 'helvetica',
            fontSize: pageSize === 'a3' ? 5.35 : 4.05,
            cellPadding: pageSize === 'a3' ? 1.15 : 0.8,
            lineColor: [175, 190, 198],
            lineWidth: 0.12,
            textColor: [30, 40, 45],
            overflow: 'linebreak',
            valign: 'middle',
            halign: 'center'
        },
        headStyles: {
            fillColor: green,
            textColor: [255,255,255],
            fontStyle: 'bold',
            fontSize: pageSize === 'a3' ? 4.9 : 3.7,
            cellPadding: 1.15,
            halign: 'center',
            valign: 'middle'
        },
        alternateRowStyles: { fillColor: [248, 250, 250] },
        columnStyles: {
            0: { cellWidth: 7 },
            1: { cellWidth: 12 },
            2: { cellWidth: 15 },
            3: { cellWidth: 10 },
            4: { cellWidth: 10 },
            5: { cellWidth: 10 },
            6: { cellWidth: 12 },
            7: { cellWidth: 18 },
            8: { cellWidth: 14 },
            9: { cellWidth: 25, halign: 'left' },
            10: { cellWidth: 25, halign: 'left' },
            11: { cellWidth: 15 },
            12: { cellWidth: 10 },
            13: { cellWidth: 14 },
            14: { cellWidth: 14 },
            15: { cellWidth: 12 },
            16: { cellWidth: 12 },
            17: { cellWidth: 12 },
            18: { cellWidth: 12 },
            19: { cellWidth: 12 },
            20: { cellWidth: 10 },
            21: { cellWidth: 8 },
            22: { cellWidth: 8 },
            23: { cellWidth: 10 },
            24: { cellWidth: 11 },
            25: { cellWidth: 11 },
            26: { cellWidth: 9 },
            27: { cellWidth: 13 },
            28: { cellWidth: 18 },
            29: { cellWidth: 18, halign: 'left' },
            30: { cellWidth: 12 }
        },
        didDrawPage: (data) => {
            const pageNo = doc.internal.getNumberOfPages();
            drawPageHeader(pageNo);

            // Footer tipis dan konsisten di setiap lembar.
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(4.5);
            doc.setTextColor(90, 100, 105);
            doc.text('MASTER LINE LIST WEBAPP  •  Tripatra Engineering Studio', 10, pageHeight - 4);
            doc.text(`Page ${pageNo}`, pageWidth - 10, pageHeight - 4, { align: 'right' });
        }
    });

    doc.save(`${proj.name.replace(/\s+/g, '_')}_Master_Line_List.pdf`);
    showDownloadToast('PDF berhasil diunduh.');
}


/* ================================================================
   P&ID / DOCUMENT UPLOAD
   - Uses IndexedDB so PDF/images do not need to be converted to
     localStorage and remain available after refreshing the page.
   ================================================================ */
const DOCUMENT_DB_NAME = 'masterLineListDocumentsDB';
const DOCUMENT_STORE = 'documents';
let documentDBPromise = null;

function openDocumentDB() {
    if (documentDBPromise) return documentDBPromise;
    documentDBPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DOCUMENT_DB_NAME, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(DOCUMENT_STORE)) {
                const store = db.createObjectStore(DOCUMENT_STORE, { keyPath: 'id' });
                store.createIndex('uploadedAt', 'uploadedAt');
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    return documentDBPromise;
}

async function getUploadedDocuments() {
    const db = await openDocumentDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(DOCUMENT_STORE, 'readonly');
        const req = tx.objectStore(DOCUMENT_STORE).getAll();
        req.onsuccess = () => resolve((req.result || []).sort((a,b) => b.uploadedAt - a.uploadedAt));
        req.onerror = () => reject(req.error);
    });
}

async function saveUploadedDocument(record) {
    const db = await openDocumentDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(DOCUMENT_STORE, 'readwrite');
        tx.objectStore(DOCUMENT_STORE).put(record);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

async function deleteUploadedDocument(id) {
    const db = await openDocumentDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(DOCUMENT_STORE, 'readwrite');
        tx.objectStore(DOCUMENT_STORE).delete(id);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

async function getUploadedDocument(id) {
    const db = await openDocumentDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(DOCUMENT_STORE, 'readonly');
        const req = tx.objectStore(DOCUMENT_STORE).get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function formatDocumentSize(bytes) {
    if (!Number.isFinite(bytes)) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDocumentDate(timestamp) {
    return new Date(timestamp).toLocaleString('id-ID', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function documentTypeLabel(type) {
    if (type === 'application/pdf') return 'PDF';
    if (type.startsWith('image/')) return 'IMAGE';
    if (type.includes('sheet') || type.includes('excel')) return 'EXCEL';
    if (type.includes('word')) return 'WORD';
    return 'FILE';
}

function escapeHtmlDocument(value) {
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({
        '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
    }[ch]));
}

async function renderUploadedDocuments() {
    const tbody = document.getElementById('documentsTableBody');
    if (!tbody) return;
    try {
        const docs = await getUploadedDocuments();
        // Remove only rows created by this upload feature. Static project rows remain.
        tbody.querySelectorAll('tr[data-uploaded-document="true"]').forEach(row => row.remove());
        docs.forEach(doc => {
            const tr = document.createElement('tr');
            tr.dataset.uploadedDocument = 'true';
            tr.innerHTML = `
                <td class="p-3 font-mono font-bold">${escapeHtmlDocument(doc.documentNumber)}</td>
                <td class="p-3">
                    <div class="font-semibold text-slate-800">${escapeHtmlDocument(doc.name)}</div>
                    <div class="text-[10px] text-slate-500 mt-0.5">${documentTypeLabel(doc.type)} · ${formatDocumentSize(doc.size)} · ${formatDocumentDate(doc.uploadedAt)}</div>
                </td>
                <td class="p-3">${escapeHtmlDocument(doc.revision)}</td>
                <td class="p-3"><span class="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded">Pending Review</span></td>
                <td class="p-3 text-center whitespace-nowrap">
                    <button type="button" onclick="viewUploadedDocument('${doc.id}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 mr-1"><i class="fa-solid fa-eye"></i> View</button>
                    <button type="button" onclick="removeUploadedDocument('${doc.id}')" class="px-2 py-1 bg-rose-50 hover:bg-rose-100 rounded text-rose-700"><i class="fa-solid fa-trash"></i></button>
                </td>`;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Gagal memuat dokumen:', error);
    }
}

function openDocumentUpload() {
    const input = document.getElementById('documentUploadInput');
    if (input) {
        input.value = '';
        input.click();
    }
}

async function handleDocumentUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const allowed = ['application/pdf','image/png','image/jpeg','image/webp',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel','application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const extAllowed = /\.(pdf|png|jpe?g|webp|xlsx?|docx?)$/i.test(file.name);
    if (!allowed.includes(file.type) && !extAllowed) {
        showModal('Format Tidak Didukung', 'Gunakan PDF, gambar, Excel, atau Word untuk dokumen engineering.', 'error');
        return;
    }

    // Keep the document metadata together with the actual Blob in IndexedDB.
    const record = {
        id: `DOC-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
        documentNumber: `UPL-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
        projectId: projectsData[currentProjectIndex]?.id || null,
        projectName: projectsData[currentProjectIndex]?.name || '',
        name: file.name,
        revision: `${projectsData[currentProjectIndex]?.revisionStatus || 'IFR'} (${projectsData[currentProjectIndex]?.revisionNumber || getRevisionOption('IFR').defaultNumber})`,
        type: file.type || 'application/octet-stream',
        size: file.size,
        uploadedAt: Date.now(),
        blob: file
    };

    try {
        await saveUploadedDocument(record);
        await renderUploadedDocuments();
        showModal('Upload Berhasil', `${file.name} berhasil ditambahkan ke daftar P&ID / Documents. Status awal: Pending Review.`, 'success');
    } catch (error) {
        console.error(error);
        showModal('Upload Gagal', 'Browser tidak dapat menyimpan file ini. Coba file yang lebih kecil atau gunakan browser modern.', 'error');
    }
}

async function viewUploadedDocument(id) {
    try {
        const doc = await getUploadedDocument(id);
        if (!doc || !doc.blob) throw new Error('Dokumen tidak ditemukan');
        const url = URL.createObjectURL(doc.blob);
        const opened = window.open(url, '_blank');
        if (!opened) {
            const a = document.createElement('a');
            a.href = url;
            a.download = doc.name;
            document.body.appendChild(a);
            a.click();
            a.remove();
        }
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
        console.error(error);
        showModal('Dokumen Tidak Ditemukan', 'File sudah tidak tersedia di penyimpanan browser.', 'error');
    }
}

async function removeUploadedDocument(id) {
    if (!confirm('Hapus dokumen yang di-upload ini dari daftar?')) return;
    try {
        await deleteUploadedDocument(id);
        await renderUploadedDocuments();
        showModal('Dokumen Dihapus', 'Dokumen berhasil dihapus dari daftar upload.', 'success');
    } catch (error) {
        showModal('Gagal Menghapus', 'Dokumen tidak dapat dihapus.', 'error');
    }
}

function initDocumentUpload() {
    const input = document.getElementById('documentUploadInput');
    if (input) input.addEventListener('change', handleDocumentUpload);
    renderUploadedDocuments();
}


let approvalConfirmCallback = null;

function openApprovalConfirm(title, text, onYes) {
    const modal = document.getElementById('approvalConfirmModal');
    const titleEl = document.getElementById('approvalConfirmTitle');
    const textEl = document.getElementById('approvalConfirmText');
    if (!modal || !titleEl || !textEl) {
        // Fallback only if the confirmation UI is unavailable.
        if (typeof onYes === 'function') onYes();
        return;
    }
    titleEl.textContent = title;
    textEl.textContent = text;
    approvalConfirmCallback = typeof onYes === 'function' ? onYes : null;
    modal.classList.remove('hidden');
}

function closeApprovalConfirm() {
    const modal = document.getElementById('approvalConfirmModal');
    if (modal) modal.classList.add('hidden');
    approvalConfirmCallback = null;
}

function confirmApprovalYes() {
    const callback = approvalConfirmCallback;
    closeApprovalConfirm();
    if (typeof callback === 'function') callback();
}

function showModal(title, text, type = "info") {
    document.getElementById('customModalTitle').innerText = title;
    document.getElementById('customModalText').innerText = text;
    const iconDiv = document.getElementById('customModalIcon');
    if (type === "success") {
        iconDiv.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-600"></i>';
    } else if (type === "error" || type === "warning") {
        iconDiv.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-rose-600"></i>';
    } else {
        iconDiv.innerHTML = '<i class="fa-solid fa-circle-info text-blue-600"></i>';
    }
    document.getElementById('customModal').classList.remove('hidden');
}

function openAddAccountModal() {
    document.getElementById('addAccountModal').classList.remove('hidden');
}

function closeAddAccountModal() {
    document.getElementById('addAccountModal').classList.add('hidden');
}

function defaultProjectRules() {
    return [
        { cycle: 1, revision: 'A', status: 'IFC' },
        { cycle: 2, revision: 'B', status: 'IFR' },
        { cycle: 3, revision: 'C', status: 'IFR' }
    ];
}

function normalizeProjectRules(rules) {
    const source = Array.isArray(rules) && rules.length ? rules : defaultProjectRules();
    return source.map((r, i) => ({
        cycle: i + 1,
        revision: String(r.revision ?? '').trim() || String.fromCharCode(65 + i),
        status: REVISION_OPTIONS.some(o => o.code === r.status) ? r.status : 'IFR'
    }));
}

function renderProjectRuleRows(rules = window._newProjectRules || defaultProjectRules(), options = {}) {
    window._newProjectRules = normalizeProjectRules(rules);
    const editMode = !!options.editMode;
    const currentCycle = Number(options.currentCycle || 1);
    const container = document.getElementById('projectRuleRows');
    if (!container) return;
    container.innerHTML = window._newProjectRules.map((rule, i) => `
        <div data-rule-index="${i}" class="grid grid-cols-[72px_minmax(80px,120px)_minmax(180px,1fr)_36px] gap-2 items-center bg-white border border-slate-200 rounded-lg p-2 shadow-sm">
            <div class="text-[10px] font-bold text-slate-700">Cycle ${i + 1}</div>
            <input type="text" maxlength="8" value="${escapeHtml(rule.revision)}" data-rule-revision="${i}" ${editMode && i < currentCycle - 1 ? 'disabled' : ''}
                class="w-full px-2.5 py-2 text-[11px] border border-slate-300 rounded-md focus:outline-none focus:border-emerald-500 uppercase font-semibold">
            <select data-rule-status="${i}" ${editMode && i < currentCycle - 1 ? 'disabled' : ''} class="w-full px-2.5 py-2 text-[11px] border border-slate-300 rounded-md focus:outline-none focus:border-emerald-500">
                ${REVISION_OPTIONS.filter(o => !o.resultOnly).map(o => `<option value="${o.code}" ${o.code === rule.status ? 'selected' : ''}>${escapeHtml(o.code + ' - ' + o.label)}</option>`).join('')}
            </select>
            <button type="button" onclick="removeProjectRuleRow(${i})" ${(window._newProjectRules.length <= 1 || (editMode && i < currentCycle)) ? 'disabled' : ''}
                class="w-8 h-8 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30" title="Hapus cycle" aria-label="Hapus cycle ${i + 1}">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </div>`).join('');

    container.querySelectorAll('[data-rule-revision]').forEach(input => input.addEventListener('input', e => {
        const i = Number(e.target.dataset.ruleRevision);
        window._newProjectRules[i].revision = e.target.value.trim().toUpperCase();
    }));
    container.querySelectorAll('[data-rule-status]').forEach(select => select.addEventListener('change', e => {
        const i = Number(e.target.dataset.ruleStatus);
        window._newProjectRules[i].status = e.target.value;
    }));
}

function addProjectRuleRow() {
    const rules = normalizeProjectRules(window._newProjectRules);
    const last = rules[rules.length - 1];
    const nextRevision = /^[A-Z]$/.test(last.revision) ? String.fromCharCode(Math.min(90, last.revision.charCodeAt(0) + 1)) : String(rules.length + 1);
    rules.push({ cycle: rules.length + 1, revision: nextRevision, status: 'IFR' });
    renderProjectRuleRows(rules);
}

function removeProjectRuleRow(index) {
    const rules = normalizeProjectRules(window._newProjectRules);
    if (rules.length <= 1) return;
    rules.splice(index, 1);
    renderProjectRuleRows(rules);
}

function collectProjectRules() {
    const rules = normalizeProjectRules(window._newProjectRules);
    rules.forEach((rule, i) => {
        const revisionEl = document.querySelector(`[data-rule-revision="${i}"]`);
        const statusEl = document.querySelector(`[data-rule-status="${i}"]`);
        rule.revision = String(revisionEl?.value || rule.revision).trim().toUpperCase();
        rule.status = statusEl?.value || rule.status;
    });
    const message = document.getElementById('projectRuleMessage');
    const invalid = rules.find(r => !r.revision || !REVISION_OPTIONS.some(o => o.code === r.status));
    if (invalid) {
        if (message) { message.textContent = 'Setiap cycle wajib memiliki Revisi dan Status.'; message.classList.remove('hidden'); }
        return null;
    }
    if (message) message.classList.add('hidden');
    return rules;
}

function applyProjectCycle(proj, cycleIndex) {
    if (!proj) return;
    proj.cycleRules = normalizeProjectRules(proj.cycleRules);
    const idx = Math.max(0, Math.min(cycleIndex, proj.cycleRules.length - 1));
    const rule = proj.cycleRules[idx];
    proj.currentCycle = idx + 1;
    proj.revisionNumber = String(rule.revision || '').toUpperCase();
    proj.revisionStatus = rule.status;
    proj.documentStatus = getRevisionOption(rule.status).label;
    (proj.lines || []).forEach(line => syncCurrentCycleApproval(line, proj.currentCycle));
}

function advanceProjectCycleAfterApproval(proj) {
    if (!proj || !Array.isArray(proj.cycleRules) || !proj.cycleRules.length) return false;
    const current = Math.max(1, Number(proj.currentCycle || 1));
    const currentRule = proj.cycleRules[current - 1];
    if (!currentRule) return false;

    if (!Array.isArray(proj.cycleHistory)) proj.cycleHistory = [];
    proj.cycleHistory.push({
        cycle: current,
        revision: currentRule.revision,
        status: currentRule.status,
        approvedAt: new Date().toISOString()
    });

    if (current >= proj.cycleRules.length) {
        proj.cycleCompleted = true;
        saveRevisionState();
        saveApprovalState();
        return false;
    }

    // Hanya setelah cycle aktif benar-benar di-approve, cycle berikutnya dibuka.
    applyProjectCycle(proj, current);
    proj.cycleCompleted = false;
    (proj.lines || []).forEach(line => {
        line.processApproval = 'Pending';
        line.pipingApproval = 'Pending';
    });
    saveApprovalState();
    saveRevisionState();
    return true;
}

function openAddProjectModal() {
    if (currentUser?.role === 'Project Manager') {
        showModal('Akses Ditolak', 'Project Manager tidak memiliki akses untuk menambah Project baru.', 'warning');
        return;
    }
    editingProjectRulesIndex = null;
    const modal = document.getElementById('addProjectModal');
    if (!modal) return;
    const input = document.getElementById('newProjectNameInput');
    const docInput = document.getElementById('newProjectDocNumberInput');
    if (input) { input.value = ''; input.closest('div')?.classList.remove('hidden'); }
    if (docInput) { docInput.value = ''; docInput.closest('div')?.classList.remove('hidden'); }
    const title = modal.querySelector('h4');
    if (title) title.innerHTML = '<i class="fa-solid fa-folder-plus text-emerald-600"></i> Tambah Project Baru';
    const saveBtn = modal.querySelector('button[onclick="saveEditedProjectRules()"]') || modal.querySelector('button[onclick="saveNewProject()"]');
    if (saveBtn) { saveBtn.textContent = 'Simpan & Pilih'; saveBtn.setAttribute('onclick', 'saveNewProject()'); }
    renderProjectRuleRows(defaultProjectRules());
    modal.classList.remove('hidden');
    setTimeout(() => input?.focus(), 50);
}

function closeAddProjectModal() {
    const modal = document.getElementById('addProjectModal');
    if (modal) modal.classList.add('hidden');
    editingProjectRulesIndex = null;
}

function openEditProjectRulesModal(projectIndex = currentProjectIndex) {
    const proj = projectsData[projectIndex];
    const modal = document.getElementById('addProjectModal');
    if (!proj || !modal) return;
    editingProjectRulesIndex = projectIndex;
    const title = modal.querySelector('h4');
    if (title) title.innerHTML = '<i class="fa-solid fa-sliders text-emerald-600"></i> Edit Setting Rule Cycle';
    const nameInput = document.getElementById('newProjectNameInput');
    const docInput = document.getElementById('newProjectDocNumberInput');
    // Saat Edit Setting Rule, nama project ikut dapat diubah. Nomor document tetap menjadi identitas project.
    if (nameInput) { nameInput.value = String(proj.name || '').toUpperCase(); nameInput.closest('div')?.classList.remove('hidden'); }
    if (docInput) { docInput.value = String(proj.docNumber || '').replace(/\s+/g, '').toUpperCase(); docInput.closest('div')?.classList.remove('hidden'); }
    renderProjectRuleRows(proj.cycleRules || defaultProjectRules(), { editMode: true, currentCycle: Number(proj.currentCycle || 1) });
    const saveBtn = modal.querySelector('button[onclick="saveNewProject()"]');
    if (saveBtn) { saveBtn.textContent = 'Simpan Setting Rule'; saveBtn.setAttribute('onclick', 'saveEditedProjectRules()'); }
    modal.classList.remove('hidden');
}

function saveEditedProjectRules() {
    const idx = editingProjectRulesIndex;
    const proj = projectsData[idx];
    if (!proj) return;
    const rules = collectProjectRules();
    if (!rules) return;

    const nameInput = document.getElementById('newProjectNameInput');
    const docInput = document.getElementById('newProjectDocNumberInput');
    const newName = String(nameInput?.value || '').trim().toUpperCase();
    const newDocNumber = String(docInput?.value || '').replace(/\s+/g, '').toUpperCase();
    if (!newName) {
        showModal('Peringatan', 'Nama project tidak boleh kosong.', 'warning');
        nameInput?.focus();
        return;
    }
    if (!newDocNumber) {
        showModal('Peringatan', 'Nomor document tidak boleh kosong.', 'warning');
        docInput?.focus();
        return;
    }
    const duplicateName = projectsData.some((p, i) => i !== idx && String(p.name || '').trim().toUpperCase() === newName);
    if (duplicateName) {
        showModal('Nama Project Sudah Ada', `Project "${newName}" sudah digunakan. Gunakan nama project yang berbeda.`, 'warning');
        nameInput?.focus();
        return;
    }

    const current = Number(proj.currentCycle || 1);
    const historyCount = Array.isArray(proj.cycleHistory) ? proj.cycleHistory.length : 0;
    if (historyCount > 0) {
        for (let i = 0; i < Math.min(current - 1, rules.length); i++) {
            const oldRule = proj.cycleRules?.[i];
            if (oldRule && (rules[i].revision !== oldRule.revision || rules[i].status !== oldRule.status)) {
                showModal('Cycle Sudah Dikunci', `Cycle ${i + 1} sudah disetujui dan tidak dapat diubah lagi.`, 'warning');
                return;
            }
        }
    }
    if (rules.length < current) {
        showModal('Setting Rule Tidak Valid', `Jumlah cycle tidak boleh kurang dari Cycle ${current} yang sedang aktif.`, 'warning');
        return;
    }
    const duplicateDoc = projectsData.some((p, i) => i !== idx && String(p.docNumber || '').replace(/\s+/g, '').toUpperCase() === newDocNumber);
    if (duplicateDoc) {
        showModal('Nomor Document Sudah Ada', `Nomor document "${newDocNumber}" sudah digunakan oleh project lain.`, 'warning');
        docInput?.focus();
        return;
    }
    proj.name = newName;
    proj.docNumber = newDocNumber;
    proj.cycleRules = normalizeProjectRules(rules);
    const activeRule = getActiveCycleRule(proj);
    if (activeRule) {
        proj.revisionNumber = activeRule.revision;
        proj.revisionStatus = activeRule.status;
        proj.documentStatus = getRevisionOption(activeRule.status).label;
    }
    saveRevisionState();
    closeAddProjectModal();
    editingProjectRulesIndex = null;
    renderDashboard();
    showModal('Setting Rule Disimpan', `Setting Rule project "${String(proj.name || '').toUpperCase()}" berhasil diperbarui.`, 'success');
}

function saveNewProject() {
    const name = document.getElementById('newProjectNameInput').value.trim().toUpperCase();
    const docNumber = document.getElementById('newProjectDocNumberInput')?.value.replace(/\s+/g, '').toUpperCase();
    if (!name) {
        showModal("Peringatan", "Name project tidak boleh kosong.", "warning");
        return;
    }
    if (!docNumber) {
        showModal("Peringatan", "Nomor document tidak boleh kosong.", "warning");
        document.getElementById('newProjectDocNumberInput')?.focus();
        return;
    }
    const rules = collectProjectRules();
    if (!rules) return;

    const duplicateName = projectsData.some(p => String(p.name || '').trim().toLowerCase() === name.toLowerCase());
    if (duplicateName) {
        showModal('Project Sudah Ada', `Project "${name}" sudah ada. Project baru tidak dibuat agar data tidak tertimpa.`, 'warning');
        return;
    }
    const normalizedDocNumber = docNumber.toUpperCase().replace(/\s+/g, '').trim();
    const duplicateDoc = projectsData.some(p => String(p.docNumber || '').toLowerCase().replace(/\s+/g, '').trim() === normalizedDocNumber);
    if (duplicateDoc) {
        showModal('Nomor Document Sudah Ada', `Nomor document "${docNumber}" sudah digunakan oleh project lain. Gunakan nomor document yang berbeda.`, 'warning');
        return;
    }

    const newProj = {
        id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: name,
        docNumber: docNumber,
        leftLogo: "",
        rightLogo: "",
        lines: [],
        cycleRules: rules,
        currentCycle: 1,
        cycleHistory: [],
        finalApproval: null,
        cycleCompleted: false,
        revisionStatus: rules[0].status,
        revisionNumber: rules[0].revision,
        documentStatus: getRevisionOption(rules[0].status).label
    };
    projectsData.push(newProj);
    currentProjectIndex = projectsData.length - 1;
    currentProject = currentProjectIndex;
    saveRevisionState();
    saveApprovalState();
    closeAddProjectModal();
    renderDashboard();
    showModal("Berhasil", `Project "${name}" berhasil ditambahkan dengan Document No. ${docNumber}. Cycle 1 / Revisi ${rules[0].revision} / ${getRevisionOption(rules[0].status).label} aktif.`, "success");
}

// ==========================================
// FUNGSI NAVIGASI SIDEBAR (DIPERBARUI)
// ==========================================
function switchDashboardTab(tabName) {
    // Team & Roles khusus System Administrator.
    if (tabName === 'team' && (!currentUser || currentUser.role !== 'System Administrator')) {
        tabName = 'studio';
    }

    const menuButtons = {
        'overview': document.getElementById('menuBtnOverview'),
        'studio': document.getElementById('menuBtnStudio'),
        'documents': document.getElementById('menuBtnDocuments'),
        'tasks': document.getElementById('menuBtnTasks'),
        'team': document.getElementById('menuBtnTeam'),
        'settings': document.getElementById('menuBtnSettings')
    };

    const tabContents = {
        'overview': document.getElementById('tabContentOverview'),
        'studio': document.getElementById('tabContentStudio'),
        'documents': document.getElementById('tabContentDocuments'),
        'tasks': document.getElementById('tabContentTasks'),
        'team': document.getElementById('tabContentTeam'),
        'settings': document.getElementById('tabContentSettings')
    };

    // Reset semua tombol ke style non-aktif & sembunyikan semua konten tab
    Object.keys(menuButtons).forEach(key => {
        const btn = menuButtons[key];
        if (btn) {
            btn.classList.remove('bg-blue-600', 'text-white', 'shadow-sm');
            btn.classList.add('text-slate-300', 'hover:bg-blue-900/50');
        }
        if (tabContents[key]) {
            tabContents[key].classList.add('hidden');
        }
    });

    // Aktifkan tombol yang diklik dan tampilkan konten tab yang sesuai
    if (menuButtons[tabName]) {
        menuButtons[tabName].classList.remove('text-slate-300', 'hover:bg-blue-900/50');
        menuButtons[tabName].classList.add('bg-blue-600', 'text-white', 'shadow-sm');
    }
    if (tabContents[tabName]) {
        tabContents[tabName].classList.remove('hidden');
    }
}

// Set default aktif ke tab "studio" saat pertama kali login
document.addEventListener('DOMContentLoaded', () => {
    switchDashboardTab('studio');
});

// ==========================================
// NAVIGASI KEYBOARD UNTUK TABEL LINE LIST
// ==========================================
// Tab / Shift+Tab : pindah ke sel editable berikut/sebelumnya.
// Enter / Arrow Down : pindah ke sel pada baris berikutnya.
// Shift+Enter / Arrow Up : pindah ke sel pada baris sebelumnya.
// Complete Line No. readonly tetap bisa dilihat saat navigasi; tidak dapat diedit.
function initLineTableKeyboardNavigation() {
    if (window.__lineTableKeyboardNavigationReady) return;
    window.__lineTableKeyboardNavigationReady = true;

    const keepRowVerticallyVisible = (row) => {
        const scroller = row?.closest('.line-list-scroll');
        if (!scroller || !row) return;
        const sr = scroller.getBoundingClientRect();
        const rr = row.getBoundingClientRect();
        if (rr.bottom > sr.bottom) scroller.scrollTop += rr.bottom - sr.bottom;
        else if (rr.top < sr.top) scroller.scrollTop -= sr.top - rr.top;
    };

    document.addEventListener('keydown', (event) => {
        const target = event.target;
        if (!target || !target.closest('#lineTableBody')) return;
        if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
        if (target.disabled || target.readOnly) return;

        const tbody = document.getElementById('lineTableBody');
        if (!tbody) return;

        const rows = Array.from(tbody.querySelectorAll('tr')).filter(row => row.dataset.lineIndex !== undefined);
        const currentRow = target.closest('tr');
        if (!currentRow) return;

        const getNavigable = (row) => Array.from(row.querySelectorAll('input:not([disabled]), select:not([disabled]), textarea:not([disabled])'))
            .filter(el => el.offsetParent !== null)
            .filter(el => !el.readOnly || el.classList.contains('complete-line-no'));

        const currentCells = getNavigable(currentRow);
        const currentColumn = currentCells.indexOf(target);

        // Tab navigation: browser default sebenarnya sudah benar, tetapi
        // kita ambil alih agar perpindahan tetap konsisten di dalam tabel.
        if (event.key === 'Tab') {
            const all = [];
            rows.forEach(row => getNavigable(row).forEach(el => all.push(el)));
            const pos = all.indexOf(target);
            if (pos === -1) return;

            const nextPos = event.shiftKey ? pos - 1 : pos + 1;
            if (nextPos >= 0 && nextPos < all.length) {
                event.preventDefault();
                all[nextPos].focus({ preventScroll: true });
                all[nextPos].select?.();
                const row = all[nextPos].closest('tr');
                if (row) keepRowVerticallyVisible(row);
            }
            return;
        }

        // Enter / Arrow Up / Arrow Down: pertahankan kolom, pindah baris.
        if (event.key === 'Enter' || event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            // Untuk textarea, Enter tetap digunakan untuk membuat baris baru.
            if (event.key === 'Enter' && target.tagName === 'TEXTAREA') return;

            let rowIndex = rows.indexOf(currentRow);
            if (rowIndex === -1) return;

            const direction = (event.key === 'ArrowUp' || (event.key === 'Enter' && event.shiftKey)) ? -1 : 1;
            const nextRow = rows[rowIndex + direction];
            if (!nextRow) return;

            const nextCells = getNavigable(nextRow);
            const nextCell = nextCells[Math.min(Math.max(currentColumn, 0), nextCells.length - 1)];
            if (!nextCell) return;

            event.preventDefault();
            nextCell.focus({ preventScroll: true });
            nextCell.select?.();
            keepRowVerticallyVisible(nextRow);
        }
    });
}

// =========================================================
// AUTO-SCROLL DATA PANJANG
// - Project name tidak bergerak otomatis.
// - Sel input panjang mengikuti fokus/keyboard tanpa scrollbar kecil.
// - P&ID / From / To menggunakan textarea agar bisa Enter/multi-line.
// =========================================================
function initProjectNameMarquee() {
    // Nama project tidak dianimasikan. Teks dipusatkan dan ukuran font
    // otomatis dikecilkan sampai seluruh nama muat di area yang tersedia.
    const viewport = document.getElementById('projectNameViewport');
    const input = document.getElementById('headerProjectName');
    if (!viewport || !input) return;

    const fit = () => {
        const text = String(input.value || '');
        const computed = window.getComputedStyle(input);
        const fontWeight = computed.fontWeight || '800';
        const fontFamily = computed.fontFamily || 'Arial, sans-serif';

        // Beri ruang aman supaya teks tidak menempel pada sisi viewport.
        const available = Math.max(40, viewport.clientWidth - 10);

        const canvas = fit.__canvas || (fit.__canvas = document.createElement('canvas'));
        const ctx = canvas.getContext('2d');

        let size = 13;
        const minSize = 8.5;
        const letterSpacing = -0.15;

        while (size > minSize) {
            ctx.font = `${fontWeight} ${size}px ${fontFamily}`;
            const measured = ctx.measureText(text).width + Math.max(0, text.length - 1) * letterSpacing;
            if (measured <= available) break;
            size -= 0.25;
        }

        input.style.fontSize = `${Math.max(minSize, size)}px`;
        input.style.letterSpacing = `${letterSpacing}px`;
        input.style.textAlign = 'center';
        input.style.width = '100%';
        input.style.display = 'block';

        viewport.style.justifyContent = 'center';
        viewport.style.textAlign = 'center';
        viewport.scrollLeft = 0;
        input.scrollLeft = 0;
    };

    if (!window.__projectNameAutoFitReady) {
        window.__projectNameAutoFitReady = true;
        window.addEventListener('resize', () => requestAnimationFrame(fit));
    }

    requestAnimationFrame(fit);
}


function ensureCaretVisibleInCell(el) {
    if (!el || !['INPUT', 'TEXTAREA'].includes(el.tagName)) return;
    if (!el.matches('.excel-table td input, .excel-table td textarea')) return;

    const value = String(el.value || '');
    const start = typeof el.selectionStart === 'number' ? el.selectionStart : value.length;
    const end = typeof el.selectionEnd === 'number' ? el.selectionEnd : start;

    // For an active caret at the end, native controls can reliably reveal it.
    if (start >= value.length) {
        el.scrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
        return;
    }
    if (start <= 0) {
        el.scrollLeft = 0;
        return;
    }

    // Measure the text before the caret using the same font as the control.
    const mirror = document.createElement('span');
    const cs = getComputedStyle(el);
    mirror.style.position = 'fixed';
    mirror.style.left = '-100000px';
    mirror.style.top = '0';
    mirror.style.visibility = 'hidden';
    mirror.style.whiteSpace = 'pre';
    mirror.style.font = cs.font;
    mirror.style.fontSize = cs.fontSize;
    mirror.style.fontFamily = cs.fontFamily;
    mirror.style.fontWeight = cs.fontWeight;
    mirror.style.letterSpacing = cs.letterSpacing;
    mirror.textContent = value.slice(0, start).replace(/\n/g, ' ');
    document.body.appendChild(mirror);

    const caretX = mirror.getBoundingClientRect().width;
    const pad = 10;
    const leftLimit = el.scrollLeft + pad;
    const rightLimit = el.scrollLeft + el.clientWidth - pad;

    if (caretX > rightLimit) {
        el.scrollLeft = Math.max(0, caretX - el.clientWidth + pad);
    } else if (caretX < leftLimit) {
        el.scrollLeft = Math.max(0, caretX - pad);
    }

    mirror.remove();
}

function initLongContentAutoScroll() {
    if (window.__longContentAutoScrollReady) return;
    window.__longContentAutoScrollReady = true;

    // Make P&ID / From / To expand vertically so every character remains visible.
    // Long text wraps instead of being clipped or hidden behind the next row.
    const autoGrowTextarea = (el) => {
        if (!el || el.tagName !== 'TEXTAREA' || !el.classList.contains('multi-line-cell')) return;

        el.setAttribute('wrap', 'soft');
        el.style.setProperty('height', 'auto', 'important');
        el.style.setProperty('min-height', '30px', 'important');
        el.style.setProperty('max-height', 'none', 'important');
        el.style.setProperty('overflow-y', 'hidden', 'important');
        el.style.setProperty('overflow-x', 'hidden', 'important');
        el.style.setProperty('white-space', 'pre-wrap', 'important');
        el.style.setProperty('overflow-wrap', 'anywhere', 'important');
        el.style.setProperty('word-break', 'break-word', 'important');
        el.style.setProperty('word-wrap', 'break-word', 'important');

        // scrollHeight is the reliable browser measurement for wrapped text.
        const height = Math.max(30, el.scrollHeight + 2);
        el.style.setProperty('height', `${height}px`, 'important');
        el.style.setProperty('min-height', `${height}px`, 'important');
        el.classList.toggle('has-multiple-lines', String(el.value || '').includes('\n'));
    };

    const revealCellHorizontally = (el) => {
        const scroller = el?.closest('.line-list-scroll');
        const cell = el?.closest('td, th');
        if (!scroller || !cell) return;
        if (cell.classList.contains('freeze-col') || cell.classList.contains('freeze-insulation')) return;

        const table = cell.closest('table');
        if (!table) return;
        const columnIndex = cell.cellIndex;
        if (columnIndex < 0) return;

        const cols = Array.from(table.querySelectorAll('colgroup col'));
        let targetLeft = 0;
        for (let i = 0; i < columnIndex; i++) {
            targetLeft += cols[i]?.getBoundingClientRect().width || 0;
        }
        const targetWidth = cols[columnIndex]?.getBoundingClientRect().width || cell.getBoundingClientRect().width;
        const frozenWidth = cols.slice(0, 7).reduce((sum, col) => sum + (col?.getBoundingClientRect().width || 0), 0);
        const visibleLeft = scroller.scrollLeft + frozenWidth;
        const visibleRight = scroller.scrollLeft + scroller.clientWidth;
        const desiredLeft = Math.max(frozenWidth, targetLeft);
        const desiredRight = targetLeft + targetWidth;

        if (desiredLeft < visibleLeft) {
            scroller.scrollLeft = Math.max(0, desiredLeft - frozenWidth - 12);
        } else if (desiredRight > visibleRight) {
            scroller.scrollLeft = Math.max(0, desiredRight - scroller.clientWidth + 12);
        }
    };

    const ensureCaretVisibleInCell = (el) => {
        if (!el || !el.matches?.('.excel-table td input, .excel-table td textarea')) return;
        revealCellHorizontally(el);
    };

    window.__lineListAutoGrowTextarea = autoGrowTextarea;
    window.__lineListRevealCell = revealCellHorizontally;
    window.__lineListEnsureCaret = ensureCaretVisibleInCell;

    document.addEventListener('input', (event) => {
        const el = event.target;
        if (el?.tagName === 'TEXTAREA' && el.classList.contains('multi-line-cell')) {
            autoGrowTextarea(el);
            scheduleLineListAutoFit();
        }
    }, true);

    document.addEventListener('focusin', (event) => {
        const el = event.target;
        if (el?.matches?.('.excel-table td input, .excel-table td textarea')) {
            requestAnimationFrame(() => {
                revealCellHorizontally(el);
                ensureCaretVisibleInCell(el);
            });
            if (el.tagName === 'TEXTAREA') autoGrowTextarea(el);
        }
    }, true);

    document.addEventListener('mouseenter', (event) => {
        const el = event.target;
        if (el?.matches?.('.excel-table td input, .excel-table td textarea')) revealCellHorizontally(el);
    }, true);

    document.querySelectorAll('.multi-line-cell').forEach(autoGrowTextarea);

    const lineBody = document.getElementById('lineTableBody');
    if (lineBody && !lineBody.__multiLineObserverReady) {
        lineBody.__multiLineObserverReady = true;
        const observer = new MutationObserver(() => {
            lineBody.querySelectorAll('.multi-line-cell').forEach(autoGrowTextarea);
            scheduleLineListAutoFit();
        });
        observer.observe(lineBody, { childList: true, subtree: true });
        scheduleLineListAutoFit();
    }

    if (!window.__lineListAutoFitResizeReady) {
        window.__lineListAutoFitResizeReady = true;
        window.addEventListener('resize', () => {
            document.querySelectorAll('.multi-line-cell').forEach(autoGrowTextarea);
            scheduleLineListAutoFit();
        });
    }
}


/* =========================================================
   AUTO-FIT LINE LIST COLUMNS
   Kolom mengikuti teks terpanjang yang tampil. Tidak ada
   pemotongan teks; tabel tetap horizontal-scrollable.
   ========================================================= */
function autoFitLineListColumns() {
    const table = document.querySelector('.excel-table');
    if (!table) return;

    const colgroup = table.querySelector('.line-list-colgroup');
    const completeCol = colgroup?.querySelector('col.c-complete');
    const fromCol = colgroup?.querySelector('col.c-from');
    const toCol = colgroup?.querySelector('col.c-to');
    const serviceCol = colgroup?.querySelector('col.c-service');
    if (!completeCol || !fromCol || !toCol || !serviceCol) return;

    const project = (typeof projectsData !== 'undefined' && typeof currentProjectIndex !== 'undefined')
        ? projectsData[currentProjectIndex]
        : null;
    const lines = project && Array.isArray(project.lines) ? project.lines : [];

    const measure = document.createElement('span');
    Object.assign(measure.style, {
        position: 'fixed', left: '-100000px', top: '-100000px',
        visibility: 'hidden', whiteSpace: 'pre', display: 'inline-block',
        padding: '0', margin: '0'
    });
    document.body.appendChild(measure);

    const reference = table.querySelector('tbody td:nth-child(10) textarea') || table;
    const cs = getComputedStyle(reference);
    measure.style.font = cs.font;
    measure.style.fontFamily = cs.fontFamily;
    measure.style.fontSize = cs.fontSize;
    measure.style.fontWeight = cs.fontWeight;
    measure.style.letterSpacing = cs.letterSpacing;

    const getWidth = (field, fallback, selector) => {
        const values = lines.length
            ? lines.map(line => String(line?.[field] ?? ''))
            : Array.from(table.querySelectorAll(selector)).map(el => String(el.value ?? el.textContent ?? ''));
        let max = fallback;
        for (const value of values) {
            for (const part of value.replace(/\r/g, '').split('\n')) {
                measure.textContent = part || ' ';
                max = Math.max(max, Math.ceil(measure.getBoundingClientRect().width) + 42);
            }
        }
        // Tidak ada batas maksimum: kolom boleh melebar agar teks tidak terpotong.
        return Math.max(fallback, max);
    };

    const completeWidth = getWidth('complete_no', 220, 'tbody td:nth-child(8) input');
    const fromWidth = getWidth('from', 180, 'tbody td:nth-child(10) textarea');
    const toWidth = getWidth('to', 180, 'tbody td:nth-child(11) textarea');
    const serviceWidth = getWidth('service', 180, 'tbody td:nth-child(12) input');
    measure.remove();

    const apply = (col, selector, width) => {
        col.style.setProperty('width', `${width}px`, 'important');
        col.style.setProperty('min-width', `${width}px`, 'important');
        col.style.setProperty('max-width', 'none', 'important');
        table.querySelectorAll(selector).forEach(cell => {
            cell.style.setProperty('width', `${width}px`, 'important');
            cell.style.setProperty('min-width', `${width}px`, 'important');
            cell.style.setProperty('max-width', 'none', 'important');
            cell.style.setProperty('overflow', 'visible', 'important');
            cell.style.setProperty('text-align', 'center', 'important');
            const textarea = cell.querySelector('textarea');
            const input = cell.querySelector('input');
            const editor = textarea || input;
            if (editor) {
                editor.style.setProperty('width', '100%', 'important');
                editor.style.setProperty('min-width', '0', 'important');
                editor.style.setProperty('max-width', 'none', 'important');
                editor.style.setProperty('text-align', 'center', 'important');
                if (textarea) {
                    textarea.style.setProperty('white-space', 'nowrap', 'important');
                    textarea.style.setProperty('overflow-wrap', 'normal', 'important');
                    textarea.style.setProperty('word-break', 'normal', 'important');
                    textarea.style.setProperty('overflow-x', 'hidden', 'important');
                    textarea.style.setProperty('overflow-y', 'hidden', 'important');
                    textarea.style.setProperty('height', '30px', 'important');
                }
            }
        });
    };

    apply(completeCol, 'tbody td:nth-child(8)', completeWidth);
    apply(fromCol, 'tbody td:nth-child(10)', fromWidth);
    apply(toCol, 'tbody td:nth-child(11)', toWidth);
    apply(serviceCol, 'tbody td:nth-child(12)', serviceWidth);
}


function scheduleLineListAutoFit() {
    if (window.__lineListAutoFitFrame) return;
    window.__lineListAutoFitFrame = requestAnimationFrame(() => {
        window.__lineListAutoFitFrame = null;
        autoFitLineListColumns();
    });
}


// Final initialization for automatic horizontal reveal of long data.
document.addEventListener("DOMContentLoaded", () => { initLongContentAutoScroll(); initProjectNameMarquee(); scheduleLineListAutoFit(); });

// Nama Project: klik area nama untuk fokus navigasi keyboard tanpa mengedit nilainya.
document.addEventListener('click', (event) => {
    const viewport = document.getElementById('projectNameViewport');
    if (!viewport) return;
    if (event.target.closest('#projectNameViewport')) {
        viewport.focus({ preventScroll: true });
    }
});


// Initialize P&ID / Documents upload after the page is ready.
document.addEventListener("DOMContentLoaded", initDocumentUpload);


