// Основные переменные
const grid = document.getElementById('grid');
const blocksContainer = document.getElementById('blocks');
let score = 0;
let blockShapes = [];
const colors = ['#4169E1', '#50C878', '#FF4500', '#9370DB', '#FFD700', '#87CEEB']; // Синий, Зеленый, Оранжевый, Фиолетовый, Желтый, Голубой
let cellSize = 0; // Размер ячейки вычисляется динамически

// Шаблоны блоков (каждый массив представляет форму блока)
const blockTemplates = [
    [[1, 1], [1, 1]], // Квадрат 2x2
    [[1, 1, 1]], // Горизонтальная линия из 3 блоков
    [[1], [1], [1]], // Вертикальная линия из 3 блоков
    [[1, 1, 1], [0, 1, 0]], // Т-образный блок
    [[1, 1], [0, 1], [0, 1]], // L-образный блок
    [[1, 1], [1, 0], [1, 0]], // Обратный L-образный блок
    [[1, 1, 0], [0, 1, 1]], // Z-образный блок
    [[0, 1, 1], [1, 1, 0]]  // Обратный Z-образный блок
];

// Инициализация игры
function initGame() {
    createGrid();
    updateScore(0);
    calculateCellSize();
    generateNewBlocks();
    
    // Добавляем обработчик для отслеживания перетаскивания блоков
    document.addEventListener('dragover', handleGlobalDragOver);
}

// Вычисляем размер ячейки на основе размера игрового поля
function calculateCellSize() {
    const gridComputedStyle = window.getComputedStyle(grid);
    const gridWidth = parseInt(gridComputedStyle.width) - parseInt(gridComputedStyle.paddingLeft) - parseInt(gridComputedStyle.paddingRight);
    cellSize = gridWidth / 10; // 10 ячеек в ряду
}

// Создание сетки
function createGrid() {
    grid.innerHTML = '';
    for (let i = 0; i < 100; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.dataset.index = i;
        cell.addEventListener('dragover', handleDragOver);
        cell.addEventListener('drop', handleDrop);
        grid.appendChild(cell);
    }
}

// Генерация новых блоков для выбора
function generateNewBlocks() {
    blocksContainer.innerHTML = '';
    blockShapes = [];

    for (let i = 0; i < 3; i++) {
        const blockTemplate = blockTemplates[Math.floor(Math.random() * blockTemplates.length)];
        const color = colors[Math.floor(Math.random() * colors.length)];
        createBlock(blockTemplate, color, i);
    }
}

// Создание одного блока
function createBlock(shape, color, blockId) {
    const block = document.createElement('div');
    block.classList.add('block');
    block.draggable = true;
    block.dataset.blockId = blockId;
    block.style.position = 'relative';
    
    // Рассчитываем размеры блока
    const rows = shape.length;
    const cols = Math.max(...shape.map(row => row.length));
    
    // Устанавливаем размер блока в зависимости от его формы
    const blockCellSize = cellSize * 0.8; // Немного меньше, чем ячейки на сетке
    block.style.width = cols * blockCellSize + 'px';
    block.style.height = rows * blockCellSize + 'px';
    
    // Создаем визуальное представление блока
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
                block.appendChild(cell);
            }
        }
    }
    
    // Добавляем события для перетаскивания
    block.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('blockId', blockId);
        // Сохраняем информацию о точке, за которую схватили блок
        const rect = block.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;
        e.dataTransfer.setData('offsetX', offsetX);
        e.dataTransfer.setData('offsetY', offsetY);
        block.classList.add('dragging');
        
        // Создаем невидимый элемент для "красивого" перетаскивания
        const dragImage = document.createElement('div');
        dragImage.style.opacity = '0';
        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(dragImage, 0, 0);
        
        // Сохраняем форму текущего блока в глобальную переменную
        window.currentDraggingShape = shape;
        window.currentDraggingColor = color;
    });
    
    block.addEventListener('dragend', () => {
        block.classList.remove('dragging');
        // Удаляем предварительный просмотр
        removePlacementPreview();
    });
    
    blocksContainer.appendChild(block);
    blockShapes[blockId] = { shape, color };
}

// Глобальная функция для отслеживания перетаскивания
function handleGlobalDragOver(e) {
    if (!window.currentDraggingShape) return;
    
    // Получаем координаты курсора относительно игрового поля
    const gridRect = grid.getBoundingClientRect();
    const mouseX = e.clientX - gridRect.left;
    const mouseY = e.clientY - gridRect.top;
    
    // Если курсор за пределами игрового поля, скрываем превью
    if (mouseX < 0 || mouseY < 0 || mouseX > gridRect.width || mouseY > gridRect.height) {
        removePlacementPreview();
        return;
    }
    
    // Вычисляем ячейку, над которой находится курсор
    const col = Math.floor(mouseX / cellSize);
    const row = Math.floor(mouseY / cellSize);
    
    // Проверяем возможность размещения и показываем превью
    const canPlace = checkPlacement(row, col, window.currentDraggingShape);
    showPlacementPreview(row, col, window.currentDraggingShape, window.currentDraggingColor, canPlace);
}

// Проверка возможности размещения блока
function checkPlacement(row, col, shape) {
    const gridWidth = 10;
    let canPlace = true;
    
    for (let i = 0; i < shape.length; i++) {
        for (let j = 0; j < shape[i].length; j++) {
            if (shape[i][j]) {
                const newRow = row + i;
                const newCol = col + j;
                
                if (newRow >= 10 || newCol >= 10 || newRow < 0 || newCol < 0) {
                    canPlace = false;
                    break;
                }
                
                const targetIndex = newRow * gridWidth + newCol;
                const targetCell = document.querySelector(`.cell[data-index="${targetIndex}"]`);
                
                if (!targetCell || targetCell.classList.contains('filled')) {
                    canPlace = false;
                    break;
                }
            }
        }
        if (!canPlace) break;
    }
    
    return canPlace;
}

// Показать визуальное превью размещения блока
function showPlacementPreview(row, col, shape, color, canPlace) {
    // Удаляем старое превью
    removePlacementPreview();
    
    const gridWidth = 10;
    const previewCells = [];
    
    // Для каждой ячейки в форме блока
    for (let i = 0; i < shape.length; i++) {
        for (let j = 0; j < shape[i].length; j++) {
            if (shape[i][j]) {
                const newRow = row + i;
                const newCol = col + j;
                
                // Проверяем, находится ли ячейка в пределах сетки
                if (newRow >= 0 && newRow < 10 && newCol >= 0 && newCol < 10) {
                    const targetIndex = newRow * gridWidth + newCol;
                    const targetCell = document.querySelector(`.cell[data-index="${targetIndex}"]`);
                    
                    if (targetCell) {
                        // Создаем элемент превью
                        const preview = document.createElement('div');
                        preview.classList.add('placement-preview');
                        preview.style.width = cellSize + 'px';
                        preview.style.height = cellSize + 'px';
                        preview.style.backgroundColor = canPlace ? color : 'rgba(255, 0, 0, 0.3)';
                        preview.style.opacity = canPlace ? '0.5' : '0.7';
                        preview.style.top = targetCell.offsetTop + 'px';
                        preview.style.left = targetCell.offsetLeft + 'px';
                        
                        grid.appendChild(preview);
                        previewCells.push(preview);
                    }
                }
            }
        }
    }
    
    // Сохраняем ссылки на элементы превью
    window.placementPreview = previewCells;
}

// Удалить визуальное превью размещения
function removePlacementPreview() {
    if (window.placementPreview) {
        window.placementPreview.forEach(preview => {
            preview.remove();
        });
        window.placementPreview = null;
    }
}

// Обработка события, когда перетаскиваемый элемент находится над ячейкой
function handleDragOver(e) {
    e.preventDefault(); // Разрешаем drop
    // Мы больше не используем эту функцию для подсветки, так как обрабатываем всё глобально
}

// Обработка сброса блока на сетку
function handleDrop(e) {
    e.preventDefault();
    
    // Удаляем подсветку
    removePlacementPreview();
    
    const blockId = e.dataTransfer.getData('blockId');
    if (!blockId) return;
    
    const shape = blockShapes[blockId].shape;
    const color = blockShapes[blockId].color;
    
    // Получаем координаты мыши относительно сетки
    const gridRect = grid.getBoundingClientRect();
    const mouseX = e.clientX - gridRect.left;
    const mouseY = e.clientY - gridRect.top;
    
    // Вычисляем ячейку на основе координат мыши
    const col = Math.floor(mouseX / cellSize);
    const row = Math.floor(mouseY / cellSize);
    
    // Проверка возможности размещения
    if (checkPlacement(row, col, shape)) {
        // Размещение блока на сетке
        const gridWidth = 10;
        
        for (let i = 0; i < shape.length; i++) {
            for (let j = 0; j < shape[i].length; j++) {
                if (shape[i][j]) {
                    const newRow = row + i;
                    const newCol = col + j;
                    
                    const targetIndex = newRow * gridWidth + newCol;
                    const targetCell = document.querySelector(`.cell[data-index="${targetIndex}"]`);
                    
                    targetCell.classList.add('filled');
                    targetCell.style.backgroundColor = color;
                }
            }
        }
        
        // Удаляем использованный блок
        const usedBlock = document.querySelector(`.block[data-block-id="${blockId}"]`);
        if (usedBlock) {
            usedBlock.remove();
        }
        
        // Проверка на заполненные линии
        checkLines();
        
        // Если все блоки использованы, генерируем новые
        if (document.querySelectorAll('.block').length === 0) {
            generateNewBlocks();
        }
        
        // Проверяем, возможно ли разместить оставшиеся блоки
        checkGameOver();
    }
    
    // Сбрасываем текущий перетаскиваемый блок
    window.currentDraggingShape = null;
    window.currentDraggingColor = null;
}

// Проверка заполненных линий (горизонтальных и вертикальных)
function checkLines() {
    const gridWidth = 10;
    let totalLinesCleared = 0;
    
    // Проверка горизонтальных линий
    for (let row = 0; row < 10; row++) {
        let isRowFilled = true;
        for (let col = 0; col < 10; col++) {
            const cellIndex = row * gridWidth + col;
            const cell = document.querySelector(`.cell[data-index="${cellIndex}"]`);
            if (!cell.classList.contains('filled')) {
                isRowFilled = false;
                break;
            }
        }
        
        if (isRowFilled) {
            // Анимация очистки строки
            for (let col = 0; col < 10; col++) {
                const cellIndex = row * gridWidth + col;
                const cell = document.querySelector(`.cell[data-index="${cellIndex}"]`);
                
                // Добавляем анимацию
                cell.style.transition = 'all 0.3s';
                cell.style.transform = 'scale(0.1)';
                cell.style.opacity = '0';
                
                setTimeout(() => {
                    cell.classList.remove('filled');
                    cell.style.backgroundColor = '';
                    cell.style.transform = '';
                    cell.style.opacity = '';
                    cell.style.transition = '';
                }, 300);
            }
            
            totalLinesCleared++;
        }
    }
    
    // Проверка вертикальных линий
    for (let col = 0; col < 10; col++) {
        let isColFilled = true;
        for (let row = 0; row < 10; row++) {
            const cellIndex = row * gridWidth + col;
            const cell = document.querySelector(`.cell[data-index="${cellIndex}"]`);
            if (!cell.classList.contains('filled')) {
                isColFilled = false;
                break;
            }
        }
        
        if (isColFilled) {
            // Анимация очистки столбца
            for (let row = 0; row < 10; row++) {
                const cellIndex = row * gridWidth + col;
                const cell = document.querySelector(`.cell[data-index="${cellIndex}"]`);
                
                // Добавляем анимацию
                cell.style.transition = 'all 0.3s';
                cell.style.transform = 'scale(0.1)';
                cell.style.opacity = '0';
                
                setTimeout(() => {
                    cell.classList.remove('filled');
                    cell.style.backgroundColor = '';
                    cell.style.transform = '';
                    cell.style.opacity = '';
                    cell.style.transition = '';
                }, 300);
            }
            
            totalLinesCleared++;
        }
    }
    
    // Начисляем очки
    if (totalLinesCleared > 0) {
        // Больше очков за одновременную очистку нескольких линий
        const points = totalLinesCleared * 100 * totalLinesCleared;
        updateScore(points);
    }
}

// Обновление счета
function updateScore(points) {
    score += points;
    
    // Если элемент счета не существует, создаем его
    let scoreElement = document.getElementById('score');
    if (!scoreElement) {
        scoreElement = document.createElement('div');
        scoreElement.id = 'score';
        scoreElement.classList.add('score');
        document.querySelector('.game-container').prepend(scoreElement);
    }
    
    // Анимация обновления счета
    if (points > 0) {
        const oldScore = scoreElement.textContent;
        scoreElement.style.transform = 'scale(1.2)';
        scoreElement.textContent = score;
        
        // Создаем анимацию плюс очков
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
        
        // Добавляем стили анимации
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
        
        // Удаляем анимацию после завершения
        setTimeout(() => {
            pointsAnim.remove();
            scoreElement.style.transform = '';
        }, 1000);
    } else {
        scoreElement.textContent = score;
    }
}

// Проверка на возможность размещения блоков (конец игры)
function checkGameOver() {
    const remainingBlocks = document.querySelectorAll('.block');
    let canPlaceAny = false;
    
    // Для каждого оставшегося блока
    for (let block of remainingBlocks) {
        const blockId = block.dataset.blockId;
        const shape = blockShapes[blockId].shape;
        
        // Проверяем все возможные позиции на сетке
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 10; col++) {
                if (checkPlacement(row, col, shape)) {
                    canPlaceAny = true;
                    break;
                }
            }
            if (canPlaceAny) break;
        }
        if (canPlaceAny) break;
    }
    
    // Если никакой блок нельзя разместить, игра окончена
    if (!canPlaceAny && remainingBlocks.length > 0) {
        // Создаем диалог окончания игры
        const gameOverDialog = document.createElement('div');
        gameOverDialog.classList.add('game-over-dialog');
        gameOverDialog.innerHTML = `
            <div class="game-over-content">
                <h2>Игра окончена!</h2>
                <p>Ваш счет: <span class="final-score">${score}</span></p>
                <button id="restart-button">Играть снова</button>
            </div>
        `;
        
        // Стили для диалога
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
        
        const content = gameOverDialog.querySelector('.game-over-content');
        content.style.backgroundColor = '#4169E1';
        content.style.padding = '30px';
        content.style.borderRadius = '15px';
        content.style.textAlign = 'center';
        content.style.boxShadow = '0 0 20px rgba(0, 0, 0, 0.5)';
        
        const finalScore = gameOverDialog.querySelector('.final-score');
        finalScore.style.fontSize = '32px';
        finalScore.style.fontWeight = 'bold';
        finalScore.style.color = '#FFD700';
        
        const restartButton = gameOverDialog.querySelector('#restart-button');
        restartButton.style.padding = '10px 20px';
        restartButton.style.fontSize = '18px';
        restartButton.style.backgroundColor = '#50C878';
        restartButton.style.color = 'white';
        restartButton.style.border = 'none';
        restartButton.style.borderRadius = '5px';
        restartButton.style.marginTop = '20px';
        restartButton.style.cursor = 'pointer';
        
        document.body.appendChild(gameOverDialog);
        
        // Обработчик для кнопки рестарта
        restartButton.addEventListener('click', () => {
            gameOverDialog.remove();
            score = 0;
            initGame();
        });
    }
}

// Запуск игры
window.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('resize', () => {
        calculateCellSize();
        // Обновляем размеры блоков в соответствии с новым размером ячейки
        document.querySelectorAll('.block').forEach(block => {
            const blockId = block.dataset.blockId;
            const shape = blockShapes[blockId].shape;
            // Рассчитываем размеры блока
            const rows = shape.length;
            const cols = Math.max(...shape.map(row => row.length));
            const blockCellSize = cellSize * 0.8;
            block.style.width = cols * blockCellSize + 'px';
            block.style.height = rows * blockCellSize + 'px';
            
            // Обновляем размеры ячеек блока
            block.querySelectorAll('.block-cell').forEach(cell => {
                cell.style.width = blockCellSize + 'px';
                cell.style.height = blockCellSize + 'px';
            });
        });
    });
    initGame();
});
