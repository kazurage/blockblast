const GameCore = (() => {
    const blockTemplates = [
        [[1, 1], [1, 1]],
        [[1, 1, 1]],
        [[1], [1], [1]],
        [[1, 1, 1], [0, 1, 0]],
        [[1, 1], [0, 1], [0, 1]],
        [[1, 1], [1, 0], [1, 0]],
        [[1, 1, 0], [0, 1, 1]],
        [[0, 1, 1], [1, 1, 0]],
        [[1, 1, 1, 1]],
        [[1], [1], [1], [1]],
        [[1, 1], [1, 1], [1, 1]],
        [[1, 1, 1], [1, 1, 1]],
        [[1, 0], [1, 1], [0, 1]],
        [[1, 0, 0], [1, 1, 1]],
        [[0, 0, 1], [1, 1, 1]],
        [[1, 1, 1], [1, 0, 1]],
        [[1, 0, 1], [1, 1, 1]],
        [[1]],
        [[1, 1]],
        [[1], [1]],
        [[1, 1, 1, 1, 1]],
        [[1], [1], [1], [1], [1]],
        [[1, 1, 0], [0, 1, 0], [0, 1, 1]],
        [[1, 1], [1, 0]],
        [[1, 1], [0, 1]]
    ];
    
    const blockSizes = ['small', 'medium', 'large'];
    
    const colors = ['#4169E1', '#50C878', '#FF4500', '#9370DB', '#FFD700', '#87CEEB'];
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
    
    function generateBlockShape() {
        return blockTemplates[Math.floor(Math.random() * blockTemplates.length)];
    }
    
    function generateBlockColor() {
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    function generateBlockSize() {
        return blockSizes[Math.floor(Math.random() * blockSizes.length)];
    }
    
    function checkPlacement(row, col, shape) {
        const gridWidth = 10;
        
        for (let i = 0; i < shape.length; i++) {
            for (let j = 0; j < shape[i].length; j++) {
                if (shape[i][j]) {
                    const newRow = row + i;
                    const newCol = col + j;
                    
                    if (newRow >= 10 || newCol >= 10 || newRow < 0 || newCol < 0) {
                        return false;
                    }
                    
                    const targetIndex = newRow * gridWidth + newCol;
                    const targetCell = gridCells[targetIndex];
                    
                    if (!targetCell || targetCell.classList.contains('filled')) {
                        return false;
                    }
                }
            }
        }
        
        return true;
    }
    
    function placeBlock(row, col, shape, color) {
        const gridWidth = 10;
        
        for (let i = 0; i < shape.length; i++) {
            for (let j = 0; j < shape[i].length; j++) {
                if (shape[i][j]) {
                    const newRow = row + i;
                    const newCol = col + j;
                    
                    const targetIndex = newRow * gridWidth + newCol;
                    const targetCell = gridCells[targetIndex];
                    
                    targetCell.classList.add('filled');
                    targetCell.style.backgroundColor = color;
                }
            }
        }
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
        for (let blockId in shapes) {
            const shape = shapes[blockId].shape;
            
            for (let row = 0; row < 10; row++) {
                for (let col = 0; col < 10; col++) {
                    if (checkPlacement(row, col, shape)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    
    function resetScore() {
        score = 0;
    }
    
    return {
        generateBlockShape,
        generateBlockColor,
        generateBlockSize,
        calculateCellSize,
        createGrid,
        checkPlacement,
        placeBlock,
        checkLines,
        canPlaceAnyBlock,
        resetScore,
        getScore: () => score,
        getHighScore: () => highScore,
        setBlockShapes: (shapes) => blockShapes = shapes,
        setCellSize: (size) => cellSize = size,
    };
})();