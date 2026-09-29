/* ==========================================================================
   NEXORA — Custom Select (enhanced native <select>)
   --------------------------------------------------------------------------
   A native <select> cannot be styled once its list is open: the popup is
   drawn by the OS/browser, so its border, radius and layout are off limits.
   This replaces the *presentation* only, never the control itself:

     - the real <select> stays in the DOM, keeps its id/name/options, and stays
       the single source of truth. Anything reading .value (dashboard.js reads
       #ticketType / #ticketPriority) keeps working untouched.
     - it is visually hidden, not removed, so FormData and form resets still
       see it.
     - a <button role="combobox"> + <div role="listbox"> pair is rendered next
       to it, driven by aria-activedescendant rather than roving tabindex.

   Progressive enhancement: with JS off or this file failing to load, the
   native select stays visible and fully functional. The .xsel wrapper is only
   added after a successful build, so a throw mid-build cannot leave a select
   hidden with no way to open it.
   ========================================================================== */
(function () {
    'use strict';

    const PHONE = '(max-width: 767.98px)';
    const GAP = 8;          /* trigger -> panel breathing room */
    const EDGE = 12;        /* viewport gutter for the panel */
    const MIN_PANEL = 190;

    const mqPhone = window.matchMedia(PHONE);
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    let uid = 0;
    const open = new Set();

    /* ---------- Shared scrim ----------
       Lives on <body> rather than inside the trigger's ancestor chain: the
       panel sets position:fixed, and any ancestor with a transform/filter/
       backdrop-filter would become its containing block and pin the panel to
       that element instead of the viewport. */
    let scrim = null;
    function getScrim() {
        if (scrim) return scrim;
        scrim = document.createElement('div');
        scrim.className = 'xsel-scrim';
        /* No `hidden` attribute: CSS toggles this element's visibility per
           breakpoint, and an author-level display rule would beat the UA's
           [hidden] rule and leave it on screen anyway. */
        scrim.setAttribute('aria-hidden', 'true');
        scrim.addEventListener('click', closeAll);
        document.body.appendChild(scrim);
        return scrim;
    }

    function closeAll() {
        Array.from(open).forEach(inst => inst.close());
    }

    /* ---------- One enhanced select ---------- */
    class XSelect {
        constructor(native) {
            this.native = native;
            this.uid = ++uid;
            this.panel = null;
            this.trigger = null;
            this.wrap = null;
            this.items = [];       /* flat list of rendered options, in DOM order */
            this.active = -1;      /* index into this.items, -1 = none */
            this.buf = '';
            this.bufTimer = 0;
            this.onDocDown = this.onDocDown.bind(this);
            this.onReflow = this.onReflow.bind(this);
            this.onTriggerKey = this.onTriggerKey.bind(this);
        }

        build() {
            const sel = this.native;

            /* Wrap first, so every later step can bail out to a visible native
               select simply by never adding the .xsel class. */
            const wrap = document.createElement('div');
            wrap.className = 'xsel';
            sel.parentNode.insertBefore(wrap, sel);
            wrap.appendChild(sel);
            sel.classList.add('xsel-native');
            sel.setAttribute('tabindex', '-1');
            sel.setAttribute('aria-hidden', 'true');

            this.wrap = wrap;

            /* Accessible name = the visible <label> plus the current value, so
               a screen reader announces "Budget Range, Under $5,000". */
            let labelId = null;
            let labelEl = null;
            if (sel.id) {
                labelEl = document.querySelector('label[for="' + CSS.escape(sel.id) + '"]');
                if (labelEl) {
                    if (!labelEl.id) labelEl.id = this.uid + '-lbl';
                    labelId = labelEl.id;
                    /* The label's `for` still targets the real <select>, which
                       is now visually hidden — a label click would move focus
                       to something the user cannot see. Send it to the trigger
                       instead. */
                    labelEl.addEventListener('click', e => {
                        e.preventDefault();
                        trigger.focus();
                    });
                }
            }
            const valueId = 'xsel-v' + this.uid;

            const trigger = document.createElement('button');
            trigger.type = 'button';
            trigger.className = 'xsel-trigger';
            trigger.id = 'xsel-t' + this.uid;
            trigger.setAttribute('role', 'combobox');
            trigger.setAttribute('aria-haspopup', 'listbox');
            trigger.setAttribute('aria-expanded', 'false');
            trigger.setAttribute('aria-controls', 'xsel-p' + this.uid);
            trigger.setAttribute('aria-labelledby', (labelId ? labelId + ' ' : '') + valueId);
            if (sel.disabled) trigger.disabled = true;
            trigger.innerHTML =
                '<span class="xsel-value" id="' + valueId + '"></span>' +
                '<span class="xsel-caret" aria-hidden="true"></span>';

            const panel = document.createElement('div');
            panel.className = 'xsel-panel';
            panel.id = 'xsel-p' + this.uid;
            panel.setAttribute('role', 'listbox');
            panel.setAttribute('aria-labelledby', trigger.id);

            this.trigger = trigger;
            this.panel = panel;
            wrap.appendChild(trigger);

            /* The panel is portalled to <body>, not left inside the wrapper.
               It is position:fixed, and any ancestor with a transform,
               filter, backdrop-filter, perspective or `contain` becomes the
               containing block for fixed descendants — silently re-anchoring
               the panel to that element instead of the viewport. GSAP leaves
               an identity transform on .contact-form-wrap, and the dashboard
               sets backdrop-filter, so this is not hypothetical: the phone
               sheet rendered mid-screen rather than pinned to the bottom. */
            document.body.appendChild(panel);

            this.render();
            this.bind();
            this.sync();

            /* Only now is it safe to consider the control hidden. */
            wrap.classList.add('xsel-ready');
        }

        /* Mirror every <option>/<optgroup> into the listbox. */
        render() {
            const sel = this.native;
            const frag = document.createDocumentFragment();
            this.items = [];

            Array.from(sel.options).forEach(opt => {
                const parent = opt.parentNode;
                const isGroup = parent && parent.tagName === 'OPTGROUP';

                if (isGroup && !parent.dataset.xselRendered) {
                    parent.dataset.xselRendered = '1';
                    const g = document.createElement('div');
                    g.className = 'xsel-group';
                    g.setAttribute('role', 'presentation');
                    g.textContent = parent.label || '';
                    frag.appendChild(g);
                }

                const row = document.createElement('div');
                row.className = 'xsel-opt';
                row.id = 'xsel-o' + this.uid + '-' + this.items.length;
                row.setAttribute('role', 'option');
                row.dataset.value = opt.value;
                row.style.setProperty('--i', String(this.items.length));
                if (opt.disabled) {
                    row.classList.add('is-disabled');
                    row.setAttribute('aria-disabled', 'true');
                }
                row.innerHTML =
                    '<span class="xsel-check" aria-hidden="true"></span>' +
                    '<span class="xsel-text"></span>';
                row.querySelector('.xsel-text').textContent = opt.textContent;

                this.items.push({ row: row, value: opt.value, text: opt.textContent, disabled: Boolean(opt.disabled) });
                frag.appendChild(row);
            });

            this.panel.innerHTML = '';
            this.panel.appendChild(frag);

            /* Click / pointer */
            this.panel.addEventListener('click', e => {
                const row = e.target.closest('.xsel-opt');
                if (!row || row.classList.contains('is-disabled')) return;
                const idx = this.items.findIndex(it => it.row === row);
                if (idx > -1) this.pick(idx);
            });
            this.panel.addEventListener('pointermove', e => {
                const row = e.target.closest('.xsel-opt');
                if (!row) return;
                const idx = this.items.findIndex(it => it.row === row);
                if (idx > -1 && !this.items[idx].disabled && idx !== this.active) this.highlight(idx, false);
            });
        }

        bind() {
            this.trigger.addEventListener('click', () => {
                this.isOpen ? this.close() : this.show();
            });
            this.trigger.addEventListener('keydown', this.onTriggerKey);

            /* Keep the custom UI honest if anything changes the value
               programmatically, and on form reset. */
            this.native.addEventListener('change', () => this.sync());
            const form = this.native.form;
            if (form) form.addEventListener('reset', () => setTimeout(() => this.sync(), 0));

            /* main.js toggles .is-invalid on the native select during contact
               form validation; mirror it so the visible trigger agrees. */
            if (window.MutationObserver) {
                this.obs = new MutationObserver(() => {
                    this.wrap.classList.toggle('is-invalid', this.native.classList.contains('is-invalid'));
                });
                this.obs.observe(this.native, { attributes: true, attributeFilter: ['class'] });
            }

            document.addEventListener('keydown', e => {
                if (e.key === 'Escape' && this.isOpen) {
                    e.stopPropagation();
                    this.close();
                    this.trigger.focus();
                }
            });
        }

        get isOpen() { return this.wrap.classList.contains('is-open'); }

        /* ---------- open / close ---------- */
        show() {
            if (this.isOpen || this.native.disabled) return;
            this.wrap.classList.add('is-open');
            /* The panel is not a descendant of .xsel, so it carries its own
               open state for the CSS reveal/stagger to key off. */
            this.panel.classList.add('is-open');
            this.trigger.setAttribute('aria-expanded', 'true');
            open.add(this);

            const s = getScrim();
            s.classList.add('is-on');
            document.body.classList.add('xsel-open');

            this.place();
            const sel = this.items.findIndex(it => it.value === this.native.value);
            this.highlight(sel > -1 ? sel : this.firstEnabled(), false);
            this.scrollActive();

            document.addEventListener('pointerdown', this.onDocDown, true);
            window.addEventListener('scroll', this.onReflow, true);
            window.addEventListener('resize', this.onReflow);
        }

        close() {
            if (!this.isOpen) return;
            this.wrap.classList.remove('is-open');
            this.panel.classList.remove('is-open');
            this.trigger.setAttribute('aria-expanded', 'false');
            this.trigger.removeAttribute('aria-activedescendant');
            /* Drop the measured geometry. It is only valid for the viewport it
               was computed in, and leaving it inline would let a desktop
               measurement bleed into a later phone open (the phone tier relies
               on CSS alone) or vice versa. */
            this.panel.classList.remove('is-up');
            this.panel.style.cssText = '';
            open.delete(this);
            if (!open.size) {
                document.body.classList.remove('xsel-open');
                if (scrim) scrim.classList.remove('is-on');
            }
            document.removeEventListener('pointerdown', this.onDocDown, true);
            window.removeEventListener('scroll', this.onReflow, true);
            window.removeEventListener('resize', this.onReflow);
        }

        onDocDown(e) {
            /* The panel is portalled to <body>, so "inside me" means the
               wrapper or the panel — testing only the wrapper would close the
               list on the very click that is meant to pick an option. */
            if (!this.wrap.contains(e.target) && !this.panel.contains(e.target)) this.close();
        }

        onReflow() { if (this.isOpen) this.place(); }

        /* ---------- geometry ----------
           Fixed positioning with explicit coords. The panel must not be
           absolutely positioned: dashboard selects live inside a Bootstrap
           modal, whose scroll container would clip it. */
        place() {
            if (mqPhone.matches) return;   /* CSS turns it into a bottom sheet */
            const r = this.trigger.getBoundingClientRect();
            const p = this.panel;
            const vw = document.documentElement.clientWidth;
            const vh = document.documentElement.clientHeight;

            /* Width first, height second. The flip decision and the max-height
               both depend on the content's natural height, and that height is
               only meaningful at the width the panel will actually be shown
               at. Measuring before pinning the width let a wide, one-line
               layout report a short `need`, suppress the flip, and then reflow
               taller than the room below the trigger. */
            const w = Math.min(Math.max(r.width, MIN_PANEL), vw - EDGE * 2);
            p.style.width = w + 'px';
            p.style.left = Math.max(EDGE, Math.min(r.left, vw - EDGE - w)) + 'px';

            p.style.maxHeight = 'none';
            const need = p.scrollHeight;
            const below = Math.max(0, vh - r.bottom - GAP - EDGE);
            const above = Math.max(0, r.top - GAP - EDGE);
            const up = need > below && above > below;

            p.classList.toggle('is-up', up);
            /* MIN_PANEL is a preference for small lists, never a floor: a hard
               190px minimum overflowed short viewports (e.g. a 390px-tall
               landscape phone in the tablet tier) by up to 44px. */
            p.style.maxHeight = Math.min(Math.max(MIN_PANEL, need), up ? above : below) + 'px';
            p.style.top = up ? '' : (r.bottom + GAP) + 'px';
            p.style.bottom = up ? (vh - r.top + GAP) + 'px' : '';

            /* Safety net, measured rather than assumed: if either edge still
               pokes outside the viewport, trim the height by exactly the
               overflow so the list scrolls instead of spilling. */
            const pr = p.getBoundingClientRect();
            let over = 0;
            if (pr.bottom > vh - EDGE) over = pr.bottom - (vh - EDGE);
            if (pr.top < EDGE) over = Math.max(over, EDGE - pr.top);
            if (over > 0) p.style.maxHeight = Math.max(0, p.clientHeight - over) + 'px';
        }

        /* ---------- selection ---------- */
        pick(idx) {
            const item = this.items[idx];
            if (!item || item.disabled) return;
            this.native.value = item.value;
            /* Real events, so existing listeners (contact form validation,
               anything binding change) react exactly as they would natively. */
            this.native.dispatchEvent(new Event('input', { bubbles: true }));
            this.native.dispatchEvent(new Event('change', { bubbles: true }));
            this.sync();
            this.close();
            this.trigger.focus();
        }

        sync() {
            const cur = this.native.value;
            this.items.forEach(it => {
                const on = it.value === cur;
                it.row.setAttribute('aria-selected', on ? 'true' : 'false');
                it.row.classList.toggle('is-selected', on);
            });
            const found = this.items.find(it => it.value === cur);
            const label = this.native.selectedOptions[0];
            this.trigger.querySelector('.xsel-value').textContent =
                found ? found.text : (label ? label.textContent : '');
            this.wrap.classList.toggle('is-placeholder', !found && !label);
            this.wrap.classList.toggle('is-disabled', this.native.disabled);
            this.wrap.classList.toggle('is-invalid', this.native.classList.contains('is-invalid'));
        }

        firstEnabled() {
            const i = this.items.findIndex(it => !it.disabled);
            return i;
        }

        highlight(idx, scroll) {
            this.active = idx;
            this.items.forEach((it, i) => it.row.classList.toggle('is-active', i === idx));
            if (idx > -1) {
                this.trigger.setAttribute('aria-activedescendant', this.items[idx].row.id);
                if (scroll) this.scrollActive();
            } else {
                this.trigger.removeAttribute('aria-activedescendant');
            }
        }

        scrollActive() {
            const row = this.items[this.active];
            if (row) row.row.scrollIntoView({ block: 'nearest' });
        }

        step(dir) {
            const n = this.items.length;
            if (!n) return;
            let i = this.active;
            for (let step = 0; step < n; step++) {
                i = (i + dir + n) % n;
                if (!this.items[i].disabled) break;
            }
            this.highlight(i, true);
        }

        /* ---------- keyboard ----------
           Trigger handles: open/close, arrows, Home/End, Enter, Space, Esc.
           Typeahead is first-letter only and deliberately unbuffered for
           Space/Enter, which are selection keys, not typeahead keys. */
        onTriggerKey(e) {
            const k = e.key;

            if (!this.isOpen) {
                if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter' || k === ' ' || k === 'Spacebar') {
                    e.preventDefault();
                    this.show();
                    if (k === 'ArrowUp') this.step(-1);
                }
                return;
            }

            switch (k) {
                case 'ArrowDown': e.preventDefault(); this.step(1); break;
                case 'ArrowUp': e.preventDefault(); this.step(-1); break;
                case 'Home': e.preventDefault(); this.highlight(this.firstEnabled(), true); break;
                case 'End': {
                    e.preventDefault();
                    for (let i = this.items.length - 1; i >= 0; i--) {
                        if (!this.items[i].disabled) { this.highlight(i, true); break; }
                    }
                    break;
                }
                case 'Enter':
                    e.preventDefault();
                    if (this.active > -1) this.pick(this.active);
                    break;
                case ' ':
                case 'Spacebar':
                    e.preventDefault();
                    if (this.active > -1) this.pick(this.active);
                    break;
                case 'Tab':
                    this.close();
                    break;
                case 'Escape':
                    e.preventDefault();
                    this.close();
                    break;
                default:
                    if (k.length === 1 && /\S/.test(k)) this.typeahead(k);
            }
        }

        typeahead(ch) {
            clearTimeout(this.bufTimer);
            this.buf += ch.toLowerCase();
            this.bufTimer = setTimeout(() => { this.buf = ''; }, 600);
            const n = this.items.length;
            if (!n) return;
            for (let n1 = 1; n1 <= n; n1++) {
                const i = (this.active + n1) % n;
                const it = this.items[i];
                if (!it.disabled && it.text.toLowerCase().startsWith(this.buf)) {
                    this.highlight(i, true);
                    return;
                }
            }
        }
    }

    /* ---------- boot ---------- */
    function enhance(scope) {
        Array.from((scope || document).querySelectorAll('select.form-select:not([data-xselect-off])'))
            .forEach(sel => {
                /* Leave any control the page opted out of alone. */
                if (sel.dataset.xselect === 'off') return;
                try {
                    new XSelect(sel).build();
                } catch (err) {
                    /* Any failure must leave the native select usable. */
                    sel.classList.remove('xsel-native');
                    if (sel.parentNode && sel.parentNode.classList.contains('xsel')) {
                        sel.parentNode.parentNode.insertBefore(sel, sel.parentNode);
                        sel.parentNode.remove();
                    }
                    if (window.console) console.warn('select: enhancement failed, native fallback kept', err);
                }
            });
    }

    function boot() { enhance(document); }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    /* Re-close on breakpoint change: a panel measured for a phone width and
       then left open across a rotation would keep the old fixed coords. */
    const onMq = () => { if (!mqPhone.matches) closeAll(); };
    if (mqPhone.addEventListener) mqPhone.addEventListener('change', onMq);
    else if (mqPhone.addListener) mqPhone.addListener(onMq);

    window.XSelect = { enhance: enhance, closeAll: closeAll };
})();
