document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('grid');
    const blocksContainer = document.getElementById('blocks');
    const scoreElement = document.getElementById('score');
    const highScoreElement = document.querySelector('.high-score');
    
    let blockShapes = {};
    let cellSize = 0;
    let isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    let selectedBlockId = null;
    let currentDraggingShape = null;
    let currentDraggingColor = null;
    let currentDraggingSize = null;
    let placementPreview = null;
    let isShowingPreview = false;
    let gridCells = [];
    let touchStartX = 0;
    let touchStartY = 0;
    let touchMoved = false;

    // Инициализация particles.js
    initParticles();

    // Улучшенная функция debounce для предотвращения слишком частых вызовов
    const debounce = (func, wait) => {
        let timeout;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    };

    function initGame() {
        // Очистка всех предыдущих обработчиков событий перед инициализацией
        cleanupEventListeners();
        
        gridCells = GameCore.createGrid(grid, isTouchDevice, {
            dragOver: handleDragOver,
            drop: handleDrop
        });
        cellSize = GameCore.calculateCellSize(grid);
        GameCore.setCellSize(cellSize);
        updateScore(0);
        updateHighScore();
        
        // Анимация появления сетки с помощью GSAP
        gsap.fromTo(grid, 
            { opacity: 0, scale: 0.9 }, 
            { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.7)" }
        );
        
        generateNewBlocks();
        
        setupInputEvents();

        window.addEventListener('resize', debounce(() => {
            cellSize = GameCore.calculateCellSize(grid);
            GameCore.setCellSize(cellSize);
            updateBlockSizes();
        }, 250));
        
        // Проверяем состояние игры сразу после инициализации
        setTimeout(checkGameOver, 500);
    }

    // Функция для очистки обработчиков событий
    function cleanupEventListeners() {
        if (isTouchDevice) {
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        } else {
            document.removeEventListener('dragover', handleGlobalDragOver);
        }
    }

    function setupInputEvents() {
        if (isTouchDevice) {
            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.addEventListener('touchend', handleTouchEnd);
        } else {
            document.addEventListener('dragover', handleGlobalDragOver);
        }
    }

    function handleTouchMove(e) {
        e.preventDefault(); // Предотвращаем прокрутку страницы
        
        if (selectedBlockId === null) return;
        
        const touch = e.touches[0];
        const blockElement = document.querySelector(`.block[data-block-id="${selectedBlockId}"]`);
        if (!blockElement) return; // Добавляем проверку на существование блока
        
        // Снижаем порог перемещения для более отзывчивой реакции
        const moveThreshold = 5; // Уменьшаем порог в пикселях с 10 до 5
        const deltaX = Math.abs(touch.clientX - touchStartX);
        const deltaY = Math.abs(touch.clientY - touchStartY);
        
        if (deltaX > moveThreshold || deltaY > moveThreshold) {
            touchMoved = true;
            
            // Увеличиваем размер блока и добавляем свечение для лучшей визуальной обратной связи
            if (!blockElement.hasAttribute('data-moved')) {
                blockElement.setAttribute('data-moved', 'true');
                // Используем GSAP для плавной анимации
                gsap.to(blockElement, {
                    scale: 1.15, // Увеличиваем масштаб
                    boxShadow: '0 0 25px rgba(255, 255, 255, 0.5)', // Добавляем более яркое свечение
                    duration: 0.2,
                    ease: "power1.out"
                });
                
                // Смещаем блок так, чтобы он был под пальцем пользователя
                const blockRect = blockElement.getBoundingClientRect();
                const offsetX = touch.clientX - (blockRect.left + blockRect.width / 2);
                const offsetY = touch.clientY - (blockRect.top + blockRect.height / 2);
                
                // Устанавливаем перетаскиваемый блок в позицию под пальцем
                blockElement.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(1.15)`;
                blockElement.style.pointerEvents = 'none'; // Отключаем поинтер-события во время перетаскивания
            }
            
            // Перемещаем блок с пальцем пользователя
            const blockRect = blockElement.getBoundingClientRect();
            const offsetX = touch.clientX - touchStartX;
            const offsetY = touch.clientY - touchStartY;
            
            // Применяем смещение с учетом масштаба
            blockElement.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(1.15)`;
        }
        
        // Получаем позицию относительно сетки
        const gridRect = grid.getBoundingClientRect();
        const mouseX = touch.clientX - gridRect.left;
        const mouseY = touch.clientY - gridRect.top;
        
        // Если вышли за пределы сетки, скрываем превью
        if (mouseX < 0 || mouseY < 0 || mouseX > gridRect.width || mouseY > gridRect.height) {
            removePlacementPreview();
            return;
        }
        
        const col = Math.floor(mouseX / cellSize);
        const row = Math.floor(mouseY / cellSize);
        
        if (blockShapes[selectedBlockId]) {
            const shape = blockShapes[selectedBlockId].shape;
            const color = blockShapes[selectedBlockId].color;
            const canPlace = GameCore.checkPlacement(row, col, shape);
            
            // Визуальный отклик на возможность/невозможность размещения
            if (canPlace) {
                if (blockElement.style.boxShadow !== '0 0 25px rgba(0, 255, 0, 0.5)') {
                    gsap.to(blockElement, {
                        boxShadow: '0 0 25px rgba(0, 255, 0, 0.5)', // Зеленое свечение если можно разместить
                        duration: 0.2
                    });
                }
            } else {
                if (blockElement.style.boxShadow !== '0 0 25px rgba(255, 0, 0, 0.5)') {
                    gsap.to(blockElement, {
                        boxShadow: '0 0 25px rgba(255, 0, 0, 0.5)', // Красное свечение если нельзя разместить
                        duration: 0.2
                    });
                }
            }
            
            // Используем requestAnimationFrame для оптимизации производительности
            if (!isShowingPreview) {
                isShowingPreview = true;
                requestAnimationFrame(() => {
                    showPlacementPreview(row, col, shape, color, canPlace);
                    isShowingPreview = false;
                });
            }
        }
    }

    function handleTouchEnd(e) {
        if (selectedBlockId === null) return;
        
        const blockElement = document.querySelector(`.block[data-block-id="${selectedBlockId}"]`);
        if (!blockElement) {
            selectedBlockId = null;
            return;
        }
        
        // Восстанавливаем свойства блока
        blockElement.style.pointerEvents = 'auto';
        blockElement.classList.remove('dragging');
        blockElement.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        blockElement.style.boxShadow = '0 0 10px rgba(255, 255, 255, 0.2)';
        
        // Удаляем атрибут data-moved
        if (blockElement.hasAttribute('data-moved')) {
            blockElement.removeAttribute('data-moved');
        }
        
        // Возвращаем блок к нормальному размеру и положению
        gsap.to(blockElement, {
            scale: 1,
            clearProps: 'transform', // Сбрасываем свойство transform
            duration: 0.2
        });
        
        // Скрываем индикатор касания
        const touchIndicator = blockElement.querySelector('.touch-indicator');
        if (touchIndicator) {
            touchIndicator.style.display = 'none';
        }
        
        // Если блок не перемещался, просто снимаем выделение
        if (!touchMoved) {
            selectedBlockId = null;
            touchMoved = false;
            return;
        }
        
        const touch = e.changedTouches[0];
        const gridRect = grid.getBoundingClientRect();
        const mouseX = touch.clientX - gridRect.left;
        const mouseY = touch.clientY - gridRect.top;
        
        // Если отпустили за пределами сетки
        if (mouseX < 0 || mouseY < 0 || mouseX > gridRect.width || mouseY > gridRect.height) {
            removePlacementPreview();
            selectedBlockId = null;
            touchMoved = false;
            return;
        }
        
        const col = Math.floor(mouseX / cellSize);
        const row = Math.floor(mouseY / cellSize);
        
        if (blockShapes[selectedBlockId]) {
            const shape = blockShapes[selectedBlockId].shape;
            const color = blockShapes[selectedBlockId].color;
            
            placeBlockWithAnimation(row, col, shape, color, selectedBlockId);
        }
        
        removePlacementPreview();
        selectedBlockId = null;
        touchMoved = false;
    }

    function updateBlockSizes() {
        document.querySelectorAll('.block').forEach(block => {
            const blockId = block.dataset.blockId;
            if (!blockShapes[blockId]) return;
            
            const shape = blockShapes[blockId].shape;
            const size = blockShapes[blockId].size || 'medium';
            const rows = shape.length;
            const cols = Math.max(...shape.map(row => row.length));
            
            let blockCellSize = cellSize * 0.8;
            
            if (size === 'small') {
                blockCellSize = cellSize * 0.6;
            } else if (size === 'large') {
                blockCellSize = cellSize * 1.0;
            }
            
            block.style.width = cols * blockCellSize + 'px';
            block.style.height = rows * blockCellSize + 'px';
            
            block.querySelectorAll('.block-cell').forEach(cell => {
                cell.style.width = blockCellSize + 'px';
                cell.style.height = blockCellSize + 'px';
            });
            
            block.querySelectorAll('.block-cell').forEach((cell, index) => {
                const row = Math.floor(index / cols);
                const col = index % cols;
                
                cell.style.width = blockCellSize + 'px';
                cell.style.height = blockCellSize + 'px';
                cell.style.left = col * blockCellSize + 'px';
                cell.style.top = row * blockCellSize + 'px';
            });
        });
    }

    function generateNewBlocks() {
        blocksContainer.innerHTML = '';
        blockShapes = {};
        
        const fragment = document.createDocumentFragment();
        
        // Всегда генерируем ровно 3 блока
        for (let i = 0; i < 3; i++) {
            const shape = GameCore.generateBlockShape();
            const color = GameCore.generateBlockColor();
            const size = GameCore.generateBlockSize();
            const block = createBlock(shape, color, i, size);
            fragment.appendChild(block);
        }
        
        blocksContainer.appendChild(fragment);
        GameCore.setBlockShapes(blockShapes);
        
        // Анимируем появление блоков
        gsap.fromTo('.block', 
            { opacity: 0, y: 30 }, 
            { 
                opacity: 1, 
                y: 0, 
                duration: 0.5, 
                stagger: 0.1, 
                ease: "back.out(1.4)",
                onComplete: () => {
                    // Добавляем небольшую анимацию парения
                    gsap.to('.block', {
                        y: '+=5',
                        duration: 1.5,
                        repeat: -1,
                        yoyo: true,
                        ease: "sine.inOut",
                        stagger: {
                            each: 0.2,
                            from: "random"
                        }
                    });
                }
            }
        );
    }

    function createBlock(shape, color, blockId, size) {
        const block = document.createElement('div');
        block.classList.add('block');
        block.dataset.blockId = blockId;
        block.style.position = 'relative';
        
        const rows = shape.length;
        const cols = Math.max(...shape.map(row => row.length));
        
        let blockCellSize = cellSize * 0.8;
        
        if (size === 'small') {
            blockCellSize = cellSize * 0.6;
        } else if (size === 'large') {
            blockCellSize = cellSize * 1.0;
        }
        
        // Увеличиваем размер контейнера блока, чтобы добавить немного места вокруг для упрощения захвата
        const extraMargin = 10; // в пикселях
        block.style.width = (cols * blockCellSize + extraMargin) + 'px';
        block.style.height = (rows * blockCellSize + extraMargin) + 'px';
        
        // Увеличиваем видимость фона для лучшего распознавания области захвата
        block.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'; // повышаем непрозрачность
        block.style.borderRadius = '10px';
        block.style.boxShadow = '0 0 10px rgba(255, 255, 255, 0.2)'; // делаем более заметную тень
        block.style.transition = 'transform 0.2s, box-shadow 0.2s, background-color 0.2s, opacity 0.2s';
        block.style.padding = '5px'; // добавляем внутренний отступ
        block.style.boxSizing = 'border-box'; // чтобы padding не увеличивал общий размер
        
        const fragment = document.createDocumentFragment();
        
        const blockContentWrapper = document.createElement('div');
        blockContentWrapper.style.position = 'relative';
        blockContentWrapper.style.width = '100%';
        blockContentWrapper.style.height = '100%';
        blockContentWrapper.style.display = 'flex';
        blockContentWrapper.style.justifyContent = 'center';
        blockContentWrapper.style.alignItems = 'center';
        
        // Создаем внутренний контейнер для ячеек блока
        const cellsContainer = document.createElement('div');
        cellsContainer.style.position = 'relative';
        cellsContainer.style.width = (cols * blockCellSize) + 'px';
        cellsContainer.style.height = (rows * blockCellSize) + 'px';
        
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < (shape[i] ? shape[i].length : 0); j++) {
                if (shape[i][j]) {
                    const cell = document.createElement('div');
                    cell.classList.add('block-cell');
                    cell.style.width = blockCellSize + 'px';
                    cell.style.height = blockCellSize + 'px';
                    cell.style.backgroundColor = color;
                    cell.style.position = 'absolute';
                    cell.style.left = j * blockCellSize + 'px';
                    cell.style.top = i * blockCellSize + 'px';
                    cell.style.borderRadius = '4px'; // скругляем углы ячеек
                    cell.style.boxShadow = 'inset 0 0 3px rgba(0, 0, 0, 0.2)'; // добавляем внутреннюю тень
                    cellsContainer.appendChild(cell);
                }
            }
        }
        
        blockContentWrapper.appendChild(cellsContainer);
        block.appendChild(blockContentWrapper);
        
        if (isTouchDevice) {
            // Добавляем более заметный индикатор для тач-устройств
            const touchIndicator = document.createElement('div');
            touchIndicator.style.position = 'absolute';
            touchIndicator.style.width = '100%';
            touchIndicator.style.height = '100%';
            touchIndicator.style.top = '0';
            touchIndicator.style.left = '0';
            touchIndicator.style.backgroundColor = 'transparent';
            touchIndicator.style.border = '2px dashed rgba(255, 255, 255, 0.5)'; // Делаем более заметным
            touchIndicator.style.borderRadius = '8px';
            touchIndicator.style.boxSizing = 'border-box';
            touchIndicator.style.zIndex = '1';
            touchIndicator.style.display = 'none';
            touchIndicator.classList.add('touch-indicator');
            block.appendChild(touchIndicator);
            
            // Улучшаем обработку touch событий
            block.addEventListener('touchstart', (e) => {
                e.preventDefault(); // Предотвращаем действия по умолчанию
                selectedBlockId = blockId;
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                touchMoved = false;
                
                // Визуальная обратная связь
                block.classList.add('dragging');
                block.style.backgroundColor = 'rgba(255, 255, 255, 0.25)'; // Делаем более заметным
                block.style.boxShadow = '0 0 20px rgba(255, 255, 255, 0.4)'; // Увеличиваем свечение
                block.style.transform = 'scale(1.05)'; // Немного увеличиваем блок при захвате
                
                // Показываем индикатор захвата
                const touchIndicator = block.querySelector('.touch-indicator');
                if (touchIndicator) {
                    touchIndicator.style.display = 'block';
                }
                
                // Тактильная обратная связь, если доступна
                if (window.navigator && window.navigator.vibrate) {
                    window.navigator.vibrate(50);
                }
                
                // Таймер для определения долгого нажатия
                setTimeout(() => {
                    if (selectedBlockId === blockId && !touchMoved) {
                        // Анимируем блок, если пользователь удерживает его
                        gsap.to(block, {
                            scale: 1.1,
                            duration: 0.2
                        });
                    }
                }, 200);
            });
        } else {
            block.draggable = true;
            
            // Добавляем индикатор для hover состояния
            block.addEventListener('mouseover', () => {
                block.style.backgroundColor = 'rgba(255, 255, 255, 0.25)'; // Повышаем заметность
                block.style.boxShadow = '0 0 15px rgba(255, 255, 255, 0.3)';
                block.style.cursor = 'grab';
                block.style.transform = 'scale(1.02)'; // Слегка увеличиваем при наведении
            });
            
            block.addEventListener('mouseout', () => {
                if (!block.classList.contains('dragging')) {
                    block.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                    block.style.boxShadow = '0 0 10px rgba(255, 255, 255, 0.2)';
                    block.style.transform = 'scale(1)'; // Возвращаем размер
                }
            });
            
            block.addEventListener('mousedown', () => {
                block.style.cursor = 'grabbing';
                block.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
                block.style.transform = 'scale(1.05)'; // Увеличиваем блок при нажатии
            });
            
            block.addEventListener('mouseup', () => {
                block.style.cursor = 'grab';
                block.style.backgroundColor = 'rgba(255, 255, 255, 0.25)';
                block.style.transform = 'scale(1.02)'; // Возвращаем к состоянию наведения
            });
            
            block.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('blockId', blockId);
                
                const dragImage = document.createElement('div');
                dragImage.style.opacity = '0';
                document.body.appendChild(dragImage);
                e.dataTransfer.setDragImage(dragImage, 0, 0);
                
                block.classList.add('dragging');
                block.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                block.style.boxShadow = '0 0 15px rgba(255, 255, 255, 0.3)';
                currentDraggingShape = shape;
                currentDraggingColor = color;
                currentDraggingSize = size;
                
                setTimeout(() => {
                    dragImage.remove();
                }, 0);
            });
            
            block.addEventListener('dragend', () => {
                block.classList.remove('dragging');
                block.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                block.style.boxShadow = '0 0 10px rgba(255, 255, 255, 0.1)';
                removePlacementPreview();
                currentDraggingShape = null;
                currentDraggingColor = null;
                currentDraggingSize = null;
            });
        }
        
        blockShapes[blockId] = { shape, color, size };
        return block;
    }

    function handleGlobalDragOver(e) {
        if (!currentDraggingShape) return;
        
        const gridRect = grid.getBoundingClientRect();
        const mouseX = e.clientX - gridRect.left;
        const mouseY = e.clientY - gridRect.top;
        
        if (mouseX < 0 || mouseY < 0 || mouseX > gridRect.width || mouseY > gridRect.height) {
            removePlacementPreview();
            return;
        }
        
        const col = Math.floor(mouseX / cellSize);
        const row = Math.floor(mouseY / cellSize);
        
        const canPlace = GameCore.checkPlacement(row, col, currentDraggingShape);
        
        if (!isShowingPreview) {
            isShowingPreview = true;
            requestAnimationFrame(() => {
                showPlacementPreview(row, col, currentDraggingShape, currentDraggingColor, canPlace);
                isShowingPreview = false;
            });
        }
    }

    function showPlacementPreview(row, col, shape, color, canPlace) {
        removePlacementPreview();
        
        const gridWidth = 10;
        const previewCells = [];
        
        const fragment = document.createDocumentFragment();
        
        let size = 'medium';
        
        if (currentDraggingSize) {
            size = currentDraggingSize;
        } else if (selectedBlockId !== null && blockShapes[selectedBlockId]) {
            size = blockShapes[selectedBlockId].size || 'medium';
        }
        
        for (let i = 0; i < shape.length; i++) {
            for (let j = 0; j < shape[i].length; j++) {
                if (shape[i][j]) {
                    const newRow = row + i;
                    const newCol = col + j;
                    
                    if (newRow >= 0 && newRow < 10 && newCol >= 0 && newCol < 10) {
                        const targetIndex = newRow * gridWidth + newCol;
                        const targetCell = gridCells[targetIndex];
                        
                        if (targetCell) {
                            const preview = document.createElement('div');
                            preview.classList.add('placement-preview');
                            preview.style.width = cellSize + 'px';
                            preview.style.height = cellSize + 'px';
                            preview.style.backgroundColor = canPlace ? color : 'rgba(255, 0, 0, 0.3)';
                            preview.style.opacity = canPlace ? '0.5' : '0.7';
                            preview.style.top = targetCell.offsetTop + 'px';
                            preview.style.left = targetCell.offsetLeft + 'px';
                            
                            fragment.appendChild(preview);
                            previewCells.push(preview);
                        }
                    }
                }
            }
        }
        
        grid.appendChild(fragment);
        placementPreview = previewCells;
    }

    function removePlacementPreview() {
        if (placementPreview) {
            placementPreview.forEach(preview => {
                if (preview.parentNode) {
                    preview.parentNode.removeChild(preview);
                }
            });
            placementPreview = null;
        }
    }

    function handleDragOver(e) {
        e.preventDefault();
    }

    function handleDrop(e) {
        e.preventDefault();
        
        removePlacementPreview();
        
        const blockId = e.dataTransfer.getData('blockId');
        if (!blockId || !blockShapes[blockId]) return;
        
        const shape = blockShapes[blockId].shape;
        const color = blockShapes[blockId].color;
        
        const gridRect = grid.getBoundingClientRect();
        const mouseX = e.clientX - gridRect.left;
        const mouseY = e.clientY - gridRect.top;
        
        const col = Math.floor(mouseX / cellSize);
        const row = Math.floor(mouseY / cellSize);
        
        placeBlockWithAnimation(row, col, shape, color, blockId);
        
        currentDraggingShape = null;
        currentDraggingColor = null;
        currentDraggingSize = null;
    }

    function placeBlockWithAnimation(row, col, shape, color, blockId) {
        if (GameCore.checkPlacement(row, col, shape)) {
            // Добавляем анимацию для размещения блока на сетке
            const gridWidth = 10;
            
            // Сначала собираем все ячейки, которые будут заполнены
            const cellsToFill = [];
            for (let i = 0; i < shape.length; i++) {
                for (let j = 0; j < shape[i].length; j++) {
                    if (shape[i][j]) {
                        const newRow = row + i;
                        const newCol = col + j;
                        
                        const targetIndex = newRow * gridWidth + newCol;
                        cellsToFill.push(gridCells[targetIndex]);
                    }
                }
            }
            
            // Создаем временную анимацию
            gsap.fromTo(cellsToFill, 
                { backgroundColor: "rgba(255, 255, 255, 0.8)", scale: 0.8 },
                { 
                    backgroundColor: color, 
                    scale: 1, 
                    duration: 0.3, 
                    stagger: 0.02,
                    ease: "back.out(1.7)",
                    onStart: () => {
                        cellsToFill.forEach(cell => cell.classList.add('filled'));
                    }
                }
            );
            
            // Удаляем блок из интерфейса
            const usedBlock = document.querySelector(`.block[data-block-id="${blockId}"]`);
            if (usedBlock) {
                gsap.to(usedBlock, {
                    opacity: 0,
                    scale: 0.5, 
                    duration: 0.2,
                    onComplete: () => {
                        usedBlock.remove();
                        
                        // Проверяем, сколько блоков осталось сразу после удаления текущего
                        const remainingBlocks = document.querySelectorAll('.block').length;
                        if (remainingBlocks === 0) {
                            console.log("Генерируем новые блоки, т.к. не осталось ни одного");
                            setTimeout(generateNewBlocks, 500);
                        }
                    }
                });
            }
            
            // Размещаем блок в логике игры
            GameCore.placeBlock(row, col, shape, color);
            
            // Удаляем блок из объекта blockShapes
            delete blockShapes[blockId];
            
            // Проверяем линии с анимацией
            checkLinesWithAnimation();
            
            // Проверяем возможность продолжения игры если остались блоки
            const remainingBlocks = document.querySelectorAll('.block').length;
            if (remainingBlocks > 0) {
                setTimeout(checkGameOver, 500);
            }
            
            return true;
        }
        
        return false;
    }

    // Создаем отдельную функцию для обновления счета в GameCore
    function updateGameScore(points) {
        // Добавляем очки к текущему счету в GameCore
        const currentScore = GameCore.getScore();
        const newScore = currentScore + points;
        
        // Обновляем счет в GameCore
        // Нам нужен доступ к этой функции, добавим ее в GameCore
        GameCore.setScore(newScore);
        
        // Обновляем отображение счета
        updateScore(points);
    }

    function checkLinesWithAnimation() {
        const gridWidth = 10;
        let linesToClear = [];
        let totalLinesCleared = 0;
        
        // Проверяем горизонтальные линии
        for (let row = 0; row < 10; row++) {
            let isRowFilled = true;
            for (let col = 0; col < 10; col++) {
                const cellIndex = row * gridWidth + col;
                if (!gridCells[cellIndex].classList.contains('filled')) {
                    isRowFilled = false;
                    break;
                }
            }
            
            if (isRowFilled) {
                for (let col = 0; col < 10; col++) {
                    linesToClear.push(row * gridWidth + col);
                }
                totalLinesCleared++;
            }
        }
        
        // Проверяем вертикальные линии
        for (let col = 0; col < 10; col++) {
            let isColFilled = true;
            for (let row = 0; row < 10; row++) {
                const cellIndex = row * gridWidth + col;
                if (!gridCells[cellIndex].classList.contains('filled')) {
                    isColFilled = false;
                    break;
                }
            }
            
            if (isColFilled) {
                for (let row = 0; row < 10; row++) {
                    const cellIndex = row * gridWidth + col;
                    if (!linesToClear.includes(cellIndex)) {
                        linesToClear.push(cellIndex);
                    }
                }
                totalLinesCleared++;
            }
        }
        
        if (linesToClear.length > 0) {
            const points = totalLinesCleared * 100 * totalLinesCleared;
            
            // Добавляем класс для анимации
            const cellsToAnimate = linesToClear.map(index => gridCells[index]);
            
            // Используем GSAP для анимации очистки линий
            gsap.to(cellsToAnimate, {
                backgroundColor: "rgba(255, 255, 255, 0.9)",
                scale: 1.1,
                boxShadow: "0 0 15px white",
                duration: 0.3,
                stagger: 0.01,
                onComplete: () => {
                    gsap.to(cellsToAnimate, {
                        scale: 0,
                        opacity: 0,
                        duration: 0.4,
                        stagger: 0.01,
                        onComplete: () => {
                            // Очищаем ячейки
                            linesToClear.forEach(index => {
                                const cell = gridCells[index];
                                cell.classList.remove('filled');
                                gsap.set(cell, {
                                    backgroundColor: "",
                                    scale: 1,
                                    opacity: 1,
                                    boxShadow: ""
                                });
                            });
                            
                            // Обновляем счет с помощью нашей новой функции
                            updateGameScore(points);
                            
                            // Проверяем необходимость генерации новых блоков
                            const remainingBlocks = document.querySelectorAll('.block').length;
                            if (remainingBlocks === 0) {
                                console.log("Генерируем новые блоки после очистки линий, т.к. не осталось ни одного");
                                setTimeout(generateNewBlocks, 500);
                            } else {
                                setTimeout(checkGameOver, 500);
                            }
                        }
                    });
                }
            });
        }
    }

    function updateScore(points) {
        scoreElement.textContent = GameCore.getScore();
        updateHighScore();
        
        if (points > 0) {
            // Анимируем счет с помощью GSAP
            gsap.fromTo(scoreElement, 
                { scale: 1 },
                { scale: 1.3, duration: 0.2, yoyo: true, repeat: 1 }
            );
            
            // Создаем анимацию прибавления очков
            const pointsAnim = document.createElement('div');
            pointsAnim.classList.add('points-animation');
            pointsAnim.classList.add('animate__animated', 'animate__bounceIn');
            pointsAnim.textContent = `+${points}`;
            document.querySelector('.game-container').appendChild(pointsAnim);
            
            // Удаляем анимацию после завершения
            setTimeout(() => {
                if (pointsAnim.parentNode) {
                    pointsAnim.parentNode.removeChild(pointsAnim);
                }
            }, 1000);
        }
    }
    
    function updateHighScore() {
        const currentHighScore = GameCore.getHighScore();
        highScoreElement.textContent = currentHighScore;
        
        // Если это новый рекорд, добавляем анимацию
        if (currentHighScore > parseInt(highScoreElement.getAttribute('data-prev-high') || 0)) {
            gsap.fromTo('.crown', 
                { rotation: -15, scale: 1 },
                { rotation: 15, scale: 1.3, duration: 0.5, repeat: 3, yoyo: true }
            );
            highScoreElement.setAttribute('data-prev-high', currentHighScore);
        }
    }

    function checkGameOver() {
        // Переписанная логика проверки завершения игры
        if (document.querySelectorAll('.block').length > 0) {
            // Проверяем, можно ли разместить хотя бы один блок
            if (!GameCore.canPlaceAnyBlock(blockShapes)) {
                console.log("Game over detected: no blocks can be placed");
                showGameOver();
            }
        }
    }

    function showGameOver() {
        // Удаляем существующий диалог, если он есть
        const existingDialog = document.querySelector('.game-over-dialog');
        if (existingDialog) {
            existingDialog.remove();
        }
        
        const gameOverDialog = document.createElement('div');
        gameOverDialog.classList.add('game-over-dialog');
        
        const content = document.createElement('div');
        content.classList.add('game-over-content');
        
        const title = document.createElement('h2');
        title.textContent = 'Игра окончена!';
        title.classList.add('animate__animated', 'animate__fadeInDown');
        
        const scoreText = document.createElement('p');
        const scoreSpan = document.createElement('span');
        scoreSpan.classList.add('final-score', 'animate__animated', 'animate__heartBeat');
        scoreSpan.textContent = GameCore.getScore();
        scoreText.textContent = 'Ваш счет: ';
        scoreText.appendChild(scoreSpan);
        
        const restartButton = document.createElement('button');
        restartButton.id = 'restart-button';
        restartButton.textContent = 'Играть снова';
        restartButton.classList.add('animate__animated', 'animate__bounceIn');
        restartButton.style.animationDelay = '0.5s';
        
        content.appendChild(title);
        content.appendChild(scoreText);
        content.appendChild(restartButton);
        gameOverDialog.appendChild(content);
        
        document.body.appendChild(gameOverDialog);
        
        // Анимируем появление диалога
        gsap.fromTo(content, 
            { opacity: 0, y: 50 }, 
            { opacity: 1, y: 0, duration: 0.5, ease: "back.out(1.7)" }
        );
        
        restartButton.addEventListener('click', () => {
            gsap.to(gameOverDialog, {
                opacity: 0,
                duration: 0.3,
                onComplete: () => {
                    gameOverDialog.remove();
                    GameCore.resetScore();
                    initGame();
                }
            });
        });
    }
    
    // Инициализация particles.js
    function initParticles() {
        if (window.particlesJS) {
            particlesJS('particles-js', {
                "particles": {
                    "number": {
                        "value": 50,
                        "density": {
                            "enable": true,
                            "value_area": 800
                        }
                    },
                    "color": {
                        "value": "#ffffff"
                    },
                    "shape": {
                        "type": "circle",
                        "stroke": {
                            "width": 0,
                            "color": "#000000"
                        },
                        "polygon": {
                            "nb_sides": 5
                        }
                    },
                    "opacity": {
                        "value": 0.5,
                        "random": true,
                        "anim": {
                            "enable": true,
                            "speed": 1,
                            "opacity_min": 0.1,
                            "sync": false
                        }
                    },
                    "size": {
                        "value": 3,
                        "random": true,
                        "anim": {
                            "enable": true,
                            "speed": 2,
                            "size_min": 0.1,
                            "sync": false
                        }
                    },
                    "line_linked": {
                        "enable": true,
                        "distance": 150,
                        "color": "#ffffff",
                        "opacity": 0.2,
                        "width": 1
                    },
                    "move": {
                        "enable": true,
                        "speed": 1,
                        "direction": "none",
                        "random": true,
                        "straight": false,
                        "out_mode": "out",
                        "bounce": false,
                        "attract": {
                            "enable": false,
                            "rotateX": 600,
                            "rotateY": 1200
                        }
                    }
                },
                "interactivity": {
                    "detect_on": "canvas",
                    "events": {
                        "onhover": {
                            "enable": true,
                            "mode": "grab"
                        },
                        "onclick": {
                            "enable": true,
                            "mode": "push"
                        },
                        "resize": true
                    },
                    "modes": {
                        "grab": {
                            "distance": 140,
                            "line_linked": {
                                "opacity": 0.6
                            }
                        },
                        "bubble": {
                            "distance": 400,
                            "size": 40,
                            "duration": 2,
                            "opacity": 8,
                            "speed": 3
                        },
                        "repulse": {
                            "distance": 200,
                            "duration": 0.4
                        },
                        "push": {
                            "particles_nb": 4
                        },
                        "remove": {
                            "particles_nb": 2
                        }
                    }
                },
                "retina_detect": true
            });
        }
    }

    initGame();
});