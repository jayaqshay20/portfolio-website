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
});