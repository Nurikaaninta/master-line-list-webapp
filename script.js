function appData() {
    return {
        isLoggedIn: false,
        loginError: false,
        loginErrorMsg: '',
        loginForm: {
            user: '',
            pass: '',
            role: ''
        },
        
        currentDashboardTab: 'home',
        activeProject: 'PRJ-3000',
        allProjectsData: {},

        sheets: [
            'SP Items', 'Valve', 'Support', 'LineList', 'Tee', 'Single Branch Fitting', 'Pipe', 'Nozzle', 
            'Instrument', 'Flange', 'Elbow', 'Coupling', 'Pipe Run Component', 
            'Tap Weld', 'Socketweld', 'Gasket', 'Buttweld', 'Bolt Set', 
            'Fasteners', 'Vessel', 'Tank', 'Pump', 'Misc Equipment', 
            'Equipment', 'Piping and Equipment'
        ],
        activeSheet: 'Valve',
        addFormType: 'MTO',
        globalSearch: '',
        currentPage: 1,
        itemsPerPage: 15,
        tableRenderKey: 0,

        // Filter per kolom seperti Excel.
        // Key = nama kolom, value = daftar nilai yang dipilih.
        columnFilters: {},
        filterPopupOpen: false,
        activeFilterColumn: '',
        filterOptionSearch: '',
        filterOptions: [],
        filterDraftValues: [],
        filterPopupPosition: { left: 0, top: 0 },

        // Mode input data langsung di tabel.
        addingNewData: false,
        newInlineRow: {},

        showAddModal: false,
        showBomModal: false,
        showBoqModal: false,
        showApproveModal: false,
        taskView: 'active',
        approvalHistory: [],
        approvalNote: '',
        showModuleModal: false,

        // State Create Project
        showCreateProjectModal: false,
        isCreatingProject: false,
        createProjectMessage: '',
        createProjectMessageType: 'error',
        createProjectForm: {
            code: '',
            name: '',
            description: '',
            initialization: 'empty',
            file: null,
            fileName: ''
        },

        activeModuleName: '',
        moduleDescription: '',

        activePriceLevel: 'Menengah',
        boqCurrency: 'USD',
        
        newRowForm: {
            longDesc: '',
            material: 'CS',
            spec: 'CS150',
            size: '2"',
            pressure: '150',
            wasteFactor: '5',
            tag: ''
        },

        // State & Fungsi Pendukung Kalender
        calendarMonth: new Date().getMonth(), // 0 - 11
        calendarYear: new Date().getFullYear(),
        monthNames: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],

        get calendarDaysInMonth() {
            return new Date(this.calendarYear, this.calendarMonth + 1, 0).getDate();
        },

        get calendarFirstDayIndex() {
            return new Date(this.calendarYear, this.calendarMonth, 1).getDay();
        },

        prevMonth() {
            if (this.calendarMonth === 0) {
                this.calendarMonth = 11;
                this.calendarYear--;
            } else {
                this.calendarMonth--;
            }
        },

        nextMonth() {
            if (this.calendarMonth === 11) {
                this.calendarMonth = 0;
                this.calendarYear++;
            } else {
                this.calendarMonth++;
            }
        },

        // Tambahan State untuk Modul Interaktif Baru
        travelForm: {
            destination: 'Yogyakarta',
            date: '2026-08-15'
        },
        selectedCalendarDate: 4,
        newAgendaText: '',
        calendarAgendas: {
            '4-7-2026': ['Meeting Koordinasi Proyek BMBQ', 'Review MTO Valve']
        },
        policiesList: [
            { id: 1, title: 'SOP Keselamatan Kerja (HSE-01)', category: 'SOP', status: 'Aktif' },
            { id: 2, title: 'Panduan Pengadaan Material Pipa (PR-04)', category: 'Panduan', status: 'Aktif' }
        ],

        // Fungsi Pendukung Modul Baru
        submitTravelRequest() {
            alert(`Pengajuan perjalanan dinas ke ${this.travelForm.destination} tanggal ${this.travelForm.date} berhasil disimpan!`);
        },

        selectCalendarDate(day) {
            this.selectedCalendarDate = day;
        },

        addAgenda() {
            if (!this.newAgendaText.trim()) return;
            const key = `${this.selectedCalendarDate}-${this.calendarMonth}-${this.calendarYear}`;
            if (!this.calendarAgendas[key]) {
                this.calendarAgendas[key] = [];
            }
            this.calendarAgendas[key].push(this.newAgendaText.trim());
            this.newAgendaText = '';
            alert('Agenda berhasil ditambahkan!');
        },

        removeAgenda(key, index) {
            if (this.calendarAgendas[key]) {
                this.calendarAgendas[key].splice(index, 1);
            }
        },

        init() {
            this.$nextTick(() => {
                this.updateTableScrollbar();
                if (!this.tableScrollbarResizeObserver) {
                    const card = document.querySelector('.workspace-table-card');
                    if (card && window.ResizeObserver) {
                        this.tableScrollbarResizeObserver = new ResizeObserver(() => this.updateTableScrollbar());
                        this.tableScrollbarResizeObserver.observe(card);
                    }
                }
            });

            window.addEventListener('resize', () => this.updateTableScrollbar());

            const tableObserver = new MutationObserver(() => {
                this.$nextTick(() => this.updateTableScrollbar());
            });
            this.$nextTick(() => {
                const tableArea = document.querySelector('.excel-table-container');
                if (tableArea) {
                    tableObserver.observe(tableArea, { childList: true, subtree: true });
                }
            });

            // ==========================================================
            // DATABASE V4 - SEMUA TABEL DIMULAI KOSONG
            // Setiap tabel memiliki storage sendiri berdasarkan PROJECT + SHEET.
            // ==========================================================
            const STORAGE_VERSION = 'BMBQ_TABLE_STORAGE_V7_EXACT_EXCEL';
            const savedVersion = localStorage.getItem('tripatra_storage_version');

            if (savedVersion !== STORAGE_VERSION) {
                Object.keys(localStorage)
                    .filter(key => key.startsWith('tripatra_table_v4_') || key === 'tripatra_multiproject_db')
                    .forEach(key => localStorage.removeItem(key));
                localStorage.setItem('tripatra_storage_version', STORAGE_VERSION);
            }

            const defaultPRJ3000 = this.createBlankProject('PRJ-3000', 'Piping & Equipment', 'Project utama BMBQ WebApp');
            const defaultPRJ4000 = this.createBlankProject('PRJ-4000', 'Piping & Equipment', '');
            const defaultPRJ5000 = this.createBlankProject('PRJ-5000', 'Piping & Equipment', '');

            this.allProjectsData = {
                'PRJ-3000': defaultPRJ3000,
                'PRJ-4000': defaultPRJ4000,
                'PRJ-5000': defaultPRJ5000
            };

            this.loadProjectMetaStorage();
            this.loadTableStorage();

            this.normalizeAllProjectsData();
            this.loadBomBoqStorage();
            this.refreshSheetList();
            this.loadApprovalHistory();
            this.saveStorage();
        },

        // ==========================================================
        // EXCEL DATA MODEL
        // Data hasil import disimpan 1:1 dengan header Excel.
        // Tidak ada alias/rename/delete kolom pada data import.
        // ==========================================================
        normalizeHeaderExact(value) {
            return String(value ?? '')
                .replace(/\u00A0/g, ' ')
                .trim();
        },

        getExactSchema(sheetName) {
            const schemas = {
                'SP Items': [
                    'Long Description (Family)',
                    'Short Description',
                    'Spec',
                    'Available Size',
                    'Part Subtype',
                    'Item Count'
                ],
                'Support': [
                    'Long Description (Family)',
                    'Compatible Standard',
                    'Manufacturer',
                    'Material',
                    'Material Code',
                    'Long Description (Size)',
                    'Short Description',
                    'Spec',
                    'Size',
                    'Line Number Tag',
                    'Design Std',
                    'Content Iso Symbol Definition',
                    'Design Pressure Factor',
                    'End Type',
                    'Engagement Length',
                    'Facing',
                    'Flange Std',
                    'Gasket Std',
                    'Port Unit',
                    'Matching Pipe OD',
                    'Nominal Diameter',
                    'X Coordinate (Port 1)',
                    'Y Coordinate (Port 1)',
                    'COP Elevation (Port 1)',
                    'Pressure Class',
                    'Schedule',
                    'Status',
                    'Wall Thickness',
                    'Weight',
                    'Weight Unit',
                    'Required Spec',
                    'Insulation Thickness',
                    'Insulation Type',
                    'Service',
                    'Tag',
                    'Tie In Number',
                    'Shop/Field',
                    'DWG Number',
                    'PnPID',
                    'PnPGuid',
                    'Item Code',
                    'Flange Thickness',
                    'Center of Gravity X',
                    'Center of Gravity Y',
                    'Center of Gravity Z',
                    'Tracing Type',
                    'Tracing Spec',
                    'Insulation Spec',
                    'Spool Number',
                    'Unit',
                    'Top of Pipe',
                    'Bottom of Pipe',
                    'Part Subtype',
                    'Support Type',
                    'Support Detail',
                    'Fixed',
                    'Length',
                    'Min Length',
                    'Max Length',
                    'Comment',
                    'Reference'
                ],
                'LineList': [
                    'No',
                    'Line Size (Inch)',
                    'Process Fluid Identifier',
                    'Pipe.Spec',
                    'Seq. No',
                    'Type',
                    'Thickness [mm]',
                    'Complete Line No.',
                    'P&ID No',
                    'From',
                    'To',
                    'Fluid Service',
                    'Phase',
                    'Mass Flow\n[kg/h]',
                    'Volume Flow\n[m1.5/h]',
                    'Operating',
                    'Design',
                    'Operating Temperature',
                    'Design Temperature',
                    'Density\n[kg/m3]',
                    'Viscosity\n[cP]',
                    'RT',
                    'PT/MT',
                    'Medium',
                    'Pressure [Barg]',
                    'Painting Code',
                    'Remarks'
                ],
                'Valve': [
                    'Number',
                    'Long Description (Family)',
                    'Compatible Standard',
                    'Manufacturer',
                    'Material',
                    'Material Code',
                    'Long Description (Size)',
                    'Short Description',
                    'Spec',
                    'Size',
                    'Line Number Tag',
                    'Design Std',
                    'Content Iso Symbol Definition',
                    'Design Pressure Factor',
                    'End Type',
                    'Engagement Length',
                    'Facing',
                    'Flange Std',
                    'Gasket Std',
                    'Port Unit',
                    'Nominal Diameter',
                    'X Coordinate (Port 1)',
                    'Y Coordinate (Port 1)',
                    'COP Elevation (Port 1)',
                    'Pressure Class',
                    'Schedule',
                    'Status',
                    'Wall Thickness',
                    'Weight',
                    'Weight Unit',
                    'Required Spec',
                    'Insulation Thickness',
                    'Insulation Type',
                    'Service',
                    'Tag',
                    'Tie In Number',
                    'Shop/Field',
                    'DWG Number',
                    'PnPID',
                    'PnPGuid',
                    'Item Code',
                    'Matching Pipe OD',
                    'Flange Thickness',
                    'Center of Gravity X',
                    'Center of Gravity Y',
                    'Center of Gravity Z',
                    'Tracing Type',
                    'Tracing Spec',
                    'Insulation Spec',
                    'Spool Number',
                    'Unit',
                    'Top of Pipe',
                    'Bottom of Pipe',
                    'Length',
                    'Valve Alignment',
                    'Valve Detail',
                    'Valve Body Type',
                    'Flow Dependent',
                    'Offset',
                    'Operator Type',
                    'Actuator Type',
                    'Actuator Height',
                    'Actuator Width',
                    'Control Valve',
                    'Valve Code',
                    'Normally',
                    'Failure',
                    'End Connections',
                    'Code'
                ]
            };
            return schemas[sheetName] || null;
        },

        getImportTargetSheet() {
            const name = String(this.activeSheet || '').trim();
            if (name.toLowerCase() === 'support' || name.toLowerCase() === 'pipe support') return 'Support';
            if (name.toLowerCase() === 'linelist' || name.toLowerCase() === 'line list') return 'LineList';
            return name;
        },

        findWorkbookSheet(workbook, targetSheet) {
            const target = String(targetSheet || '').trim().toLowerCase();
            const aliases = {
                'support': ['support', 'pipe support'],
                'linelist': ['linelist', 'line list'],
                'sp items': ['sp items', 'sp_items', 'spitems'],
                'valve': ['valve']
            };
            const accepted = aliases[target] || [target];

            return workbook.SheetNames.find(name =>
                accepted.includes(String(name || '').replace(/\u00A0/g, ' ').trim().toLowerCase())
            ) || null;
        },

        worksheetToExactRows(worksheet) {
            if (!worksheet) throw new Error('Worksheet Excel tidak ditemukan.');

            const matrix = XLSX.utils.sheet_to_json(worksheet, {
                header: 1,
                defval: '',
                raw: true,
                blankrows: false
            });

            // Cari baris header pertama yang mempunyai minimal 2 cell berisi.
            const headerIndex = matrix.findIndex(row =>
                Array.isArray(row) &&
                row.filter(v => String(v ?? '').trim() !== '').length >= 2
            );

            if (headerIndex < 0) {
                throw new Error('Header Excel tidak ditemukan.');
            }

            const rawHeaders = matrix[headerIndex] || [];
            const headers = [];
            const used = new Set();

            rawHeaders.forEach((value, colIndex) => {
                let header = this.normalizeHeaderExact(value);
                if (!header) header = `Column ${colIndex + 1}`;

                // Header duplikat tidak boleh membuat nilai tertimpa.
                let unique = header;
                let n = 2;
                while (used.has(unique.toLowerCase())) {
                    unique = `${header} (${n++})`;
                }
                used.add(unique.toLowerCase());
                headers.push(unique);
            });

            const rows = [];

            for (let r = headerIndex + 1; r < matrix.length; r++) {
                const sourceRow = Array.isArray(matrix[r]) ? matrix[r] : [];
                const hasData = headers.some((_, c) => {
                    const value = sourceRow[c];
                    return value !== null && value !== undefined && String(value).trim() !== '';
                });
                if (!hasData) continue;

                const row = {};
                headers.forEach((header, c) => {
                    row[header] = sourceRow[c] ?? '';
                });
                rows.push(row);
            }

            return { headers, rows, headerIndex };
        },

        normalizeAllProjectsData() {
            Object.keys(this.allProjectsData || {}).forEach(projectKey => {
                const project = this.allProjectsData[projectKey];
                if (!project || typeof project !== 'object') return;

                if (!project.meta || typeof project.meta !== 'object') {
                    project.meta = {
                        projectCode: projectKey,
                        projectName: 'Piping & Equipment',
                        description: '',
                        createdAt: '',
                        createdBy: '',
                        isApproved: false,
                        approvedAt: '',
                        version: 0,
                        progress: '0%',
                        workflowStatus: 'DRAFT',
                        revisionNotes: '',
                        bom: null,
                        boq: null
                    };
                } else {
                    project.meta.workflowStatus ||= 'DRAFT';
                    project.meta.revisionNotes ||= '';
                    if (!('bom' in project.meta)) project.meta.bom = null;
                    if (!('boq' in project.meta)) project.meta.boq = null;
                }

                // Hanya pastikan tipe data benar.
                // JANGAN mengubah nama header atau isi cell Excel.
                Object.keys(project).forEach(sheetName => {
                    if (sheetName === 'meta') return;
                    if (!Array.isArray(project[sheetName])) project[sheetName] = [];
                    project[sheetName] = project[sheetName]
                        .filter(row => row && typeof row === 'object');
                });

                this.sheets.forEach(sheetName => {
                    if (!Array.isArray(project[sheetName])) project[sheetName] = [];
                });
            });
        },

        refreshSheetList() {
            const importedSheets = new Set();
            Object.values(this.allProjectsData || {}).forEach(project => {
                if (!project || typeof project !== 'object') return;
                Object.keys(project).forEach(key => {
                    if (key !== 'meta') importedSheets.add(key);
                });
            });
            this.sheets = [...new Set([...this.sheets, ...importedSheets])];
        },

        getTableStorageKey(projectKey, sheetName) {
            return `tripatra_table_v4::${encodeURIComponent(String(projectKey || 'default'))}::${encodeURIComponent(String(sheetName || 'default'))}`;
        },

        getProjectMetaStorageKey() {
            return 'tripatra_project_meta_v4';
        },

        getBomStorageKey(projectKey) {
            return `tripatra_bom_v4::${encodeURIComponent(String(projectKey || 'default'))}`;
        },

        getBoqStorageKey(projectKey) {
            return `tripatra_boq_v4::${encodeURIComponent(String(projectKey || 'default'))}`;
        },

        loadBomBoqStorage() {
            Object.entries(this.allProjectsData || {}).forEach(([projectKey, project]) => {
                if (!project?.meta) return;
                try {
                    const bomRaw = localStorage.getItem(this.getBomStorageKey(projectKey));
                    const boqRaw = localStorage.getItem(this.getBoqStorageKey(projectKey));
                    if (bomRaw) {
                        const bom = JSON.parse(bomRaw);
                        if (bom && typeof bom === 'object') project.meta.bom = bom;
                    }
                    if (boqRaw) {
                        const boq = JSON.parse(boqRaw);
                        if (boq && typeof boq === 'object') project.meta.boq = boq;
                    }
                } catch (error) {
                    console.warn('BOM/BOQ storage tidak dapat dibaca:', error);
                }
            });
        },

        saveBomBoqStorage() {
            Object.entries(this.allProjectsData || {}).forEach(([projectKey, project]) => {
                const bom = project?.meta?.bom;
                const boq = project?.meta?.boq;
                try {
                    if (bom) localStorage.setItem(this.getBomStorageKey(projectKey), JSON.stringify(bom));
                    else localStorage.removeItem(this.getBomStorageKey(projectKey));
                    if (boq) localStorage.setItem(this.getBoqStorageKey(projectKey), JSON.stringify(boq));
                    else localStorage.removeItem(this.getBoqStorageKey(projectKey));
                } catch (error) {
                    console.error('Gagal menyimpan BOM/BOQ terpisah:', error);
                    alert('Penyimpanan BOM/BOQ gagal karena kapasitas browser penuh. Data tabel Excel tidak dihapus.');
                }
            });
        },

        loadProjectMetaStorage() {
            try {
                const raw = localStorage.getItem(this.getProjectMetaStorageKey());
                if (!raw) return;
                const metas = JSON.parse(raw);
                if (!metas || typeof metas !== 'object') return;
                Object.entries(metas).forEach(([projectKey, meta]) => {
                    if (!this.allProjectsData[projectKey]) {
                        this.allProjectsData[projectKey] = this.createBlankProject(
                            projectKey, meta?.projectName || 'Piping & Equipment', meta?.description || ''
                        );
                    }
                    this.allProjectsData[projectKey].meta = {
                        ...this.allProjectsData[projectKey].meta, ...(meta || {})
                    };
                });
            } catch (error) {
                console.warn('Metadata project tidak dapat dibaca:', error);
            }
        },

        loadTableStorage() {
            const prefix = 'tripatra_table_v4::';

            // Baca semua tabel yang pernah disimpan, termasuk project/sheet baru.
            Object.keys(localStorage)
                .filter(key => key.startsWith(prefix))
                .forEach(key => {
                    const rest = key.slice(prefix.length);
                    const parts = rest.split('::');
                    if (parts.length < 2) return;

                    let projectKey = '';
                    let sheetName = '';
                    try {
                        projectKey = decodeURIComponent(parts[0]);
                        sheetName = decodeURIComponent(parts.slice(1).join('::'));
                    } catch (error) {
                        return;
                    }
                    if (!projectKey || !sheetName) return;

                    if (!this.allProjectsData[projectKey]) {
                        this.allProjectsData[projectKey] = this.createBlankProject(projectKey, 'Piping & Equipment', '');
                    }
                    if (!this.sheets.includes(sheetName)) this.sheets.push(sheetName);

                    try {
                        const raw = localStorage.getItem(key);
                        const rows = raw ? JSON.parse(raw) : [];
                        this.allProjectsData[projectKey][sheetName] = Array.isArray(rows) ? rows : [];
                    } catch (error) {
                        this.allProjectsData[projectKey][sheetName] = [];
                    }
                });

            // Pastikan setiap project mempunyai array terpisah untuk setiap sheet.
            Object.values(this.allProjectsData || {}).forEach(project => {
                this.sheets.forEach(sheetName => {
                    if (!Array.isArray(project[sheetName])) project[sheetName] = [];
                });
            });
        },

        saveTableStorage(projectKey, sheetName) {
            if (!projectKey || !sheetName) return;
            const project = this.allProjectsData?.[projectKey];
            if (!project) return;
            const rows = Array.isArray(project[sheetName]) ? project[sheetName] : [];
            localStorage.setItem(this.getTableStorageKey(projectKey, sheetName), JSON.stringify(rows));
        },

        saveStorage() {
            // Metadata ringan; BOM/BOQ besar selalu disimpan terpisah.
            const metas = {};
            Object.entries(this.allProjectsData || {}).forEach(([projectKey, project]) => {
                const meta = project?.meta || {};
                const { bom, boq, ...lightMeta } = meta;
                metas[projectKey] = lightMeta;
            });
            try {
                localStorage.setItem(this.getProjectMetaStorageKey(), JSON.stringify(metas));
            } catch (error) {
                console.error('Metadata project gagal disimpan:', error);
            }
            this.saveBomBoqStorage();

            Object.entries(this.allProjectsData || {}).forEach(([projectKey, project]) => {
                Object.keys(project || {}).forEach(sheetName => {
                    if (sheetName !== 'meta') this.saveTableStorage(projectKey, sheetName);
                });
            });
        },

        switchProject() {
            this.loadTableStorage();
            this.loadBomBoqStorage();
            this.currentPage = 1;
            this.globalSearch = '';
            this.columnFilters = {};
            this.closeColumnFilter();
        },

        // ==========================================================
        // CREATE PROJECT
        // Project baru selalu dibuat dari struktur kosong.
        // Tidak pernah menyalin data dari project lain.
        // ==========================================================
        openCreateProjectModal() {
            this.createProjectForm = {
                code: '',
                name: '',
                description: '',
                initialization: 'empty',
                file: null,
                fileName: ''
            };
            this.createProjectMessage = '';
            this.createProjectMessageType = 'error';
            this.isCreatingProject = false;
            this.showCreateProjectModal = true;

            this.$nextTick(() => {
                const input = document.querySelector('.create-project-modal input');
                if (input) input.focus();
            });
        },

        closeCreateProjectModal() {
            if (this.isCreatingProject) return;
            this.showCreateProjectModal = false;
            this.createProjectMessage = '';
        },

        handleCreateProjectFile(event) {
            const file = event.target.files?.[0];
            if (!file) {
                this.createProjectForm.file = null;
                this.createProjectForm.fileName = '';
                return;
            }

            const lowerName = file.name.toLowerCase();
            if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls')) {
                this.createProjectForm.file = null;
                this.createProjectForm.fileName = '';
                this.createProjectMessageType = 'error';
                this.createProjectMessage = 'File harus berformat .xlsx atau .xls.';
                event.target.value = '';
                return;
            }

            this.createProjectForm.file = file;
            this.createProjectForm.fileName = file.name;
            this.createProjectMessage = '';
        },

        createBlankProject(projectCode, projectName, description = '') {
            const project = {
                meta: {
                    projectCode,
                    projectName,
                    description,
                    createdAt: new Date().toLocaleString('id-ID'),
                    createdBy: this.loginForm.user || 'engineer@tripatra.com',
                    isApproved: false,
                    approvedAt: '',
                    version: 0,
                    progress: '0%',
                    workflowStatus: 'DRAFT',
                    revisionNotes: '',
                    bom: null,
                    boq: null
                }
            };

            this.sheets.forEach(sheetName => {
                project[sheetName] = [];
            });

            return project;
        },

        async createProject() {
            if (this.isCreatingProject) return;

            const code = String(this.createProjectForm.code || '').trim();
            const name = String(this.createProjectForm.name || '').trim();
            const description = String(this.createProjectForm.description || '').trim();

            if (!code) {
                this.createProjectMessageType = 'error';
                this.createProjectMessage = 'Project Code wajib diisi.';
                return;
            }

            if (name.length < 2) {
                this.createProjectMessageType = 'error';
                this.createProjectMessage = 'Project Name wajib diisi minimal 2 karakter.';
                return;
            }

            const duplicate = Object.keys(this.allProjectsData || {})
                .some(key => String(key).trim().toLowerCase() === code.toLowerCase());

            if (duplicate) {
                this.createProjectMessageType = 'error';
                this.createProjectMessage = `Project ${code} sudah ada. Gunakan kode project lain.`;
                return;
            }

            if (this.createProjectForm.initialization === 'import' && !this.createProjectForm.file) {
                this.createProjectMessageType = 'error';
                this.createProjectMessage = 'Pilih file Excel terlebih dahulu untuk opsi Import Excel.';
                return;
            }

            this.isCreatingProject = true;
            this.createProjectMessage = '';

            try {
                const newProject = this.createBlankProject(code, name, description);

                if (this.createProjectForm.initialization === 'empty') {
                    this.allProjectsData[code] = newProject;
                    this.activeSheet = 'Valve';
                } else {
                    const workbook = await this.readExcelWorkbook(this.createProjectForm.file);

                    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                        throw new Error('Workbook tidak memiliki sheet.');
                    }

                    let firstImportedSheet = '';

                    workbook.SheetNames.forEach((sheetName, sheetIndex) => {
                        const worksheet = workbook.Sheets[sheetName];
                        if (!worksheet || !worksheet['!ref']) return;

                        let rows = XLSX.utils.sheet_to_json(worksheet, {
                            defval: '',
                            raw: false,
                            blankrows: false
                        });

                        rows = rows
                            .filter(row => Object.values(row || {}).some(value => String(value).trim() !== ''))
                            .map((row, idx) => this.normalizeRow(row, idx));

                        const cleanSheetName = String(sheetName).trim() || `Sheet ${sheetIndex + 1}`;
                        newProject[cleanSheetName] = rows;

                        if (!firstImportedSheet && rows.length > 0) {
                            firstImportedSheet = cleanSheetName;
                        }
                    });

                    this.allProjectsData[code] = newProject;
                    this.refreshSheetList();
                    this.activeSheet = firstImportedSheet || 'Valve';
                }

                this.activeProject = code;
                this.currentDashboardTab = 'workspace';
                this.currentPage = 1;
                this.globalSearch = '';
                this.saveStorage();

                this.createProjectMessageType = 'success';
                this.createProjectMessage = this.createProjectForm.initialization === 'import'
                    ? `Project ${code} berhasil dibuat dan data Excel berhasil diimport.`
                    : `Project ${code} berhasil dibuat sebagai project kosong.`;

                setTimeout(() => {
                    this.showCreateProjectModal = false;
                    this.createProjectMessage = '';
                    this.isCreatingProject = false;
                }, 700);

            } catch (error) {
                console.error('Create project error:', error);
                this.createProjectMessageType = 'error';
                this.createProjectMessage = error.message || 'Project gagal dibuat.';
                this.isCreatingProject = false;
            }
        },

        readExcelWorkbook(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();

                reader.onload = (event) => {
                    try {
                        const data = new Uint8Array(event.target.result);
                        const workbook = XLSX.read(data, {
                            type: 'array',
                            cellDates: true,
                            raw: false
                        });
                        resolve(workbook);
                    } catch (error) {
                        reject(new Error('File Excel tidak dapat dibaca. Pastikan format file valid.'));
                    }
                };

                reader.onerror = () => reject(new Error('File Excel tidak dapat dibaca oleh browser.'));
                reader.readAsArrayBuffer(file);
            });
        },

        // Backward compatibility untuk kode lama.
        addNewProject() {
            this.openCreateProjectModal();
        },

        openAppModule(appName) {
            this.activeModuleName = appName;
            if (appName === 'Travel') {
                this.moduleDescription = 'Modul Manajemen Perjalanan Dinas, pemesanan tiket pesawat, akomodasi hotel, dan klaim reimbursement.';
            } else if (appName === 'Calendar') {
                this.moduleDescription = 'Kalender Terpadu perusahaan untuk penjadwalan meeting proyek, deadline deliverables, dan milestone engineering.';
            } else if (appName === 'HR Docs') {
                this.moduleDescription = 'Pusat arsip dokumen kepegawaian, surat keputusan (SK), slip gaji, dan sertifikasi keahlian profesional.';
            } else if (appName === 'Policies') {
                this.moduleDescription = 'Direktori Standar Operasional Prosedur (SOP), kebijakan keselamatan kerja (HSE), dan panduan internal perusahaan.';
            } else if (appName === 'Flows') {
                this.moduleDescription = 'Pusat otomatisasi alur kerja digital, formulir persetujuan multi-level, dan pelacakan status dokumen.';
            } else if (appName === 'Perf') {
                this.moduleDescription = 'Modul Penilaian Kinerja Karyawan (Performance Review), penyusunan KPI tahunan, dan feedback berkelanjutan.';
            } else if (appName === 'Attendance') {
                this.moduleDescription = 'Modul Rekapitulasi Kehadiran & Pengajuan Regularisasi Absensi Karyawan.';
            } else if (appName === 'Talent Referral') {
                this.moduleDescription = 'Portal Lowongan Kerja internal dan Program Referensi Talenta Perusahaan.';
            } else {
                this.moduleDescription = 'Modul sistem internal Tripatra BMBQ WebApp.';
            }
            this.showModuleModal = true;
        },

        login() {
            this.loginError = false;
            const email = this.loginForm.user.trim().toLowerCase();
            const pass = this.loginForm.pass.trim();

            if (email === 'engineer@tripatra.com' && pass === 'engineer123') {
                this.loginForm.role = 'Piping Engineer';
                this.isLoggedIn = true;
            } else if (email === 'estimator@tripatra.com' && pass === 'estimator123') {
                this.loginForm.role = 'Estimator Proposal';
                this.isLoggedIn = true;
            } else if (email === 'lead@tripatra.com' && pass === 'lead123') {
                this.loginForm.role = 'Lead Estimator';
                this.isLoggedIn = true;
            } else {
                this.loginError = true;
                this.loginErrorMsg = 'Email atau password salah. Silakan periksa kembali.';
            }
        },

        logout() {
            this.isLoggedIn = false;
            this.loginForm.user = '';
            this.loginForm.pass = '';
        },

        getRoleFocusText() {
            if (this.loginForm.role === 'Piping Engineer') return 'Spesifikasi Teknis & Input Parameter MTO (S3D/E3D/P3D)';
            if (this.loginForm.role === 'Estimator Proposal') return 'Database Harga, Kalkulasi Biaya BOQ & Material (Direct/Indirect Cost)';
            if (this.loginForm.role === 'Lead Estimator') return 'Pengawasan Progres, Approval Flow & Laporan Eksekutif';
            return '';
        },

        getProjectVersion() {
            if (!this.allProjectsData[this.activeProject]?.meta) return 'Rev 0';
            return 'Rev ' + (this.allProjectsData[this.activeProject].meta.version || 0);
        },

        get currentRows() {
            if (!this.allProjectsData[this.activeProject]) {
                this.allProjectsData[this.activeProject] = this.createBlankProject(this.activeProject, 'Piping & Equipment', '');
            }
            if (!Array.isArray(this.allProjectsData[this.activeProject][this.activeSheet])) {
                this.allProjectsData[this.activeProject][this.activeSheet] = [];
            }
            return this.allProjectsData[this.activeProject][this.activeSheet];
        },

        get currentColumns() {
            const exactSchema = this.getExactSchema(this.activeSheet);
            if (exactSchema) {
                // Number/No tetap tersimpan, tetapi kolom nomor sudah disediakan
                // oleh kolom UI paling kiri.
                return exactSchema.filter(col => col !== 'Number' && col !== 'No');
            }

            const rows = this.currentRows || [];
            if (!rows.length) {
                return ['Material', 'Material Code', 'Spec', 'Size', 'Pressure Class', 'Line Number Tag', 'Status'];
            }

            // Untuk sheet MTO lain, ikuti urutan header dari baris pertama.
            return Object.keys(rows[0] || {}).filter(col =>
                col !== 'Number' && col !== 'No'
            );
        },

        get freezeColumns() {
            // Freeze dari kiri sampai kolom batas berikut (termasuk kolom
            // batasnya), sisanya tetap bisa digeser. Kolom "No" di paling
            // kiri SELALU ikut freeze secara terpisah (lihat getNoFreezeClass).
            //
            //   Tabel                                  | Freeze dari kiri sampai
            //   ---------------------------------------|-------------------------
            //   MTO Pipe & Fitting Valve                | Material
            //   SP Items                                | Spec
            //   Pipe Support                             | Material
            //   Line List                                | Seq. No
            //   Vessel / Tank / Pump / Misc Equipment /
            //   Equipment / Piping and Equipment         | Long Description (Size)
            const boundaryBySheet = {
                'Valve': 'Material',
                'SP Items': 'Spec',
                'Support': 'Material',
                'LineList': 'Seq. No',
                'Vessel': 'Long Description (Size)',
                'Tank': 'Long Description (Size)',
                'Pump': 'Long Description (Size)',
                'Misc Equipment': 'Long Description (Size)',
                'Equipment': 'Long Description (Size)',
                'Piping and Equipment': 'Long Description (Size)'
            };

            const columns = this.currentColumns || [];
            // Sheet MTO lain (Tee, Flange, Elbow, dst) mengikuti pola yang
            // sama seperti Valve: freeze sampai Material.
            const boundary = boundaryBySheet[this.activeSheet]
                || boundaryBySheet['Valve'];

            const boundaryIndex = columns.indexOf(boundary);
            if (boundaryIndex !== -1) return columns.slice(0, boundaryIndex + 1);

            // Fallback: kalau kolom batas tidak ditemukan pada data sheet ini
            // (mis. hasil import dengan header berbeda), coba freeze sampai
            // "Long Description (Size)" atau "Long Description (Family)"
            // (kolom deskripsi/identitas baris yang paling umum dipakai di
            // seluruh sheet MTO), baru fallback ke kolom pertama.
            const genericBoundary = columns.includes('Long Description (Size)')
                ? 'Long Description (Size)'
                : (columns.includes('Long Description (Family)')
                    ? 'Long Description (Family)'
                    : null);

            if (genericBoundary) {
                const idx = columns.indexOf(genericBoundary);
                return columns.slice(0, idx + 1);
            }

            return columns.length ? [columns[0]] : [];
        },

        isFreezeColumn(column) {
            return this.freezeColumns.includes(column);
        },

        // Sheet keluarga Equipment (Vessel, Tank, Pump, Misc Equipment,
        // Equipment) SELALU pakai nomor urut baris polos (1, 2, 3, ...),
        // tidak memakai nomor tag asli dari Excel (mis. 6001, 3000A),
        // supaya kolom NO konsisten sebagai nomor baris biasa.
        //
        // Sheet lain tetap memakai Number/No asli kalau memang valid;
        // hanya placeholder kosong atau "?" yang diganti nomor urut.
        getRowNumber(row, index) {
            const sequentialOnlySheets = [
                'Vessel', 'Tank', 'Pump', 'Misc Equipment', 'Equipment'
            ];

            const sequentialNumber = () =>
                String((this.currentPage - 1) * this.itemsPerPage + index + 1);

            if (sequentialOnlySheets.includes(this.activeSheet)) {
                return sequentialNumber();
            }

            const raw = row?.Number ?? row?.No ?? '';
            const normalized = String(raw).trim();
            const isPlaceholder = normalized === '' || normalized === '?';

            if (!isPlaceholder) return normalized;

            return sequentialNumber().padStart(2, '0');
        },

        // Kolom "No" di paling kiri selalu ikut dibekukan (index 0),
        // baru diikuti kolom-kolom dari freezeColumns (index 1, 2, dst)
        // supaya semuanya berjejer rapi tanpa saling menumpuk.
        getNoFreezeClass() {
            return 'freeze-col freeze-col-0';
        },

        getFreezeClass(column) {
            const freezeIndex = this.freezeColumns.indexOf(column);
            if (freezeIndex === -1) return '';
            return `freeze-col freeze-col-${freezeIndex + 1}`;
        },

        get filteredRows() {
            let rows = this.currentRows;

            // Search global tetap bekerja seperti sebelumnya.
            if (this.globalSearch) {
                const q = this.globalSearch.toLowerCase().trim();
                if (q) {
                    rows = rows.filter(row =>
                        Object.values(row || {}).some(val =>
                            String(val ?? '').toLowerCase().includes(q)
                        )
                    );
                }
            }

            // Filter per kolom.
            Object.entries(this.columnFilters || {}).forEach(([column, selectedValues]) => {
                if (!Array.isArray(selectedValues)) return;

                rows = rows.filter(row => {
                    const rawValue = row?.[column];
                    const normalized = this.normalizeFilterValue(rawValue);
                    return selectedValues.includes(normalized);
                });
            });

            return rows;
        },

        get filteredFilterOptions() {
            const q = String(this.filterOptionSearch || '').toLowerCase().trim();
            const source = Array.isArray(this.filterOptions) ? this.filterOptions : [];

            if (!q) return source.slice(0, 300);

            return source
                .filter(value => this.filterDisplayValue(value).toLowerCase().includes(q))
                .slice(0, 300);
        },

        get allFilterValuesSelected() {
            return this.filterOptions.length > 0 &&
                this.filterOptions.every(value => this.filterDraftValues.includes(value));
        },

        get maxPage() {
            return Math.ceil(this.filteredRows.length / this.itemsPerPage) || 1;
        },

        get paginatedRows() {
            const start = (this.currentPage - 1) * this.itemsPerPage;
            return this.filteredRows.slice(start, start + this.itemsPerPage);
        },

        normalizeFilterValue(value) {
            const text = String(value ?? '').trim();
            return text === '' ? '__EMPTY__' : text;
        },

        filterDisplayValue(value) {
            return value === '__EMPTY__' ? '(Kosong)' : String(value);
        },

        isColumnFiltered(column) {
            return Object.prototype.hasOwnProperty.call(this.columnFilters || {}, column);
        },

        getColumnFilterOptions(column) {
            const seen = new Set();
            const values = [];

            (this.currentRows || []).forEach(row => {
                const value = this.normalizeFilterValue(row?.[column]);
                if (!seen.has(value)) {
                    seen.add(value);
                    values.push(value);
                }
            });

            values.sort((a, b) => {
                if (a === '__EMPTY__') return 1;
                if (b === '__EMPTY__') return -1;
                return String(a).localeCompare(String(b), undefined, {
                    numeric: true,
                    sensitivity: 'base'
                });
            });

            return values;
        },

        openColumnFilter(column, event) {
            if (!column) return;

            this.activeFilterColumn = column;
            this.filterOptionSearch = '';
            this.filterOptions = this.getColumnFilterOptions(column);

            // Jika belum pernah difilter, semua nilai dipilih.
            // Jika sudah pernah difilter, popup membuka pilihan terakhir.
            if (this.isColumnFiltered(column)) {
                this.filterDraftValues = [...(this.columnFilters[column] || [])];
            } else {
                this.filterDraftValues = [...this.filterOptions];
            }

            const button = event?.currentTarget || event?.target;
            const rect = button?.getBoundingClientRect?.();

            if (rect) {
                const popupWidth = 300;
                const popupHeight = Math.min(430, window.innerHeight - 24);
                let left = rect.left;
                let top = rect.bottom + 6;

                if (left + popupWidth > window.innerWidth - 12) {
                    left = Math.max(12, window.innerWidth - popupWidth - 12);
                }

                if (top + popupHeight > window.innerHeight - 12) {
                    top = Math.max(12, rect.top - popupHeight - 6);
                }

                this.filterPopupPosition = { left, top };
            }

            this.filterPopupOpen = true;
        },

        closeColumnFilter() {
            this.filterPopupOpen = false;
            this.filterOptionSearch = '';
        },

        toggleAllFilterValues() {
            if (this.allFilterValuesSelected) {
                this.filterDraftValues = [];
            } else {
                this.filterDraftValues = [...this.filterOptions];
            }
        },

        clearColumnFilter(column = this.activeFilterColumn) {
            if (!column) return;

            const next = { ...(this.columnFilters || {}) };
            delete next[column];
            this.columnFilters = next;
            this.currentPage = 1;
            this.filterPopupOpen = false;
            this.tableRenderKey++;

            this.$nextTick(() => this.updateTableScrollbar());
        },

        applyColumnFilter() {
            const column = this.activeFilterColumn;
            if (!column) return;

            const selected = [...this.filterDraftValues];
            const allSelected =
                this.filterOptions.length > 0 &&
                selected.length === this.filterOptions.length;

            const next = { ...(this.columnFilters || {}) };

            if (allSelected) {
                delete next[column];
            } else {
                next[column] = selected;
            }

            this.columnFilters = next;
            this.currentPage = 1;
            this.filterPopupOpen = false;
            this.tableRenderKey++;

            this.$nextTick(() => this.updateTableScrollbar());
        },

        resetAllColumnFilters() {
            this.columnFilters = {};
            this.currentPage = 1;
            this.filterPopupOpen = false;
            this.filterOptionSearch = '';
            this.tableRenderKey++;

            this.$nextTick(() => this.updateTableScrollbar());
        },

                openDataSheet(sheetName) {
        this.saveTableStorage(this.activeProject, this.activeSheet);
        this.activeSheet = sheetName;
        this.currentDashboardTab = 'workspace';
        this.currentPage = 1;
        this.globalSearch = '';
        this.columnFilters = {};
        this.closeColumnFilter();

        this.$nextTick(() => {
            this.updateTableScrollbar();
        });
    },

    // ==========================================================
    // TASK MANAGEMENT
    // Membuka tugas MTO Valve
    // ==========================================================
    openTaskMTOValve() {
        // Tampilkan informasi tugas terlebih dahulu
        alert('Membuka detail tugas MTO Valve...');

        // Setelah user menekan OK pada alert,
        // otomatis diarahkan ke halaman MTO & Equipment Suite -> Valve
        this.activeSheet = 'Valve';
        this.currentDashboardTab = 'workspace';
        this.currentPage = 1;
        this.globalSearch = '';

        // Pastikan tabel sudah dirender sebelum update scrollbar
        this.$nextTick(() => {
            this.updateTableScrollbar();
        });
    },

        openAddModalForActiveSheet() {
            if (this.loginForm.role !== 'Piping Engineer') {
                alert('Akses ditolak! Hanya Piping Engineer yang dapat menambah data.');
                return;
            }

            const project = this.allProjectsData?.[this.activeProject];
            if (!project) {
                alert('Project aktif tidak ditemukan.');
                return;
            }

            const sheet = this.activeSheet;
            if (!Array.isArray(project[sheet])) project[sheet] = [];

            /*
             * MODE TAMBAH DATA INLINE:
             * Data lama TIDAK dihapus dari storage.
             * Saat tombol Add data diklik, tabel sementara hanya
             * menampilkan SATU BARIS KOSONG untuk diisi langsung.
             */
            const nextNum = String(project[sheet].length + 1).padStart(2, '0');
            const draft = {
                Number: nextNum,
                Status: 'New',
                __inlineDraft: true
            };

            // Ambil SEMUA kolom sheet yang sedang aktif.
            const columns = this.currentColumns || [];
            columns.forEach(col => {
                if (!(col in draft)) draft[col] = '';
            });

            this.newInlineRow = draft;
            this.addingNewData = true;
            this.globalSearch = '';
            this.currentPage = 1;
            this.tableRenderKey++;

            this.$nextTick(() => {
                this.updateTableScrollbar();

                const firstInput = document.querySelector(
                    '.excel-table tbody tr.inline-new-row input'
                );

                if (firstInput) {
                    firstInput.focus();
                    firstInput.select?.();
                }
            });
        },

        cancelInlineAdd() {
            // Batalkan hanya baris draft. Semua data lama tetap ada.
            this.addingNewData = false;
            this.newInlineRow = {};
            this.tableRenderKey++;
            this.$nextTick(() => this.updateTableScrollbar());
        },

        saveInlineAdd() {
            if (this.loginForm.role !== 'Piping Engineer') {
                alert('Akses ditolak! Hanya Piping Engineer yang dapat menambah data.');
                return;
            }

            if (!this.addingNewData || !this.newInlineRow) return;

            const draft = { ...this.newInlineRow };
            delete draft.__inlineDraft;
            delete draft.__edited;

            const hasValue = Object.entries(draft).some(([key, value]) => {
                return key !== 'Number' && String(value ?? '').trim() !== '';
            });

            if (!hasValue) {
                alert('Silakan isi minimal satu data pada baris baru.');
                return;
            }

            const rows = this.currentRows;

            // Nomor mengikuti jumlah data terakhir.
            draft.Number = String(rows.length + 1).padStart(2, '0');
            draft.Status = draft.Status || 'New';

            rows.push(draft);

            // Rapikan nomor setelah penambahan.
            rows.forEach((row, idx) => {
                row.Number = String(idx + 1).padStart(2, '0');
            });

            this.saveTableStorage(this.activeProject, this.activeSheet);
            this.saveStorage();

            this.addingNewData = false;
            this.newInlineRow = {};
            this.currentPage = Math.max(1, Math.ceil(rows.length / this.itemsPerPage));
            this.tableRenderKey++;

            this.$nextTick(() => {
                this.updateTableScrollbar();
            });
        },

        markRowEdited(row) {
            if (!row) return;
            row.__edited = true;
            this.saveTableStorage(this.activeProject, this.activeSheet);
            this.saveStorage();
        },

        resetNewRowForm() {
            this.newRowForm = {
                longDesc: '', material: 'CS', spec: 'CS150', size: '2"', pressure: '150',
                wasteFactor: '5', tag: '', qty: '', unit: '', service: '', supportType: ''
            };
        },

        changeSheet(sheetName) {
            const name = String(sheetName || '').replace(/\u00A0/g, ' ').trim();
            if (!name) return;

            const project = this.allProjectsData?.[this.activeProject];

            // Pastikan kategori yang dipilih selalu mempunyai array data.
            if (project && !Array.isArray(project[name])) {
                project[name] = [];
            }

            // Pastikan kategori tetap terdaftar di navigasi.
            if (!this.sheets.includes(name)) {
                this.sheets = [...this.sheets, name];
            }

            this.activeSheet = name;
            this.currentDashboardTab = 'workspace';
            this.currentPage = 1;
            this.globalSearch = '';
            this.columnFilters = {};
            this.closeColumnFilter();
            this.tableRenderKey++;

            this.$nextTick(() => this.updateTableScrollbar());
        },

        updateTableScrollbar() {
            this.$nextTick(() => {
                const container = this.$refs?.tableScroll || document.querySelector('.workspace-table-card .excel-table-container');
                const table = container?.querySelector('.excel-table');
                const bottom = this.$refs?.tableBottomScrollbar || document.querySelector('.workspace-table-card .table-bottom-scrollbar');
                const spacer = this.$refs?.tableBottomScrollbarSpacer || document.querySelector('.workspace-table-card .table-bottom-scrollbar-spacer');
                if (!container || !table || !bottom || !spacer) return;

                // Freeze kolom "No" (index 0) + kolom-kolom dari freezeColumns
                // (index 1, 2, ...), disusun berjejer sesuai lebar kolom
                // sebelumnya supaya tidak saling menumpuk.
                const freezeColumnCount = (this.freezeColumns || []).length;

                for (let i = 0; i <= freezeColumnCount; i++) {
                    const headerCell = table.querySelector(`thead th.freeze-col-${i}`);
                    if (!headerCell) continue;

                    // Offset = total lebar semua kolom freeze sebelumnya.
                    let offset = 0;
                    for (let j = 0; j < i; j++) {
                        const prevHeader = table.querySelector(`thead th.freeze-col-${j}`);
                        if (prevHeader) offset += Math.ceil(prevHeader.getBoundingClientRect().width);
                    }

                    const offsetPx = `${offset}px`;
                    headerCell.style.left = offsetPx;
                    headerCell.style.setProperty('--freeze-left', offsetPx);

                    table.querySelectorAll(`tbody td.freeze-col-${i}`).forEach(cell => {
                        cell.style.left = offsetPx;
                        cell.style.setProperty('--freeze-left', offsetPx);
                    });
                }

                const headerCells = Array.from(table.querySelectorAll('thead tr:first-child > th'));
                let naturalTableWidth = headerCells.reduce((total, cell) => total + Math.ceil(cell.getBoundingClientRect().width), 0);

                Array.from(table.querySelectorAll('tbody tr')).forEach(row => {
                    const rowWidth = Array.from(row.children).reduce((total, cell) => total + Math.ceil(cell.getBoundingClientRect().width), 0);
                    naturalTableWidth = Math.max(naturalTableWidth, rowWidth);
                });

                const tableWidth = Math.max(naturalTableWidth, Math.ceil(table.scrollWidth), Math.ceil(table.offsetWidth), container.clientWidth);
                table.style.width = `${tableWidth}px`;
                table.style.minWidth = `${tableWidth}px`;
                table.style.maxWidth = 'none';
                spacer.style.width = `${tableWidth}px`;
                spacer.style.minWidth = `${tableWidth}px`;
                spacer.style.maxWidth = 'none';
                bottom.style.display = 'block';

                const maxScroll = Math.max(0, tableWidth - container.clientWidth);
                if (container.scrollLeft > maxScroll) container.scrollLeft = maxScroll;
                if (Math.abs(bottom.scrollLeft - container.scrollLeft) > 0.5) bottom.scrollLeft = container.scrollLeft;
            });
        },

        syncTableBottomScroll(event) {
            const container =
                this.$refs?.tableScroll ||
                document.querySelector('.workspace-table-card .excel-table-container');

            const bottom =
                this.$refs?.tableBottomScrollbar ||
                document.querySelector('.workspace-table-card .table-bottom-scrollbar');

            if (!container || !bottom) return;

            const left = event.target.scrollLeft;

            // Tabel -> scrollbar bawah
            if (Math.abs(bottom.scrollLeft - left) > 0.5) {
                bottom.scrollLeft = left;
            }
        },

        syncBottomTableScroll(event) {
            const bottom =
                this.$refs?.tableBottomScrollbar ||
                document.querySelector('.workspace-table-card .table-bottom-scrollbar');

            const container =
                this.$refs?.tableScroll ||
                document.querySelector('.workspace-table-card .excel-table-container');

            if (!bottom || !container) return;

            // Scrollbar bawah -> TABEL
            container.scrollLeft = event.target.scrollLeft;
        },


        importExcelFile(event) {
            const input = event?.target;
            const file = input?.files?.[0];
            if (!file) return;

            const resetInput = () => {
                if (input) input.value = '';
            };

            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const buffer = e.target.result;
                    if (!buffer) {
                        throw new Error('File Excel kosong atau tidak dapat dibaca.');
                    }

                    const workbook = XLSX.read(new Uint8Array(buffer), {
                        type: 'array',
                        cellDates: false,
                        cellNF: false,
                        cellText: false,
                        raw: true
                    });

                    if (!workbook.SheetNames?.length) {
                        throw new Error('Workbook tidak memiliki worksheet.');
                    }

                    const projectKey = this.activeProject;
                    if (!projectKey) {
                        throw new Error('Project aktif belum dipilih.');
                    }

                    if (!this.allProjectsData[projectKey]) {
                        this.allProjectsData[projectKey] =
                            this.createBlankProject(projectKey, 'Piping & Equipment', '');
                    }

                    const targetSheet = this.getImportTargetSheet();

                    /*
                     * ======================================================
                     * ATURAN IMPORT FINAL
                     * ======================================================
                     *
                     * 1. SP Items       -> hanya sheet SP Items
                     * 2. Pipe Support   -> hanya sheet Pipe Support/Support
                     * 3. Line List      -> hanya sheet Line List/LineList
                     * 4. MTO workbook   -> IMPORT SEMUA SHEET MTO
                     *
                     * Ini yang sebelumnya menyebabkan Tee, Pipe, Elbow,
                     * Flange, dll tetap kosong: import hanya mengambil
                     * worksheet yang sedang aktif (Valve).
                     *
                     * Project 3000-Piping and Equipment.xlsx memang merupakan
                     * workbook master yang berisi seluruh kategori MTO.
                     * Saat workbook itu diimport dari area MTO, semua sheet
                     * MTO dimasukkan ke tabelnya masing-masing.
                     *
                     * Sheet Support sengaja tidak ditimpa oleh workbook MTO
                     * karena tabel Pipe Support mempunyai sumber exact
                     * tersendiri: Pipe_Support_Project_3000_EXACT.xlsx.
                     * ======================================================
                     */

                    const dedicatedTargets = new Set([
                        'SP Items',
                        'Support',
                        'LineList'
                    ]);

                    const mtoSheets = new Set([
                        'Valve',
                        'Tee',
                        'Single Branch Fitting',
                        'Pipe',
                        'Nozzle',
                        'Instrument',
                        'Flange',
                        'Elbow',
                        'Coupling',
                        'Pipe Run Component',
                        'Tap Weld',
                        'Socketweld',
                        'Gasket',
                        'Buttweld',
                        'Bolt Set',
                        'Fasteners',
                        'Vessel',
                        'Tank',
                        'Pump',
                        'Misc Equipment',
                        'Equipment',
                        'Piping and Equipment'
                    ]);

                    const normalizeSheetName = (name) =>
                        String(name || '')
                            .replace(/\u00A0/g, ' ')
                            .trim();

                    const lower = (name) =>
                        normalizeSheetName(name).toLowerCase();

                    const findExactWorkbookSheet = (aliases) => {
                        const wanted = aliases.map(lower);
                        return workbook.SheetNames.find(name =>
                            wanted.includes(lower(name))
                        ) || null;
                    };

                    // ------------------------------------------------------
                    // MODE A: dedicated table (SP Items / Pipe Support /
                    // Line List). Hanya satu sheet yang diproses.
                    // ------------------------------------------------------
                    if (dedicatedTargets.has(targetSheet)) {
                        let aliases;

                        if (targetSheet === 'SP Items') {
                            aliases = ['SP Items', 'SP_Items', 'SPItems'];
                        } else if (targetSheet === 'Support') {
                            aliases = ['Pipe Support', 'Support'];
                        } else {
                            aliases = ['Line List', 'LineList'];
                        }

                        let actualSheetName = findExactWorkbookSheet(aliases);

                        if (!actualSheetName && workbook.SheetNames.length === 1) {
                            actualSheetName = workbook.SheetNames[0];
                        }

                        if (!actualSheetName) {
                            throw new Error(
                                `Worksheet untuk "${targetSheet}" tidak ditemukan.\n\n` +
                                `Worksheet tersedia:\n${workbook.SheetNames.join(', ')}`
                            );
                        }

                        const parsed = this.worksheetToExactRows(
                            workbook.Sheets[actualSheetName]
                        );

                        if (!parsed.rows.length) {
                            throw new Error(
                                `Worksheet "${actualSheetName}" tidak mempunyai data.`
                            );
                        }

                        const expected = this.getExactSchema(targetSheet);

                        if (expected) {
                            const normalizedHeaders = parsed.headers.map(h =>
                                String(h)
                                    .replace(/\r\n/g, '\n')
                                    .trim()
                                    .toLowerCase()
                            );

                            const matched = expected.filter(h =>
                                normalizedHeaders.includes(
                                    String(h)
                                        .replace(/\r\n/g, '\n')
                                        .trim()
                                        .toLowerCase()
                                )
                            ).length;

                            const ratio = expected.length
                                ? matched / expected.length
                                : 1;

                            if (ratio < 0.5) {
                                throw new Error(
                                    `Struktur Excel tidak cocok dengan tabel ${targetSheet}.\n\n` +
                                    `Header terbaca:\n${parsed.headers.join(' | ')}`
                                );
                            }
                        }

                        this.allProjectsData[projectKey][targetSheet] =
                            parsed.rows.map(row => ({ ...row }));

                        this.activeSheet = targetSheet;

                        this.currentDashboardTab = 'workspace';
                        this.currentPage = 1;
                        this.globalSearch = '';
                        this.columnFilters = {};
                        this.closeColumnFilter();
                        this.tableRenderKey++;

                        this.saveStorage();

                        this.$nextTick(() => {
                            requestAnimationFrame(() => {
                                this.updateTableScrollbar();
                            });
                        });

                        console.log(
                            `[IMPORT EXACT] ${targetSheet}:`,
                            actualSheetName,
                            parsed.rows.length,
                            'rows',
                            parsed.headers.length,
                            'columns'
                        );

                        alert(
                            `Import berhasil!\n\n` +
                            `Project: ${projectKey}\n` +
                            `Tabel: ${targetSheet}\n` +
                            `Worksheet: ${actualSheetName}\n` +
                            `Kolom: ${parsed.headers.length}\n` +
                            `Data: ${parsed.rows.length} baris`
                        );

                        return;
                    }

                    // ------------------------------------------------------
                    // MODE B: MTO
                    // ------------------------------------------------------
                    //
                    // Jika workbook berisi beberapa sheet MTO, import SEMUA
                    // sheet yang dikenali. Ini membuat navigasi Tee, Pipe,
                    // Elbow, Flange, dst. tidak lagi kosong.
                    //
                    // Jika workbook hanya berisi satu sheet, hanya sheet itu
                    // yang dimasukkan.
                    // ------------------------------------------------------
                    const availableMtoSheets = workbook.SheetNames
                        .map(normalizeSheetName)
                        .filter(name => mtoSheets.has(name));

                    if (availableMtoSheets.length > 0) {
                        const imported = [];
                        const skipped = [];

                        availableMtoSheets.forEach(actualSheetName => {
                            try {
                                const parsed = this.worksheetToExactRows(
                                    workbook.Sheets[actualSheetName]
                                );

                                if (!parsed.rows.length) {
                                    skipped.push(`${actualSheetName} (kosong)`);
                                    return;
                                }

                                // Pastikan target sheet sudah ada di navigasi.
                                if (!this.sheets.includes(actualSheetName)) {
                                    this.sheets = [...this.sheets, actualSheetName];
                                }

                                // Simpan setiap sheet ke storage sheet-nya
                                // sendiri. Tidak menumpuk ke Valve.
                                this.allProjectsData[projectKey][actualSheetName] =
                                    parsed.rows.map(row => ({ ...row }));

                                imported.push({
                                    sheet: actualSheetName,
                                    rows: parsed.rows.length,
                                    columns: parsed.headers.length
                                });
                            } catch (sheetError) {
                                skipped.push(
                                    `${actualSheetName} (${sheetError.message})`
                                );
                            }
                        });

                        if (!imported.length) {
                            throw new Error(
                                'Tidak ada sheet MTO yang berhasil diimport.'
                            );
                        }

                        // Jangan sentuh Support/Pipe Support di sini.
                        // Sumbernya adalah file Pipe Support exact terpisah.

                        // Tampilkan Valve jika ada; kalau tidak, tampilkan
                        // sheet MTO pertama yang berhasil diimport.
                        const valveImported = imported.some(
                            item => item.sheet === 'Valve'
                        );

                        this.activeSheet = valveImported
                            ? 'Valve'
                            : imported[0].sheet;

                        this.currentDashboardTab = 'workspace';
                        this.currentPage = 1;
                        this.globalSearch = '';
                        this.columnFilters = {};
                        this.closeColumnFilter();
                        this.tableRenderKey++;

                        this.saveStorage();

                        this.$nextTick(() => {
                            requestAnimationFrame(() => {
                                this.updateTableScrollbar();
                                setTimeout(() => {
                                    this.updateTableScrollbar();
                                }, 150);
                            });
                        });

                        console.table(imported);

                        const summary = imported
                            .map(item =>
                                `• ${item.sheet}: ${item.rows} baris × ${item.columns} kolom`
                            )
                            .join('\n');

                        alert(
                            `Import MTO berhasil!\n\n` +
                            `Project: ${projectKey}\n\n` +
                            `Sheet yang berhasil dimuat:\n${summary}` +
                            (skipped.length
                                ? `\n\nSheet yang dilewati:\n• ${skipped.join('\n• ')}`
                                : '') +
                            `\n\nSetiap sheet disimpan ke tabelnya masing-masing.`
                        );

                        return;
                    }

                    // ------------------------------------------------------
                    // MODE C: workbook satu sheet MTO non-standar.
                    // ------------------------------------------------------
                    if (workbook.SheetNames.length === 1) {
                        const actualSheetName = workbook.SheetNames[0];
                        const parsed = this.worksheetToExactRows(
                            workbook.Sheets[actualSheetName]
                        );

                        if (!parsed.rows.length) {
                            throw new Error(
                                `Worksheet "${actualSheetName}" tidak mempunyai data.`
                            );
                        }

                        const target = targetSheet || actualSheetName;

                        this.allProjectsData[projectKey][target] =
                            parsed.rows.map(row => ({ ...row }));

                        if (!this.sheets.includes(target)) {
                            this.sheets = [...this.sheets, target];
                        }

                        this.activeSheet = target;
                        this.currentDashboardTab = 'workspace';
                        this.currentPage = 1;
                        this.globalSearch = '';
                        this.columnFilters = {};
                        this.closeColumnFilter();
                        this.tableRenderKey++;

                        this.saveStorage();

                        this.$nextTick(() => {
                            requestAnimationFrame(() => {
                                this.updateTableScrollbar();
                            });
                        });

                        alert(
                            `Import berhasil!\n\n` +
                            `Tabel: ${target}\n` +
                            `Worksheet: ${actualSheetName}\n` +
                            `Data: ${parsed.rows.length} baris`
                        );

                        return;
                    }

                    throw new Error(
                        `Workbook tidak dikenali sebagai workbook MTO atau tabel khusus.\n\n` +
                        `Worksheet tersedia: ${workbook.SheetNames.join(', ')}`
                    );

                } catch (error) {
                    console.error('[IMPORT FIX] Gagal:', error);
                    alert(
                        'Import Excel gagal.\n\n' +
                        (error?.message || 'Format Excel tidak sesuai.')
                    );
                } finally {
                    resetInput();
                }
            };

            reader.onerror = () => {
                resetInput();
                alert('File Excel tidak dapat dibaca oleh browser.');
            };

            reader.readAsArrayBuffer(file);
        },

        exportExcel() {
            const rows = this.currentRows;
            if (!rows || rows.length === 0) return alert(`Tidak ada data pada sheet ${this.activeSheet}.`);
            const worksheet = XLSX.utils.json_to_sheet(rows);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, this.activeSheet.substring(0, 31));
            XLSX.writeFile(workbook, `${this.activeProject}_${this.activeSheet.replace(/\s+/g, '_')}.xlsx`);
        },

        // ==========================================================
        formatCurrency(value) {
            const n = Number(value) || 0;
            const currency = this.boqCurrency === 'IDR' ? 'IDR' : 'USD';
            return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);
        },

        // WORKFLOW ENGINEER -> ESTIMATOR -> LEAD -> ENGINEER
        // ==========================================================
        get workflowStatus() {
            return this.allProjectsData?.[this.activeProject]?.meta?.workflowStatus || 'DRAFT';
        },

        get workflowStatusText() {
            const map = {
                DRAFT: 'Draft - Pekerjaan Engineer',
                BOM_CALCULATED: 'BOM / BQ Sudah Dihitung',
                SUBMITTED_TO_ESTIMATOR: 'Menunggu Estimator',
                BOQ_CALCULATED: 'BOQ Sudah Dihitung',
                SUBMITTED_TO_LEAD: 'Menunggu Lead Review',
                REVISION_REQUIRED: 'Revisi Diperlukan - Kembali ke Engineer',
                APPROVED: 'Approved - Laporan Final'
            };
            return map[this.workflowStatus] || this.workflowStatus;
        },

        get workflowStatusClass() {
            const s = this.workflowStatus;
            if (s === 'APPROVED') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            if (s === 'REVISION_REQUIRED') return 'bg-amber-100 text-amber-700 border-amber-200';
            if (s === 'SUBMITTED_TO_LEAD' || s === 'SUBMITTED_TO_ESTIMATOR') return 'bg-sky-100 text-sky-700 border-sky-200';
            return 'bg-slate-100 text-slate-700 border-slate-200';
        },

        saveProjectMetaOnly() {
            const metas = {};
            Object.entries(this.allProjectsData || {}).forEach(([projectKey, project]) => {
                const meta = project?.meta || {};
                // Metadata hanya menyimpan status/proyek. BOM dan BOQ besar disimpan
                // pada storage terpisah agar hasil 641 item tidak hilang karena quota.
                const { bom, boq, ...lightMeta } = meta;
                metas[projectKey] = lightMeta;
            });
            try {
                localStorage.setItem(this.getProjectMetaStorageKey(), JSON.stringify(metas));
                this.saveBomBoqStorage();
            } catch (error) {
                console.error('Gagal menyimpan metadata project:', error);
                alert('Metadata project gagal disimpan. Data BOM/BOQ tetap dicoba disimpan pada storage terpisah.');
                this.saveBomBoqStorage();
            }
        },

        setWorkflowStatus(status, note = '') {
            const project = this.allProjectsData?.[this.activeProject];
            if (!project) return;
            if (!project.meta) project.meta = {};
            project.meta.workflowStatus = status;
            project.meta.revisionNotes = note || project.meta.revisionNotes || '';
            project.meta.workflowUpdatedAt = new Date().toLocaleString('id-ID');
            // Jangan serialize semua tabel Excel setiap perubahan status.
            this.saveProjectMetaOnly();
        },

        openCalculateBOM() {
            if (this.loginForm.role !== 'Piping Engineer') {
                alert('Calculate BOM hanya dapat dilakukan oleh Piping Engineer.');
                return;
            }

            const status = this.workflowStatus;

            // Jika sudah final, Engineer melihat laporan final.
            // Data final tidak dihitung ulang/ditimpa.
            if (status === 'APPROVED') {
                const finalApproval = this.latestApproval || {
                    status: 'APPROVED',
                    notes: 'Laporan final telah disetujui oleh Lead Estimator.'
                };
                this.printFinalReportPDF(finalApproval);
                return;
            }

            // Jika sedang menunggu role berikutnya, tampilkan hasil BOM yang sudah ada.
            if (status === 'SUBMITTED_TO_ESTIMATOR' || status === 'SUBMITTED_TO_LEAD') {
                const existingBom = this.allProjectsData?.[this.activeProject]?.meta?.bom;
                if (existingBom?.details?.length) {
                    this.showBomModal = true;
                    return;
                }
                alert('BOM sudah dikirim ke tahap berikutnya dan sedang menunggu proses Estimator/Lead.');
                return;
            }

            const existingBom = this.allProjectsData?.[this.activeProject]?.meta?.bom;
            if (existingBom?.details?.length && existingBom.sourceSheet === 'ALL_MTO') {
                this.showBomModal = true;
                return;
            }

            this.calculateBOM();
        },

        getNumeric(row, keys) {
            for (const key of keys) {
                const value = row?.[key];
                if (value !== undefined && value !== null && String(value).trim() !== '') {
                    const n = Number(String(value).replace(/,/g, '').replace(/[^0-9.\-]/g, ''));
                    if (Number.isFinite(n)) return n;
                }
            }
            return 0;
        },

        getText(row, keys, fallback = '-') {
            for (const key of keys) {
                const value = row?.[key];
                if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
            }
            return fallback;
        },

        sanitizeLineNo(value) {
            const v = String(value ?? '').trim();
            // Jangan menampilkan placeholder mentah seperti ?->? sebagai Line No.
            if (!v || /^(\?\s*(?:[-–—]|->|→)\s*\?)+$/.test(v) || /^line\s*list[-_ ]?\d+$/i.test(v)) {
                return '-';
            }
            return v;
        },

        recalculateBOM() {
            // Tombol Hitung Ulang harus benar-benar menghitung ulang data sheet aktif.
            // Jangan menutup modal dan jangan menulis ulang seluruh data Excel.
            try {
                this.calculateBOM(true);
            } catch (error) {
                console.error('Calculate BOM error:', error);
                alert('Perhitungan BOM gagal dijalankan. Periksa Console untuk detail error.');
            }
        },

        getBomField(row, field, sheetName) {
            const sheet = String(sheetName || row?.__sheet || '').trim().toLowerCase();
            const aliases = {
                lineNo: ['Line No.', 'Line No', 'LINE NO.', 'Complete Line No.', 'Line Number Tag', 'LINE NUMBER TAG', 'Tag', 'TAG', 'LINE NUMBER'],
                component: ['Component', 'COMPONENT', 'Equipment Type', 'TYPE', 'Part Subtype'],
                description: ['Short Description', 'SHORT DESCRIPTION', 'Long Description (Family)', 'LONG DESCRIPTION (FAMILY)', 'Description', 'DESCRIPTION', 'Fluid Service', 'Process Fluid Identifier'],
                qty: ['Qty', 'Quantity', 'QTY', 'Item Count', 'ITEM COUNT'],
                size1: ['Size 1', 'SIZE 1', 'Size', 'SIZE', 'Nominal Size', 'Line Size (Inch)', 'LINE SIZE (INCH)'],
                size2: ['Size 2', 'SIZE 2'],
                length: ['Length', 'LENGTH', 'Pipe Length', 'PIPE LENGTH', 'Length (m)', 'LENGTH (M)'],
                unit: ['Unit', 'UNIT', 'UOM', 'Satuan']
            };

            // LineList is a process/line definition table. It has no BOM component
            // quantity or physical pipe length, so do not invent them.
            if (sheet === 'linelist' || sheet === 'line list') {
                if (field === 'lineNo') return this.sanitizeLineNo(this.getText(row, ['Complete Line No.', 'LINE NO.', 'Line No.', 'LINE NUMBER', 'Line Number'], ''));
                if (field === 'component') return 'Pipe';
                if (field === 'description') return this.getText(row, ['Fluid Service', 'Process Fluid Identifier', 'Pipe.Spec'], '-');
                if (field === 'qty') return 1;
                if (field === 'size1') return this.getNumeric(row, ['Line Size (Inch)', 'LINE SIZE (INCH)']);
                if (field === 'size2') return this.getNumeric(row, ['Size 2', 'SIZE 2']);
                if (field === 'length') return this.getNumeric(row, ['Length', 'LENGTH', 'Pipe Length', 'PIPE LENGTH']);
                if (field === 'unit') return 'LINE';
            }

            // Valve/MTO sheets use the actual component description and size.
            if (sheet === 'valve') {
                if (field === 'lineNo') return this.sanitizeLineNo(this.getText(row, ['Line Number Tag', 'LINE NUMBER TAG', 'Tag', 'TAG', 'Complete Line No.'], ''));
                if (field === 'component') return 'Valve';
                if (field === 'description') return this.getText(row, ['Long Description (Family)', 'Short Description', 'Long Description (Size)'], 'Valve');
                if (field === 'qty') return this.getNumeric(row, ['Qty', 'Quantity', 'Item Count', 'ITEM COUNT']) || 1;
                if (field === 'size1') return this.getNumeric(row, ['Size', 'SIZE', 'Nominal Diameter', 'Nominal Size']);
                if (field === 'size2') return this.getNumeric(row, ['Size 2', 'SIZE 2']);
                if (field === 'length') return this.getNumeric(row, ['Length', 'LENGTH', 'Engagement Length']);
                if (field === 'unit') return this.getText(row, ['Unit', 'UNIT', 'UOM'], 'EA');
            }

            const keys = aliases[field] || [];
            if (field === 'qty') return this.getNumeric(row, keys) || 1;
            if (field === 'size1' || field === 'size2' || field === 'length') return this.getNumeric(row, keys);
            if (field === 'unit') return this.getText(row, keys, 'EA');
            if (field === 'lineNo') return this.sanitizeLineNo(this.getText(row, keys, ''));
            return this.getText(row, keys, field === 'component' ? (row.__sheet || '-') : '-');
        },

        getAllMtoRows() {
            const project = this.allProjectsData?.[this.activeProject] || {};
            // Calculate BOM membaca seluruh sheet MTO yang memang berisi data.
            // LineList hanya menjadi MASTER referensi untuk mencocokkan Line Number,
            // sedangkan SP Items tidak ikut perhitungan. Support tetap dibaca karena
            // masuk ke rekap PIPING SUPPORT. Hanya sheet kosong yang dilewati agar
            // proses tetap ringan dan tidak menyebabkan lag.
            const referenceOnly = new Set(['LineList', 'SP Items']);
            const result = [];
            Object.keys(project).forEach(sheet => {
                if (sheet === 'meta' || referenceOnly.has(sheet)) return;
                const rows = Array.isArray(project[sheet]) ? project[sheet] : [];
                if (!rows.length) return;
                rows.forEach((row, index) => {
                    if (!row || typeof row !== 'object') return;
                    const hasValue = Object.values(row).some(v => String(v ?? '').trim() !== '');
                    if (!hasValue) return;
                    result.push({ ...row, __sheet: sheet, __index: index });
                });
            });
            return result;
        },

        calculateBOM(forceRecalculate = false) {
            const rows = this.getAllMtoRows();
            if (!rows.length) {
                alert('Belum ada data MTO. Import atau input data MTO terlebih dahulu.');
                return;
            }

            // Sesuai arahan mentor: item MTO hanya dihitung apabila Line Number
            // ditemukan pada Master Line List. Jika tidak ada pasangan, item tidak masuk BOM.
            const project = this.allProjectsData?.[this.activeProject] || {};
            const lineRows = Array.isArray(project['LineList']) ? project['LineList'] : [];
            const normalizeLine = (v) => String(v ?? '').trim().toUpperCase().replace(/['\"\s]/g, '');
            const lineSet = new Set(lineRows.map(r => normalizeLine(this.getText(r, [
                'Complete Line No.', 'LINE NO.', 'Line No.', 'LINE NUMBER', 'Line Number', 'Line Number Tag', 'LINE NUMBER TAG'
            ], ''))).filter(Boolean));

            const materialOf = (row) => this.getText(row, ['Material', 'MATERIAL', 'Material Code', 'MATERIAL CODE'], '');
            const installationOf = (row) => this.getText(row, ['Installation', 'INSTALLATION', 'Location', 'LOCATION', 'Aboveground / Underground', 'ABOVEGROUND / UNDERGROUND'], '');

            const classify = (component, description, sheet) => {
                const t = `${component} ${description} ${sheet}`.toLowerCase();
                if (/support/.test(t)) return 'SUPPORT';
                if (/hydrostatic/.test(t)) return 'HYDROSTATIC';
                if (/high pressure|air testing|flushing/.test(t)) return 'AIR_TESTING';
                if (/radiographic|radiography/.test(t)) return 'RADIOGRAPHIC';
                if (/pipe\b/.test(t)) return 'PIPE';
                return 'COMPONENT';
            };

            // MASTER RUMUS BOM DARI MENTOR.
            // Jangan menambah/mengganti rumus dengan asumsi lain.
            const formulaFor = (component, description, sheet, size1, size2, qty, length) => {
                const t = `${component} ${description} ${sheet}`.toLowerCase().replace(/[°]/g, '');
                const BF = Number(size1) || 0;
                const BG = Number(size2) || 0;
                const R = Number(qty) || 0;
                const pipeR = Number(length) || 0;
                const x = (n) => Number(n || 0).toFixed(2);
                let value = 0;
                let formula = 'Belum ada rumus mentor';

                // 1) Cap = BF2 × R2
                if (/\bcap\b/.test(t)) {
                    value = BF * R;
                    formula = 'BF2 × R2';

                // 2) Coupling = 2 × BF2 × R2
                } else if (/\breducing\s+coupling\b/.test(t)) {
                    value = (BF + BG) * R;
                    formula = '(BF2 × R2) + (BG2 × R2)';
                } else if (/\bcoupling\b/.test(t)) {
                    value = 2 * BF * R;
                    formula = '2 × BF2 × R2';

                // 3) Reducers
                } else if (/\b(concentric|eccentric)\s+reducer\b/.test(t)) {
                    value = (BF + BG) * R;
                    formula = '(BF2 × R2) + (BG2 × R2)';

                // 4) Elbows
                } else if (/\belbow\s*90\b|\b90\s*elbow\b/.test(t)) {
                    value = 2 * BF * R;
                    formula = '2 × BF2 × R2';
                } else if (/\belbow\s*45\b|\b45\s*elbow\b/.test(t)) {
                    value = 2 * BF * R;
                    formula = '2 × BF2 × R2';

                // 5) Flange dan opsi 300#/600# menggunakan rumus yang sama.
                } else if (/\bflange\b/.test(t)) {
                    value = BF * R;
                    formula = 'BF2 × R2';

                // 6) Pipe = ROUNDDOWN(R2/6,0) × BF2
                } else if (/\bpipe\b/.test(t) && !/support|strainer|valve|elbow|tee|reducer|coupling|flange|olet|socket|weldolet|threadolet|pad/.test(t)) {
                    value = Math.floor(pipeR / 6) * BF;
                    formula = 'ROUNDDOWN(R2/6,0) × BF2';

                // 7) Branch / olet
                } else if (/\bsaddle\s+branch\b|\bsockolet\b/.test(t)) {
                    value = (BG + 1.5 * BG) * R;
                    formula = '(BG2 × R2) + (1.5 × BG2 × R2)';
                } else if (/\bweldolet\b|\bthreadolet\b/.test(t)) {
                    value = (BG + 1.5 * BG) * R;
                    formula = '(BG2 × R2) + (1.5 × BG2 × R2)';

                // 8) Tee
                } else if (/\bequal\s+tee\b/.test(t)) {
                    value = 3 * BF * R;
                    formula = '3 × BF2 × R2';
                } else if (/\breducing\s+tee\b|\bbarred\s+tee\b/.test(t)) {
                    value = (2 * BF + BG) * R;
                    formula = '(2 × BF2 × R2) + (BG2 × R2)';

                // 9) Reinforcing Pad
                } else if (/\b90\s*reinforcing\s+pad\b|\b45\s*reinforcing\s+pad\b/.test(t)) {
                    value = (BG + (8 + BG)) * R;
                    formula = '(BG2 × R2) + ((8+BG2) × R2)';

                // 10) 45° Pipe to Pipe Full Encirclement
                } else if (/\b45\s*pipe\s+to\s+pipe\s+full\s+encirclement\b/.test(t)) {
                    value = (2 * BF + 2 * 1.5 * BF) * R;
                    formula = '(2 × BF2 × R2) + (2 × 1.5 × BF2 × R2)';

                // 11) Valve / strainer SW
                } else if (/\bt\s*strainer\s*bw\b|\bball\s+valve\s*sw\b|\bcheck\s+valve\s*sw\b|\bgate\s+valve\s*sw\b|\bglobe\s+valve\s*sw\b/.test(t)) {
                    value = 2 * BF * R;
                    formula = '(BF2 × R2) + (BF2 × R2)';
                }

                return { value, formula };
            };

            const details = [];
            let excludedNoLine = 0;
            rows.forEach((row, i) => {
                const sheetName = row.__sheet;
                const qty = this.getBomField(row, 'qty', sheetName);
                const size1 = this.getBomField(row, 'size1', sheetName);
                const size2 = this.getBomField(row, 'size2', sheetName);
                const length = this.getBomField(row, 'length', sheetName);
                const unit = this.getBomField(row, 'unit', sheetName);
                const component = this.getBomField(row, 'component', sheetName);
                const description = this.getBomField(row, 'description', sheetName);
                const lineNo = this.sanitizeLineNo(this.getBomField(row, 'lineNo', sheetName));
                const lineKey = normalizeLine(lineNo);

                // Aturan mentor: item MTO hanya dihitung jika Line Number MTO
                // benar-benar ditemukan di Line List. Jika Line List kosong,
                // tidak ada satu pun item MTO yang boleh masuk BOM.
                if (sheetName !== 'LineList' && (!lineKey || lineKey === '-' || !lineSet.has(lineKey))) {
                    excludedNoLine++;
                    return;
                }

                const calc = formulaFor(component, description, sheetName, size1, size2, qty, length);
                details.push({
                    no: details.length + 1,
                    lineNo,
                    sheet: sheetName,
                    component,
                    description,
                    material: materialOf(row),
                    installation: installationOf(row),
                    qty, size1, size2, length, unit,
                    inchDia: calc.value,
                    mentorFormula: calc.formula,
                    category: classify(component, description, sheetName)
                });
            });

            const totalQty = details.reduce((sum, r) => sum + (Number(r.qty) || 0), 0);
            const pipeQty = details.filter(r => r.category === 'PIPE').reduce((sum, r) => sum + (Number(r.length) || 0), 0);
            const totalInchDia = details.reduce((sum, r) => sum + (Number(r.inchDia) || 0), 0);
            const totalJoint = details.filter(r => r.category === 'COMPONENT').reduce((sum, r) => sum + (Number(r.qty) || 0), 0);

            const bom = {
                revision: project.meta?.version || 0,
                sourceSheet: 'ALL_MTO',
                matchingRule: 'MTO_LINE_LIST_EXACT_MATCH_V2',
                calculatedAt: new Date().toLocaleString('id-ID'),
                totalMtoItems: rows.length,
                totalItems: details.length,
                totalQty,
                pipeQty,
                totalInchDia,
                totalJoint,
                excludedNoLine,
                details
            };
            project.meta.bom = bom;
            project.meta.workflowStatus = 'BOM_CALCULATED';
            project.meta.revisionNotes = '';
            this.saveProjectMetaOnly();
            this.showBomModal = true;
        },

        submitBOMToEstimator() {
            if (this.loginForm.role !== 'Piping Engineer') return alert('Hanya Piping Engineer yang dapat mengirim BOM.');
            const bom = this.allProjectsData[this.activeProject]?.meta?.bom;
            if (!bom?.details?.length) return alert('Hitung BOM terlebih dahulu.');
            if (bom.matchingRule !== 'MTO_LINE_LIST_EXACT_MATCH_V2') {
                return alert('BOM belum menggunakan aturan pencocokan MTO dengan Line List. Silakan Hitung Ulang BOM terlebih dahulu.');
            }
            this.setWorkflowStatus('SUBMITTED_TO_ESTIMATOR', 'BOM sudah dikirim oleh Piping Engineer. Menunggu Estimator melakukan kalkulasi BOQ.');
            this.showBomModal = false;
            alert('BOM / BQ berhasil dikirim ke Estimator.');
        },

        generateBOQ() {
            if (this.loginForm.role !== 'Estimator Proposal') {
                alert('Kalkulasi Biaya BOQ hanya dapat dilakukan oleh Estimator Proposal.');
                return;
            }

            const meta = this.allProjectsData?.[this.activeProject];

            // BOQ final tidak dihitung ulang setelah Lead approval.
            if (this.workflowStatus === 'APPROVED') {
                const finalApproval = this.latestApproval || {
                    status: 'APPROVED',
                    notes: 'Laporan final telah disetujui oleh Lead Estimator.'
                };
                this.printFinalReportPDF(finalApproval);
                return;
            }

            if (this.workflowStatus !== 'SUBMITTED_TO_ESTIMATOR' && this.workflowStatus !== 'BOQ_CALCULATED') {
                alert(`BOQ belum dapat dihitung. Status saat ini: ${this.workflowStatusText}`);
                return;
            }

            // Pastikan BOM yang dipakai Estimator benar-benar mengikuti aturan
            // MTO Line Number ↔ Line List. BOM lama/stale dari versi sebelumnya
            // tidak boleh membuat tombol BOQ macet.
            let currentBom = meta.meta?.bom;
            const bomNeedsRebuild = !currentBom?.details?.length ||
                currentBom.matchingRule !== 'MTO_LINE_LIST_EXACT_MATCH_V2';

            if (bomNeedsRebuild) {
                const keepStatus = this.workflowStatus;
                this.calculateBOM(true);
                currentBom = meta.meta?.bom;

                // calculateBOM membuka modal dan mengubah status menjadi BOM_CALCULATED.
                // Kembalikan status agar Estimator tetap berada pada tahap yang benar.
                if (keepStatus === 'SUBMITTED_TO_ESTIMATOR' && currentBom?.details) {
                    this.setWorkflowStatus('SUBMITTED_TO_ESTIMATOR',
                        'BOM sudah dikirim oleh Piping Engineer. Menunggu Estimator melakukan kalkulasi BOQ.');
                    this.showBomModal = false;
                }
            }

            if (!currentBom?.details?.length) {
                alert('Tidak ada item BOM yang match antara MTO dan Line List. Tidak ada BOQ yang dapat dihitung.');
                return;
            }

            const previous = meta.boq?.items || [];
            const previousGroups = meta.boq?.priceGroups || [];
            const priceMap = new Map(previous.map(x => [x.key, Number(x.unitPrice) || 0]));
            const previousGroupPriceMap = new Map(previousGroups.map(g => [g.key, Number(g.unitPrice) || 0]));

            const items = currentBom.details.map((r, i) => ({
                ...r,
                key: `${r.sheet}::${r.no}`,
                unitPrice: priceMap.get(`${r.sheet}::${r.no}`) || 0,
                totalPrice: (priceMap.get(`${r.sheet}::${r.no}`) || 0) * (Number(r.qty) || 0)
            }));

            meta.boq = {
                revision: meta.version || 0,
                calculatedAt: new Date().toLocaleString('id-ID'),
                priceLevel: this.activePriceLevel,
                currency: this.boqCurrency,
                items,
                priceGroups: [],
                directCost: 0,
                indirectCost: Number(meta.boq?.indirectCost) || 0,
                totalCost: 0
            };

            // Estimator tidak perlu memasukkan harga 641 kali.
            // Kelompok harga dibuat dari karakteristik item yang menentukan harga:
            // Sheet + Component + Description + Size 1 + Size 2 + Unit.
            this.rebuildBOQPriceGroups(previousGroupPriceMap);
            this.recalculateBOQTotals();
            this.setWorkflowStatus('BOQ_CALCULATED', 'BOQ sudah dihitung oleh Estimator.');
            this.showBoqModal = true;
        },

        getBOQGroupKey(row) {
            const norm = (value) => String(value ?? '').trim().toLowerCase().replace(/\\s+/g, ' ');
            return [
                norm(row.sheet),
                norm(row.component),
                norm(row.description),
                norm(row.size1),
                norm(row.size2),
                norm(row.unit)
            ].join('||');
        },

        rebuildBOQPriceGroups(previousPriceMap = new Map()) {
            const meta = this.allProjectsData?.[this.activeProject]?.meta;
            if (!meta?.boq?.items) return;

            const groups = new Map();
            meta.boq.items.forEach((row) => {
                const key = this.getBOQGroupKey(row);
                if (!groups.has(key)) {
                    groups.set(key, {
                        key,
                        sheet: row.sheet || '-',
                        component: row.component || '-',
                        description: row.description || '-',
                        size1: row.size1 ?? null,
                        size2: row.size2 ?? null,
                        unit: row.unit || '-',
                        qty: 0,
                        itemCount: 0,
                        unitPrice: Number(previousPriceMap.get(key) ?? 0) || 0
                    });
                }
                const group = groups.get(key);
                group.qty += Number(row.qty) || 0;
                group.itemCount += 1;
            });

            meta.boq.priceGroups = Array.from(groups.values()).sort((a, b) =>
                `${a.sheet}${a.component}${a.description}${a.size1}`.localeCompare(
                    `${b.sheet}${b.component}${b.description}${b.size1}`
                )
            );

            // Terapkan harga group ke seluruh detail BOM.
            const groupPriceMap = new Map(meta.boq.priceGroups.map(g => [g.key, Number(g.unitPrice) || 0]));
            meta.boq.items.forEach(row => {
                const price = groupPriceMap.get(this.getBOQGroupKey(row)) || 0;
                row.unitPrice = price;
                row.totalPrice = price * (Number(row.qty) || 0);
            });
        },

        updateBOQPriceGroup(index, value) {
            const meta = this.allProjectsData?.[this.activeProject]?.meta;
            const group = meta?.boq?.priceGroups?.[index];
            if (!group) return;

            const n = Number(String(value).replace(/,/g, '')) || 0;
            group.unitPrice = n;

            const groupKey = group.key;
            meta.boq.items.forEach(row => {
                if (this.getBOQGroupKey(row) === groupKey) {
                    row.unitPrice = n;
                    row.totalPrice = n * (Number(row.qty) || 0);
                }
            });

            this.recalculateBOQTotals();
        },

        recalculateBOQTotals() {
            const meta = this.allProjectsData?.[this.activeProject]?.meta;
            if (!meta?.boq?.items) return;

            meta.boq.directCost = meta.boq.items.reduce(
                (sum, row) => sum + (Number(row.totalPrice) || 0), 0
            );
            meta.boq.totalCost =
                meta.boq.directCost + (Number(meta.boq.indirectCost) || 0);

            this.saveStorage();
        },

        getBOQGroupPriceCoverage() {
            const groups = this.allProjectsData?.[this.activeProject]?.meta?.boq?.priceGroups || [];
            const priced = groups.filter(g => Number(g.unitPrice) > 0).length;
            return {
                total: groups.length,
                priced,
                unpriced: groups.length - priced
            };
        },

        updateBOQPrice(index, value) {
            const meta = this.allProjectsData?.[this.activeProject]?.meta;
            if (!meta?.boq?.items?.[index]) return;
            const n = Number(String(value).replace(/,/g, '')) || 0;
            meta.boq.items[index].unitPrice = n;
            meta.boq.items[index].totalPrice = n * (Number(meta.boq.items[index].qty) || 0);
            meta.boq.directCost = meta.boq.items.reduce((s, x) => s + (Number(x.totalPrice) || 0), 0);
            meta.boq.totalCost = meta.boq.directCost + (Number(meta.boq.indirectCost) || 0);
            this.saveStorage();
        },

        setIndirectCost(value) {
            const meta = this.allProjectsData?.[this.activeProject]?.meta;
            if (!meta?.boq) return;
            meta.boq.indirectCost = Number(String(value).replace(/,/g, '')) || 0;
            meta.boq.totalCost = (Number(meta.boq.directCost) || 0) + meta.boq.indirectCost;
            this.saveStorage();
        },

        submitBOQToLead() {
            if (this.loginForm.role !== 'Estimator Proposal') return alert('Hanya Estimator Proposal yang dapat mengirim BOQ.');
            const meta = this.allProjectsData?.[this.activeProject]?.meta;
            if (!meta?.boq?.items?.length) return alert('Hitung BOQ terlebih dahulu.');
            const coverage = this.getBOQGroupPriceCoverage();
            if (coverage.unpriced > 0) {
                return alert(`Masih ada ${coverage.unpriced} kelompok harga yang belum diisi. Lengkapi Unit Price terlebih dahulu sebelum mengirim BOQ ke Lead.`);
            }
            this.setWorkflowStatus('SUBMITTED_TO_LEAD', 'BOQ sudah dikirim oleh Estimator. Menunggu Lead Estimator melakukan review.');
            this.showBoqModal = false;
            alert('BOQ berhasil dikirim ke Lead Estimator untuk review.');
        },

        approveData() {
            if (this.loginForm.role !== 'Lead Estimator') {
                alert('Approval & Review Laporan hanya dapat dilakukan oleh Lead Estimator.');
                return;
            }

            // Setelah approval, tombol review membuka laporan final.
            if (this.workflowStatus === 'APPROVED') {
                const finalApproval = this.latestApproval || {
                    status: 'APPROVED',
                    notes: 'Laporan final telah disetujui oleh Lead Estimator.'
                };
                this.printFinalReportPDF(finalApproval);
                return;
            }

            if (this.workflowStatus !== 'SUBMITTED_TO_LEAD') {
                alert(`Belum ada BOQ yang menunggu review. Status saat ini: ${this.workflowStatusText}`);
                return;
            }

            const meta = this.allProjectsData?.[this.activeProject]?.meta;
            const reviewBoq = meta?.boq;
            if (!reviewBoq?.items?.length) {
                alert('BOQ belum tersedia. Estimator harus menghitung dan mengirim BOQ terlebih dahulu.');
                return;
            }
            if (meta?.bom?.matchingRule !== 'MTO_LINE_LIST_EXACT_MATCH_V2') {
                alert('BOQ belum menggunakan pencocokan Line Number MTO dengan Line List. Engineer harus menghitung ulang BOM terlebih dahulu.');
                return;
            }

            this.approvalNote = '';
            this.showApproveModal = true;
        },

        getReviewNote() {
            const el = document.getElementById('reviewer-notes-textarea');
            return String(el?.value || this.approvalNote || '').trim();
        },

        recordApproval(status, notes = '') {
            const meta = this.allProjectsData[this.activeProject].meta;
            const item = {
                id: Date.now(),
                projectId: this.activeProject,
                sheet: this.activeSheet,
                revision: meta.version || 0,
                status,
                reviewer: this.loginForm.role || 'Lead Estimator',
                notes,
                timestamp: new Date().toLocaleString('id-ID'),
                title: status === 'APPROVED' ? 'BOQ / Laporan Disetujui' : 'Revisi BOQ / Laporan'
            };
            const historyKey = 'tripatra_approval_history_v2';
            let history = [];
            try { history = JSON.parse(localStorage.getItem(historyKey) || '[]'); } catch (_) {}
            history.push(item);
            localStorage.setItem(historyKey, JSON.stringify(history));
            this.approvalHistory = history;
            return item;
        },

        confirmApprove() {
            if (this.loginForm.role !== 'Lead Estimator') return;
            const meta = this.allProjectsData[this.activeProject].meta;
            const notes = this.getReviewNote() || 'Laporan disetujui oleh Lead Estimator.';
            meta.isApproved = true;
            meta.approvedAt = new Date().toLocaleString('id-ID');
            meta.version = Number(meta.version || 0);
            this.setWorkflowStatus('APPROVED', notes);
            this.recordApproval('APPROVED', notes);
            this.showApproveModal = false;
            alert('Laporan berhasil APPROVED. Workflow selesai dan menjadi laporan final.');
        },

        handleMintaRevisi() {
            if (this.loginForm.role !== 'Lead Estimator') return;
            const meta = this.allProjectsData[this.activeProject].meta;
            const notes = this.getReviewNote();
            if (!notes) return alert('Catatan revisi wajib diisi agar Engineer mengetahui bagian yang harus diperbaiki.');
            meta.isApproved = false;
            meta.version = Number(meta.version || 0) + 1;
            this.setWorkflowStatus('REVISION_REQUIRED', notes);
            this.recordApproval('REVISION_REQUIRED', notes);
            this.showApproveModal = false;
            alert(`Revisi diminta. Project kembali ke Engineer sebagai Rev ${meta.version}.`);
        },

        startNewRevision() {
            if (this.loginForm.role !== 'Piping Engineer') {
                alert('Revisi baru hanya dapat dimulai oleh Piping Engineer.');
                return;
            }

            const project = this.allProjectsData?.[this.activeProject];
            if (!project) return;

            const meta = project.meta || {};
            const nextRevision = Number(meta.version || 0) + 1;

            if (!confirm(`Mulai Rev ${nextRevision} dari laporan final? Data MTO tetap dipertahankan, tetapi BOM/BOQ lama akan menjadi hasil revisi sebelumnya.`)) {
                return;
            }

            meta.version = nextRevision;
            meta.isApproved = false;
            meta.approvedAt = null;
            meta.bom = null;
            meta.boq = null;
            meta.workflowStatus = 'DRAFT';
            meta.revisionNotes = 'Revisi baru dimulai oleh Piping Engineer.';
            meta.workflowUpdatedAt = new Date().toLocaleString('id-ID');

            this.saveProjectMetaOnly();
            this.showBomModal = false;
            this.showBoqModal = false;
            this.showApproveModal = false;

            alert(`Rev ${nextRevision} siap dikerjakan. Alur dimulai kembali dari Engineer.`);
        },

        rejectData() {
            if (this.loginForm.role !== 'Lead Estimator') return;
            const notes = this.getReviewNote() || 'Laporan ditolak dan perlu diperbaiki oleh Engineer.';
            const meta = this.allProjectsData[this.activeProject].meta;
            meta.isApproved = false;
            meta.version = Number(meta.version || 0) + 1;
            this.setWorkflowStatus('REVISION_REQUIRED', notes);
            this.recordApproval('REJECTED', notes);
            this.showApproveModal = false;
            alert(`Laporan ditolak. Project dikembalikan ke Engineer sebagai Rev ${meta.version}.`);
        },

        loadApprovalHistory() {
            try { this.approvalHistory = JSON.parse(localStorage.getItem('tripatra_approval_history_v2') || '[]'); }
            catch (_) { this.approvalHistory = []; }
        },

        get projectApprovalHistory() {
            return (this.approvalHistory || []).filter(x => x.projectId === this.activeProject);
        },

        get latestApproval() {
            const arr = this.projectApprovalHistory;
            return arr.length ? arr[arr.length - 1] : null;
        },

        get activeTaskCount() {
            const s = this.workflowStatus;
            if (this.loginForm.role === 'Piping Engineer') return ['DRAFT', 'REVISION_REQUIRED'].includes(s) ? 1 : 0;
            if (this.loginForm.role === 'Estimator Proposal') return s === 'SUBMITTED_TO_ESTIMATOR' ? 1 : 0;
            if (this.loginForm.role === 'Lead Estimator') return s === 'SUBMITTED_TO_LEAD' ? 1 : 0;
            return 0;
        },

        getApprovalStatusText(status) {
            const map = { APPROVED: 'Approved', REVISION_REQUIRED: 'Minta Revisi', REJECTED: 'Rejected' };
            return map[status] || status || 'Menunggu';
        },

        getApprovalStatusClass(status) {
            if (status === 'APPROVED') return 'bg-emerald-100 text-emerald-700';
            if (status === 'REVISION_REQUIRED') return 'bg-amber-100 text-amber-700';
            return 'bg-rose-100 text-rose-700';
        },

        openActiveTasks() { this.taskView = 'active'; },
        openApprovalHistory() { this.taskView = 'history'; },
        openTaskMTOValve() { this.currentDashboardTab = 'workspace'; this.activeSheet = 'Valve'; this.currentPage = 1; },
        openApprovalDetail(item) { this.printFinalReportPDF(item); },

        printFinalReportPDF(approvalItem = null) {
            const meta = this.allProjectsData?.[this.activeProject]?.meta || {};
            const bom = meta.bom || { details: [] };
            const boq = meta.boq || { items: [], directCost: 0, indirectCost: 0, totalCost: 0 };
            const esc = (v) => String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
            const num = (v) => Number(v || 0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
            const money = (v) => new Intl.NumberFormat('en-US', {style:'currency', currency: boq.currency === 'IDR' ? 'IDR' : 'USD', maximumFractionDigits:2}).format(Number(v)||0);

            const rows = Array.isArray(bom.details) ? bom.details : [];
            const materialGroups = ['CS PIPE','SS PIPE','LTCS PIPE','LOW ALLOY PIPE','HIGH ALLOY PIPE','HDPE PIPE','RTRP PIPE'];
            const materialValue = (r) => `${r.material || ''} ${r.description || ''}`.toUpperCase();
            const pipeRows = rows.filter(r => r.category === 'PIPE' || /\bPIPE\b/i.test(`${r.component} ${r.description}`));
            const pipeAmount = (label) => pipeRows.filter(r => {
                const t = materialValue(r);
                if (label === 'CS PIPE') return /\bCS\b|CARBON STEEL/.test(t) && !/LTCS|SS|STAINLESS/.test(t);
                if (label === 'SS PIPE') return /\bSS\b|STAINLESS/.test(t);
                if (label === 'LTCS PIPE') return /LTCS/.test(t);
                if (label === 'LOW ALLOY PIPE') return /LOW ALLOY/.test(t);
                if (label === 'HIGH ALLOY PIPE') return /HIGH ALLOY/.test(t);
                if (label === 'HDPE PIPE') return /HDPE/.test(t);
                if (label === 'RTRP PIPE') return /RTRP/.test(t);
                return false;
            }).reduce((s,r) => s + (Number(r.inchDia)||0), 0);

            const supportQty = rows.filter(r => r.category === 'SUPPORT' || /support/i.test(`${r.sheet} ${r.component} ${r.description}`)).reduce((s,r)=>s+(Number(r.qty)||0),0);
            const testRows = rows.filter(r => ['HYDROSTATIC','AIR_TESTING','RADIOGRAPHIC'].includes(r.category));
            const testAmount = cat => testRows.filter(r=>r.category===cat).reduce((s,r)=>s+(Number(r.inchDia)||Number(r.qty)||0),0);
            const itemRow = (no, desc, qty, unit='', cls='') => `<tr class="${cls}"><td class="no">${no}</td><td>${esc(desc)}</td><td class="qty">${typeof qty === 'number' ? num(qty) : esc(qty)}</td><td>${esc(unit)}</td><td></td></tr>`;
            const pipeSection = (title, no) => {
                let h = itemRow(no, title, '', '', 'section');
                materialGroups.forEach(m => { h += itemRow('', '- ' + m, pipeAmount(m), 'DIA.INCH'); });
                return h;
            };

            const detailRows = rows.map((r,i) => `<tr><td>${i+1}</td><td>${esc(r.lineNo || '-')}</td><td>${esc(r.component || '-')}</td><td>${esc(r.description || '-')}</td><td class="qty">${num(r.inchDia)}</td><td>${esc(r.unit || 'DIA.INCH')}</td></tr>`).join('');
            const approval = approvalItem || this.latestApproval || {};
            const approved = approval.status === 'APPROVED' || meta.isApproved;
            const status = approved ? 'APPROVED' : this.getApprovalStatusText(approval.status || meta.workflowStatus);

            const reportRows = pipeSection('1  INSTALLATION PIPE', '1') +
                itemRow('2', 'PIPING SUPPORT', supportQty, 'TON') +
                itemRow('3', 'TESTING', '', '', 'section') +
                itemRow('', 'Hydrostatic testing and cleaning', testAmount('HYDROSTATIC'), 'LM', testAmount('HYDROSTATIC') ? '' : 'zero') +
                itemRow('', 'High Pressure air testing (flushing) and cleaning', testAmount('AIR_TESTING'), 'LM', testAmount('AIR_TESTING') ? '' : 'zero') +
                itemRow('', 'Radiographic Testing', testAmount('RADIOGRAPHIC'), 'DIA.INCH', testAmount('RADIOGRAPHIC') ? '' : 'zero');

            const html = `<!doctype html><html><head><meta charset="utf-8"><title>Final Total BOQ KPI Format - ${esc(this.activeProject)}</title>
            <style>
            *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;padding:14mm 12mm;font-size:10px}h1{font-size:15px;text-align:center;margin:0 0 2px;font-weight:700}h2{font-size:12px;text-align:center;margin:0 0 16px;font-weight:700}.meta{display:grid;grid-template-columns:130px 1fr 130px 1fr;margin-bottom:10px}.meta div{border:1px solid #333;padding:5px}.meta .label{font-weight:700;background:#f1f1f1}.status{text-align:center;font-weight:700;margin:7px 0 12px}.main{width:100%;border-collapse:collapse}.main th,.main td{border:1px solid #222;padding:5px 6px;vertical-align:middle}.main th{background:#bdbdbd;text-align:center;font-weight:700}.main .no{width:45px;text-align:center}.main .qty{width:110px;text-align:right;font-variant-numeric:tabular-nums}.main .section td{font-weight:700}.main .zero td{color:#333}.summary{margin-top:16px;width:100%;border-collapse:collapse}.summary th,.summary td{border:1px solid #222;padding:5px}.summary th{background:#d9ead3}.detail{page-break-before:always}.detail table{width:100%;border-collapse:collapse;font-size:8px}.detail th,.detail td{border:1px solid #777;padding:4px}.detail th{background:#e5e7eb}.right{text-align:right}.footer{margin-top:18px;display:grid;grid-template-columns:1fr 1fr;gap:25px}.sign{border-top:1px solid #555;padding-top:6px;text-align:center}.note{margin-top:10px;border:1px solid #999;padding:7px}.muted{color:#666}@page{size:A4 portrait;margin:8mm}@media print{body{padding:0}.no-print{display:none}}
            </style></head><body>
            <h1>PIPING WORK MATERIAL TAKE OFF (MTO) FOR UTILITY &amp; OFFSITE FACILITIES</h1>
            <h2>${esc(meta.projectName || this.activeProject)}</h2>
            <div class="meta"><div class="label">CONSULTANT NAME</div><div>TTS Consortium</div><div class="label">DATE</div><div>${esc(new Date().toLocaleDateString('en-GB'))}</div>
            <div class="label">CLIENT</div><div>PT. KILANG PERTAMINA INTERNASIONAL</div><div class="label">REVISION</div><div>Rev ${esc(meta.version || 0)}</div>
            <div class="label">SITE</div><div>${esc(meta.projectName || this.activeProject)}</div><div class="label">MADE / CHECKED BY</div><div>${approved ? 'LEAD ESTIMATOR' : '-'}</div></div>
            <div class="status">STATUS: ${esc(status)}</div>
            <table class="main"><thead><tr><th>NO</th><th>DESCRIPTION</th><th>QTY</th><th>UNIT</th><th>REMARKS</th></tr></thead><tbody>${reportRows}</tbody></table>
            <table class="summary"><tr><th>BOQ SUMMARY</th><th class="right">VALUE</th></tr><tr><td>Direct Cost</td><td class="right">${money(boq.directCost)}</td></tr><tr><td>Indirect Cost</td><td class="right">${money(boq.indirectCost)}</td></tr><tr><th>Total BOQ</th><th class="right">${money(boq.totalCost)}</th></tr></table>
            <div class="note"><b>Approval Note:</b> ${esc(approval.notes || meta.revisionNotes || '-')}</div>
            <div class="footer"><div class="sign">Prepared by<br><b>Estimator Proposal</b></div><div class="sign">Reviewed &amp; Approved by<br><b>Lead Estimator</b></div></div>
            <div class="detail"><h2>DETAIL PERHITUNGAN BOM / BOQ</h2><table><thead><tr><th>No</th><th>Line No.</th><th>Component</th><th>Description</th><th>Inch-Dia</th><th>Unit</th></tr></thead><tbody>${detailRows}</tbody></table></div>
            </body></html>`;

            const win = window.open('', '_blank', 'width=1100,height=850');
            if (!win) return alert('Popup diblokir browser. Izinkan popup untuk membuka laporan PDF.');
            win.document.open(); win.document.write(html); win.document.close(); win.focus();
            setTimeout(() => win.print(), 500);
        },

        exportBOQ() {
            const meta = this.allProjectsData?.[this.activeProject]?.meta;
            const boq = meta?.boq;
            if (!boq?.items?.length) return alert('BOQ belum tersedia. Estimator harus menghitung BOM terlebih dahulu.');

            const format = (num) => {
                const currency = boq.currency === 'IDR' ? 'IDR' : 'USD';
                return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(num) || 0);
            };
            const rows = boq.items.map((item, index) => `
                <tr>
                    <td>${index + 1}</td><td>${item.lineNo || '-'}</td><td>${item.sheet || '-'}</td><td>${item.component || '-'}</td>
                    <td>${Number(item.qty || 0).toFixed(2)}</td><td>${item.unit || '-'}</td><td>${format(item.unitPrice)}</td><td>${format(item.totalPrice)}</td>
                </tr>`).join('');

            const html = `<!doctype html><html><head><meta charset="utf-8"><title>BOQ ${this.activeProject}</title><style>
                body{font-family:Arial,sans-serif;font-size:10pt;color:#111;padding:25px}h1{font-size:16pt;margin-bottom:4px}h2{font-size:12pt;margin-top:25px}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #777;padding:6px}th{background:#e2e8f0;text-align:center}td:nth-child(1),td:nth-child(5){text-align:center}td:nth-child(n+7){text-align:right}.summary{margin-top:18px;width:420px;margin-left:auto}.summary td{border:none;padding:4px}.total{font-weight:bold;border-top:1px solid #111!important}.muted{color:#64748b;font-size:9pt}
            </style></head><body>
                <h1>PT. TRIPATRA ENGINEERING</h1><div class="muted">Laporan Kalkulasi Biaya BOQ • ${this.activeProject} • Rev ${meta.version || 0}</div>
                <h2>Ringkasan BOQ</h2><div>Level Harga: <b>${boq.priceLevel || '-'}</b> &nbsp; | &nbsp; Mata Uang: <b>${boq.currency || '-'}</b></div>
                <table><thead><tr><th>No</th><th>Line No.</th><th>Sheet</th><th>Component</th><th>Qty</th><th>Unit</th><th>Unit Price</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
                <table class="summary"><tr><td>Direct Cost</td><td>${format(boq.directCost)}</td></tr><tr><td>Indirect Cost</td><td>${format(boq.indirectCost)}</td></tr><tr class="total"><td>Total BOQ</td><td>${format(boq.totalCost)}</td></tr></table>
            </body></html>`;
            const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
            const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `Laporan_BOQ_${this.activeProject}_Rev${meta.version || 0}.doc`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        },

        printPDF() {
            const rows = this.filteredRows || [];
            if (!rows.length) return alert(`Tidak ada data pada sheet ${this.activeSheet}.`);
            const columns = this.currentColumns || [];
            const escapeHtml = (v) => String(v ?? '').replace(/[&<>\"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[ch]));
            const headers = ['No', 'Long Description (Family)', ...columns.filter(c => c !== 'Long Description (Family)')];
            const body = rows.map((row, i) => `<tr>${headers.map((h, j) => `<td>${escapeHtml(j === 0 ? String(i + 1).padStart(2,'0') : row[h])}</td>`).join('')}</tr>`).join('');
            const win = window.open('', '_blank', 'width=1200,height=800');
            if (!win) return alert('Popup diblokir browser. Izinkan popup untuk mencetak PDF.');
            win.document.write(`<!doctype html><html><head><meta charset=\"utf-8\"><title>${escapeHtml(this.activeProject)} - ${escapeHtml(this.activeSheet)}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h1{font-size:18px;margin:0 0 4px}p{font-size:11px;color:#555;margin:0 0 16px}table{border-collapse:collapse;width:100%;font-size:8px}th,td{border:1px solid #999;padding:4px;vertical-align:top}th{background:#e2e8f0;font-weight:700} @page{size:landscape;margin:10mm}</style></head><body><h1>${escapeHtml(this.activeProject)} — ${escapeHtml(this.activeSheet)}</h1><p>Export PDF • ${new Date().toLocaleString('id-ID')} • Total ${rows.length} data</p><table><thead><tr>${headers.map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></body></html>`);
            win.document.close();
            win.focus();
            setTimeout(() => win.print(), 300);
        }
    }
}