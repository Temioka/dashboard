// Улучшенный скрипт для работы с тенями и фиксированными колонками в таблицах
document.addEventListener('DOMContentLoaded', function() {

    const tableContainers = document.querySelectorAll('.table-responsive');
    const tablesData = []; // Массив для хранения пар контейнер/таблица
    let resizeTimeout; // Для debounce обработчика resize

    /**
     * Обновляет классы is-scrolled и is-scrolled-x в зависимости от позиции скролла.
     * @param {Element} container - Элемент контейнера таблицы.
     */
    function updateScrollState(container) {
        // Добавляем/удаляем класс для тени сверху (вертикальный скролл)
        container.classList.toggle('is-scrolled', container.scrollTop > 0);
        // Добавляем/удаляем класс для тени слева (горизонтальный скролл)
        container.classList.toggle('is-scrolled-x', container.scrollLeft > 0);
    }

    /**
     * Проверяет, нужна ли фиксация первой колонки, и обновляет класс.
     * @param {Element} container - Элемент контейнера таблицы.
     * @param {Element} table - Элемент таблицы внутри контейнера.
     */
    function updateFixedColumnState(container, table) {
        if (!table) return;
        // Добавляем/удаляем класс, если таблица шире контейнера
        container.classList.toggle('with-fixed-column', table.offsetWidth > container.offsetWidth);
    }

    /**
     * Обновляет состояние фиксированной колонки для всех таблиц.
     */
    function checkAllFixedColumns() {
        tablesData.forEach(({ container, table }) => {
            updateFixedColumnState(container, table);
        });
    }

    // --- Инициализация и настройка слушателей ---

    tableContainers.forEach(container => {
        const table = container.querySelector('table');
        
        // Пропускаем контейнеры без таблиц внутри
        if (!table) {
            console.warn('Найден .table-responsive без <table> внутри:', container);
            return; 
        }

        // Сохраняем пару для обработчика resize
        tablesData.push({ container, table });

        // 1. Добавляем слушатель скролла для каждого контейнера
        container.addEventListener('scroll', () => {
            updateScrollState(container);
        }, { passive: true }); // Оптимизация: указываем, что не будем отменять скролл

        // 2. Инициализируем начальное состояние скролла и фикс. колонки
        updateScrollState(container);
        updateFixedColumnState(container, table);
    });

    // 3. Добавляем ОДИН слушатель изменения размера окна для ВСЕХ таблиц
    window.addEventListener('resize', () => {
        // Debounce: откладываем выполнение, чтобы не вызывать слишком часто
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(checkAllFixedColumns, 150); // Задержка 150 мс
    });

    // На всякий случай, перепроверим состояние фиксации колонок после небольшой задержки
    // Это может помочь, если стили или шрифты влияют на размер таблицы после DOMContentLoaded
    setTimeout(checkAllFixedColumns, 50); 

});