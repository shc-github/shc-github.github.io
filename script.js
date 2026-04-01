/**
 * SHC 粒子动态Logo + 水波交互
 */

class ParticleLogo {
    constructor() {
        this.canvas = document.getElementById('particle-logo');
        this.ctx = this.canvas.getContext('2d');
        this.maskCanvas = document.getElementById('ripple-mask');
        this.maskCtx = this.maskCanvas.getContext('2d');
        this.hint = document.querySelector('.hint');
        this.footer = document.querySelector('.footer-info');

        this.particles = [];
        this.mouseX = -1000;
        this.mouseY = -1000;
        this.rippleRadius = 0;
        this.isHovering = false;
        this.lastMoveTime = 0;
        this.hasInteracted = false;
        this.time = 0;

        this.init();
    }

    init() {
        this.resize();
        this.createParticles();
        this.bindEvents();
        this.animate();
    }

    resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;

        this.canvas.width = w;
        this.canvas.height = h;
        this.maskCanvas.width = w;
        this.maskCanvas.height = h;

        // 计算Logo尺寸和位置
        this.logoCenter = { x: w / 2, y: h / 2 };
        this.logoScale = Math.min(w * 0.12, h * 0.18);

        // 重新创建粒子
        this.particles = [];
        this.createParticles();
    }

    createParticles() {
        const letters = ['S', 'H', 'C'];
        const spacing = this.logoScale * 0.85;
        const startX = this.logoCenter.x - spacing;

        letters.forEach((letter, index) => {
            const offsetX = startX + index * spacing;
            this.createLetterParticles(letter, offsetX, this.logoCenter.y, this.logoScale);
        });
    }

    createLetterParticles(letter, centerX, centerY, scale) {
        // 在隐藏canvas上绘制字母获取轮廓点
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = scale * 1.5;
        tempCanvas.height = scale * 1.5;

        const fontSize = scale;
        tempCtx.font = `bold ${fontSize}px Arial`;
        tempCtx.fillStyle = '#fff';
        tempCtx.textAlign = 'center';
        tempCtx.textBaseline = 'middle';
        tempCtx.fillText(letter, tempCanvas.width / 2, tempCanvas.height / 2);

        // 扫描像素获取轮廓点
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imageData.data;

        // 边缘检测 - 只取边缘粒子
        const edgeParticles = [];
        const step = 3; // 粒子密度

        for (let y = 0; y < tempCanvas.height; y += step) {
            for (let x = 0; x < tempCanvas.width; x += step) {
                const i = (y * tempCanvas.width + x) * 4;
                if (data[i + 3] > 128) {
                    // 检查是否是边缘（周围有不透明区域）
                    const isEdge = this.isEdgePixel(data, x, y, tempCanvas.width, tempCanvas.height);
                    if (isEdge) {
                        edgeParticles.push({
                            x: centerX + (x - tempCanvas.width / 2),
                            y: centerY + (y - tempCanvas.height / 2),
                            baseX: centerX + (x - tempCanvas.width / 2),
                            baseY: centerY + (y - tempCanvas.height / 2),
                            size: Math.random() * 1.5 + 1,
                            alpha: Math.random() * 0.3 + 0.5,
                            phase: Math.random() * Math.PI * 2,
                            speed: Math.random() * 0.02 + 0.01
                        });
                    }
                }
            }
        }

        // 添加一些内部粒子增加密度
        const innerParticles = [];
        const innerStep = 6;
        for (let y = 0; y < tempCanvas.height; y += innerStep) {
            for (let x = 0; x < tempCanvas.width; x += innerStep) {
                const i = (y * tempCanvas.width + x) * 4;
                if (data[i + 3] > 128) {
                    innerParticles.push({
                        x: centerX + (x - tempCanvas.width / 2),
                        y: centerY + (y - tempCanvas.height / 2),
                        baseX: centerX + (x - tempCanvas.width / 2),
                        baseY: centerY + (y - tempCanvas.height / 2),
                        size: Math.random() * 0.8 + 0.5,
                        alpha: Math.random() * 0.2 + 0.3,
                        phase: Math.random() * Math.PI * 2,
                        speed: Math.random() * 0.015 + 0.008
                    });
                }
            }
        }

        this.particles.push(...edgeParticles, ...innerParticles);
    }

    isEdgePixel(data, x, y, width, height) {
        // 检查周围像素
        const neighbors = [
            [x - 1, y], [x + 1, y],
            [x, y - 1], [x, y + 1]
        ];

        for (const [nx, ny] of neighbors) {
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) return true;
            const ni = (ny * width + nx) * 4;
            if (data[ni + 3] < 50) return true;
        }
        return false;
    }

    bindEvents() {
        window.addEventListener('mousemove', (e) => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
            this.lastMoveTime = Date.now();
            this.isHovering = true;

            if (!this.hasInteracted) {
                this.hasInteracted = true;
                this.hint.classList.add('hidden');
            }
        });

        document.addEventListener('mouseleave', () => {
            this.isHovering = false;
        });

        window.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            this.mouseX = touch.clientX;
            this.mouseY = touch.clientY;
            this.lastMoveTime = Date.now();
            this.isHovering = true;
            this.hasInteracted = true;
            this.hint.classList.add('hidden');
        });

        window.addEventListener('touchmove', (e) => {
            const touch = e.touches[0];
            this.mouseX = touch.clientX;
            this.mouseY = touch.clientY;
            this.lastMoveTime = Date.now();
        });

        window.addEventListener('touchend', () => {
            this.isHovering = false;
        });

        window.addEventListener('resize', () => this.resize());
    }

    animate() {
        this.time += 0.016;

        // 水波半径控制
        const maxRadius = Math.max(window.innerWidth, window.innerHeight) * 1.5;
        const hideDelay = 1000;

        if (this.isHovering && Date.now() - this.lastMoveTime > hideDelay) {
            this.isHovering = false;
        }

        if (this.isHovering) {
            this.rippleRadius += (maxRadius - this.rippleRadius) * 0.02;
        } else {
            this.rippleRadius += (0 - this.rippleRadius) * 0.015;
            if (this.rippleRadius < 1) this.rippleRadius = 0;
        }

        // 显示/隐藏底部信息
        if (this.rippleRadius > maxRadius * 0.6) {
            this.footer.classList.add('visible');
        } else {
            this.footer.classList.remove('visible');
        }

        // 清空画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.maskCtx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);

        // 绘制黑色遮罩
        this.maskCtx.fillStyle = '#000';
        this.maskCtx.fillRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);

        if (this.rippleRadius > 0) {
            // 镂空水波区域
            this.maskCtx.globalCompositeOperation = 'destination-out';
            const gradient = this.maskCtx.createRadialGradient(
                this.mouseX, this.mouseY, this.rippleRadius * 0.1,
                this.mouseX, this.mouseY, this.rippleRadius
            );
            gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
            gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.8)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            this.maskCtx.fillStyle = gradient;
            this.maskCtx.beginPath();
            this.maskCtx.arc(this.mouseX, this.mouseY, this.rippleRadius, 0, Math.PI * 2);
            this.maskCtx.fill();
            this.maskCtx.globalCompositeOperation = 'source-over';
        }

        // 绘制粒子
        this.particles.forEach(p => {
            // 呼吸动画
            const floatX = Math.sin(this.time * p.speed * 60 + p.phase) * 2;
            const floatY = Math.cos(this.time * p.speed * 60 + p.phase) * 2;
            p.x = p.baseX + floatX;
            p.y = p.baseY + floatY;

            // 根据距离光标的距离计算亮度
            const dist = Math.sqrt(
                Math.pow(p.x - this.mouseX, 2) +
                Math.pow(p.y - this.mouseY, 2)
            );

            let alpha = 0;
            if (this.rippleRadius > 0 && dist < this.rippleRadius) {
                // 水波范围内的粒子逐渐显现
                const ratio = 1 - dist / this.rippleRadius;
                alpha = p.alpha * ratio * ratio; // 二次曲线，边缘更柔和
            }

            if (alpha > 0.01) {
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                this.ctx.fill();
            }
        });

        requestAnimationFrame(() => this.animate());
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ParticleLogo();
});