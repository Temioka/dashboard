const AnimationConfig = {
    particles: {
        count: 30, 
        minSize: 25,
        maxSize: 50,
        colors: [
            'rgba(255, 165, 0, 0.65)',
            'rgba(255, 140, 0, 0.70)',
            'rgba(255, 99, 71, 0.65)',
            'rgba(255, 69, 0, 0.75)',
            'rgba(255, 215, 0, 0.60)'
        ],
        types: {
            circle: 0.9,  // Увеличен шанс круглых частиц (с 0.8 до 0.9)
            square: 0.1,  // 10% chance
            triangle: 0, // Убраны треугольники (они ресурсоёмки)
            glass: 0     // Убраны стеклянные эффекты (они ресурсоёмки)
        },
        animation: {
            minDuration: 45, // Увеличено время анимации с 30 до 45
            maxDuration: 60, // Увеличено с 45 до 60
            easing: 'linear' // Самая эффективная функция плавности
        }
    },
    effects: {
        parallax: {
            depth: 4, // Уменьшена глубина (с 6 до 4)
            intensity: 15, // Снижена интенсивность (с 25 до 15)
            transitionSpeed: '1.5s' // Увеличена плавность
        },
        ripple: {
            duration: 1000, // Уменьшено время (с 1500 до 1000)
            easing: 'ease-out'
        }
    },
    refreshInterval: 300000,  // 5 minutes - значительно увеличен интервал обновления (с 2 до 5 минут)
    performance: {
        useSimpleRendering: true, // Использовать упрощенный рендеринг
        disableEffectsOnMobile: true, // Отключать эффекты на мобильных устройствах
        limitActiveAnimations: true, // Ограничить количество одновременных анимаций
        maxActiveAnimations: 2, // Уменьшено с 3 до 2
        useRequestIdleCallback: true, // Добавлена опция использования requestIdleCallback
        disableOnLowFPS: true // Добавлена опция отключения анимаций при низком FPS
    }
};

/**
 * Main animation controller class
 */
class ParticleAnimator {
    constructor() {
        this.backgroundElement = null;
        this.particles = [];
        this.isInitialized = false;
        this.frameId = null;
        this.isMobile = window.innerWidth < 768;
        this.isLowPerformance = false; // Определяем при инициализации
        this.activeAnimations = 0;
        this.maxActiveAnimations = AnimationConfig.performance.maxActiveAnimations || 2;
        this.lastInteractionTime = Date.now();
        this.isIdle = false;
        this.isPaused = false;
        
        // Добавляем трекер FPS
        this.fpsCounter = {
            startTime: 0,
            frameCount: 0,
            currentFps: 60,
            threshold: 30, // Порог FPS, ниже которого считается низкой производительностью
            checkInterval: 2000 // Проверяем FPS каждые 2 секунды
        };
    }

    initialize() {
        // Определяем поддержку аппаратного ускорения и возможности устройства
        this.detectDeviceCapabilities();
        
        // Создаем фоновый элемент с улучшенными настройками
        this.createBackgroundElement();
        
        // Создаем частицы эффективно и с учетом производительности
        this.createOptimizedParticles();
        
        // Устанавливаем оптимизированные обработчики событий
        this.setupOptimizedEventListeners();
        
        // Запускаем эффекты только при хорошей производительности и не на мобильных устройствах
        if (!this.isLowPerformance && !(this.isMobile && AnimationConfig.performance.disableEffectsOnMobile)) {
            this.initializeMinimalEffects();
        }
        
        // Используем улучшенный интервал обновления
        this.setupAdaptiveRefresh();
        
        this.isInitialized = true;
        
        // Добавляем отслеживание бездействия и производительности
        this.setupIdleDetection();
        this.setupPerformanceMonitoring();
        
        // При загрузке страницы - постепенное появление анимации
        this.fadeInAnimation();
    }

    detectDeviceCapabilities() {
        // Проверка мобильного устройства
        this.isMobile = window.innerWidth < 768 || 
                       /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // Определяем уровень производительности устройства
        const canvas = document.createElement('canvas');
        let gl;
        
        try {
            gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        } catch (e) {
            this.isLowPerformance = true;
        }
        
        if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                // Проверяем, не содержит ли название рендерера намеков на слабую графику
                this.isLowPerformance = /(Intel|Basic|Microsoft|SwiftShader)/i.test(renderer);
            }
        } else {
            this.isLowPerformance = true;
        }
        
        // Учитываем сенсорные устройства как потенциально менее производительные
        if ('ontouchstart' in window) {
            this.isLowPerformance = true;
        }
        
        console.log(`Device detected as: ${this.isMobile ? 'mobile' : 'desktop'}, performance: ${this.isLowPerformance ? 'low' : 'high'}`);
    }

    setupPerformanceMonitoring() {
        // Инициализация мониторинга FPS
        this.fpsCounter.startTime = performance.now();
        
        const checkPerformance = () => {
            // Обновляем счетчик FPS
            const now = performance.now();
            const elapsed = now - this.fpsCounter.startTime;
            
            if (elapsed >= this.fpsCounter.checkInterval) {
                this.fpsCounter.currentFps = Math.round((this.fpsCounter.frameCount * 1000) / elapsed);
                
                // Если FPS низкий и включена опция отключения при низком FPS
                if (AnimationConfig.performance.disableOnLowFPS && 
                    this.fpsCounter.currentFps < this.fpsCounter.threshold && 
                    !this.isPaused) {
                    this.pauseAllAnimations();
                    this.isPaused = true;
                    console.log(`Animations paused due to low FPS: ${this.fpsCounter.currentFps}`);
                } 
                // Если FPS восстановился и анимации были на паузе
                else if (this.isPaused && this.fpsCounter.currentFps > this.fpsCounter.threshold) {
                    this.resumeAllAnimations();
                    this.isPaused = false;
                    console.log(`Animations resumed, FPS: ${this.fpsCounter.currentFps}`);
                }
                
                // Сбрасываем счетчик
                this.fpsCounter.frameCount = 0;
                this.fpsCounter.startTime = now;
            } else {
                this.fpsCounter.frameCount++;
            }
            
            // Продолжаем мониторинг, но с ограничением частоты вызовов
            if (!this.isPaused) {
                this.frameId = requestAnimationFrame(checkPerformance);
            } else {
                // При паузе проверяем реже
                setTimeout(() => {
                    this.frameId = requestAnimationFrame(checkPerformance);
                }, 1000);
            }
        };
        
        this.frameId = requestAnimationFrame(checkPerformance);
    }

    pauseAllAnimations() {
        // Приостанавливаем все анимации для экономии ресурсов
        this.particles.forEach(particle => {
            particle.style.animationPlayState = 'paused';
            particle.style.transitionDuration = '0s';
        });
        
        // Уменьшаем непрозрачность для визуальной индикации
        this.backgroundElement.style.opacity = '0.5';
    }

    resumeAllAnimations() {
        // Возобновляем анимации
        this.backgroundElement.style.opacity = '1';
        
        this.particles.forEach(particle => {
            particle.style.animationPlayState = 'running';
            particle.style.transitionDuration = '';
        });
    }

    fadeInAnimation() {
        // Плавное появление анимации при загрузке страницы
        this.backgroundElement.style.opacity = '0';
        
        // Используем requestAnimationFrame для оптимальной анимации
        requestAnimationFrame(() => {
            this.backgroundElement.style.transition = 'opacity 1.5s ease-in';
            this.backgroundElement.style.opacity = '1';
        });
    }

    createBackgroundElement() {
        let background = document.querySelector('.animated-background');
        if (!background) {
            background = document.createElement('div');
            background.className = 'animated-background';
            document.body.insertBefore(background, document.body.firstChild);
            
            // Оптимизированные CSS-свойства для GPU-ускорения
            background.style.perspective = '1000px';
            background.style.perspectiveOrigin = 'center center';
            background.style.transform = 'translateZ(0)';
            background.style.backfaceVisibility = 'hidden';
            
            // Используем композитное свойство вместо отдельных will-change
            background.style.willChange = 'transform, opacity';
            
            // Добавляем атрибут для отслеживания производительности
            background.setAttribute('data-fps', '60');
        }
        this.backgroundElement = background;
    }

    createOptimizedParticles() {
        if (this.backgroundElement) {
            this.backgroundElement.innerHTML = '';
        }
        this.particles = [];
        
        // Адаптируем количество частиц в зависимости от производительности устройства
        let particleCount = AnimationConfig.particles.count;
        
        if (this.isLowPerformance) {
            particleCount = Math.floor(particleCount * 0.5); // 50% от изначального количества
        } else if (this.isMobile) {
            particleCount = Math.floor(particleCount * 0.7); // 70% от изначального количества
        }
        
        // Используем документальный фрагмент для оптимизации вставки DOM
        const fragment = document.createDocumentFragment();
        
        // Создаем частицы с оптимальной задержкой
        const createWithDelay = (i) => {
            if (i >= particleCount) return;
            
            const particle = this.createOptimizedParticle();
            fragment.appendChild(particle);
            this.particles.push(particle);
            
            // Используем setTimeout только для небольшого количества частиц
            // или requestIdleCallback, если доступно и включено
            if (i < particleCount - 1) {
                if (AnimationConfig.performance.useRequestIdleCallback && window.requestIdleCallback) {
                    window.requestIdleCallback(() => createWithDelay(i + 1), { timeout: 100 });
                } else {
                    setTimeout(() => createWithDelay(i + 1), i < 5 ? 50 : 0);
                }
            } else {
                // Добавляем все созданные частицы в DOM за один раз
                this.backgroundElement.appendChild(fragment);
            }
        };
        
        createWithDelay(0);
    }

    createOptimizedParticle() {
        const particle = document.createElement('div');
        const config = AnimationConfig.particles;
        
        // Упрощаем выбор типа частицы - только круги и квадраты
        const isCircle = Math.random() < config.types.circle;
        particle.className = isCircle ? 'particle' : 'particle square';
        
        // Оптимизированные размеры и позиции
        const size = config.minSize + Math.random() * (config.maxSize - config.minSize);
        const xPos = Math.random() * 100;
        const yPos = Math.random() * 100;
        const color = config.colors[Math.floor(Math.random() * config.colors.length)];
        
        // Используем меньшую глубину для параллакса
        const depth = Math.random() * (this.isLowPerformance ? 2 : AnimationConfig.effects.parallax.depth);
        
        // Устанавливаем базовые стили
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${xPos}%`;
        particle.style.top = `${yPos}%`;
        particle.style.backgroundColor = color;
        particle.style.opacity = `${0.3 + Math.random() * 0.4}`; // Немного меньше максимальная непрозрачность
        
        // Оптимизированная трансформация
        if (this.isLowPerformance || AnimationConfig.performance.useSimpleRendering) {
            particle.style.transform = `translate(0, 0) rotate(${Math.random() * 360}deg)`;
        } else {
            particle.style.transform = `translate3d(0, 0, ${depth * 30}px) rotate(${Math.random() * 360}deg)`;
            particle.style.willChange = 'transform, opacity';
        }
        
        // Используем более долгие и редкие анимации
        particle.style.animationDuration = `${config.animation.minDuration + Math.random() * 
            (config.animation.maxDuration - config.animation.minDuration)}s`;
        particle.style.animationTimingFunction = config.animation.easing;
        particle.style.animationDelay = `${Math.random() * config.animation.minDuration * 0.5}s`;
        particle.style.setProperty('--depth', depth.toFixed(2));
        
        // Полностью убираем тени для улучшения производительности
        return particle;
    }

    setupOptimizedEventListeners() {
        // Используем технику throttle для событий мыши
        let lastMouseMoveTime = 0;
        let lastMouseX = 0;
        let lastMouseY = 0;
        const mouseMoveThrottle = 50; // миллисекунды между обновлениями (увеличено для оптимизации)

        const handleMouseMove = (e) => {
            const now = Date.now();
            
            // Пропускаем обработку событий, если анимация приостановлена
            if (this.isPaused) return;
            
            // Throttle для обработки движения мыши
            if (now - lastMouseMoveTime > mouseMoveThrottle) {
                lastMouseX = e.clientX / window.innerWidth;
                lastMouseY = e.clientY / window.innerHeight;
                lastMouseMoveTime = now;
                
                // Используем requestAnimationFrame для синхронизации с отрисовкой
                if (!this.isLowPerformance) {
                    requestAnimationFrame(() => {
                        this.updateParallaxEffect(lastMouseX, lastMouseY);
                    });
                }
            }
        };

        // Throttle для прокрутки
        let lastScrollTime = 0;
        let lastScrollY = 0;
        const scrollThrottle = 100; // миллисекунды между обновлениями

        const handleScroll = () => {
            const now = Date.now();
            
            // Пропускаем обработку при паузе
            if (this.isPaused) return;
            
            if (now - lastScrollTime > scrollThrottle) {
                lastScrollY = window.scrollY;
                lastScrollTime = now;
                
                // Обновляем только при хорошей производительности
                if (!this.isLowPerformance) {
                    requestAnimationFrame(() => {
                        this.updateScrollEffect(lastScrollY);
                    });
                }
            }
        };

        // Оптимизированная обработка кликов
        let lastClickTime = 0;
        const clickThrottle = 500; // миллисекунды между эффектами клика
        
        const handleClick = (e) => {
            const now = Date.now();
            
            // Пропускаем при паузе
            if (this.isPaused) return;
            
            if (now - lastClickTime > clickThrottle && 
                this.activeAnimations < this.maxActiveAnimations) {
                lastClickTime = now;
                
                // Создаем эффект клика с задержкой для лучшей производительности
                setTimeout(() => {
                    this.createSimpleRippleEffect(e.clientX, e.clientY);
                }, 10);
            }
        };

        // Ограничиваем обработку событий движения мыши для мобильных
        if (!this.isMobile && !this.isLowPerformance) {
            // Используем passive: true для оптимизации обработчиков
            document.addEventListener('mousemove', handleMouseMove, { passive: true });
        }
        
        window.addEventListener('scroll', handleScroll, { passive: true });
        
        // Обработчик клика только при хорошей производительности
        if (!this.isLowPerformance) {
            document.addEventListener('click', handleClick, { passive: true });
        }
        
        // Оптимизация обработчика изменения размера окна с debounce
        let resizeTimeout;
        window.addEventListener('resize', () => {
            // Отменяем предыдущий таймаут
            clearTimeout(resizeTimeout);
            
            // Устанавливаем новый с большей задержкой
            resizeTimeout = setTimeout(() => {
                this.isMobile = window.innerWidth < 768;
                
                // Проверка производительности при изменении размера
                this.detectDeviceCapabilities();
                
                // Оптимизированная обработка изменения размера
                this.handleResizeOptimized();
            }, 500); // Увеличенная задержка debounce
        }, { passive: true });
        
        // Обработка видимости страницы для оптимизации
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Страница не активна - приостанавливаем анимации
                this.pauseAllAnimations();
            } else {
                // Страница снова активна - возобновляем анимации
                this.resumeAllAnimations();
            }
        });
    }

    updateParallaxEffect(mouseX, mouseY) {
        // Пропускаем эффект при низкой производительности
        if (this.isLowPerformance || this.isPaused) return;
        
        const { intensity, transitionSpeed } = AnimationConfig.effects.parallax;
        
        // Обрабатываем только часть частиц для оптимизации
        const step = this.isMobile ? 4 : 2; // Обрабатываем только каждую вторую/четвертую частицу
        
        for (let i = 0; i < this.particles.length; i += step) {
            const particle = this.particles[i];
            if (!particle) continue;
            
            const depth = parseFloat(particle.style.getPropertyValue('--depth') || 1);
            
            // Уменьшенные смещения для лучшей производительности
            const offsetX = (mouseX - 0.5) * intensity * depth * 0.7;
            const offsetY = (mouseY - 0.5) * intensity * depth * 0.7;
            
            // Более плавный переход
            particle.style.transition = `transform ${transitionSpeed} ${AnimationConfig.particles.animation.easing}`;
            
            // Упрощенные трансформации для лучшей производительности
            particle.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
        }
    }

    updateScrollEffect(scrollY) {
        // Пропускаем эффект при низкой производительности
        if (this.isLowPerformance || this.isPaused) return;
        
        // Обрабатываем только каждую 4-ю частицу для лучшей производительности
        for (let i = 0; i < this.particles.length; i += 4) {
            const particle = this.particles[i];
            if (!particle) continue;
            
            const depth = parseFloat(particle.style.getPropertyValue('--depth') || 1);
            const speed = depth * 0.05; // Замедленный эффект
            
            // Более простая реализация
            const currentTransform = particle.style.transform;
            const translateY = scrollY * speed;
            
            // Обновляем только Y-компонент
            if (currentTransform.includes('translate3d')) {
                const matches = currentTransform.match(/translate3d\(([^,]+),\s*([^,]+),\s*([^)]+)\)/);
                if (matches && matches.length === 4) {
                    const x = matches[1];
                    const z = matches[3];
                    particle.style.transform = `translate3d(${x}, ${translateY}px, ${z}`;
                }
            } else if (currentTransform.includes('translate')) {
                const matches = currentTransform.match(/translate\(([^,]+),\s*([^)]+)\)/);
                if (matches && matches.length === 3) {
                    const x = matches[1];
                    particle.style.transform = `translate(${x}, ${translateY}px)`;
                }
            }
        }
    }
    
    handleResizeOptimized() {
        // При изменении размера окна выполняем минимальные изменения
        // вместо полной перерисовки для экономии ресурсов
        
        // Корректируем количество видимых частиц в зависимости от размера экрана
        const visibilityThreshold = this.isMobile ? 0.5 : 0.7;
        
        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            
            // Скрываем часть частиц на маленьких экранах
            if (this.isMobile && Math.random() > visibilityThreshold) {
                particle.style.display = 'none';
            } else {
                particle.style.display = '';
                
                // Обновляем позиции только для некоторых частиц
                if (i % 3 === 0) {
                    // Обновляем только горизонтальную позицию для оптимизации
                    particle.style.left = `${Math.random() * 100}%`;
                }
            }
        }
    }

    createSimpleRippleEffect(x, y) {
        // Увеличиваем счетчик активных анимаций
        this.activeAnimations++;
        
        const config = AnimationConfig.effects.ripple;
        const ripple = document.createElement('div');
        ripple.className = 'ripple';
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        
        // Упрощенный градиент для экономии ресурсов
        ripple.style.background = 'radial-gradient(circle, rgba(255, 165, 0, 0.6) 0%, rgba(255, 69, 0, 0) 70%)';
        
        document.body.appendChild(ripple);
        
        // Используем более простые анимации
        const duration = this.isMobile || this.isLowPerformance ? 
            config.duration * 0.6 : config.duration;
        const scale = this.isMobile || this.isLowPerformance ? 5 : 8;
        
        // Используем оптимизированную анимацию Web Animation API
        const mainAnimation = ripple.animate(
            [
                { transform: 'translate(-50%, -50%) scale(0.1)', opacity: 0.7 },
                { transform: `translate(-50%, -50%) scale(${scale})`, opacity: 0 }
            ],
            {
                duration: duration,
                easing: config.easing
            }
        );

        mainAnimation.onfinish = () => {
            ripple.remove();
            this.activeAnimations--;
        };
    }

    setupIdleDetection() {
        // Увеличенное время бездействия для снижения нагрузки
        const idleTime = 45000; // 45 секунд бездействия
        
        const resetIdleTimer = () => {
            if (this.isPaused) return; // Не сбрасываем, если анимация на паузе
            
            this.lastInteractionTime = Date.now();
            
            // Если анимации были приостановлены из-за бездействия, возобновим их
            if (this.isIdle) {
                this.isIdle = false;
                this.reduceIdleAnimations(false);
            }
        };
        
        // Отслеживаем действия пользователя с оптимизацией
        const events = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll'];
        
        // Throttled handler для действий пользователя
        let lastHandledInteraction = 0;
        const interactionThrottle = 500; // Обрабатываем только каждые 500мс
        
        const throttledResetIdleTimer = () => {
            const now = Date.now();
            if (now - lastHandledInteraction > interactionThrottle) {
                lastHandledInteraction = now;
                resetIdleTimer();
            }
        };
        
        events.forEach(event => {
            document.addEventListener(event, throttledResetIdleTimer, { passive: true });
        });
        
        // Проверка бездействия с увеличенным интервалом
        setInterval(() => {
            if (!this.isPaused && !this.isIdle && 
                Date.now() - this.lastInteractionTime > idleTime) {
                this.isIdle = true;
                this.reduceIdleAnimations(true);
            }
        }, 10000); // Проверяем реже
    }
    
    reduceIdleAnimations(reduce) {
        if (reduce) {
            // Приостанавливаем большую часть анимаций в режиме бездействия
            this.particles.forEach((particle, index) => {
                // Оставляем активными только каждую 4-ю частицу
                if (index % 4 !== 0) {
                    particle.style.animationPlayState = 'paused';
                    // Уменьшаем непрозрачность для визуального эффекта
                    particle.style.opacity = parseFloat(particle.style.opacity) * 0.6;
                }
            });
            console.log('Idle mode activated: reduced animations');
        } else {
            // Возобновляем анимации
            this.particles.forEach(particle => {
                particle.style.animationPlayState = 'running';
                // Восстанавливаем исходную непрозрачность
                const originalOpacity = parseFloat(particle.style.opacity) / 0.6;
                particle.style.opacity = Math.min(originalOpacity, 0.7).toString();
            });
            console.log('Idle mode deactivated: restored animations');
        }
    }

    initializeMinimalEffects() {
        // Добавляем минимум дополнительных эффектов
        if (!this.isMobile && !this.isLowPerformance) {
            this.createMinimalAmbientEffects();
        }
        
        // Планируем случайные простые эффекты для оживления анимации
        this.scheduleMinimalRandomEffects();
    }
    
    createMinimalAmbientEffects() {
        // Создаем очень ограниченное количество фоновых эффектов
        const count = 3; // Сильно уменьшенное количество (было 8-12)
        
        for (let i = 0; i < count; i++) {
            const particle = document.createElement('div');
            particle.className = 'ambient-particle';
            const size = 60 + Math.random() * 80;
            const xPos = Math.random() * 100;
            const yPos = Math.random() * 100;
            
            // Создаем очень легкие эффекты без фильтров размытия
            const opacity = 0.04 + Math.random() * 0.08; // Значительно меньшая непрозрачность
            
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            particle.style.left = `${xPos}%`;
            particle.style.top = `${yPos}%`;
            
            // Упрощенный градиент без размытия
            particle.style.background = `radial-gradient(circle, rgba(255, 215, 0, ${opacity}) 0%, 
                                                       rgba(255, 165, 0, ${opacity * 0.6}) 50%, 
                                                       rgba(255, 69, 0, 0) 100%)`;
            
            // Полностью убираем фильтр размытия
            particle.style.opacity = '0.4';
            particle.style.borderRadius = '50%';
            particle.style.zIndex = '-1';
            particle.style.transition = 'transform 60s ease-in-out'; // Очень медленный переход
            
            this.backgroundElement.appendChild(particle);
            
            // Обновляем позицию очень редко
            setInterval(() => {
                // Проверяем, не поставлена ли анимация на паузу
                if (this.isPaused || this.isIdle) return;
                
                const newX = -15 + Math.random() * 30;
                const newY = -15 + Math.random() * 30;
                
                particle.style.transform = `translate(${newX}px, ${newY}px)`;
            }, 40000 + Math.random() * 20000); // Очень редкие обновления
        }
    }
    
    scheduleMinimalRandomEffects() {
        let nextEffectTime = 10000; // Начинаем с большей задержки
        let effectScheduler;
        
        // Функция для планирования следующего эффекта
        const scheduleNextEffect = () => {
            // Если в режиме ожидания или низкой производительности, увеличиваем интервал
            const intervalMultiplier = (this.isIdle || this.isPaused || this.isLowPerformance) ? 6 : 1;
            nextEffectTime = (8000 + Math.random() * 12000) * intervalMultiplier;
            
            clearTimeout(effectScheduler);
            effectScheduler = setTimeout(() => {
                // Проверяем состояние страницы и производительности
                if (!document.hidden && !this.isPaused && this.activeAnimations < this.maxActiveAnimations) {
                    // Очень редкие упрощенные эффекты
                    if (Math.random() > 0.85) {
                        this.createSimpleFloatingParticle();
                    }
                }
                
                // Планируем следующий эффект
                scheduleNextEffect();
            }, nextEffectTime);
        };
        
        scheduleNextEffect();
    }
    
    createSimpleFloatingParticle() {
        // Увеличиваем счетчик активных анимаций
        this.activeAnimations++;
        
        const particle = document.createElement('div');
        particle.className = 'floating-particle';
        const size = 3 + Math.random() * 4; // Меньше размер для лучшей производительности
        const xPos = Math.random() * 100;
        
        // Только самые простые круглые частицы
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.backgroundColor = 'rgba(255, 165, 0, 0.7)';
        particle.style.borderRadius = '50%';
        
        particle.style.left = `${xPos}%`;
        particle.style.top = '105%';
        
        // Убираем тени полностью
        this.backgroundElement.appendChild(particle);
        
        // Очень простая анимация
        const keyframes = [
            { 
                transform: 'translate(0, 0)', 
                opacity: 0,
                offset: 0 
            },
            { 
                transform: 'translate(0, -300px)', 
                opacity: 0.7,
                offset: 0.3
            },
            { 
                transform: 'translate(0, -800px)', 
                opacity: 0,
                offset: 1 
            }
        ];
        
        const duration = 12000 + Math.random() * 8000; // Более долгая анимация
        
        particle.animate(
            keyframes, 
            {
                duration: duration,
                easing: 'linear',
                fill: 'forwards'
            }
        ).onfinish = () => {
            particle.remove();
            this.activeAnimations--;
        };
    }
    
    setupAdaptiveRefresh() {
        // Используем адаптивное планирование обновления частиц
        // В зависимости от производительности устройства и активности страницы
        
        // Определяем базовый интервал обновления
        let refreshInterval = AnimationConfig.refreshInterval;
        
        // Если производительность низкая, увеличиваем интервал
        if (this.isLowPerformance) {
            refreshInterval *= 2;
        }
        
        // Настраиваем периодическое обновление
        const scheduleRefresh = () => {
            // Проверяем, активна ли страница
            if (document.hidden) {
                // Если страница не активна, проверяем реже
                setTimeout(scheduleRefresh, refreshInterval * 2);
                return;
            }
            
            // Сокращаем интенсивность обновлений при низкой производительности
            if (this.fpsCounter.currentFps < this.fpsCounter.threshold || this.isPaused) {
                setTimeout(scheduleRefresh, refreshInterval * 2);
                return;
            }
            
            // Выполняем оптимизированное обновление
            this.performOptimizedRefresh();
            
            // Планируем следующее обновление с адаптивным интервалом
            setTimeout(scheduleRefresh, this.isIdle ? refreshInterval * 1.5 : refreshInterval);
        };
        
        // Запускаем планировщик с начальной задержкой
        setTimeout(scheduleRefresh, 60000); // Первое обновление через минуту
    }
    
    performOptimizedRefresh() {
        // Обновляем только небольшую часть частиц для экономии ресурсов
        
        // Определяем процент частиц для обновления
        const refreshRatio = this.isLowPerformance ? 0.1 : 0.15; // 10-15% вместо 20%
        const particlesToRefresh = Math.floor(this.particles.length * refreshRatio);
        
        // Массив индексов для обновления (предварительно перемешан)
        const indices = [];
        for (let i = 0; i < this.particles.length; i++) {
            if (Math.random() < refreshRatio) {
                indices.push(i);
                if (indices.length >= particlesToRefresh) break;
            }
        }
        
        // Последовательное обновление частиц с задержкой
        const updateParticleWithDelay = (index, delay) => {
            setTimeout(() => {
                const particle = this.particles[index];
                if (!particle || !particle.parentNode) return;
                
                // Плавное скрытие
                particle.style.transition = 'opacity 1s ease-out';
                particle.style.opacity = '0';
                
                // Удаление и создание новой частицы
                setTimeout(() => {
                    if (particle && particle.parentNode) {
                        particle.parentNode.removeChild(particle);
                        this.particles[index] = this.createOptimizedParticle();
                        this.backgroundElement.appendChild(this.particles[index]);
                    }
                }, 1000);
            }, delay);
        };
        
        // Обновляем выбранные частицы с интервалом
        indices.forEach((index, i) => {
            // Распределяем обновления по времени для снижения нагрузки
            updateParticleWithDelay(index, i * 100);
        });
    }
    
    // Метод для очистки ресурсов при необходимости
    dispose() {
        // Отменяем все запланированные задачи
        cancelAnimationFrame(this.frameId);
        
        // Удаляем все элементы
        if (this.backgroundElement) {
            this.backgroundElement.innerHTML = '';
        }
        
        // Очищаем массив частиц
        this.particles = [];
        this.isInitialized = false;
        
        console.log('Animation resources cleaned up');
    }
}

// Оптимизированные CSS-стили
document.addEventListener('DOMContentLoaded', function() {
    const style = document.createElement('style');
    style.textContent = 
    document.head.appendChild(style);
    
    // Инициализация анимации с проверкой предпочтений пользователя
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const animator = new ParticleAnimator();
        animator.initialize();
        
        // Сохраняем ссылку на аниматор в глобальной области для возможности управления
        window.particleAnimator = animator;
    }
});

// Функция для проверки производительности и адаптивной настройки
function checkAndOptimizePerformance() {
    if (!window.particleAnimator) return;
    
    const animator = window.particleAnimator;
    
    // Получаем текущий FPS
    const currentFps = animator.fpsCounter.currentFps;
    
    // Если FPS сильно упал, применяем более агрессивные оптимизации
    if (currentFps < 20 && !animator.isLowPerformance) {
        console.log('Performance issues detected. Applying aggressive optimizations.');
        animator.isLowPerformance = true;
        
        // Уменьшаем количество видимых частиц вдвое
        animator.particles.forEach((particle, index) => {
            if (index % 2 !== 0) {
                particle.style.display = 'none';
            }
        });
        
        // Отключаем все дополнительные эффекты
        document.querySelectorAll('.ambient-particle, .floating-particle').forEach(el => {
            el.style.display = 'none';
        });
    }
}

// Запускаем проверку производительности периодически
setTimeout(() => {
    setInterval(checkAndOptimizePerformance, 10000);
}, 30000); // Начинаем проверку через 30 секунд после загрузки