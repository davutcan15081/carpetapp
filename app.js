class CarpetApp {
    constructor() {
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.roomImage = null;
        this.carpetImage = null;
        
        this.selectionPoints = [];
        this.isSelecting = false;
        this.isApplying = false;
        
        this.originalImageData = null;
        
        // Carpet transform properties
        this.carpetX = 0;
        this.carpetY = 0;
        this.carpetWidth = 200;
        this.carpetHeight = 200;
        this.carpetRotation = 0;
        this.carpetVisible = false;
        
        // Perspective control points (4 corners)
        this.perspectivePoints = []; // Will be initialized when carpet is loaded
        this.isDraggingPerspectivePoint = false;
        this.draggedPerspectivePointIndex = -1;
        
        // Drag and rotation state
        this.isDraggingCarpet = false;
        this.isRotatingCarpet = false;
        this.isResizingCarpet = false;
        this.resizeHandle = null; // 'nw', 'ne', 'sw', 'se'
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.initialCarpetX = 0;
        this.initialCarpetY = 0;
        this.initialCarpetWidth = 0;
        this.initialCarpetHeight = 0;
        this.initialRotation = 0;
        
        this.embedMode = this.checkEmbedMode();
        this.config = this.loadConfig();
        
        this.initEventListeners();
        this.initPostMessageListener();
        this.applyConfig();
    }
    
    initEventListeners() {
        document.getElementById('roomImageInput').addEventListener('change', (e) => this.handleRoomImageUpload(e));
        document.getElementById('carpetImageInput').addEventListener('change', (e) => this.handleCarpetImageUpload(e));
        
        document.getElementById('applyCarpetBtn').addEventListener('click', () => this.applyCarpet());
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());
        
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
        this.canvas.addEventListener('mousedown', (e) => this.handleCanvasMouseDown(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleCanvasMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleCanvasMouseUp(e));
    }
    
    handleRoomImageUpload(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    this.roomImage = img;
                    this.displayRoomImage();
                    document.getElementById('roomImageName').textContent = file.name;
                    this.updateStatus('Oda görüntüsü yüklendi. Halı yükleyebilirsiniz.');
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    }
    
    handleCarpetImageUpload(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    this.carpetImage = img;
                    document.getElementById('carpetImageName').textContent = file.name;
                    this.updateStatus('Halı görüntüsü yüklendi. Sürükleyip yerleştirebilirsiniz.');
                    
                    // Initialize carpet position in center of canvas
                    if (this.canvas.width > 0) {
                        this.carpetX = (this.canvas.width - 200) / 2;
                        this.carpetY = (this.canvas.height - 200) / 2;
                        this.carpetWidth = Math.min(200, this.canvas.width * 0.4);
                        this.carpetHeight = Math.min(200, this.canvas.height * 0.4);
                        this.carpetRotation = 0;
                        this.carpetVisible = true;
                        
                        // Initialize perspective points (4 corners)
                        this.perspectivePoints = [
                            { x: this.carpetX, y: this.carpetY }, // top-left
                            { x: this.carpetX + this.carpetWidth, y: this.carpetY }, // top-right
                            { x: this.carpetX + this.carpetWidth, y: this.carpetY + this.carpetHeight }, // bottom-right
                            { x: this.carpetX, y: this.carpetY + this.carpetHeight } // bottom-left
                        ];
                        
                        this.drawCarpet();
                    }
                    
                    this.checkApplyButton();
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    }
    
    displayRoomImage() {
        if (!this.roomImage) return;
        
        const maxWidth = 1140;
        const maxHeight = 600;
        
        let width = this.roomImage.width;
        let height = this.roomImage.height;
        
        if (width > maxWidth) {
            height = (maxWidth / width) * height;
            width = maxWidth;
        }
        
        if (height > maxHeight) {
            width = (maxHeight / height) * width;
            height = maxHeight;
        }
        
        this.canvas.width = width;
        this.canvas.height = height;
        
        this.ctx.drawImage(this.roomImage, 0, 0, width, height);
        this.originalImageData = this.ctx.getImageData(0, 0, width, height);
        
        document.getElementById('instructions').style.display = 'none';
    }
    
    startSelection() {
        if (!this.roomImage) return;
        
        this.isSelecting = true;
        this.isApplying = false;
        this.selectionPoints = [];
        
        document.getElementById('selectAreaBtn').disabled = true;
        document.getElementById('undoPointBtn').disabled = false;
        document.getElementById('clearSelectionBtn').disabled = false;
        
        this.updateStatus('Zemin alanının köşelerine tıklayın (en az 4 nokta)');
        this.canvas.style.cursor = 'crosshair';
    }
    
    handleCanvasClick(e) {
        if (this.isSelecting) {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this.selectionPoints.push({ x, y });
            this.updatePointCount();
            this.drawSelection();
            
            if (this.selectionPoints.length >= 4) {
                this.updateStatus('Halı uygulamak için "Halıyı Uygula" butonuna tıklayın');
                this.checkApplyButton();
            }
        }
    }
    
    handleCanvasMouseDown(e) {
        if (this.carpetVisible && !this.isSelecting) {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;
            
            const handleSize = 15;
            
            // Check if clicking on perspective control points
            for (let i = 0; i < this.perspectivePoints.length; i++) {
                if (this.isNearPoint(x, y, this.perspectivePoints[i].x, this.perspectivePoints[i].y, handleSize)) {
                    this.isDraggingPerspectivePoint = true;
                    this.draggedPerspectivePointIndex = i;
                    this.dragStartX = x;
                    this.dragStartY = y;
                    return;
                }
            }
            
            // Check if clicking on carpet (for dragging the whole shape)
            if (this.isPointInPolygon(x, y, this.perspectivePoints)) {
                this.isDraggingCarpet = true;
                this.dragStartX = x;
                this.dragStartY = y;
                this.initialPerspectivePoints = JSON.parse(JSON.stringify(this.perspectivePoints));
                this.canvas.style.cursor = 'grabbing';
            }
        }
    }
    
    isNearPoint(x, y, px, py, threshold) {
        return Math.sqrt((x - px) ** 2 + (y - py) ** 2) < threshold;
    }
    
    handleCanvasMouseUp(e) {
        this.isDraggingCarpet = false;
        this.isRotatingCarpet = false;
        this.isResizingCarpet = false;
        this.isDraggingPerspectivePoint = false;
        this.draggedPerspectivePointIndex = -1;
        this.resizeHandle = null;
        this.canvas.style.cursor = this.isSelecting ? 'crosshair' : 'default';
    }
    
    handleCanvasMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        
        // Handle dragging individual perspective points
        if (this.isDraggingPerspectivePoint && this.carpetVisible) {
            this.perspectivePoints[this.draggedPerspectivePointIndex].x = x;
            this.perspectivePoints[this.draggedPerspectivePointIndex].y = y;
            this.redrawCanvas();
            return;
        }
        
        // Handle carpet dragging (move all points together)
        if (this.isDraggingCarpet && this.carpetVisible) {
            const dx = x - this.dragStartX;
            const dy = y - this.dragStartY;
            
            for (let i = 0; i < this.perspectivePoints.length; i++) {
                this.perspectivePoints[i].x = this.initialPerspectivePoints[i].x + dx;
                this.perspectivePoints[i].y = this.initialPerspectivePoints[i].y + dy;
            }
            
            this.redrawCanvas();
            return;
        }
        
        // Handle selection mode
        if (!this.isSelecting || this.selectionPoints.length === 0) return;
        
        this.drawSelection();
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.selectionPoints[this.selectionPoints.length - 1].x, 
                       this.selectionPoints[this.selectionPoints.length - 1].y);
        this.ctx.lineTo(x, y);
        this.ctx.strokeStyle = '#667eea';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }
    
    drawSelection() {
        if (!this.originalImageData) return;
        
        this.ctx.putImageData(this.originalImageData, 0, 0);
        
        if (this.selectionPoints.length === 0) return;
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.selectionPoints[0].x, this.selectionPoints[0].y);
        
        for (let i = 1; i < this.selectionPoints.length; i++) {
            this.ctx.lineTo(this.selectionPoints[i].x, this.selectionPoints[i].y);
        }
        
        this.ctx.strokeStyle = '#667eea';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
        
        this.selectionPoints.forEach((point, index) => {
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
            this.ctx.fillStyle = '#667eea';
            this.ctx.fill();
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(index + 1, point.x, point.y);
        });
    }
    
    undoLastPoint() {
        if (this.selectionPoints.length > 0) {
            this.selectionPoints.pop();
            this.updatePointCount();
            this.drawSelection();
            
            if (this.selectionPoints.length === 0) {
                document.getElementById('undoPointBtn').disabled = true;
                document.getElementById('clearSelectionBtn').disabled = true;
            }
            
            this.checkApplyButton();
        }
    }
    
    clearSelection() {
        this.selectionPoints = [];
        this.updatePointCount();
        this.drawSelection();
        document.getElementById('undoPointBtn').disabled = true;
        document.getElementById('clearSelectionBtn').disabled = true;
        this.checkApplyButton();
        this.updateStatus('Seçim temizlendi. Yeni noktalar ekleyebilirsiniz.');
    }
    
    checkApplyButton() {
        const canApply = this.carpetVisible && this.carpetImage !== null;
        document.getElementById('applyCarpetBtn').disabled = !canApply;
    }
    
    applyCarpet() {
        if (!this.carpetVisible || !this.carpetImage) return;
        
        this.isSelecting = false;
        this.isApplying = true;
        
        this.updateStatus('Halı uygulanıyor...');
        
        setTimeout(() => {
            this.applyPerspectiveTransform();
            this.updateStatus('Halı başarıyla uygulandı!');
            document.getElementById('applyCarpetBtn').disabled = true;
            this.canvas.style.cursor = 'default';
        }, 100);
    }
    
    applyPerspectiveTransform() {
        // Apply carpet permanently to the room image with current perspective
        if (!this.carpetVisible || !this.carpetImage) return;
        
        // Draw the perspective-warped carpet one final time
        this.drawPerspectiveCarpet();
        
        // Update original image data to include the carpet
        this.originalImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        
        // Hide the draggable carpet layer
        this.carpetVisible = false;
        this.updateStatus('Halı başarıyla uygulandı!');
    }
    
    drawCarpet() {
        if (!this.carpetVisible || !this.carpetImage) return;
        
        this.ctx.save();
        
        // Draw perspective-warped carpet
        this.drawPerspectiveCarpet();
        
        // Draw polygon outline
        this.ctx.beginPath();
        this.ctx.moveTo(this.perspectivePoints[0].x, this.perspectivePoints[0].y);
        for (let i = 1; i < this.perspectivePoints.length; i++) {
            this.ctx.lineTo(this.perspectivePoints[i].x, this.perspectivePoints[i].y);
        }
        this.ctx.closePath();
        this.ctx.strokeStyle = '#667eea';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
        
        // Draw corner control points
        const handleSize = 12;
        this.perspectivePoints.forEach((point, index) => {
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, handleSize, 0, Math.PI * 2);
            this.ctx.fillStyle = '#667eea';
            this.ctx.fill();
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
            
            // Add point numbers
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(index + 1, point.x, point.y);
        });
        
        this.ctx.globalAlpha = 1.0;
        this.ctx.restore();
    }
    
    drawPerspectiveCarpet() {
        // Calculate bounding box of perspective points
        const minX = Math.min(...this.perspectivePoints.map(p => p.x));
        const maxX = Math.max(...this.perspectivePoints.map(p => p.x));
        const minY = Math.min(...this.perspectivePoints.map(p => p.y));
        const maxY = Math.max(...this.perspectivePoints.map(p => p.y));
        
        const width = maxX - minX;
        const height = maxY - minY;
        
        this.ctx.save();
        
        // Clip to the perspective polygon
        this.ctx.beginPath();
        this.ctx.moveTo(this.perspectivePoints[0].x, this.perspectivePoints[0].y);
        for (let i = 1; i < this.perspectivePoints.length; i++) {
            this.ctx.lineTo(this.perspectivePoints[i].x, this.perspectivePoints[i].y);
        }
        this.ctx.closePath();
        this.ctx.clip();
        
        // Draw carpet image stretched to bounding box
        this.ctx.globalAlpha = 1.0;
        this.ctx.drawImage(this.carpetImage, minX, minY, width, height);
        
        this.ctx.restore();
    }
    
    getBarycentricCoordsQuad(x, y, corners) {
        // Simplified barycentric coordinates for a quad
        // Divide quad into two triangles and use barycentric coordinates
        
        // Check which triangle the point is in
        const p0 = corners[0];
        const p1 = corners[1];
        const p2 = corners[2];
        const p3 = corners[3];
        
        // Triangle 1: p0, p1, p2
        if (this.isPointInTriangle(x, y, p0, p1, p2)) {
            const bary = this.getBarycentricTriangle(x, y, p0, p1, p2);
            return { u: bary.u, v: bary.v, w: bary.w, t: 0 };
        }
        
        // Triangle 2: p0, p2, p3
        if (this.isPointInTriangle(x, y, p0, p2, p3)) {
            const bary = this.getBarycentricTriangle(x, y, p0, p2, p3);
            return { u: bary.u, v: 0, w: bary.v, t: bary.w };
        }
        
        // Fallback
        return { u: 0.25, v: 0.25, w: 0.25, t: 0.25 };
    }
    
    isPointInTriangle(px, py, p0, p1, p2) {
        const area = 0.5 * (-p1.y * p2.x + p0.y * (-p1.x + p2.x) + p0.x * (p1.y - p2.y) + p1.x * p2.y);
        const s = 1 / (2 * area) * (p0.y * p2.x - p0.x * p2.y + (p2.y - p0.y) * px + (p0.x - p2.x) * py);
        const t = 1 / (2 * area) * (p0.x * p1.y - p0.y * p1.x + (p0.y - p1.y) * px + (p1.x - p0.x) * py);
        return s > 0 && t > 0 && (1 - s - t) > 0;
    }
    
    getBarycentricTriangle(px, py, p0, p1, p2) {
        const v0 = { x: p1.x - p0.x, y: p1.y - p0.y };
        const v1 = { x: p2.x - p0.x, y: p2.y - p0.y };
        const v2 = { x: px - p0.x, y: py - p0.y };
        
        const d00 = v0.x * v0.x + v0.y * v0.y;
        const d01 = v0.x * v1.x + v0.y * v1.y;
        const d11 = v1.x * v1.x + v1.y * v1.y;
        const d20 = v2.x * v0.x + v2.y * v0.y;
        const d21 = v2.x * v1.x + v2.y * v1.y;
        
        const denom = d00 * d11 - d01 * d01;
        const v = (d11 * d20 - d01 * d21) / denom;
        const w = (d00 * d21 - d01 * d20) / denom;
        const u = 1 - v - w;
        
        return { u, v, w };
    }
    
    calculateHomography(srcPoints, dstPoints) {
        // Calculate homography matrix using DLT (Direct Linear Transform)
        // This is a simplified version - for production use a proper linear algebra library
        
        const A = [];
        const b = [];
        
        for (let i = 0; i < 4; i++) {
            const [x, y] = srcPoints[i];
            const [u, v] = dstPoints[i];
            
            A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, -u]);
            A.push([0, 0, 0, x, y, 1, -v * x, -v * y, -v]);
            b.push(u);
            b.push(v);
        }
        
        // Solve using Gaussian elimination (simplified)
        const h = this.solveLinearSystem(A, b);
        
        return [
            [h[0], h[1], h[2]],
            [h[3], h[4], h[5]],
            [h[6], h[7], 1]
        ];
    }
    
    solveLinearSystem(A, b) {
        // Simplified Gaussian elimination
        const n = A.length;
        const augmented = A.map((row, i) => [...row, b[i]]);
        
        for (let i = 0; i < n; i++) {
            // Find pivot
            let maxRow = i;
            for (let k = i + 1; k < n; k++) {
                if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
                    maxRow = k;
                }
            }
            
            // Swap rows
            [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
            
            // Eliminate
            for (let k = i + 1; k < n; k++) {
                const factor = augmented[k][i] / augmented[i][i];
                for (let j = i; j < n + 1; j++) {
                    augmented[k][j] -= factor * augmented[i][j];
                }
            }
        }
        
        // Back substitution
        const x = new Array(n).fill(0);
        for (let i = n - 1; i >= 0; i--) {
            x[i] = augmented[i][n];
            for (let j = i + 1; j < n; j++) {
                x[i] -= augmented[i][j] * x[j];
            }
            x[i] /= augmented[i][i];
        }
        
        return x;
    }
    
    applyHomographyInverse(x, y, H) {
        // Apply inverse homography to get source coordinates
        const det = H[0][0] * (H[1][1] * H[2][2] - H[1][2] * H[2][1]) -
                   H[0][1] * (H[1][0] * H[2][2] - H[1][2] * H[2][0]) +
                   H[0][2] * (H[1][0] * H[2][1] - H[1][1] * H[2][0]);
        
        if (Math.abs(det) < 1e-10) {
            return { x: 0, y: 0 };
        }
        
        // For simplicity, use the forward homography and approximate
        // In production, you'd calculate the proper inverse matrix
        const w = H[2][0] * x + H[2][1] * y + H[2][2];
        const srcX = (H[0][0] * x + H[0][1] * y + H[0][2]) / w;
        const srcY = (H[1][0] * x + H[1][1] * y + H[1][2]) / w;
        
        return { x: srcX, y: srcY };
    }
    
    redrawCanvas() {
        if (!this.originalImageData) return;
        
        // Restore original room image
        this.ctx.putImageData(this.originalImageData, 0, 0);
        
        // Redraw selection points if in selection mode
        if (this.selectionPoints.length > 0) {
            this.drawSelection();
        }
        
        // Draw carpet layer
        this.drawCarpet();
    }
    
    isPointInPolygon(x, y, points) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const xi = points[i].x, yi = points[i].y;
            const xj = points[j].x, yj = points[j].y;
            
            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    }
    
    getBarycentricCoordinates(x, y, points) {
        const p0 = points[0];
        const p1 = points[1];
        const p2 = points[2];
        
        const det = (p1.x - p0.x) * (p2.y - p0.y) - (p2.x - p0.x) * (p1.y - p0.y);
        
        if (Math.abs(det) < 0.0001) {
            return { x: 0.5, y: 0.5 };
        }
        
        const lambda1 = ((p2.y - p0.y) * (x - p0.x) + (p0.x - p2.x) * (y - p0.y)) / det;
        const lambda2 = ((p0.y - p1.y) * (x - p0.x) + (p1.x - p0.x) * (y - p0.y)) / det;
        
        return { x: lambda1, y: lambda2 };
    }
    
    reset() {
        this.roomImage = null;
        this.carpetImage = null;
        this.selectionPoints = [];
        this.isSelecting = false;
        this.isApplying = false;
        this.originalImageData = null;
        
        // Reset carpet properties
        this.carpetX = 0;
        this.carpetY = 0;
        this.carpetWidth = 200;
        this.carpetHeight = 200;
        this.carpetRotation = 0;
        this.carpetVisible = false;
        
        // Reset drag state
        this.isDraggingCarpet = false;
        this.isRotatingCarpet = false;
        this.isResizingCarpet = false;
        this.resizeHandle = null;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.canvas.width = 0;
        this.canvas.height = 0;
        
        document.getElementById('roomImageInput').value = '';
        document.getElementById('carpetImageInput').value = '';
        document.getElementById('roomImageName').textContent = '';
        document.getElementById('carpetImageName').textContent = '';
        
        document.getElementById('applyCarpetBtn').disabled = true;
        
        document.getElementById('instructions').style.display = 'block';
        document.getElementById('instructions').innerHTML = '<p>👆 Başlamak için oda görüntüsü yükleyin</p>';
        
        this.updateStatus('Hazır');
        this.canvas.style.cursor = 'default';
    }
    
    updateStatus(message) {
        document.getElementById('statusText').textContent = message;
    }
    
    checkEmbedMode() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('embed') === 'true';
    }
    
    loadConfig() {
        const urlParams = new URLSearchParams(window.location.search);
        return {
            primaryColor: urlParams.get('primaryColor') || null,
            hideHeader: urlParams.get('hideHeader') === 'true',
            hideStatus: urlParams.get('hideStatus') === 'true',
            compactMode: urlParams.get('compact') === 'true',
            language: urlParams.get('lang') || 'tr'
        };
    }
    
    applyConfig() {
        if (this.embedMode) {
            document.body.classList.add('embed-mode');
        }
        
        if (this.config.primaryColor) {
            document.documentElement.style.setProperty('--primary-color', this.config.primaryColor);
        }
        
        if (this.config.hideHeader) {
            document.querySelector('.header').style.display = 'none';
        }
        
        if (this.config.hideStatus) {
            document.querySelector('.status-bar').style.display = 'none';
        }
        
        if (this.config.compactMode) {
            document.querySelector('.upload-section').style.marginBottom = '15px';
            document.querySelector('.canvas-container').style.marginBottom = '15px';
            document.querySelector('.controls').style.marginBottom = '10px';
        }
    }
    
    initPostMessageListener() {
        window.addEventListener('message', (event) => {
            this.handlePostMessage(event);
        });
    }
    
    handlePostMessage(event) {
        const { type, data } = event.data;
        
        switch (type) {
            case 'setRoomImage':
                this.setRoomImageFromUrl(data.url);
                break;
            case 'setCarpetImage':
                this.setCarpetImageFromUrl(data.url);
                break;
            case 'setSelectionPoints':
                this.setSelectionPoints(data.points);
                break;
            case 'applyCarpet':
                if (this.selectionPoints.length >= 4 && this.carpetImage) {
                    this.applyCarpet();
                }
                break;
            case 'reset':
                this.reset();
                break;
            case 'getConfig':
                this.sendConfig();
                break;
            case 'exportImage':
                this.exportImage();
                break;
            case 'setTheme':
                this.setTheme(data);
                break;
            default:
                console.warn('Unknown message type:', type);
        }
    }
    
    setRoomImageFromUrl(url) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            this.roomImage = img;
            this.displayRoomImage();
            document.getElementById('roomImageName').textContent = 'External Image';
            document.getElementById('selectAreaBtn').disabled = false;
            this.updateStatus('Oda görüntüsü yüklendi.');
            this.postMessage('roomImageLoaded', { success: true });
        };
        img.onerror = () => {
            this.postMessage('roomImageLoaded', { success: false, error: 'Failed to load image' });
        };
        img.src = url;
    }
    
    setCarpetImageFromUrl(url) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            this.carpetImage = img;
            document.getElementById('carpetImageName').textContent = 'External Carpet';
            this.updateStatus('Halı görüntüsü yüklendi.');
            this.checkApplyButton();
            this.postMessage('carpetImageLoaded', { success: true });
        };
        img.onerror = () => {
            this.postMessage('carpetImageLoaded', { success: false, error: 'Failed to load carpet' });
        };
        img.src = url;
    }
    
    setSelectionPoints(points) {
        this.selectionPoints = points;
        this.updatePointCount();
        this.drawSelection();
        this.checkApplyButton();
    }
    
    sendConfig() {
        this.postMessage('config', {
            embedMode: this.embedMode,
            config: this.config,
            hasRoomImage: !!this.roomImage,
            hasCarpetImage: !!this.carpetImage,
            selectionPointsCount: this.selectionPoints.length
        });
    }
    
    exportImage() {
        if (!this.canvas.width || !this.canvas.height) {
            this.postMessage('imageExported', { success: false, error: 'No image to export' });
            return;
        }
        
        try {
            const dataUrl = this.canvas.toDataURL('image/png');
            this.postMessage('imageExported', { success: true, dataUrl });
        } catch (error) {
            this.postMessage('imageExported', { success: false, error: error.message });
        }
    }
    
    setTheme(theme) {
        if (theme.primaryColor) {
            document.documentElement.style.setProperty('--primary-color', theme.primaryColor);
        }
        if (theme.secondaryColor) {
            document.documentElement.style.setProperty('--secondary-color', theme.secondaryColor);
        }
        if (theme.successColor) {
            document.documentElement.style.setProperty('--success-color', theme.successColor);
        }
        if (theme.dangerColor) {
            document.documentElement.style.setProperty('--danger-color', theme.dangerColor);
        }
    }
    
    postMessage(type, data) {
        if (window.parent !== window) {
            window.parent.postMessage({ type, data }, '*');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new CarpetApp();
});
