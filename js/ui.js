document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('grid');
    const blocksContainer = document.getElementById('blocks');
    const scoreElement = document.getElementById('score');
    const highScoreElement = document.querySelector('.high-score');
    const gameContainer = document.querySelector('.game-container');
    
    let blockShapes = [];
    let cellSize = 0;
    let isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    let selectedBlockId = null;
    let currentDraggingShape = null;
    let currentDraggingColor = null;
    let placementPreview = null;
    let isShowingPreview = false;
    let gridCells = [];
    let animationFrameId = null;
    let lastCanPlaceState = false;

    const debounce = (func, wait) => {
        let timeout;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    };

    const throttle = (func, limit) => {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    };

    function initGame() {
        gridCells = GameCore.createGrid(grid, isTouchDevice, {
            dragOver: handleDragOver,
            drop: handleDrop
        });
        cellSize = GameCore.calculateCellSize(grid);
        GameCore.setCellSize(cellSize);
        updateScore(0);
        updateHighScore();
        generateNewBlocks();
        
        setupInputEvents();

        window.addEventListener('resize', debounce(() => {
            cellSize = GameCore.calculateCellSize(grid);
            GameCore.setCellSize(cellSize);
            
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
            
            animationFrameId = requestAnimationFrame(() => {
                updateBlockSizes();
                animationFrameId = null;
            });
        }, 250));
    }

    function setupInputEvents() {
        if (isTouchDevice) {
            document.addEventListener('touchmove', throttle(handleTouchMove, 16), { passive: false });
            document.addEventListener('touchend', handleTouchEnd);
        } else {
            document.addEventListener('dragover', throttle(handleGlobalDragOver, 16));
        }
    }

    function handleTouchMove(e) {
        if (selectedBlockId === null) return;
        
        const touch = e.touches[0];
        const gridRect = grid.getBoundingClientRect();
        const mouseX = touch.clientX - gridRect.left;
        const mouseY = touch.clientY - gridRect.top;
        
        const selectedBlock = document.querySelector(`.block[data-block-id="${selectedBlockId}"]`);
        
        // Перемещаем блок за пальцем
        if (selectedBlock) {
            selectedBlock.style.position = 'fixed';
            selectedBlock.style.left = (touch.clientX - selectedBlock.offsetWidth / 2) + 'px';
            selectedBlock.style.top = (touch.clientY - selectedBlock.offsetHeight / 2) + 'px';
            selectedBlock.style.zIndex = '1000';
        }
        
        // Определяем, находится ли касание над сеткой
        const isOverGrid = 
            mouseX >= 0 && 
            mouseY >= 0 && 
            mouseX <= gridRect.width && 
            mouseY <= gridRect.height;
        
        // Если касание вне сетки, убираем предварительный просмотр
        if (!isOverGrid) {
            removePlacementPreview();
            return;
        }
        
        // Определяем позицию на сетке
        const col = Math.floor(mouseX / cellSize);
        const row = Math.floor(mouseY / cellSize);
        
        // Проверяем, поменялась ли позиция с последнего обновления
        if (!blockShapes[selectedBlockId]) return;
        
        const shape = blockShapes[selectedBlockId].shape;
        const color = blockShapes[selectedBlockId].color;
        
        // Проверяем возможность размещения
        const canPlace = GameCore.checkPlacement(row, col, shape);
        
        // Показываем предварительный просмотр с небольшой задержкой для производительности
        if (!isShowingPreview) {
            isShowingPreview = true;
            requestAnimationFrame(() => {
                showPlacementPreview(row, col, shape, color, canPlace);
                isShowingPreview = false;
            });
        }
        
        // Добавляем тактильную обратную связь при изменении возможности размещения
        if (window.navigator.vibrate && canPlace !== lastCanPlaceState) {
            window.navigator.vibrate(canPlace ? 20 : 10);
            lastCanPlaceState = canPlace;
        }
    }

    function handleTouchEnd(e) {
        if (selectedBlockId === null) return;
        
        const touch = e.changedTouches[0];
        const gridRect = grid.getBoundingClientRect();
        const mouseX = touch.clientX - gridRect.left;
        const mouseY = touch.clientY - gridRect.top;
        
        const blockElement = document.querySelector(`.block[data-block-id="${selectedBlockId}"]`);
        
        if (blockElement) {
            blockElement.style.position = 'relative';
            blockElement.style.left = '';
            blockElement.style.top = '';
            blockElement.style.zIndex = '';
        }
        
        if (mouseX < 0 || mouseY < 0 || mouseX > gridRect.width || mouseY > gridRect.height) {
            removePlacementPreview();
            if (blockElement) {
                blockElement.classList.remove('dragging');
            }
            selectedBlockId = null;
            return;
        }
        
        const col = Math.floor(mouseX / cellSize);
        const row = Math.floor(mouseY / cellSize);
        
        if (!blockShapes[selectedBlockId]) {
            if (blockElement) {
                blockElement.classList.remove('dragging');
            }
            selectedBlockId = null;
            return;
        }
        
        const shape = blockShapes[selectedBlockId].shape;
        const color = blockShapes[selectedBlockId].color;
        
        let placementSuccessful = false;
        
        if (GameCore.checkPlacement(row, col, shape)) {
            GameCore.placeBlock(row, col, shape, color, updateScore);
            
            if (blockElement) {
                blockElement.style.transition = 'transform 0.2s, opacity 0.2s';
                blockElement.style.transform = 'scale(0.8)';
                blockElement.style.opacity = '0';
                
                setTimeout(() => {
                    blockElement.remove();
                }, 200);
            }
            
            // Удаляем блок из blockShapes
            delete blockShapes[selectedBlockId];
            
            if (document.querySelectorAll('.block').length === 0) {
                generateNewBlocks();
            } else {
                // Проверяем окончание игры после размещения блока 
                // без использования setTimeout
                checkGameOver();
            }
            
            if (window.navigator.vibrate) {
                window.navigator.vibrate([50, 50, 100]);
            }
            
            placementSuccessful = true;
        } else {
            if (blockElement) {
                blockElement.style.transition = 'transform 0.3s';
                blockElement.style.transform = '';
            }
        }
        
        removePlacementPreview();
        if (blockElement && !placementSuccessful) {
            blockElement.classList.remove('dragging');
        }
        selectedBlockId = null;
    }

    function updateBlockSizes() {
        document.querySelectorAll('.block').forEach(block => {
            const blockId = block.dataset.blockId;
            if (!blockShapes[blockId]) return;
            
            const shape = blockShapes[blockId].shape;
            const rows = shape.length;
            const cols = Math.max(...shape.map(row => row.length));
            
            let blockCellSize = cellSize * 0.8;
            let sizeCategory = "medium";
            
            if (rows * cols <= 2) {
                blockCellSize = cellSize * 0.9;
                sizeCategory = "small";
            } else if (rows * cols >= 6) {
                blockCellSize = cellSize * 0.7;
                sizeCategory = "large";
            }
            
            block.dataset.size = sizeCategory;
            
            block.style.width = cols * blockCellSize + 'px';
            block.style.height = rows * blockCellSize + 'px';
            
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
        blockShapes = [];
        
        const fragment = document.createDocumentFragment();
        
        for (let i = 0; i < 3; i++) {
            const shape = GameCore.generateBlockShape();
            const color = GameCore.generateBlockColor();
            const block = createBlock(shape, color, i);
            fragment.appendChild(block);
        }
        
        blocksContainer.appendChild(fragment);
        GameCore.setBlockShapes(blockShapes);
        
        // После генерации новых блоков проверяем, можно ли их разместить
        // Небольшая задержка нужна для гарантии завершения обновления DOM
        requestAnimationFrame(() => {
            checkGameOver();
        });
    }

    function createBlock(shape, color, blockId) {
        const block = document.createElement('div');
        block.classList.add('block');
        block.dataset.blockId = blockId;
        block.style.position = 'relative';
        
        const rows = shape.length;
        const cols = Math.max(...shape.map(row => row.length));
        
        let blockCellSize = cellSize * 0.8;
        let sizeCategory = "medium";
        
        if (rows * cols <= 2) {
            blockCellSize = cellSize * 0.9;
            sizeCategory = "small";
        } else if (rows * cols >= 6) {
            blockCellSize = cellSize * 0.7;
            sizeCategory = "large";
        }
        
        block.dataset.size = sizeCategory;
        
        block.style.width = cols * blockCellSize + 'px';
        block.style.height = rows * blockCellSize + 'px';
        
        const fragment = document.createDocumentFragment();
        
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
                    fragment.appendChild(cell);
                }
            }
        }
        
        const dragHandle = document.createElement('div');
        dragHandle.classList.add('drag-handle');
        dragHandle.style.position = 'absolute';
        dragHandle.style.top = '0';
        dragHandle.style.left = '0';
        dragHandle.style.width = '100%';
        dragHandle.style.height = '100%';
        dragHandle.style.cursor = 'grab';
        
        if (isTouchDevice) {
            const grabIndicator = document.createElement('div');
            grabIndicator.classList.add('grab-indicator');
            grabIndicator.style.position = 'absolute';
            grabIndicator.style.top = '50%';
            grabIndicator.style.left = '50%';
            grabIndicator.style.transform = 'translate(-50%, -50%)';
            grabIndicator.style.width = '40%';
            grabIndicator.style.height = '40%';
            grabIndicator.style.borderRadius = '50%';
            grabIndicator.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
            grabIndicator.style.display = 'flex';
            grabIndicator.style.justifyContent = 'center';
            grabIndicator.style.alignItems = 'center';
            grabIndicator.style.pointerEvents = 'none';
            
            const grabIcon = document.createElement('div');
            grabIcon.style.width = '50%';
            grabIcon.style.height = '50%';
            grabIcon.style.borderRadius = '50%';
            grabIcon.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
            
            grabIndicator.appendChild(grabIcon);
            dragHandle.appendChild(grabIndicator);
        }
        
        block.appendChild(fragment);
        block.appendChild(dragHandle);
        
        if (isTouchDevice) {
            dragHandle.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                selectedBlockId = blockId;
                block.classList.add('dragging');
                
                block.style.transform = 'scale(1.05)';
                
                if (window.navigator.vibrate) {
                    window.navigator.vibrate(50);
                }
                
                document.body.style.overflow = 'hidden';
                
                document.addEventListener('touchmove', blockTouchMoveHandler, { passive: false });
                document.addEventListener('touchend', blockTouchEndHandler);
                document.addEventListener('touchcancel', blockTouchEndHandler);
                
                function blockTouchMoveHandler(ev) {
                    ev.preventDefault();
                    handleTouchMove(ev);
                }
                
                function blockTouchEndHandler(ev) {
                    document.body.style.overflow = '';
                    
                    block.style.transform = '';
                    
                    document.removeEventListener('touchmove', blockTouchMoveHandler);
                    document.removeEventListener('touchend', blockTouchEndHandler);
                    document.removeEventListener('touchcancel', blockTouchEndHandler);
                    
                    handleTouchEnd(ev);
                }
            }, { passive: false });
        } else {
            block.draggable = true;
            
            block.querySelectorAll('.block-cell').forEach(cell => {
                cell.style.pointerEvents = 'none';
            });
            
            block.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('blockId', blockId);
                
                const dragImage = document.createElement('div');
                dragImage.style.opacity = '0';
                document.body.appendChild(dragImage);
                e.dataTransfer.setDragImage(dragImage, 0, 0);
                
                block.classList.add('dragging');
                currentDraggingShape = shape;
                currentDraggingColor = color;
                
                setTimeout(() => {
                    dragImage.remove();
                }, 0);
            });
            
            block.addEventListener('dragend', () => {
                block.classList.remove('dragging');
                removePlacementPreview();
            });
        }
        
        blockShapes[blockId] = { shape, color };
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
        
        // Проверка корректности входных данных
        if (!shape || shape.length === 0 || row < 0 || col < 0 || row >= 10 || col >= 10) {
            return;
        }
        
        // Добавляем дополнительную информацию о подсветке для пользователя
        const infoText = document.createElement('div');
        infoText.classList.add('placement-info');
        infoText.textContent = canPlace ? 'Поставить здесь' : 'Нельзя поставить';
        infoText.style.position = 'absolute';
        infoText.style.top = '-30px';
        infoText.style.left = '50%';
        infoText.style.transform = 'translateX(-50%)';
        infoText.style.backgroundColor = canPlace ? 'rgba(0, 200, 0, 0.7)' : 'rgba(255, 0, 0, 0.7)';
        infoText.style.color = 'white';
        infoText.style.padding = '3px 8px';
        infoText.style.borderRadius = '4px';
        infoText.style.fontSize = '12px';
        infoText.style.fontWeight = 'bold';
        infoText.style.whiteSpace = 'nowrap';
        infoText.style.zIndex = '100';
        infoText.style.pointerEvents = 'none';
        
        const rows = shape.length;
        for (let i = 0; i < rows; i++) {
            const rowWidth = shape[i].length;
            for (let j = 0; j < rowWidth; j++) {
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
                            
                            // Добавляем эффект пульсации для лучшей видимости на мобильных устройствах
                            if (isTouchDevice) {
                                preview.style.animation = canPlace ? 
                                    'pulse-green 1s infinite' : 
                                    'pulse-red 1s infinite';
                            }
                            
                            fragment.appendChild(preview);
                            previewCells.push(preview);
                        }
                    }
                }
            }
        }
        
        // Находим первую ячейку для позиционирования информационного текста
        if (previewCells.length > 0 && isTouchDevice) {
            const firstCellIndex = row * gridWidth + col;
            const firstCell = gridCells[firstCellIndex];
            if (firstCell) {
                fragment.appendChild(infoText);
                previewCells.push(infoText);
            }
        }
        
        grid.appendChild(fragment);
        placementPreview = previewCells;
        
        // Добавляем стили для анимации, если их еще нет
        if (isTouchDevice && !document.getElementById('preview-animation-styles')) {
            const styleSheet = document.createElement('style');
            styleSheet.id = 'preview-animation-styles';
            styleSheet.textContent = `
                @keyframes pulse-green {
                    0% { opacity: 0.5; transform: scale(0.95); }
                    50% { opacity: 0.7; transform: scale(1.05); }
                    100% { opacity: 0.5; transform: scale(0.95); }
                }
                @keyframes pulse-red {
                    0% { opacity: 0.6; transform: scale(0.95); }
                    50% { opacity: 0.8; transform: scale(1.05); }
                    100% { opacity: 0.6; transform: scale(0.95); }
                }
            `;
            document.head.appendChild(styleSheet);
        }
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
        if (!blockId) return;
        
        const shape = blockShapes[blockId].shape;
        const color = blockShapes[blockId].color;
        
        const gridRect = grid.getBoundingClientRect();
        const mouseX = e.clientX - gridRect.left;
        const mouseY = e.clientY - gridRect.top;
        
        const col = Math.floor(mouseX / cellSize);
        const row = Math.floor(mouseY / cellSize);
        
        if (GameCore.checkPlacement(row, col, shape)) {
            GameCore.placeBlock(row, col, shape, color, updateScore);
            
            const usedBlock = document.querySelector(`.block[data-block-id="${blockId}"]`);
            if (usedBlock) {
                usedBlock.remove();
                // Удаляем блок из blockShapes
                delete blockShapes[blockId];
            }
            
            if (document.querySelectorAll('.block').length === 0) {
                generateNewBlocks();
            } else {
                // Проверяем окончание игры после размещения блока
                checkGameOver();
            }
        }
        
        currentDraggingShape = null;
        currentDraggingColor = null;
    }

    function updateScore(points) {
        scoreElement.textContent = GameCore.getScore();
        updateHighScore();
        
        if (points > 0) {
            scoreElement.style.transform = 'scale(1.2)';
            
            const pointsAnim = document.createElement('div');
            pointsAnim.classList.add('points-animation');
            pointsAnim.textContent = `+${points}`;
            pointsAnim.style.position = 'absolute';
            pointsAnim.style.color = '#FFD700';
            pointsAnim.style.fontWeight = 'bold';
            pointsAnim.style.fontSize = '24px';
            pointsAnim.style.top = '40%';
            pointsAnim.style.left = '50%';
            pointsAnim.style.transform = 'translate(-50%, -50%)';
            pointsAnim.style.animation = 'flyUp 1s forwards';
            pointsAnim.style.pointerEvents = 'none';
            
            gameContainer.appendChild(pointsAnim);
            
            if (!document.getElementById('animation-styles')) {
                const styleSheet = document.createElement('style');
                styleSheet.id = 'animation-styles';
                styleSheet.textContent = `
                    @keyframes flyUp {
                        0% { opacity: 1; transform: translate(-50%, -50%); }
                        100% { opacity: 0; transform: translate(-50%, -100%); }
                    }
                `;
                document.head.appendChild(styleSheet);
            }
            
            setTimeout(() => {
                if (pointsAnim.parentNode) {
                    pointsAnim.parentNode.removeChild(pointsAnim);
                }
                scoreElement.style.transform = '';
            }, 1000);
        }
    }
    
    function updateHighScore() {
        highScoreElement.textContent = GameCore.getHighScore();
    }

    function checkGameOver() {
        // Убедимся, что у нас есть блоки для проверки
        const remainingBlocks = document.querySelectorAll('.block');
        if (remainingBlocks.length > 0) {
            // Сначала обновим blockShapes в GameCore
            GameCore.setBlockShapes(blockShapes);
            
            // Получаем диагностические данные о состоянии сетки
            const gridState = GameCore.diagnosticGridState();
            
            // Проверяем, можно ли разместить какой-либо блок
            try {
                // Добавляем явный вывод в консоль для отладки
                console.log('Проверка возможности размещения блоков...');
                console.log('Состояние сетки:', gridState);
                console.log('Доступные блоки:', Object.keys(blockShapes).length, blockShapes);
                
                const canPlace = GameCore.canPlaceAnyBlock(blockShapes);
                console.log('Результат проверки размещения:', canPlace);
                
                // Если разместить блок невозможно, показываем экран окончания игры
                if (!canPlace) {
                    console.log('Игра окончена: невозможно разместить оставшиеся блоки');
                    GameCore.setGameOver(true);
                    showGameOver();
                }
            } catch (error) {
                console.error('Ошибка при проверке окончания игры:', error);
                console.error('Стек вызовов:', error.stack);
            }
        }
    }

    function showGameOver() {
        // Проверяем, существует ли уже диалог завершения игры
        if (document.querySelector('.game-over-dialog')) {
            return; // Предотвращаем создание нескольких диалогов
        }
        
        // Очищаем все анимации и состояния
        removePlacementPreview();
        
        // Создаем и настраиваем диалог завершения игры
        const gameOverDialog = document.createElement('div');
        gameOverDialog.classList.add('game-over-dialog');
        
        const content = document.createElement('div');
        content.classList.add('game-over-content');
        
        const title = document.createElement('h2');
        title.textContent = 'Игра окончена!';
        
        const scoreText = document.createElement('p');
        const scoreSpan = document.createElement('span');
        scoreSpan.classList.add('final-score');
        scoreSpan.textContent = GameCore.getScore();
        scoreText.textContent = 'Ваш счет: ';
        scoreText.appendChild(scoreSpan);
        
        const restartButton = document.createElement('button');
        restartButton.id = 'restart-button';
        restartButton.textContent = 'Играть снова';
        
        content.appendChild(title);
        content.appendChild(scoreText);
        content.appendChild(restartButton);
        gameOverDialog.appendChild(content);
        
        // Применяем стили
        gameOverDialog.style.position = 'fixed';
        gameOverDialog.style.top = '0';
        gameOverDialog.style.left = '0';
        gameOverDialog.style.width = '100%';
        gameOverDialog.style.height = '100%';
        gameOverDialog.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        gameOverDialog.style.display = 'flex';
        gameOverDialog.style.justifyContent = 'center';
        gameOverDialog.style.alignItems = 'center';
        gameOverDialog.style.zIndex = '1000'; // Увеличиваем z-index, чтобы гарантировать отображение поверх всего
        
        content.style.backgroundColor = '#4169E1';
        content.style.padding = '30px';
        content.style.borderRadius = '15px';
        content.style.textAlign = 'center';
        content.style.boxShadow = '0 0 20px rgba(0, 0, 0, 0.5)';
        content.style.maxWidth = '80%';
        
        title.style.fontSize = '28px';
        title.style.margin = '0 0 20px 0';
        title.style.color = 'white';
        
        scoreText.style.fontSize = '20px';
        scoreText.style.marginBottom = '20px';
        
        scoreSpan.style.fontSize = '32px';
        scoreSpan.style.fontWeight = 'bold';
        scoreSpan.style.color = '#FFD700';
        
        restartButton.style.padding = '15px 25px';
        restartButton.style.fontSize = '18px';
        restartButton.style.backgroundColor = '#50C878';
        restartButton.style.color = 'white';
        restartButton.style.border = 'none';
        restartButton.style.borderRadius = '5px';
        restartButton.style.marginTop = '20px';
        restartButton.style.cursor = 'pointer';
        restartButton.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
        
        // Добавляем анимацию появления диалога
        gameOverDialog.style.animation = 'fadeIn 0.3s ease-out';
        content.style.animation = 'scaleIn 0.3s ease-out';
        
        // Добавляем стили анимации, если их еще нет
        if (!document.getElementById('game-over-animation-styles')) {
            const styleSheet = document.createElement('style');
            styleSheet.id = 'game-over-animation-styles';
            styleSheet.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleIn {
                    from { transform: scale(0.8); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
            `;
            document.head.appendChild(styleSheet);
        }
        
        // Добавляем диалог к документу
        document.body.appendChild(gameOverDialog);
        
        // Обрабатываем нажатие на кнопку рестарта
        restartButton.addEventListener('click', () => {
            // Добавляем анимацию скрытия перед удалением
            gameOverDialog.style.animation = 'fadeIn 0.3s ease-out reverse';
            
            setTimeout(() => {
                if (gameOverDialog.parentNode) {
                    gameOverDialog.remove();
                }
                
                // Полностью обновляем игру
                GameCore.resetScore();
                updateScore(0);
                updateHighScore();
                
                // Очищаем сетку и пересоздаем ее
                gridCells.forEach(cell => {
                    cell.classList.remove('filled');
                    cell.style.backgroundColor = '';
                });
                
                // Создаем новые блоки
                generateNewBlocks();
            }, 300);
        });
    }

    initGame();
});