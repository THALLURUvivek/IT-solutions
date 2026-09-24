/* ==========================================================================
   NEXORA — Client Dashboard (v2)
   Shared JS: auth guard, sidebar collapse + mobile drawer, status filters,
   live search, animated counters, toast notifications, ticket actions.
   ========================================================================== */
(function () {
    'use strict';

    const $ = (sel, ctx) => (ctx || document).querySelector(sel);
    const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
    const today = new Date().getFullYear();

    /* ---------- Read session (guarded for browsers that block localStorage on file://) ---------- */
    let session = null;
    try {
        session = JSON.parse(localStorage.getItem('nexora_user') || 'null');
    } catch (e) {
        session = null;
    }

    /* Auth guard — dashboards are reachable only after sign-in.
       localStorage is available -> redirect to signin if there's no session. */
    if (!session) {
        let storageOk = true;
        try {
            localStorage.setItem('__nx_test', '1');
            localStorage.removeItem('__nx_test');
        } catch (e) {
            storageOk = false;
        }
        if (storageOk) {
            window.location.replace('signin.html');
            return;
        }
        /* Storage blocked (e.g. private browsing) -> continue as guest. */
        session = { name: 'Guest', email: 'guest@nexora.io' };
    }

    const firstName = session.name ? String(session.name).trim().split(/\s+/)[0] : '';
    const initials = (session.name || 'G')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(w => w[0] ? w[0].toUpperCase() : '')
        .join('') || 'G';

    /* ---------- Per-user placeholders ---------- */
    $$('.js-user-name').forEach(el => { el.textContent = session.name || 'Guest'; });
    $$('.js-user-email').forEach(el => { el.textContent = session.email || ''; });
    $$('.js-user-initials').forEach(el => { el.textContent = initials; });

    /* ---------- Date chip ---------- */
    const dateEl = $('#currentDate');
    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
        });
    }

    /* ---------- Toast ---------- */
    const toastEl = $('#dashToast');
    function toast(msg, delay) {
        if (!toastEl || !window.bootstrap) return;
        const body = toastEl.querySelector('.toast-body');
        if (body) body.innerHTML = msg;
        new bootstrap.Toast(toastEl, { delay: delay || 3200 }).show();
    }

    /* ---------- Sidebar collapse (desktop, persisted) ---------- */
    const sidebar = $('#dashSidebar');
    const collapseBtn = $('#dashCollapse');
    function setCollapsed(collapsed) {
        if (!sidebar) return;
        sidebar.classList.toggle('collapsed', collapsed);
        if (collapseBtn) {
            collapseBtn.innerHTML = collapsed ? '<i class="bi bi-chevron-right"></i>' : '<i class="bi bi-chevron-left"></i>';
        }
        try { localStorage.setItem('nexora_sidebar_collapsed', collapsed ? '1' : '0'); } catch (e) { /* ignore */ }
    }
    if (collapseBtn) {
        collapseBtn.addEventListener('click', () => setCollapsed(!sidebar.classList.contains('collapsed')));
        let saved = false;
        try { saved = localStorage.getItem('nexora_sidebar_collapsed') === '1'; } catch (e) { /* ignore */ }
        if (saved && window.innerWidth >= 992) setCollapsed(true);
    }

    /* ---------- Sidebar drawer (mobile) ---------- */
    const burger = $('#dashBurger');
    const backdrop = $('#dashBackdrop');
    function openSidebar() {
        if (sidebar) sidebar.classList.add('active');
        if (backdrop) backdrop.classList.add('show');
    }
    function closeSidebar() {
        if (sidebar) sidebar.classList.remove('active');
        if (backdrop) backdrop.classList.remove('show');
    }
    if (burger) burger.addEventListener('click', openSidebar);
    if (backdrop) backdrop.addEventListener('click', closeSidebar);
    window.addEventListener('keydown', e => { if (e.key === 'Escape') closeSidebar(); });

    /* Close the mobile drawer after picking a nav link or sidebar shortcut */
    ['a.d-nav-link', '.js-filter'].forEach(sel => {
        $$(sel).forEach(el => {
            el.addEventListener('click', () => { if (window.innerWidth < 992) closeSidebar(); });
        });
    });

    /* ---------- Sign out ---------- */
    $$('#signOutBtn, #sidebarSignout, .js-signout').forEach(btn => {
        btn.addEventListener('click', e => {
            e.preventDefault();
            try { localStorage.removeItem('nexora_user'); } catch (err) { /* ignore */ }
            window.location.href = 'signin.html';
        });
    });

    /* ---------- Status filters + live search (combined) ---------- */
    const activeFilter = {};   // targetSelector -> filter value
    const searchQuery = {};    // targetSelector -> query string

    function visibleCount(targetSel) {
        return $$(targetSel).filter(el => !el.classList.contains('js-hidden')).length;
    }

    function updateEmptyState(targetSel) {
        const emptySel = { '.ticket': '#ticketsEmpty' }[targetSel];
        const empty = emptySel ? $(emptySel) : null;
        if (empty) empty.classList.toggle('js-hidden', visibleCount(targetSel) > 0);
    }

    function applyFilters(targetSel) {
        const query = (searchQuery[targetSel] || '').toLowerCase().trim();
        const filter = activeFilter[targetSel] || 'all';
        $$(targetSel).forEach(item => {
            const matchF = filter === 'all' || item.dataset.status === filter;
            const matchS = !query || (item.dataset.search || '').toLowerCase().indexOf(query) !== -1;
            item.classList.toggle('js-hidden', !(matchF && matchS));
        });
        updateEmptyState(targetSel);
    }

    $$('.js-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            const group = btn.dataset.group;
            const target = btn.dataset.target;
            if (group) {
                $$('.js-filter[data-group="' + group + '"]').forEach(b => b.classList.remove('active'));
            }
            btn.classList.add('active');
            if (target) {
                activeFilter[target] = btn.dataset.filter || 'all';
                applyFilters(target);
            }
        });
    });

    /* Initialise from whatever is marked active in the markup */
    $$('.js-filter').forEach(b => {
        if (b.classList.contains('active') && b.dataset.target) {
            activeFilter[b.dataset.target] = b.dataset.filter || 'all';
        }
    });
    Object.keys(activeFilter).forEach(applyFilters);

    /* Search inputs */
    $$('input[data-search-target]').forEach(input => {
        const target = input.dataset.searchTarget;
        input.addEventListener('input', () => {
            searchQuery[target] = input.value;
            applyFilters(target);
            toast('<i class="bi bi-funnel-fill me-2"></i>' + visibleCount(target) + ' result' + (visibleCount(target) === 1 ? '' : 's') + ' shown', 1500);
        });
    });

    /* Cmd/Ctrl + K focuses the first search box */
    window.addEventListener('keydown', e => {
        if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === 'k') {
            const input = $('input[data-search-target]');
            if (input) { e.preventDefault(); input.focus(); input.select(); }
        }
    });

    /* ---------- Single-page view router (sidebar switches content inline) ---------- */
    const VALID_VIEWS = ['projects', 'support', 'site', 'services', 'pricing', 'contact'];
    const TOPBAR_META = {
        projects: { icon: 'kanban', title: 'Projects', sub: 'Manage all your active Nexora engagements' },
        support: { icon: 'life-preserver', title: 'Support', sub: 'Raise tickets, track SLAs and stay in the loop' },
        site: { icon: 'globe2', title: 'Site', sub: 'Explore every corner of the Nexora public website' },
        services: { icon: 'stack', title: 'Services', sub: 'Everything your product needs, from idea to scale' },
        pricing: { icon: 'tags', title: 'Pricing', sub: 'Simple, transparent plans for every stage' },
        contact: { icon: 'chat-heart', title: 'Contact', sub: 'Questions, escalations or a new idea — say hi' }
    };
    const SEARCH_META = {
        projects: { target: '.project-card', placeholder: 'Search projects...' },
        support: { target: '.ticket', placeholder: 'Search tickets...' }
    };

    function showView(name, silent) {
        if (VALID_VIEWS.indexOf(name) === -1) name = 'projects';

        $$('.dash-view').forEach(v => v.classList.toggle('active', v.dataset.view === name));

        $$('a.d-nav-link.js-view').forEach(a => a.classList.toggle('active', a.dataset.view === name));

        const meta = TOPBAR_META[name];
        const topIco = $('#topbarIcon');
        const topTitle = $('#topbarTitle');
        const topSub = $('#topbarSub');
        if (topIco) topIco.innerHTML = '<i class="bi bi-' + meta.icon + '"></i>';
        if (topTitle) topTitle.textContent = meta.title;
        if (topSub) topSub.textContent = meta.sub;

        const sm = SEARCH_META[name];
        const searchBox = $('#dashboardSearch');
        if (searchBox) {
            if (sm) {
                searchBox.dataset.searchTarget = sm.target;
                searchBox.placeholder = sm.placeholder;
                searchBox.value = '';
                searchQuery[sm.target] = '';
            }
            const searchWrap = searchBox.closest('.d-search');
            if (searchWrap) searchWrap.classList.toggle('js-hidden', !sm);
        }

        $$('.dash-view.active .js-filter[data-filter="all"]').forEach(btn => btn.click());

        if (!silent) {
            try { if (history.replaceState) history.replaceState(null, '', '#' + name); } catch (err) { /* ignore */ }
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (window.innerWidth < 992) closeSidebar();
    }

    window.addEventListener('hashchange', () => {
        const name = (window.location.hash || '').replace('#', '');
        const current = $$('.dash-view.active')[0];
        if (!current || current.dataset.view !== name) {
            showView(name, true);
        }
    });

    showView((window.location.hash || '').replace('#', '') || 'projects', true);

    /* ---------- Animated counters (.js-count) ---------- */
    $$('.js-count').forEach(el => {
        const targetNum = parseInt(el.dataset.count, 10) || 0;
        if (targetNum <= 0) { el.textContent = '0'; return; }
        const duration = 1000;
        const start = performance.now();
        function tick(now) {
            const p = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = Math.round(targetNum * eased);
            if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    });

    /* ---------- Progress bars + meters ---------- */
    $$('.progress-bar span[data-progress]').forEach(p => {
        p.style.width = Math.min(100, Math.max(0, parseInt(p.dataset.progress, 10) || 0)) + '%';
    });
    $$('.d-meter-fill[data-fill]').forEach(f => {
        f.style.width = Math.min(100, Math.max(0, parseInt(f.dataset.fill, 10) || 0)) + '%';
    });

    /* ---------- Notifications ---------- */
    const markRead = $('#markRead');
    if (markRead) {
        markRead.addEventListener('click', () => {
            $$('.d-notif-item').forEach(item => item.classList.add('read'));
            $$('.d-notif-dot').forEach(dot => dot.classList.add('hidden'));
            toast('<i class="bi bi-bell-slash me-2"></i>All notifications marked as read.');
        });
    }

    /* ---------- Ticket actions ---------- */
    function attachTicketActions() {
        $$('.t-resolve-btn').forEach(btn => {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', () => {
                const ticket = btn.closest('.ticket');
                if (!ticket) return;
                ticket.dataset.status = 'resolved';
                const search = ticket.dataset.search || '';
                if (search.indexOf('resolved') === -1) ticket.dataset.search = (search + ' resolved').trim();
                const side = ticket.querySelector('.ticket-side');
                if (side) {
                    const statusBadge = side.querySelector('.badge-soft');
                    if (statusBadge) { statusBadge.className = 'badge-soft bs-green'; statusBadge.textContent = 'Resolved'; }
                    const sla = side.querySelector('.sla-tag');
                    if (sla) { sla.className = 'sla-tag ok'; sla.innerHTML = '<i class="bi bi-shield-check"></i> Just now'; }
                }
                if (btn) btn.remove();
                applyFilters('.ticket');
                toast('<i class="bi bi-patch-check-fill me-2"></i>Ticket marked as resolved. Nice work!');
            });
        });

        $$('.t-details-btn').forEach(btn => {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', () => {
                toast('<i class="bi bi-arrow-up-right me-2"></i>Full ticket view opens here (demo).');
            });
        });
    }

    /* ---------- New ticket (modal form) ---------- */
    const ticketForm = $('#ticketForm');
    if (ticketForm) {
        let ticketSeq = 2042;
        $$('.ticket').forEach(t => {
            const m = (t.dataset.search || '').match(/tn-\s*(\d+)/i);
            if (m) ticketSeq = Math.max(ticketSeq, parseInt(m[1], 10) + 1);
        });

        ticketForm.addEventListener('submit', e => {
            e.preventDefault();
            const subject = $('#ticketSubject');
            const type = $('#ticketType');
            const prio = $('#ticketPriority');
            const desc = $('#ticketDesc');
            const list = $('#ticketList');
            if (!subject.value.trim() || !desc.value.trim() || !list) {
                toast('<i class="bi bi-exclamation-circle-fill me-2"></i>Please add a subject and description.');
                return;
            }

            const typeText = (type && type.value) || 'General';
            const prioText = (prio && prio.value) || 'Medium';
            const prioBadge = { urgent: 'bs-purple', high: 'bs-red', medium: 'bs-cyan', low: 'bs-gray' }[prioText.toLowerCase()] || 'bs-cyan';
            const prioIcon = { urgent: 'n-red', high: 'n-orange', medium: 'n-cyan', low: 'n-green' }[prioText.toLowerCase()] || 'n-cyan';
            const typeIcon = {
                Bug: ['bi-bug', 'n-red'],
                Feature: ['bi-lightbulb', 'n-green'],
                Support: ['bi-chat-dots', 'n-cyan'],
                Billing: ['bi-credit-card', 'n-orange']
            }[typeText] || ['bi-chat-left-dots', 'n-purple'];

            const id = 'TN-' + ticketSeq++;
            const item = document.createElement('article');
            item.className = 'ticket';
            item.dataset.status = 'open';
            item.dataset.search = (
                id + ' ' + subject.value + ' ' + typeText + ' ' + prioText + ' open'
            ).toLowerCase();
            item.innerHTML =
                '<span class="ticket-ico ' + typeIcon[1] + '"><i class="bi ' + typeIcon[0] + '"></i></span>' +
                '<div class="ticket-main">' +
                '  <div class="ticket-row1">' +
                '    <h5>' + escapeHtml(subject.value.trim()) + '</h5>' +
                '    <span class="badge-soft ' + prioBadge + '">' + prioText + '</span>' +
                '  </div>' +
                '  <p class="ticket-desc">' + escapeHtml(desc.value.trim()) + '</p>' +
                '  <div class="ticket-meta">' +
                '    <span><i class="bi bi-tag"></i> ' + escapeHtml(typeText) + '</span>' +
                '    <span><i class="bi bi-clock"></i> Just now</span>' +
                '    <span><i class="bi bi-person"></i> ' + escapeHtml(firstName || 'You') + '</span>' +
                '    <span><i class="bi bi-hash"></i> ' + id + '</span>' +
                '  </div>' +
                '</div>' +
                '<div class="ticket-side">' +
                '  <span class="badge-soft bs-cyan">Open</span>' +
                '  <small class="sla-tag"><i class="bi bi-alarm"></i> SLA 24h left</small>' +
                '  <div class="ticket-actions">' +
                '    <button type="button" class="btn btn-xs btn-gradient t-resolve-btn"><i class="bi bi-check-lg"></i> Resolve</button>' +
                '    <button type="button" class="btn btn-xs btn-ghost t-details-btn"><i class="bi bi-arrow-up-right"></i></button>' +
                '  </div>' +
                '</div>';
            list.prepend(item);
            item.classList.add('fade-up');

            attachTicketActions();
            applyFilters('.ticket');

            const modalEl = $('#newTicketModal');
            const modal = modalEl && bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
            ticketForm.reset();
            toast('<i class="bi bi-patch-check-fill me-2"></i>Ticket <strong>' + id + '</strong> created — our team will reply shortly.');
        });
    }

    attachTicketActions();

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /* ---------- Generic demo buttons (e.g. New Project) ---------- */
    $$('.js-demo-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const msg = btn.dataset.demo || 'This feature launches soon (demo).';
            toast('<i class="bi bi-stars me-2"></i>' + msg);
        });
    });

    /* ---------- Footer year ---------- */
    $$('.js-year').forEach(el => { el.textContent = today; });
})();