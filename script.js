
// 打字机效果（只打字，不删除）
class TypeWriter {
    constructor(element, texts, speed = 150) {
        this.element = element;
        this.texts = texts;
        this.speed = speed;
        this.textIndex = 0;
        this.charIndex = 0;
        this.timeoutId = null;
        this.type();
    }
    
    type() {
        const currentText = this.texts[this.textIndex];
        
        // 只打字，不删除
        this.element.textContent = currentText.substring(0, this.charIndex + 1);
        this.charIndex++;
        
        // 打完当前文本后，切换到下一条
        if (this.charIndex === currentText.length) {
            this.charIndex = 0;
            this.textIndex = (this.textIndex + 1) % this.texts.length;
            this.timeoutId = setTimeout(() => this.type(), 3000); // 停留3秒后切换
        } else {
            this.timeoutId = setTimeout(() => this.type(), this.speed);
        }
    }
    
    destroy() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }
    }
}

// 平滑滚动
class SmoothScroll {
    constructor() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(anchor.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                    
                    // 更新导航激活状态
                    document.querySelectorAll('.nav-link').forEach(link => {
                        link.classList.remove('active');
                    });
                    anchor.classList.add('active');
                }
            });
        });
    }
}


// 导航栏滚动效果 - 已禁用
class NavbarScroll {
    constructor() {
        // 禁用导航栏滚动效果
        console.log('导航栏滚动效果已禁用');
    }
}


// 初始化所有功能
document.addEventListener('DOMContentLoaded', () => {
    // 立即显示页面
    document.body.style.opacity = '1';
    
    // 只加载必要功能
    new SmoothScroll();
    new NavbarScroll();
    
    // 延迟加载打字机效果
    setTimeout(() => {
        const typingElement = document.querySelector('.typing-text');
        if (typingElement) {
            new TypeWriter(typingElement, [
                '用技术改变世界',
                '用代码创造未来',
                '让科技改善生活',
                '构建更美好的数字世界'
            ], 100);
        }
    }, 500);
    
    console.log('✅ 页面加载完成');
});

// 添加控制台彩蛋
console.log('%c👋 欢迎来到我的个人网站！', 'color: #00f3ff; font-size: 24px; font-weight: bold; text-shadow: 0 0 10px #00f3ff;');
console.log('%c🚀 如果你看到这条消息，说明你是一个有好奇心的开发者！', 'color: #ff00ff; font-size: 14px;');
console.log('%c💼 欢迎通过邮件或GitHub与我联系交流！', 'color: #00ff88; font-size: 14px;');
