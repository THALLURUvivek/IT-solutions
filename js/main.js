/* ==========================================================================
   NEXORA — IT Solutions & Software Company Theme (multi-page)
   Shared JS: GSAP animations + UI interactions.
   Each block guards against missing elements so the file is safe on
   every page (index, about, services, work, process, pricing, blog, contact).
   ========================================================================== */
(function () {
    'use strict';

    /* ---------- Helpers ---------- */
    const $ = (sel, ctx) => (ctx || document).querySelector(sel);
    const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
    const today = (() => new Date().getFullYear())();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const HAS_GSAP = Boolean(window.gsap);
    if (HAS_GSAP && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

    document.body.classList.add('js-on');

    /* Play a from-tween only if at least one target exists on this page. */
    function playFrom(selector, vars) {
        if (!HAS_GSAP || !document.querySelector(selector)) return null;
        return gsap.from(selector, vars);
    }

    /* ================================================================
       1. PRELOADER
       ================================================================ */
    const preloader = $('#preloader');
    const hidePreloader = () => preloader && preloader.classList.add('hidden');

    window.addEventListener('load', () => {
        if (!preloader) return;
        if (!HAS_GSAP || reducedMotion) { hidePreloader(); return; }
        const tl = gsap.timeline();
        tl.to(preloader, {
            y: '-100%',
            ease: 'power4.inOut',
            duration: 0.9,
            delay: 1.15,
            onComplete: hidePreloader
        });
    });
    setTimeout(hidePreloader, 5200);

    /* ================================================================
       2. NAVBAR SCROLL STATE + BACK TO TOP
       (Active nav-link is marked statically in each page's HTML)
       ================================================================ */
    const nav = $('#mainNav');
    const backToTop = $('#backToTop');

    function onScrollNavbar() {
        if (nav) nav.classList.toggle('scrolled', window.scrollY > 60);
        if (backToTop) backToTop.classList.toggle('show', window.scrollY > 500);
    }
    window.addEventListener('scroll', onScrollNavbar, { passive: true });
    onScrollNavbar();

    if (backToTop) {
        backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }

    /* Close the offcanvas menu when a link is tapped */
    $$('#navOffcanvas .nav-link').forEach(link => {
        link.addEventListener('click', () => {
            const oc = bootstrap.Offcanvas.getInstance($('#navOffcanvas'));
            if (oc) oc.hide();
        });
    });

    /* ================================================================
       3. HERO PARTICLES (index page only, desktop only)
       ================================================================ */
    const canvas = $('#particles');
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    if (canvas) {
        if (HAS_GSAP && !reducedMotion && !isTouch) {
            const ctx = canvas.getContext('2d');
            let particles = [];
            let rafId = null;
            const colors = ['rgba(108,92,231,0.55)', 'rgba(0,212,255,0.55)', 'rgba(157,77,255,0.55)'];

            function initParticles() {
                const count = Math.min(Math.floor(canvas.width / 24), 60);
                particles = Array.from({ length: count }, () => ({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    r: Math.random() * 2 + 0.6,
                    vx: (Math.random() - 0.5) * 0.35,
                    vy: (Math.random() - 0.5) * 0.35,
                    c: colors[Math.floor(Math.random() * colors.length)]
                }));
            }

            function resizeCanvas() {
                const hero = $('#hero');
                if (!hero) return;
                canvas.width = hero.offsetWidth;
                canvas.height = hero.offsetHeight;
                initParticles();
            }

            function draw() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                for (let i = 0; i < particles.length; i++) {
                    const p = particles[i];
                    p.x += p.vx; p.y += p.vy;
                    if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
                    if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                    ctx.fillStyle = p.c;
                    ctx.fill();
                }
                for (let i = 0; i < particles.length; i++) {
                    for (let j = i + 1; j < particles.length; j++) {
                        const a = particles[i], b = particles[j];
                        const dx = a.x - b.x, dy = a.y - b.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < 130) {
                            ctx.beginPath();
                            ctx.moveTo(a.x, a.y);
                            ctx.lineTo(b.x, b.y);
                            ctx.strokeStyle = 'rgba(108,92,231,' + (1 - dist / 130) * 0.25 + ')';
                            ctx.lineWidth = 0.6;
                            ctx.stroke();
                        }
                    }
                }
                rafId = requestAnimationFrame(draw);
            }

            window.addEventListener('resize', resizeCanvas);
            resizeCanvas();
            draw();

            /* Pause when the hero scrolls off-screen */
            const hero = $('#hero');
            const io = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && !rafId) draw();
                    else if (!entry.isIntersecting && rafId) {
                        cancelAnimationFrame(rafId); rafId = null;
                    }
                });
            });
            if (hero) io.observe(hero);
        } else {
            canvas.remove();
        }
    }

    /* ================================================================
       4. GSAP ANIMATIONS
       ================================================================ */
    if (HAS_GSAP && !reducedMotion) {
        const mm = gsap.matchMedia();
        const defaults = { ease: 'power3.out', autoAlpha: 0 };

        /* ----- 4a. Hero intro (index) ----- */
        if ($('#hero .hero-title')) {
            const heroTl = gsap.timeline({
                delay: 1.65,
                defaults: { ease: 'power3.out' }
            });
            heroTl
                .from('.hero-badge', { y: 30, autoAlpha: 0, duration: 0.7 })
                .from('.hero-title .line', { y: 90, autoAlpha: 0, duration: 0.9, stagger: 0.14 }, '-=0.3')
                .from('.hero-sub', { y: 30, autoAlpha: 0, duration: 0.7 }, '-=0.5')
                .from('.hero .btn', { y: 30, autoAlpha: 0, duration: 0.6, stagger: 0.12 }, '-=0.5')
                .from('.hero-meta > div', { y: 30, autoAlpha: 0, duration: 0.6, stagger: 0.1 }, '-=0.5')
                .from('.hero-visual', { scale: 0.88, autoAlpha: 0, duration: 1, ease: 'power2.out' }, '-=1.1')
                .from('.floating-card', { y: 20, autoAlpha: 0, duration: 0.6, stagger: 0.15 }, '-=0.7')
                .from('.scroll-indicator', { autoAlpha: 0, duration: 0.6 }, '-=0.4');
        }

        /* ----- 4b. Page banner intro (all subpages) ----- */
        if ($('.page-banner')) {
            gsap.timeline({
                delay: 1.65,
                defaults: { ease: 'power3.out' }
            })
                .from('.page-badge', { y: 30, autoAlpha: 0, duration: 0.7 })
                .from('.page-banner h1', { y: 50, autoAlpha: 0, duration: 0.9 }, '-=0.3')
                .from('.page-sub', { y: 30, autoAlpha: 0, duration: 0.7 }, '-=0.5')
                .from('.breadcrumb-nav', { y: 20, autoAlpha: 0, duration: 0.6 }, '-=0.4');
        }

        /* ----- 4c. Section headings (`section-head` blocks) ----- */
        $$('.section-head').forEach(head => {
            const tag = head.querySelector('.section-tag');
            const title = head.querySelector('.section-title');
            const lead = head.querySelector('.section-lead');
            if (!tag && !title && !lead) return;
            gsap.timeline({
                scrollTrigger: { trigger: head, start: 'top 84%', once: true }
            })
                .from(tag, { ...defaults, y: 30, duration: 0.6 })
                .from(title, { ...defaults, y: 40, duration: 0.7 }, '-=0.35')
                .from(lead, { ...defaults, y: 30, duration: 0.7 }, '-=0.4');
        });

        /* ----- 4d. About preview / contact headings (outside .section-head) ----- */
        if ($('.about-visual')) {
            gsap.from('.about-visual', {
                ...defaults,
                x: () => (window.innerWidth >= 992 ? -60 : 0),
                y: () => (window.innerWidth >= 992 ? 0 : -60),
                duration: 1, ease: 'power2.out',
                scrollTrigger: { trigger: '.about-visual', start: 'top 82%', once: true }
            });
        }

        /* ----- 4e. Services ----- */
        playFrom('.service-card', {
            ...defaults, y: 60, duration: 0.8, stagger: 0.1,
            scrollTrigger: { trigger: '#services', start: 'top 75%', once: true }
        });

        /* ----- 4f. Stats counters ----- */
        function animateCounter(el) {
            const target = parseInt(el.dataset.target, 10) || 0;
            const inHero = Boolean(el.closest('#hero'));
            const state = { val: 0 };
            gsap.to(state, {
                val: target,
                duration: 2.2,
                ease: 'power1.inOut',
                scrollTrigger: {
                    trigger: inHero ? '#hero' : '.stats-section',
                    start: inHero ? 'top 60%' : 'top 80%',
                    once: true
                },
                onUpdate() {
                    el.textContent = Math.round(state.val).toLocaleString();
                }
            });
        }
        $$('.counters').forEach(animateCounter);

        /* ----- 4g. Feature items ----- */
        playFrom('.feature-item', {
            ...defaults, y: 50, duration: 0.7, stagger: 0.12,
            scrollTrigger: { trigger: '.feature-list', start: 'top 85%', once: true }
        });

        /* ----- 4h. Work cards ----- */
        playFrom('.work-col', {
            ...defaults, y: 70, duration: 0.8, stagger: 0.12,
            scrollTrigger: { trigger: '.work', start: 'top 75%', once: true }
        });

        /* ----- 4i. Process steps ----- */
        playFrom('.step-col', {
            ...defaults, y: 60, duration: 0.7, stagger: 0.12,
            scrollTrigger: { trigger: '.process', start: 'top 75%', once: true }
        });

        /* ----- 4j. Testimonial cards ----- */
        playFrom('.testimonial-card', {
            ...defaults, y: 60, duration: 0.8, stagger: 0.15,
            scrollTrigger: { trigger: '.testimonials', start: 'top 75%', once: true }
        });

        /* ----- 4k. Pricing plans ----- */
        playFrom('.price-col', {
            ...defaults, y: 70, duration: 0.8, stagger: 0.12,
            scrollTrigger: { trigger: '.pricing', start: 'top 75%', once: true }
        });

        /* ----- 4l. Team members ----- */
        playFrom('.team-col', {
            ...defaults, y: 60, duration: 0.7, stagger: 0.1,
            scrollTrigger: { trigger: '.team', start: 'top 75%', once: true }
        });

        /* ----- 4m. Blog posts ----- */
        playFrom('.blog-col', {
            ...defaults, y: 60, duration: 0.7, stagger: 0.12,
            scrollTrigger: { trigger: '.blog', start: 'top 75%', once: true }
        });

        /* ----- 4n. FAQ items ----- */
        playFrom('.accordion-item', {
            ...defaults, x: -50, duration: 0.6, stagger: 0.08,
            scrollTrigger: { trigger: '.faq', start: 'top 80%', once: true }
        });

        /* ----- 4o. Contact info + form ----- */
        playFrom('.contact-info .contact-item', {
            ...defaults, x: -50, duration: 0.7, stagger: 0.12,
            scrollTrigger: { trigger: '.contact', start: 'top 80%', once: true }
        });
        playFrom('.contact-form-wrap', {
            ...defaults, y: 60, duration: 0.9,
            scrollTrigger: { trigger: '.contact-form-wrap', start: 'top 82%', once: true }
        });

        /* ----- 4p. CTA banner ----- */
        playFrom('.cta-box > .row > div', {
            ...defaults, y: 40, duration: 0.8, stagger: 0.15,
            scrollTrigger: { trigger: '.cta-box', start: 'top 85%', once: true }
        });

        /* ----- 4q. Parallax (desktop only) ----- */
        mm.add('(min-width: 992px)', () => {
            if ($('.orb-1')) {
                gsap.to('.orb-1', {
                    y: 180,
                    scrollTrigger: { trigger: '.hero, .page-banner', start: 'top top', end: 'bottom top', scrub: 1.2 }
                });
            }
            if ($('.orb-2')) {
                gsap.to('.orb-2', {
                    y: -140,
                    scrollTrigger: { trigger: '.hero, .page-banner', start: 'top top', end: 'bottom top', scrub: 1.2 }
                });
            }
            if ($('.hero-visual')) {
                gsap.to('.hero-visual', {
                    y: -50,
                    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1.4 }
                });
            }
            if ($('.about-img-main')) {
                gsap.to('.about-img-main', {
                    y: 40,
                    scrollTrigger: { trigger: '.about-visual', start: 'top bottom', end: 'bottom top', scrub: 1.2 }
                });
            }
        });

        /* ----- 4r. Subtle card tilt (hover-capable devices) ----- */
        mm.add('(hover: hover) and (pointer: fine)', () => {
            const tiltTargets = '.service-card, .price-card:not(.featured), .step-card, .blog-card, .team-card';
            $$(tiltTargets).forEach(card => {
                card.addEventListener('mousemove', e => {
                    const r = card.getBoundingClientRect();
                    const x = (e.clientX - r.left) / r.width - 0.5;
                    const y = (e.clientY - r.top) / r.height - 0.5;
                    gsap.to(card, {
                        x: x * 6, y: y * 6,
                        rotateX: y * -4, rotateY: x * 4,
                        duration: 0.4, transformPerspective: 800, ease: 'power2.out'
                    });
                });
                card.addEventListener('mouseleave', () => {
                    gsap.to(card, {
                        x: 0, y: 0, rotateX: 0, rotateY: 0,
                        duration: 0.6, ease: 'elastic.out(1, 0.45)'
                    });
                });
            });
        });
    }

    /* ================================================================
       5. TESTIMONIAL SLIDER (index only — auto + dots + swipe)
       ================================================================ */
    const strip = $('.testimonial-track');
    const dotsWrap = $('.slider-dots');
    if (strip && dotsWrap) {
        const cards = $$('.testimonial-card', strip);
        const gap = 30;
        let idx = 0;
        let slides = cards.length;
        let perView = 1;
        let autoTimer = null;

        const getPerView = () => (window.innerWidth >= 992 ? 2 : 1);
        const getCardSpan = () => cards[0].offsetWidth + gap;

        function buildDots() {
            perView = getPerView();
            slides = Math.ceil(cards.length / perView);
            dotsWrap.innerHTML = '';
            for (let i = 0; i < slides; i++) {
                const dot = document.createElement('button');
                dot.className = 'dot' + (i === 0 ? ' active' : '');
                dot.setAttribute('aria-label', 'Slide ' + (i + 1));
                dot.addEventListener('click', () => goToSlide(i));
                dotsWrap.appendChild(dot);
            }
        }

        function updateDots() {
            $$('.dot', dotsWrap).forEach((d, i) => d.classList.toggle('active', i === idx));
        }

        function goToSlide(n) {
            idx = Math.max(0, Math.min(slides - 1, n));
            const left = idx * getCardSpan() * perView;
            if (HAS_GSAP && !reducedMotion) {
                gsap.to(strip, { scrollLeft: left, duration: 0.7, ease: 'power2.out' });
            } else {
                strip.scrollLeft = left;
            }
            updateDots();
        }

        const next = () => goToSlide((idx + 1) % slides);

        function startAuto() { stopAuto(); autoTimer = setInterval(next, 5500); }
        function stopAuto() { if (autoTimer) { clearInterval(autoTimer); autoTimer = null; } }

        function syncFromScroll() {
            const slot = Math.round(strip.scrollLeft / getCardSpan() / perView);
            if (slot >= 0 && slot < slides) { idx = slot; updateDots(); }
        }

        let resizeT = null;
        window.addEventListener('resize', () => {
            clearTimeout(resizeT);
            resizeT = setTimeout(() => {
                buildDots();
                goToSlide(0);
            }, 150);
        });

        strip.addEventListener('scroll', syncFromScroll, { passive: true });
        strip.addEventListener('touchstart', stopAuto, { passive: true });
        strip.addEventListener('touchend', () => setTimeout(startAuto, 4000));
        strip.addEventListener('mouseenter', stopAuto);
        strip.addEventListener('mouseleave', startAuto);
        dotsWrap.addEventListener('mouseenter', stopAuto);
        dotsWrap.addEventListener('mouseleave', startAuto);

        buildDots();
        startAuto();
    }

    /* ================================================================
       6. CONTACT FORM + NEWSLETTER (front-end demo)
       ================================================================ */
    const toastEl = $('#formToast');

    function showToast(custom) {
        if (!toastEl) return;
        if (custom) $('#formToast .toast-body').innerHTML = custom;
        new bootstrap.Toast(toastEl, { delay: 4200 }).show();
    }

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    function markSuffix(input, ok) {
        input.classList.toggle('is-invalid', !ok);
        return ok;
    }

    function validate(input) {
        let ok = true;
        if (!input.value.trim()) ok = false;
        if (input.type === 'email' && !emailRe.test(input.value)) ok = false;
        return markSuffix(input, ok);
    }

    const contactForm = $('#contactForm');
    if (contactForm) {
        ['input', 'change'].forEach(evt => {
            contactForm.addEventListener(evt, e => {
                if (e.target.matches('.form-control, .form-select')) e.target.classList.remove('is-invalid');
            });
        });
        contactForm.addEventListener('submit', e => {
            e.preventDefault();
            const fields = ['#name', '#email', '#message'].map(s => $(s)).filter(Boolean);
            const allValid = fields.every(validate);
            if (!allValid) {
                showToast('<i class="bi bi-exclamation-circle-fill me-2"></i>Please complete the required fields correctly.');
                return;
            }
            const btn = contactForm.querySelector('button[type="submit"]');
            const originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Sending...';
            setTimeout(() => {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
                contactForm.reset();
                showToast();
            }, 1400);
        });
    }

    const newsletter = $('#newsletterForm');
    if (newsletter) {
        const inputEl = newsletter.querySelector('input[type="email"]');
        newsletter.addEventListener('submit', e => {
            e.preventDefault();
            if (!inputEl) return;
            if (!inputEl.value.trim() || !emailRe.test(inputEl.value)) {
                markSuffix(inputEl, false);
                showToast('<i class="bi bi-exclamation-circle-fill me-2"></i>Please enter a valid email address.');
                return;
            }
            markSuffix(inputEl, true);
            inputEl.value = '';
            showToast('<i class="bi bi-envelope-check-fill me-2"></i>Subscribed! Check your inbox for a welcome email.');
        });
        ['input', 'change'].forEach(evt => {
            newsletter.addEventListener(evt, () => {
                if (inputEl) inputEl.classList.remove('is-invalid');
            });
        });
    }

    /* ================================================================
       7. FONTS / IMAGES — refresh ScrollTrigger measurements
       ================================================================ */
    if (HAS_GSAP && window.ScrollTrigger) {
        window.addEventListener('load', () => ScrollTrigger.refresh());
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => ScrollTrigger.refresh());
        }
    }

    /* Footer year auto-update */
    $$('.footer .footer-bottom p').forEach(p => {
        p.textContent = p.textContent.replace(/\d{4}/, today);
    });

})();