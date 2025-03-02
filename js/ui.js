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
    let placementPreview = null;
    let isShowingPreview = false;
    let gridCells = [];
    let touchStartX = 0;
    let touchStartY = 0;
    let touchMoved = false;

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
        touchMoved = true;
        
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
        
        // Если блок не перемещался, просто снимаем выделение
        if (!touchMoved) {
            if (blockElement) {
                blockElement.classList.remove('dragging');
            }
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
            if (blockElement) {
                blockElement.classList.remove('dragging');
            }
            selectedBlockId = null;
            touchMoved = false;
            return;
        }
        
        const col = Math.floor(mouseX / cellSize);
        const row = Math.floor(mouseY / cellSize);
        
        if (blockShapes[selectedBlockId]) {
            const shape = blockShapes[selectedBlockId].shape;
            const color = blockShapes[selectedBlockId].color;
            
            if (GameCore.checkPlacement(row, col, shape)) {
                GameCore.placeBlock(row, col, shape, color);
                
                if (blockElement) {
                    blockElement.remove();
                }
                
                // Удаляем блок из объекта blockShapes
                delete blockShapes[selectedBlockId];
                
                GameCore.checkLines(updateScore);
                
                // Если все блоки использованы, генерируем новые
                if (document.querySelectorAll('.block').length === 0) {
                    generateNewBlocks();
                } else {
                    // Иначе проверяем, можно ли разместить оставшиеся блоки
                    setTimeout(checkGameOver, 500);
                }
            }
        }
        
        removePlacementPreview();
        if (blockElement) {
            blockElement.classList.remove('dragging');
        }
        selectedBlockId = null;
        touchMoved = false;
    }

    function updateBlockSizes() {
        document.querySelectorAll('.block').forEach(block => {
            const blockId = block.dataset.blockId;
            if (!blockShapes[blockId]) return;
            
            const shape = blockShapes[blockId].shape;
            const rows = shape.length;
            const cols = Math.max(...shape.map(row => row.length));
            const blockCellSize = cellSize * 0.8;
            
            block.style.width = cols * blockCellSize + 'px';
            block.style.height = rows * blockCellSize + 'px';
            
            block.querySelectorAll('.block-cell').forEach(cell => {
                cell.style.width = blockCellSize + 'px';
                cell.style.height = blockCellSize + 'px';
            });
            
            // Пересчитываем позиции всех ячеек блока
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
        
        for (let i = 0; i < 3; i++) {
            const shape = GameCore.generateBlockShape();
            const color = GameCore.generateBlockColor();
            const block = createBlock(shape, color, i);
            fragment.appendChild(block);
        }
        
        blocksContainer.appendChild(fragment);
        GameCore.setBlockShapes(blockShapes);
    }

    function createBlock(shape, color, blockId) {
        const block = document.createElement('div');
        block.classList.add('block');
        block.dataset.blockId = blockId;
        block.style.position = 'relative';
        
        const rows = shape.length;
        const cols = Math.max(...shape.map(row => row.length));
        
        const blockCellSize = cellSize * 0.8;
        block.style.width = cols * blockCellSize + 'px';
        block.style.height = rows * blockCellSize + 'px';
        
        const fragment = document.createDocumentFragment();
        
        // Создаем ячейки блока
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
        
        block.appendChild(fragment);
        
        if (isTouchDevice) {
            // Улучшенная обработка касаний
            block.addEventListener('touchstart', (e) => {
                e.preventDefault();
                selectedBlockId = blockId;
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                touchMoved = false;
                block.classList.add('dragging');
            });
        } else {
            // Настройка перетаскивания для ПК
            block.draggable = true;
            
            block.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('blockId', blockId);
                
                // Создаем невидимое изображение для перетаскивания
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
                currentDraggingShape = null;
                currentDraggingColor = null;
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
        
        if (GameCore.checkPlacement(row, col, shape)) {
            GameCore.placeBlock(row, col, shape, color);
            
            const usedBlock = document.querySelector(`.block[data-block-id="${blockId}"]`);
            if (usedBlock) {
                usedBlock.remove();
            }
            
            // Удаляем блок из объекта blockShapes
            delete blockShapes[blockId];
            
            GameCore.checkLines(updateScore);
            
            // Если все блоки использованы, генерируем новые
            if (document.querySelectorAll('.block').length === 0) {
                generateNewBlocks();
            } else {
                // Иначе проверяем, можно ли разместить оставшиеся блоки
                setTimeout(checkGameOver, 500);
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
            
            document.querySelector('.game-container').appendChild(pointsAnim);
            
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
        
        gameOverDialog.style.position = 'fixed';
        gameOverDialog.style.top = '0';
        gameOverDialog.style.left = '0';
        gameOverDialog.style.width = '100%';
        gameOverDialog.style.height = '100%';
        gameOverDialog.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        gameOverDialog.style.display = 'flex';
        gameOverDialog.style.justifyContent = 'center';
        gameOverDialog.style.alignItems = 'center';
        gameOverDialog.style.zIndex = '100';
        
        content.style.backgroundColor = '#4169E1';
        content.style.padding = '30px';
        content.style.borderRadius = '15px';
        content.style.textAlign = 'center';
        content.style.boxShadow = '0 0 20px rgba(0, 0, 0, 0.5)';
        
        scoreSpan.style.fontSize = '32px';
        scoreSpan.style.fontWeight = 'bold';
        scoreSpan.style.color = '#FFD700';
        
        restartButton.style.padding = '10px 20px';
        restartButton.style.fontSize = '18px';
        restartButton.style.backgroundColor = '#50C878';
        restartButton.style.color = 'white';
        restartButton.style.border = 'none';
        restartButton.style.borderRadius = '5px';
        restartButton.style.marginTop = '20px';
        restartButton.style.cursor = 'pointer';
        
        document.body.appendChild(gameOverDialog);
        
        restartButton.addEventListener('click', () => {
            gameOverDialog.remove();
            GameCore.resetScore();
            initGame();
        });
    }

    initGame();
});