import { log } from '../core/log';
import cssText from './style.css?inline';
import { bindCollapsibles } from './collapsible';
import { bindScanButton } from '../features/quizPanel';
import { bindCourseButton } from '../features/coursePanel';

// ========== 样式注入（模块加载即注入，与原脚本 document-start 时序一致） ==========
GM_addStyle(cssText);

// ========== 面板创建（骨架 + 可拖拽折叠圆球） ==========

export function createPanel(): void {
    log('创建面板');

    const panel = document.createElement('div');
    panel.id = 'fenbi-id-panel';
    panel.className = 'collapsed'; // 默认收起
    panel.innerHTML = `
        <div class="collapsed-fab" id="fenbi-collapsed-fab">
            <span class="fab-icon">📋</span>
        </div>
        <div class="panel-header">
            <span>📋 粉笔综合面板</span>
            <span class="toggle-btn">—</span>
        </div>
        <div class="panel-body">
            <div class="section-title collapsible" data-section="quiz-id" data-top="1">
                <div class="section-left">
                    <span class="collapse-arrow">▼</span>
                    <span>获取题目 ID</span>
                </div>
            </div>
            <div class="section-content" data-content="quiz-id">
                <div class="empty-tip">
                    点击下方按钮获取当前页面的题目 ID
                </div>
                <button class="scan-btn" id="fenbi-scan-btn">🔍 获取题目 ID</button>
            </div>
            <div class="section-title collapsible" data-section="course-info" data-top="1">
                <div class="section-left">
                    <span class="collapse-arrow">▼</span>
                    <span>获取课程信息</span>
                </div>
            </div>
            <div class="section-content" data-content="course-info">
                <div class="empty-tip">
                    读取页面已触发的课程接口响应（脚本不主动发请求）<br>
                    <span style="font-size:11px;color:#9ca3af;">请先在课程页面打开目录并逐组点开，以触发接口请求</span>
                </div>
                <button class="scan-btn" id="fenbi-course-btn">🔍 获取课程信息</button>
            </div>
        </div>
    `;
    document.documentElement.appendChild(panel);
    log('面板已添加到页面');

    // 记录圆球拖拽后的位置
    let savedFabPos: { left: number; top: number } | null = null;

    // 折叠：点击整个 header 区域
    panel.querySelector('.panel-header')!.addEventListener('click', () => {
        panel.classList.add('collapsed');
        // 收起后恢复圆球位置（如果有拖拽记录）
        if (savedFabPos) {
            requestAnimationFrame(() => {
                panel.style.left = savedFabPos!.left + 'px';
                panel.style.top = savedFabPos!.top + 'px';
                panel.style.right = 'auto';
                panel.style.bottom = 'auto';
            });
        }
    });

    // ========== 圆形按钮拖拽 + 点击展开 ==========
    const fab = panel.querySelector('.collapsed-fab') as HTMLElement;
    let isDragging = false;
    let dragMoved = false;
    let startX = 0, startY = 0;
    let startLeft = 0, startTop = 0;

    function onDragStart(e: MouseEvent | TouchEvent) {
        isDragging = true;
        dragMoved = false;
        const touch = (e as TouchEvent).touches ? (e as TouchEvent).touches[0] : (e as MouseEvent);
        startX = touch.clientX;
        startY = touch.clientY;

        // 获取当前位置（折叠态时 bottom/right 定位，转成 left/top）
        const rect = panel.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;

        // 拖拽时切到 left/top 定位，禁用过渡
        panel.classList.add('dragging');
        panel.style.left = startLeft + 'px';
        panel.style.top = startTop + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';

        document.addEventListener('mousemove', onDragMove as any);
        document.addEventListener('mouseup', onDragEnd);
        document.addEventListener('touchmove', onDragMove, { passive: false } as any);
        document.addEventListener('touchend', onDragEnd);
    }

    function onDragMove(e: MouseEvent | TouchEvent) {
        if (!isDragging) return;
        e.preventDefault();
        const touch = (e as TouchEvent).touches ? (e as TouchEvent).touches[0] : (e as MouseEvent);
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;

        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            dragMoved = true;
        }

        let newLeft = startLeft + dx;
        let newTop = startTop + dy;

        // 边界限制：圆球 56px
        const fabSize = 48;
        const maxLeft = window.innerWidth - fabSize;
        const maxTop = window.innerHeight - fabSize;
        newLeft = Math.max(0, Math.min(maxLeft, newLeft));
        newTop = Math.max(0, Math.min(maxTop, newTop));

        panel.style.left = newLeft + 'px';
        panel.style.top = newTop + 'px';
    }

    function onDragEnd() {
        isDragging = false;
        panel.classList.remove('dragging');

        document.removeEventListener('mousemove', onDragMove as any);
        document.removeEventListener('mouseup', onDragEnd);
        document.removeEventListener('touchmove', onDragMove as any);
        document.removeEventListener('touchend', onDragEnd);

        if (dragMoved) {
            // 拖拽过：记录位置
            const rect = panel.getBoundingClientRect();
            savedFabPos = { left: rect.left, top: rect.top };
        } else {
            // 没移动，算点击 → 展开面板
            expandPanel();
        }
    }

    function expandPanel() {
        // 先禁用过渡，瞬移到右上角位置
        panel.classList.add('no-transition');
        panel.style.left = '';
        panel.style.top = '';
        panel.style.right = '';
        panel.style.bottom = '';
        panel.classList.remove('collapsed');

        // 下一帧再恢复过渡（避免展开过程有动画）
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                panel.classList.remove('no-transition');
            });
        });
    }

    fab.addEventListener('mousedown', onDragStart as any);
    fab.addEventListener('touchstart', onDragStart as any, { passive: true });

    // 绑定顶层折叠面板（获取题目 ID / 获取课程信息）
    bindCollapsibles(panel);

    // 扫描按钮（题目 / 课程）
    bindScanButton(panel);
    bindCourseButton(panel);
}
