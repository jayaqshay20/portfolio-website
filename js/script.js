document.addEventListener('DOMContentLoaded', function() {
    // Loading screen elements
    const loadingScreen = document.getElementById('loadingScreen');
    const assetCount = document.getElementById('assetCount');
    const progressFill = document.getElementById('progressFill');
    const welcomeSection = document.getElementById('welcomeSection');
    const nav = document.getElementById('nav');
    const barcode = document.getElementById('barcode');

    // Check if loading screen has already been shown in this session
    const hasLoaded = sessionStorage.getItem('hasLoaded');

    // Generate barcode lines if barcode element exists
    if (barcode) {
        for (let i = 0; i < 30; i++) {
            const line = document.createElement('div');
            line.className = 'barcode-line';
            line.style.height = Math.random() * 20 + 10 + 'px';
            barcode.appendChild(line);
        }
    }

    // Loading animation (only on index page and only once per session)
    if (loadingScreen && assetCount && progressFill && welcomeSection && nav) {
        if (hasLoaded) {
            loadingScreen.classList.add('hidden');
            nav.classList.add('visible');
        } else {
            let currentAsset = 0;
            const totalAssets = 20;
            const loadingInterval = setInterval(() => {
                currentAsset++;
                assetCount.textContent = currentAsset;
                progressFill.style.width = (currentAsset / totalAssets * 100) + '%';
                if (currentAsset >= totalAssets) {
                    clearInterval(loadingInterval);
                    welcomeSection.style.opacity = '1';
                    setTimeout(() => {
                        loadingScreen.classList.add('hidden');
                        nav.classList.add('visible');
                        sessionStorage.setItem('hasLoaded', 'true');
                    }, 1500);
                }
            }, 100);
        }
    }

    // Audio functionality with cross-page persistence
    const audio = new Audio();
    audio.src = 'assets/audio/background-music.mp3';
    audio.loop = true;
    audio.volume = 0.3;

    const savedTime = localStorage.getItem('audioCurrentTime');
    if (savedTime) {
        audio.currentTime = parseFloat(savedTime);
    }

    const soundToggle = document.getElementById('soundToggle');
    let soundOn = localStorage.getItem('soundEnabled') === 'true';
    
    if (soundToggle) {
        soundToggle.textContent = `Sound: ${soundOn ? 'On' : 'Off'}`;
        
        if (soundOn) {
            audio.play().catch(error => {
                console.log('Audio playback failed:', error);
                soundOn = false;
                localStorage.setItem('soundEnabled', 'false');
                soundToggle.textContent = 'Sound: Off';
            });
        }
        
        soundToggle.addEventListener('click', () => {
            soundOn = !soundOn;
            soundToggle.textContent = `Sound: ${soundOn ? 'On' : 'Off'}`;
            localStorage.setItem('soundEnabled', soundOn.toString());
            
            if (soundOn) {
                audio.play().catch(error => {
                    console.log('Audio playback failed:', error);
                    soundOn = false;
                    localStorage.setItem('soundEnabled', 'false');
                    soundToggle.textContent = 'Sound: Off';
                });
            } else {
                audio.pause();
            }
        });
    }

    window.addEventListener('beforeunload', () => {
        localStorage.setItem('audioCurrentTime', audio.currentTime.toString());
    });

    setInterval(() => {
        if (!audio.paused) {
            localStorage.setItem('audioCurrentTime', audio.currentTime.toString());
        }
    }, 1000);

    // Water ripple cursor effect for Hand mode with cross-page persistence
    const handToggle = document.getElementById('handToggle');
    let handMode = localStorage.getItem('handModeEnabled') === 'true';
    let lastRippleTime = 0;
    
    const rippleContainer = document.createElement('div');
    rippleContainer.className = 'ripple-container';
    document.body.appendChild(rippleContainer);

    function createRipple(x, y) {
        const ripple = document.createElement('div');
        ripple.className = 'water-ripple';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        rippleContainer.appendChild(ripple);

        setTimeout(() => {
            ripple.remove();
        }, 1000);
    }

    function handleMouseMove(e) {
        const currentTime = Date.now();
        if (currentTime - lastRippleTime > 50) {
            createRipple(e.clientX, e.clientY);
            lastRippleTime = currentTime;
        }
    }

    function enableHandMode() {
        document.body.classList.add('hand-mode-active');
        document.addEventListener('mousemove', handleMouseMove);
    }

    function disableHandMode() {
        document.body.classList.remove('hand-mode-active');
        document.removeEventListener('mousemove', handleMouseMove);
    }

    if (handToggle) {
        handToggle.textContent = `Hand: ${handMode ? 'On' : 'Off'}`;
        
        if (handMode) {
            enableHandMode();
        }
        
        handToggle.addEventListener('click', () => {
            handMode = !handMode;
            handToggle.textContent = `Hand: ${handMode ? 'On' : 'Off'}`;
            localStorage.setItem('handModeEnabled', handMode.toString());
            
            if (handMode) {
                enableHandMode();
            } else {
                disableHandMode();
            }
        });
    }

    // About page sidebar navigation
    const sidebarItems = document.querySelectorAll('.about-sidebar-item');
    const aboutSections = document.querySelectorAll('.about-section[data-section]');

    sidebarItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-target');
            const targetSection = document.querySelector(`.about-section[data-section="${target}"]`);
            
            if (targetSection) {
                targetSection.scrollIntoView({ behavior: 'smooth' });
                
                sidebarItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
            }
        });
    });

    if (aboutSections.length > 0) {
        window.addEventListener('scroll', () => {
            let current = '';
            aboutSections.forEach(section => {
                const sectionTop = section.offsetTop;
                if (scrollY >= sectionTop - 200) {
                    current = section.getAttribute('data-section');
                }
            });
            
            sidebarItems.forEach(item => {
                item.classList.remove('active');
                if (item.getAttribute('data-target') === current) {
                    item.classList.add('active');
                }
            });
        });
    }

    // Navigation active state on scroll
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.section');

    if (sections.length > 0 && navLinks.length > 0) {
        window.addEventListener('scroll', () => {
            let current = '';
            sections.forEach(section => {
                const sectionTop = section.offsetTop;
                const sectionHeight = section.clientHeight;
                if (scrollY >= sectionTop - sectionHeight / 3) {
                    current = section.getAttribute('id');
                }
            });
            navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('data-section') === current) {
                    link.classList.add('active');
                }
            });
        });
    }

    // Smooth scroll for navigation links
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href.startsWith('#')) {
                e.preventDefault();
                const targetId = href;
                const targetSection = document.querySelector(targetId);
                if (targetSection) {
                    targetSection.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    });
    
    // Intersection Observer for work items animation
    const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' };
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    document.querySelectorAll('.work-item').forEach(item => {
        item.style.opacity = '0';
        item.style.transform = 'translateY(30px)';
        item.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(item);
    });

    document.querySelectorAll('.artwork-item').forEach((item, index) => {
        item.style.opacity = '0';
        item.style.transform = 'translateY(20px)';
        item.style.transition = `opacity 0.5s ease ${index * 0.05}s, transform 0.5s ease ${index * 0.05}s`;
        observer.observe(item);
    });

    // Artwork lightbox: click an artwork to view the full design
    const artworks = [...document.querySelectorAll('.artwork-item')];
    if (artworks.length) {
        const box = document.createElement('div');
        box.className = 'lightbox';
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-modal', 'true');
        box.setAttribute('aria-label', 'Artwork viewer');
        box.innerHTML = `
            <div class="lightbox-bar">
                <span class="lightbox-count"></span>
                <button type="button" class="lightbox-btn lightbox-close" aria-label="Close">CLOSE ✕</button>
            </div>
            <div class="lightbox-stage">
                <button type="button" class="lightbox-btn lightbox-prev" aria-label="Previous artwork">←</button>
                <img class="lightbox-img" alt="">
                <button type="button" class="lightbox-btn lightbox-next" aria-label="Next artwork">→</button>
            </div>
            <div class="lightbox-caption">
                <span class="artwork-category"></span>
                <span class="artwork-name"></span>
            </div>`;
        document.body.appendChild(box);

        const img = box.querySelector('.lightbox-img');
        const count = box.querySelector('.lightbox-count');
        const category = box.querySelector('.lightbox-caption .artwork-category');
        const name = box.querySelector('.lightbox-caption .artwork-name');
        let current = 0;
        let lastFocus = null;

        const show = (index) => {
            current = (index + artworks.length) % artworks.length;
            const item = artworks[current];
            const source = item.querySelector('img');
            img.classList.add('swapping');
            setTimeout(() => {
                img.src = source.src;
                img.alt = source.alt;
                img.classList.remove('swapping');
            }, box.classList.contains('open') ? 200 : 0);
            category.textContent = item.querySelector('.artwork-category')?.textContent ?? '';
            name.textContent = item.querySelector('.artwork-name')?.textContent ?? source.alt;
            count.textContent = `${String(current + 1).padStart(2, '0')} / ${String(artworks.length).padStart(2, '0')}`;
        };

        const open = (index) => {
            lastFocus = document.activeElement;
            show(index);
            box.classList.add('open');
            document.body.style.overflow = 'hidden';
            box.querySelector('.lightbox-close').focus();
        };

        const close = () => {
            box.classList.remove('open');
            document.body.style.overflow = '';
            lastFocus?.focus();
        };

        artworks.forEach((item, index) => {
            item.setAttribute('role', 'button');
            item.setAttribute('tabindex', '0');
            item.setAttribute('aria-label', `View ${item.querySelector('img')?.alt ?? 'artwork'}`);
            item.addEventListener('click', () => open(index));
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(index); }
            });
        });

        box.querySelector('.lightbox-close').addEventListener('click', close);
        box.querySelector('.lightbox-prev').addEventListener('click', () => show(current - 1));
        box.querySelector('.lightbox-next').addEventListener('click', () => show(current + 1));
        // clicking the dark backdrop (not the image or buttons) closes the viewer
        box.addEventListener('click', (e) => {
            if (e.target === box || e.target.classList.contains('lightbox-stage')) close();
        });
        document.addEventListener('keydown', (e) => {
            if (!box.classList.contains('open')) return;
            if (e.key === 'Escape') close();
            if (e.key === 'ArrowLeft') show(current - 1);
            if (e.key === 'ArrowRight') show(current + 1);
        });
    }
});