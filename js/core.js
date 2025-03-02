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
    let blockShapes = [];
    
    function calculateCellSize(grid) {
        const gridComputedStyle = window.getComputedStyle(grid);
        const gridWidth = parseInt(gridComputedStyle.width) - 
                         parseInt(gridComputedStyle.paddingLeft) - 
                         parseInt(gridComputedStyle.paddingRight);
        return gridWidth / 10;
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
        return blockTemplates[selectedIndex];
    }
    
    function generateBlockColor() {
        // Исключаем использование того же цвета дважды подряд
        let availableColors = [...colors];
        const lastColors = blockShapes.map(block => block.color);
        
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
            maxWidth = Math.max(maxWidth, shape[i].length);
        }
        
        const lastColIndex = col + maxWidth - 1;
        if (lastColIndex >= 10 || col < 0) {
            return false;
        }
        
        // Теперь проверяем каждую ячейку
        for (let i = 0; i < rows; i++) {
            const rowWidth = shape[i].length;
            for (let j = 0; j < rowWidth; j++) {
                if (shape[i][j]) {
                    const newRow = row + i;
                    const newCol = col + j;
                    
                    const targetIndex = newRow * gridWidth + newCol;
                    // Ячейка уже проверена по общим границам выше
                    if (gridCells[targetIndex].classList.contains('filled')) {
                        return false;
                    }
                }
            }
        }
        
        return true;
    }
    
    function placeBlock(row, col, shape, color) {
        const gridWidth = 10;
        const rows = shape.length;
        
        // Используем DocumentFragment для более эффективного изменения DOM
        const fragment = document.createDocumentFragment();
        const cellsToUpdate = [];
        
        for (let i = 0; i < rows; i++) {
            const rowWidth = shape[i].length;
            for (let j = 0; j < rowWidth; j++) {
                if (shape[i][j]) {
                    const newRow = row + i;
                    const newCol = col + j;
                    
                    const targetIndex = newRow * gridWidth + newCol;
                    const targetCell = gridCells[targetIndex];
                    
                    cellsToUpdate.push({ cell: targetCell, color });
                }
            }
        }
        
        // Группируем обновления для улучшения производительности
        requestAnimationFrame(() => {
            cellsToUpdate.forEach(item => {
                item.cell.classList.add('filled');
                item.cell.style.backgroundColor = item.color;
            });
        });
    }
    
    function checkLines(onLinesClear) {
        const gridWidth = 10;
        let linesToClear = [];
        let totalLinesCleared = 0;
        
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
            score += points;
            highScore = Math.max(highScore, score);
            
            linesToClear.forEach(index => {
                const cell = gridCells[index];
                cell.style.transition = 'all 0.3s';
                cell.style.transform = 'scale(0.1)';
                cell.style.opacity = '0';
            });
            
            setTimeout(() => {
                requestAnimationFrame(() => {
                    linesToClear.forEach(index => {
                        const cell = gridCells[index];
                        cell.classList.remove('filled');
                        cell.style.backgroundColor = '';
                        cell.style.transform = '';
                        cell.style.opacity = '';
                        cell.style.transition = '';
                    });
                });
                
                onLinesClear(points);
            }, 300);
        }
    }
    
    function canPlaceAnyBlock(shapes) {
        // Кэшируем информацию о занятых ячейках для ускорения проверки
        const filledCells = new Set();
        gridCells.forEach((cell, index) => {
            if (cell.classList.contains('filled')) {
                filledCells.add(index);
            }
        });
        
        // Проверяем только по периметру заполненных ячеек
        // и пустым ячейкам рядом с ними, вместо всей сетки
        const gridWidth = 10;
        const cellsToCheck = new Set();
        
        // Если сетка пуста, проверяем только центр
        if (filledCells.size === 0) {
            // Проверяем только центральную область для пустой сетки
            for (let row = 3; row < 7; row++) {
                for (let col = 3; col < 7; col++) {
                    cellsToCheck.add(row * gridWidth + col);
                }
            }
        } else {
            // Исследуем периметр заполненных клеток
            filledCells.forEach(index => {
                const row = Math.floor(index / gridWidth);
                const col = index % gridWidth;
                
                // Добавляем соседние ячейки
                for (let r = Math.max(0, row - 1); r <= Math.min(9, row + 1); r++) {
                    for (let c = Math.max(0, col - 1); c <= Math.min(9, col + 1); c++) {
                        const neighborIndex = r * gridWidth + c;
                        if (!filledCells.has(neighborIndex)) {
                            cellsToCheck.add(neighborIndex);
                        }
                    }
                }
            });
        }
        
        // Проверяем возможность размещения для каждого блока
        for (let blockId in shapes) {
            const shape = shapes[blockId].shape;
            
            for (let cellIndex of cellsToCheck) {
                const row = Math.floor(cellIndex / gridWidth);
                const col = cellIndex % gridWidth;
                
                if (checkPlacement(row, col, shape)) {
                    return true;
                }
            }
        }
        
        // Если нужно, проверяем все остальные ячейки (более редкий сценарий)
        if (cellsToCheck.size < 50) {
            for (let row = 0; row < 10; row++) {
                for (let col = 0; col < 10; col++) {
                    const index = row * gridWidth + col;
                    
                    if (!cellsToCheck.has(index) && !filledCells.has(index)) {
                        for (let blockId in shapes) {
                            const shape = shapes[blockId].shape;
                            if (checkPlacement(row, col, shape)) {
                                return true;
                            }
                        }
                    }
                }
            }
        }
        
        return false;
    }
    
    function resetScore() {
        score = 0;
    }
    
    function setCellSize(size) {
        cellSize = size;
    }
    
    function setBlockShapes(shapes) {
        blockShapes = shapes;
    }
    
    function getScore() {
        return score;
    }
    
    function getHighScore() {
        return highScore;
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
        resetScore,
        setCellSize,
        setBlockShapes,
        getScore,
        getHighScore
    };
})();