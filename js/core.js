const GameCore = (() => {
    // Расширенный набор шаблонов блоков, включая блоки разного размера
    const blockTemplates = [
        // Маленькие блоки (размер 1-2)
        [[1]],                            // 1×1 точка
        [[1, 1]],                         // 1×2 горизонтальная линия
        [[1], [1]],                       // 2×1 вертикальная линия
        
        // Средние блоки (размер 2-4)
        [[1, 1], [1, 1]],                 // 2×2 квадрат
        [[1, 1, 1]],                      // 1×3 горизонтальная линия
        [[1], [1], [1]],                  // 3×1 вертикальная линия
        [[1, 1, 1], [0, 1, 0]],           // Т-образная форма
        [[1, 1], [0, 1], [0, 1]],         // Г-образная форма
        [[1, 1], [1, 0], [1, 0]],         // Обратная Г-форма
        [[1, 1, 0], [0, 1, 1]],           // Z-образная форма
        [[0, 1, 1], [1, 1, 0]],           // S-образная форма
        
        // Большие блоки (размер 4-6)
        [[1, 1, 1, 1]],                   // 1×4 горизонтальная линия
        [[1], [1], [1], [1]],             // 4×1 вертикальная линия
        [[1, 1, 1], [1, 0, 0], [1, 0, 0]], // L-образная форма большая
        [[1, 1, 1], [0, 0, 1], [0, 0, 1]], // Обратная L-форма большая
        [[1, 0, 0], [1, 1, 1], [1, 0, 0]], // Крестообразная форма
        [[0, 1, 0], [1, 1, 1], [0, 1, 0]], // Плюс
        [[1, 1, 1, 1], [1, 0, 0, 0]],      // Большая Г-форма
        [[1, 1], [1, 1], [1, 1]]           // 2×3 прямоугольник
    ];
    
    // Весовые категории блоков для более сбалансированной рандомизации
    const blockWeights = [
        // Маленькие блоки - более высокий шанс выпадения
        { indices: [0, 1, 2], weight: 15 },
        // Средние блоки - средний шанс выпадения
        { indices: [3, 4, 5, 6, 7, 8, 9, 10], weight: 10 },
        // Большие блоки - меньший шанс выпадения
        { indices: [11, 12, 13, 14, 15, 16, 17, 18], weight: 5 }
    ];
    
    // История последних сгенерированных блоков, чтобы избежать повторов
    let lastGeneratedBlockIndices = [];
    const colors = ['#4169E1', '#50C878', '#FF4500', '#9370DB', '#FFD700', '#87CEEB', '#FF69B4', '#32CD32', '#FF7F50'];
    let cellSize = 0;
    let score = 0;
    let highScore = 0;
    let gridCells = [];
    let blockShapes = {};
    let gameOver = false;
    
    // Функция для глубокого клонирования массивов
    function deepClone(arr) {
        return JSON.parse(JSON.stringify(arr));
    }
    
    function calculateCellSize(grid) {
        const gridComputedStyle = window.getComputedStyle(grid);
        const gridWidth = parseInt(gridComputedStyle.width) - 
                         parseInt(gridComputedStyle.paddingLeft) - 
                         parseInt(gridComputedStyle.paddingRight);
        return Math.floor(gridWidth / 10);
    }
    
    function createGrid(grid, isTouchDevice, handlers) {
        grid.innerHTML = '';
        const fragment = document.createDocumentFragment();
        gridCells = [];
        
        for (let i = 0; i < 100; i++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.index = i;
            
            if (!isTouchDevice) {
                cell.addEventListener('dragover', handlers.dragOver);
                cell.addEventListener('drop', handlers.drop);
            }
            
            fragment.appendChild(cell);
            gridCells.push(cell);
        }
        
        grid.appendChild(fragment);
        return gridCells;
    }
    
    // Функция взвешенной рандомизации
    function weightedRandom() {
        // Вычисляем общую сумму весов
        const totalWeight = blockWeights.reduce((sum, category) => sum + category.weight, 0);
        
        // Генерируем случайное число от 0 до суммы весов
        let random = Math.random() * totalWeight;
        
        // Находим категорию блоков на основе весов
        for (let category of blockWeights) {
            if (random < category.weight) {
                // Выбираем случайный блок из этой категории, избегая повторов
                let availableIndices = category.indices.filter(idx => !lastGeneratedBlockIndices.includes(idx));
                
                // Если все блоки из категории уже были недавно сгенерированы, используем все индексы
                if (availableIndices.length === 0) {
                    availableIndices = [...category.indices];
                }
                
                const selectedIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
                
                // Сохраняем индекс в истории (максимум 5 последних блоков)
                lastGeneratedBlockIndices.push(selectedIndex);
                if (lastGeneratedBlockIndices.length > 5) {
                    lastGeneratedBlockIndices.shift();
                }
                
                return selectedIndex;
            }
            random -= category.weight;
        }
        
        // Если по какой-то причине мы здесь, возвращаем случайный индекс
        return Math.floor(Math.random() * blockTemplates.length);
    }
    
    function generateBlockShape() {
        const selectedIndex = weightedRandom();
        // Создаем глубокую копию шаблона, чтобы избежать проблем с общей ссылкой
        return deepClone(blockTemplates[selectedIndex]);
    }
    
    function generateBlockColor() {
        // Исключаем использование того же цвета дважды подряд
        let availableColors = [...colors];
        const lastColors = Object.values(blockShapes).map(block => block.color);
        
        if (lastColors.length > 0) {
            availableColors = availableColors.filter(color => !lastColors.includes(color));
            
            // Если все цвета уже использованы, сбрасываем ограничение
            if (availableColors.length === 0) {
                availableColors = [...colors];
            }
        }
        
        return availableColors[Math.floor(Math.random() * availableColors.length)];
    }
    
    function checkPlacement(row, col, shape) {
        if (!shape || shape.length === 0) return false;
        
        const gridWidth = 10;
        
        // Быстрая проверка границ в целом перед перебором ячеек
        const rows = shape.length;
        const lastRowIndex = row + rows - 1;
        
        if (lastRowIndex >= 10 || row < 0) {
            return false;
        }
        
        // Найдем максимальную ширину блока
        let maxWidth = 0;
        for (let i = 0; i < rows; i++) {
            if (!shape[i]) continue; // Защита от undefined
            maxWidth = Math.max(maxWidth, shape[i].length);
        }
        
        const lastColIndex = col + maxWidth - 1;
        if (lastColIndex >= 10 || col < 0) {
            return false;
        }
        
        // Теперь проверяем каждую ячейку
        for (let i = 0; i < rows; i++) {
            if (!shape[i]) continue; // Защита от undefined
            
            const rowWidth = shape[i].length;
            for (let j = 0; j < rowWidth; j++) {
                if (shape[i][j]) {
                    const newRow = row + i;
                    const newCol = col + j;
                    
                    // Дополнительная проверка границ
                    if (newRow < 0 || newRow >= 10 || newCol < 0 || newCol >= 10) {
                        return false;
                    }
                    
                    const targetIndex = newRow * gridWidth + newCol;
                    // Проверка существования ячейки и заполненности
                    if (!gridCells[targetIndex] || gridCells[targetIndex].classList.contains('filled')) {
                        return false;
                    }
                }
            }
        }
        
        return true;
    }
    
    function placeBlock(row, col, shape, color, onLinesClear) {
        if (!shape || shape.length === 0) return false;
        
        const gridWidth = 10;
        const rows = shape.length;
        
        // Используем DocumentFragment для более эффективного изменения DOM
        const fragment = document.createDocumentFragment();
        const cellsToUpdate = [];
        
        for (let i = 0; i < rows; i++) {
            if (!shape[i]) continue; // Защита от undefined
            
            const rowWidth = shape[i].length;
            for (let j = 0; j < rowWidth; j++) {
                if (shape[i][j]) {
                    const newRow = row + i;
                    const newCol = col + j;
                    
                    // Дополнительная проверка границ
                    if (newRow < 0 || newRow >= 10 || newCol < 0 || newCol >= 10) {
                        continue;
                    }
                    
                    const targetIndex = newRow * gridWidth + newCol;
                    const targetCell = gridCells[targetIndex];
                    
                    if (targetCell) {
                        cellsToUpdate.push({ cell: targetCell, color });
                    }
                }
            }
        }
        
        // Если нет ячеек для обновления, возвращаем false
        if (cellsToUpdate.length === 0) {
            return false;
        }
        
        // Немедленно обновляем ячейки для устранения задержки
        cellsToUpdate.forEach(item => {
            item.cell.classList.add('filled');
            item.cell.style.backgroundColor = item.color;
        });
        
        // Немедленно проверяем линии
        setTimeout(() => {
            checkLines(onLinesClear);
        }, 10);
        
        return true;
    }
    
    function checkLines(onLinesClear) {
        const gridWidth = 10;
        const gridHeight = 10;
        let linesToClear = [];
        let totalLinesCleared = 0;
        
        // Создаем массив заполненных ячеек для быстрого доступа
        const filledCellsMap = Array(gridHeight).fill().map(() => Array(gridWidth).fill(false));
        
        // Заполняем карту ячеек
        for (let row = 0; row < gridHeight; row++) {
            for (let col = 0; col < gridWidth; col++) {
                const cellIndex = row * gridWidth + col;
                filledCellsMap[row][col] = gridCells[cellIndex] && gridCells[cellIndex].classList.contains('filled');
            }
        }
        
        // Проверка строк
        for (let row = 0; row < gridHeight; row++) {
            let isRowFilled = true;
            for (let col = 0; col < gridWidth; col++) {
                if (!filledCellsMap[row][col]) {
                    isRowFilled = false;
                    break;
                }
            }
            
            if (isRowFilled) {
                totalLinesCleared++;
                // Добавляем все ячейки из заполненной строки в список для очистки
                for (let col = 0; col < gridWidth; col++) {
                    const cellIndex = row * gridWidth + col;
                    if (!linesToClear.includes(cellIndex)) {
                        linesToClear.push(cellIndex);
                    }
                }
            }
        }
        
        // Проверка столбцов
        for (let col = 0; col < gridWidth; col++) {
            let isColFilled = true;
            for (let row = 0; row < gridHeight; row++) {
                if (!filledCellsMap[row][col]) {
                    isColFilled = false;
                    break;
                }
            }
            
            if (isColFilled) {
                totalLinesCleared++;
                // Добавляем все ячейки из заполненного столбца в список для очистки
                for (let row = 0; row < gridHeight; row++) {
                    const cellIndex = row * gridWidth + col;
                    if (!linesToClear.includes(cellIndex)) {
                        linesToClear.push(cellIndex);
                    }
                }
            }
        }
        
        // Если нашли линии для очистки
        if (linesToClear.length > 0) {
            // Начисляем очки с бонусом за несколько линий
            const points = totalLinesCleared * 100 * totalLinesCleared;
            score += points;
            highScore = Math.max(highScore, score);
            
            // Группируем ячейки по строкам и столбцам для визуальных эффектов
            const groupedCells = {};
            linesToClear.forEach(index => {
                groupedCells[index] = {
                    row: Math.floor(index / gridWidth),
                    col: index % gridWidth,
                    element: gridCells[index]
                };
            });
            
            // Создаем последовательность анимаций
            const animateCells = () => {
                // Этап 1: Подсветка линий
                linesToClear.forEach(index => {
                    if (gridCells[index]) {
                        const cell = gridCells[index];
                        cell.style.transition = 'all 0.15s ease-in-out';
                        cell.style.backgroundColor = '#FFD700'; // Золотой цвет
                        cell.style.boxShadow = '0 0 8px #FFD700';
                        cell.style.zIndex = '2';
                    }
                });
                
                // Этап 2: Анимация исчезновения
                setTimeout(() => {
                    linesToClear.forEach(index => {
                        if (gridCells[index]) {
                            const cell = gridCells[index];
                            cell.style.transition = 'all 0.3s ease-out';
                            cell.style.transform = 'scale(0.1)';
                            cell.style.opacity = '0';
                        }
                    });
                    
                    // Этап 3: Завершение и очистка
                    setTimeout(() => {
                        linesToClear.forEach(index => {
                            if (gridCells[index]) {
                                const cell = gridCells[index];
                                cell.classList.remove('filled');
                                cell.style.backgroundColor = '';
                                cell.style.transform = '';
                                cell.style.opacity = '';
                                cell.style.transition = '';
                                cell.style.boxShadow = '';
                                cell.style.zIndex = '';
                            }
                        });
                        
                        // Вызываем колбэк для обновления счета
                        if (typeof onLinesClear === 'function') {
                            onLinesClear(points);
                        }
                    }, 300);
                }, 150);
            };
            
            // Запускаем анимации
            requestAnimationFrame(animateCells);
            
            return true;
        }
        
        return false;
    }
    
    function canPlaceAnyBlock(shapes) {
        // Проверяем, есть ли вообще блоки для размещения
        if (!shapes || Object.keys(shapes).length === 0) {
            console.log("Нет блоков для проверки размещения");
            return false;
        }
        
        // Проверка, существуют ли формы блоков
        let hasValidBlocks = false;
        for (let blockId in shapes) {
            if (shapes[blockId] && shapes[blockId].shape && shapes[blockId].shape.length > 0) {
                hasValidBlocks = true;
                break;
            }
        }
        
        if (!hasValidBlocks) {
            console.log("Нет действительных форм блоков");
            return false;
        }
        
        // Если мы в начале игры, всегда возвращаем true для предотвращения преждевременного завершения игры
        // Эта проверка дополняет проверку в ui.js, но выполняется здесь на всякий случай
        const filledCount = countFilledCells();
        if (filledCount < 25) {
            console.log("Игра только началась (занято менее 25 ячеек), пропускаем проверку");
            return true;
        }
        
        // Кэшируем информацию о занятых ячейках для ускорения проверки
        const gridWidth = 10;
        const gridHeight = 10;
        
        // Создаем матрицу состояния сетки для более точной проверки
        const grid = Array(gridHeight).fill().map(() => Array(gridWidth).fill(false));
        
        // Заполняем матрицу состояния занятыми ячейками
        for (let row = 0; row < gridHeight; row++) {
            for (let col = 0; col < gridWidth; col++) {
                const index = row * gridWidth + col;
                if (gridCells[index] && gridCells[index].classList.contains('filled')) {
                    grid[row][col] = true;
                }
            }
        }
        
        // Проверяем каждую возможную позицию для каждого блока
        for (let row = 0; row < gridHeight; row++) {
            for (let col = 0; col < gridWidth; col++) {
                for (let blockId in shapes) {
                    if (!shapes[blockId] || !shapes[blockId].shape) continue;
                    
                    const shape = shapes[blockId].shape;
                    if (checkPlacementFast(row, col, shape, grid)) {
                        console.log(`Блок ${blockId} может быть размещен на позиции [${row}, ${col}]`);
                        return true;
                    }
                }
            }
        }
        
        // Если дошли до этой точки, ни один блок не может быть размещен
        console.log("Ни один блок не может быть размещен");
        return false;
    }
    
    // Вспомогательная функция для подсчета заполненных ячеек
    function countFilledCells() {
        let filledCount = 0;
        const gridWidth = 10;
        const gridHeight = 10;
        
        for (let row = 0; row < gridHeight; row++) {
            for (let col = 0; col < gridWidth; col++) {
                const index = row * gridWidth + col;
                if (gridCells[index] && gridCells[index].classList.contains('filled')) {
                    filledCount++;
                }
            }
        }
        
        return filledCount;
    }
    
    // Оптимизированная версия checkPlacement для быстрой проверки окончания игры
    function checkPlacementFast(row, col, shape, grid) {
        if (!shape || shape.length === 0) return false;
        
        const rows = shape.length;
        const lastRowIndex = row + rows - 1;
        
        if (lastRowIndex >= 10 || row < 0) {
            return false;
        }
        
        // Найдем максимальную ширину блока
        let maxWidth = 0;
        for (let i = 0; i < rows; i++) {
            if (!shape[i]) continue;
            maxWidth = Math.max(maxWidth, shape[i].length);
        }
        
        const lastColIndex = col + maxWidth - 1;
        if (lastColIndex >= 10 || col < 0) {
            return false;
        }
        
        // Теперь проверяем каждую ячейку
        for (let i = 0; i < rows; i++) {
            if (!shape[i]) continue;
            
            const rowWidth = shape[i].length;
            for (let j = 0; j < rowWidth; j++) {
                if (shape[i][j]) {
                    const newRow = row + i;
                    const newCol = col + j;
                    
                    // Проверка границ и занятости ячеек
                    if (newRow < 0 || newRow >= 10 || newCol < 0 || newCol >= 10 || grid[newRow][newCol]) {
                        return false;
                    }
                }
            }
        }
        
        return true;
    }
    
    function isGameOver() {
        return gameOver;
    }
    
    function setGameOver(value) {
        gameOver = value;
    }
    
    function resetScore() {
        score = 0;
        gameOver = false;
    }
    
    function setCellSize(size) {
        cellSize = size;
    }
    
    function setBlockShapes(shapes) {
        blockShapes = shapes || {};
    }
    
    function getScore() {
        return score;
    }
    
    function getHighScore() {
        return highScore;
    }
    
    // Отладочная функция для проверки блока
    function validateBlock(blockId, shapes) {
        if (!shapes || !shapes[blockId] || !shapes[blockId].shape) {
            console.error('Некорректный блок:', blockId, shapes ? shapes[blockId] : 'shapes не определено');
            return false;
        }
        return true;
    }
    
    // Добавляем новую функцию для диагностики состояния сетки
    function diagnosticGridState() {
        const gridWidth = 10;
        const gridHeight = 10;
        let filledCount = 0;
        
        for (let row = 0; row < gridHeight; row++) {
            for (let col = 0; col < gridWidth; col++) {
                const index = row * gridWidth + col;
                if (gridCells[index] && gridCells[index].classList.contains('filled')) {
                    filledCount++;
                }
            }
        }
        
        return {
            total: gridWidth * gridHeight,
            filled: filledCount,
            empty: gridWidth * gridHeight - filledCount
        };
    }
    
    return {
        generateBlockShape,
        generateBlockColor,
        calculateCellSize,
        createGrid,
        checkPlacement,
        placeBlock,
        checkLines,
        canPlaceAnyBlock,
        isGameOver,
        setGameOver,
        resetScore,
        setCellSize,
        setBlockShapes,
        getScore,
        getHighScore,
        validateBlock,
        deepClone,
        diagnosticGridState,
        countFilledCells
    };
})();