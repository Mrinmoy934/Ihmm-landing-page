/* ============================================================
   EnviGuide IHM — Landing Page JavaScript
   ============================================================ */

(function () {
  'use strict';

  /* ---- Force Page Refresh to Start at the Top ---- */
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  if (!window.location.hash && !window.location.search) {
    window.scrollTo(0, 0);
  }

  window.addEventListener('beforeunload', () => {
    if (!window.location.hash && !window.location.search) {
      window.scrollTo(0, 0);
    }
  });



  /* ---- Ensure background video plays smoothly on mobile & pauses when out of view ---- */
  const allBgVideos = document.querySelectorAll('video');
  allBgVideos.forEach(video => {
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');

    const tryPlay = () => {
      const p = video.play();
      if (p !== undefined) {
        p.catch(() => {});
      }
    };

    tryPlay();
    video.addEventListener('loadedmetadata', tryPlay, { once: true });
    video.addEventListener('canplay', tryPlay, { once: true });

    // Fallback trigger for mobile browsers requiring first user gesture
    const startMobileVideo = () => {
      tryPlay();
      window.removeEventListener('touchstart', startMobileVideo);
      window.removeEventListener('touchend', startMobileVideo);
      window.removeEventListener('scroll', startMobileVideo);
      window.removeEventListener('click', startMobileVideo);
    };
    window.addEventListener('touchstart', startMobileVideo, { passive: true, once: true });
    window.addEventListener('touchend', startMobileVideo, { passive: true, once: true });
    window.addEventListener('scroll', startMobileVideo, { passive: true, once: true });
    window.addEventListener('click', startMobileVideo, { passive: true, once: true });
  });

  const heroVideo = document.querySelector('.hero-video');
  if (heroVideo && 'IntersectionObserver' in window) {
    const videoObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          heroVideo.play().catch(() => {});
        } else {
          heroVideo.pause();
        }
      });
    }, { threshold: 0.05 });
    videoObserver.observe(heroVideo);
  }

  // Resume playback when tab is active
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && heroVideo) {
      heroVideo.play().catch(() => {});
    }
  });

  /* ---- Demo Page Slide-Up Text Animation Trigger ---- */
  const demoSection = document.querySelector('.demo-hero-section');
  if (demoSection) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        demoSection.classList.add('demo-animate');
      });
    });
  }

  /* ---- Sticky nav shadow on scroll ---- */
  const nav = document.getElementById('main-nav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });

  /* ---- Mobile menu ---- */
  const hamburger = document.getElementById('hamburger');

  // Build the mobile menu element once and insert it right after <nav>
  const mobileMenu = document.createElement('div');
  mobileMenu.className = 'mobile-menu';
  mobileMenu.id = 'mobile-menu';
  mobileMenu.setAttribute('aria-hidden', 'true');
  mobileMenu.innerHTML = `
    <a class="nav-link" href="#features">Features</a>
    <a class="nav-link" href="industries.html">Industries</a>
    <a class="nav-link" href="#faq">Resources</a>
    <div style="height:1px;background:#e2e8f0;margin:8px 0;"></div>
    <a class="btn-ghost" href="login.html" id="mob-login" style="justify-content:center">Login</a>
    <a class="btn-primary" href="book-demo.html" id="mob-get-started" style="justify-content:center">Book a Demo</a>
  `;
  nav.insertAdjacentElement('afterend', mobileMenu);

  function openMenu() {
    mobileMenu.classList.add('open');
    hamburger.classList.add('open');
    hamburger.setAttribute('aria-expanded', 'true');
    hamburger.setAttribute('aria-label', 'Close menu');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    mobileMenu.classList.remove('open');
    hamburger.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.setAttribute('aria-label', 'Open menu');
    document.body.style.overflow = '';
  }

  hamburger.addEventListener('click', () => {
    if (mobileMenu.classList.contains('open')) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (mobileMenu.classList.contains('open') &&
        !mobileMenu.contains(e.target) &&
        !hamburger.contains(e.target)) {
      closeMenu();
    }
  });

  // Close when a menu link is clicked
  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  // Close if viewport grows beyond mobile breakpoint
  window.addEventListener('resize', () => {
    if (window.innerWidth > 1024 && mobileMenu.classList.contains('open')) {
      closeMenu();
    }
  }, { passive: true });

  /* ============================================================
     Nav Dropdowns — Hover-Intent & Accessibility System
     ============================================================ */
  const dropdownNavItems = document.querySelectorAll('.nav-item.has-dropdown');
  const HOVER_OPEN_DELAY = 150;  // ms delay before opening on hover to prevent accidental triggers
  const HOVER_CLOSE_DELAY = 200; // ms grace delay before closing on mouseleave

  let openTimer = null;
  let closeTimer = null;
  let currentlyOpenItem = null;

  function openDropdown(item) {
    if (!item) return;
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    
    // Close any other open dropdowns immediately
    dropdownNavItems.forEach(el => {
      if (el !== item) {
        closeDropdown(el, true);
      }
    });

    item.classList.add('dropdown-open');
    const btn = item.querySelector('.nav-link');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    currentlyOpenItem = item;
  }

  function closeDropdown(item, immediate = false) {
    if (!item) return;
    if (immediate) {
      clearTimeout(openTimer);
      clearTimeout(closeTimer);
      item.classList.remove('dropdown-open');
      const btn = item.querySelector('.nav-link');
      if (btn) btn.setAttribute('aria-expanded', 'false');
      if (currentlyOpenItem === item) currentlyOpenItem = null;
    } else {
      clearTimeout(closeTimer);
      closeTimer = setTimeout(() => {
        item.classList.remove('dropdown-open');
        const btn = item.querySelector('.nav-link');
        if (btn) btn.setAttribute('aria-expanded', 'false');
        if (currentlyOpenItem === item) currentlyOpenItem = null;
      }, HOVER_CLOSE_DELAY);
    }
  }

  dropdownNavItems.forEach(item => {
    const btn = item.querySelector('.nav-link');
    const dropdown = item.querySelector('.dropdown');
    if (!dropdown) return;

    // Toggle on click for touchscreen or click interaction
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (item.classList.contains('dropdown-open')) {
          closeDropdown(item, true);
        } else {
          openDropdown(item);
        }
      });
    }

    // Hover intent: Wait HOVER_OPEN_DELAY ms before opening to avoid accidental triggers
    item.addEventListener('mouseenter', () => {
      clearTimeout(closeTimer);
      clearTimeout(openTimer);

      if (currentlyOpenItem && currentlyOpenItem !== item) {
        // Switch faster if another dropdown is already open
        openTimer = setTimeout(() => openDropdown(item), 60);
      } else {
        openTimer = setTimeout(() => openDropdown(item), HOVER_OPEN_DELAY);
      }
    });

    // Grace delay: Wait HOVER_CLOSE_DELAY ms before closing when mouse leaves
    item.addEventListener('mouseleave', () => {
      clearTimeout(openTimer);
      closeDropdown(item, false);
    });

    // Accessibility: Open on focusin (tabbing with keyboard)
    item.addEventListener('focusin', () => {
      clearTimeout(closeTimer);
      clearTimeout(openTimer);
      openDropdown(item);
    });

    // Accessibility: Close on focusout when focus exits the item container
    item.addEventListener('focusout', (e) => {
      if (!item.contains(e.relatedTarget)) {
        closeDropdown(item, true);
      }
    });
  });

  // Close all open dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-item.has-dropdown')) {
      dropdownNavItems.forEach(el => closeDropdown(el, true));
    }
  });

  // Close all open dropdowns when pressing Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      clearTimeout(openTimer);
      clearTimeout(closeTimer);
      dropdownNavItems.forEach(el => closeDropdown(el, true));
    }
  });

  /* ---- Feature Tabs (Static Click Interaction) ---- */
  const featureTabs    = document.querySelectorAll('[data-tab]');
  const featurePanels  = document.querySelectorAll('.tab-content');

  function activateTab(targetKey) {
    // Update tab buttons
    featureTabs.forEach(t => {
      const isActive = t.dataset.tab === targetKey;
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    // Update panels statically
    featurePanels.forEach(panel => {
      const match = panel.id === `tab-${targetKey}-panel`;
      if (match) {
        panel.classList.remove('hidden');
        panel.style.display = 'block';
      } else {
        panel.classList.add('hidden');
        panel.style.display = 'none';
      }
    });
  }

  // Wire click handlers
  featureTabs.forEach(tab => {
    tab.addEventListener('click', () => activateTab(tab.dataset.tab));
  });

  // Activate first tab by default
  activateTab('hazmat');



  /* ---- FAQ Accordion ---- */
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const btn = item.querySelector('.faq-q');
    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      // Close all
      faqItems.forEach(i => {
        i.classList.remove('open');
        i.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
      });
      // Toggle clicked
      if (!isOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* ---- Stat numbers display statically ---- */
  const statNums = document.querySelectorAll('.stat-num[data-target]');
  statNums.forEach(el => {
    const target = parseInt(el.dataset.target, 10);
    if (!isNaN(target)) el.textContent = target;
  });

  /* ---- Smooth anchor scroll ---- */
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const offset = nav ? nav.offsetHeight + 16 : 80;
        const top    = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });



  /* ---- Live Snapshot (Static Values) ---- */
  const pctEl = document.getElementById('pctNum');
  const vesselsEl = document.getElementById('statVessels');
  const itemsEl = document.getElementById('statItems');
  const reportsEl = document.getElementById('statReports');
  const tickerEl = document.getElementById('tickerText');

  if (pctEl) pctEl.textContent = '92';
  if (vesselsEl) vesselsEl.textContent = '512';
  if (itemsEl) itemsEl.textContent = '18,400';
  if (reportsEl) reportsEl.textContent = '1,240';
  if (tickerEl) tickerEl.textContent = 'Generating class-ready compliance reports for DNV, LR, ABS & BV.';

  // Toast Helper
  function showToast(msg, duration = 3000) {
    const existing = document.querySelector('.login-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'login-toast';
    toast.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      <span>${msg}</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, duration);
  }



})();





