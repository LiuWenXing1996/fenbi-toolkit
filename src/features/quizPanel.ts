import { log } from '../core/log';
import { escapeHtml } from '../core/utils';
import { copyToClipboard } from '../core/copy';
import { findSolutionsDeep } from '../core/finder';
import { quizState } from '../store/quiz';
import type { SolutionItem, MaterialItem } from '../store/quiz';
import { parseApiData } from '../parse/quiz';
import { findLatestCapture } from '../capture/quiz';

// ========== “获取题目 ID”折叠面板：渲染 / 交互 / 扫描（旁路捕获优先，内存扫描兜底） ==========

export function bindScanButton(container: ParentNode): void {
    const btn = container.querySelector('#fenbi-scan-btn') as HTMLButtonElement | null;
    if (!btn) {
        log('错误: 找不到扫描按钮');
        return;
    }
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        log('点击了获取按钮');
        btn.classList.add('loading');
        btn.textContent = '⏳ 获取中...';
        scanPageForData().finally(() => {
            btn.classList.remove('loading');
            // 按钮文字会在 renderPanel 中重置
        });
    });
    log('扫描按钮事件已绑定');
}

// ========== 渲染“获取题目 ID”折叠面板内容 ==========
function renderPanel(): void {
    const panel = document.getElementById('fenbi-id-panel') as HTMLElement | null;
    if (!panel) return;

    // 只更新“获取题目 ID”区块内部，保留“获取课程信息”等顶层折叠面板
    const body = panel.querySelector('[data-content="quiz-id"]') as HTMLElement | null;
    if (!body) return;
    const { name, materials, solutions } = quizState.currentData;

    if (solutions.length === 0 && materials.length === 0) {
        body.innerHTML = `
            <div class="empty-tip">
                未找到题目数据<br>
                <span style="font-size:11px;color:#9ca3af;">请在页面中手动触发一次题目接口请求<br>（打开/刷新练习页、切换题目均可），脚本不主动发请求</span>
            </div>
            <button class="scan-btn" id="fenbi-scan-btn">🔍 重新获取</button>
        `;
        bindScanButton(body);
        requestAnimationFrame(() => {
            if (!body.classList.contains('collapsed')) {
                body.style.maxHeight = body.scrollHeight + 'px';
            }
        });
        return;
    }

    let html = '';

    if (quizState.lastSource) {
        const tipText = quizState.lastSource === 'capture'
            ? '✓ 数据来自接口旁路捕获（未发起任何新请求）'
            : '✓ 数据来自页面内存扫描';
        html += `<div style="margin-bottom:8px;padding:6px 8px;background:#ecfdf5;border-radius:4px;color:#047857;font-size:11px;">
            ${tipText}
        </div>`;
    }

    if (name) {
        html += `<div style="margin-bottom:10px;padding:8px;background:#eff6ff;border-radius:4px;color:#1e40af;font-weight:500;">
            📚 ${escapeHtml(name)}
        </div>`;
    }

    html += `<button class="scan-btn" id="fenbi-scan-btn">🔄 重新获取</button>`;
    html += `<button class="prompt-btn" id="fenbi-prompt-btn">✨ 生成粉笔AI提示词</button>`;

    html += `
        <div class="section-title collapsible" data-section="solutions">
            <div class="section-left">
                <span class="collapse-arrow">▼</span>
                <span>题目 ID <span class="stats">(${solutions.length}题)</span></span>
            </div>
        </div>
        <div class="section-content" data-content="solutions">
            <div class="copy-format-group">
                <button class="copy-btn" data-copy="solution-ids" data-fmt="comma">逗号</button>
                <button class="copy-btn" data-copy="solution-ids" data-fmt="newline">换行</button>
                <button class="copy-btn" data-copy="solution-ids" data-fmt="space">空格</button>
                <button class="copy-btn" data-copy="solution-ids" data-fmt="js">JS 数组</button>
                <button class="copy-btn" data-copy="solution-ids" data-fmt="globalId">globalId</button>
                <button class="copy-btn" data-copy="solution-ids" data-fmt="twoCol">两列</button>
                <button class="copy-btn" data-copy="solution-ids" data-fmt="withKp">ID+知识点</button>
            </div>
    `;
    solutions.forEach((q: SolutionItem, idx: number) => {
        const materialTags = q.materialIds && q.materialIds.length > 0
            ? q.materialIds.map((id: number) => `<span class="material-tag" title="材料 ID: ${id}">📄${id}</span>`).join('')
            : '';
        const kpTags = q.keypoints && q.keypoints.length > 0
            ? q.keypoints.map((k) => `<span class="kp-tag" title="知识点ID: ${escapeHtml(k.id)}">${escapeHtml(k.name)}</span>`).join('')
            : '';
        html += `
            <div class="id-item">
                <div class="id-info" title="${escapeHtml(q.contentText || '')}">
                    <span class="id-num">${idx + 1}.</span>
                    <span>${q.id}</span>
                    <span class="id-global">(${q.globalId})</span>
                    ${materialTags}
                    ${kpTags}
                </div>
                <button class="item-copy-btn" data-copy-id="${q.id}">复制</button>
            </div>
        `;
    });
    html += `</div>`;

    if (materials.length > 0) {
        html += `
            <div class="section-title collapsible" data-section="materials">
                <div class="section-left">
                    <span class="collapse-arrow">▼</span>
                    <span>材料 ID <span class="stats">(${materials.length}篇)</span></span>
                </div>
            </div>
            <div class="section-content" data-content="materials">
                <div class="copy-format-group">
                    <button class="copy-btn" data-copy="material-ids" data-fmt="comma">逗号</button>
                    <button class="copy-btn" data-copy="material-ids" data-fmt="newline">换行</button>
                    <button class="copy-btn" data-copy="material-ids" data-fmt="space">空格</button>
                    <button class="copy-btn" data-copy="material-ids" data-fmt="js">JS 数组</button>
                    <button class="copy-btn" data-copy="material-ids" data-fmt="globalId">globalId</button>
                </div>
        `;
        materials.forEach((m: MaterialItem, idx: number) => {
            const qCount = m.questionIds ? m.questionIds.length : 0;
            const qListHtml = qCount > 0
                ? `<div class="material-questions collapsed" data-mq="${m.globalId}">
                    <div class="mq-title">
                        <span>📝 包含 ${qCount} 道题</span>
                        <span class="mq-arrow">▼</span>
                    </div>
                    <div class="mq-list">
                        ${m.questionIds.map((qid: number) => `<span class="mq-item" data-copy-id="${qid}">${qid}</span>`).join('')}
                    </div>
                </div>`
                : '';
            html += `
                <div class="id-item">
                    <div class="id-info" title="${escapeHtml(m.contentText || '')}">
                        <span class="id-num">${idx + 1}.</span>
                        <span>${m.id}</span>
                        <span class="id-global">(${m.globalId})</span>
                    </div>
                    <button class="item-copy-btn" data-copy-id="${m.id}">复制</button>
                </div>
                ${qListHtml}
            `;
        });
        html += `</div>`;
    }

    html += `
        <div class="section-title">
            <span>数据导出</span>
            <button class="copy-btn" data-copy="full-json">复制 JSON</button>
        </div>
    `;

    body.innerHTML = html;

    bindScanButton(body);

    // 生成粉笔AI提示词按钮
    const promptBtn = body.querySelector('#fenbi-prompt-btn') as HTMLButtonElement | null;
    if (promptBtn) {
        promptBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            let prompt = '';

            if (materials.length > 0) {
                // 有材料：按材料组织提示词
                const allQids = solutions.map((q) => q.id).join(',');
                const allMids = materials.map((m) => m.id).join(',');
                let materialParts = materials.map((m) => {
                    const qids = m.questionIds && m.questionIds.length > 0
                        ? m.questionIds.join(',')
                        : '无';
                    return `材料${m.id}包含题目：${qids}`;
                }).join('\n');

                prompt = `这是一些题目 ID 和材料 ID：
全部题目 ID：${allQids}
全部材料 ID：${allMids}

材料与题目的对应关系：
${materialParts}

根据以上题目 ID 和材料 ID 生成一次练习，要乱序版的，材料对应的题目要保持关联关系`;
            } else {
                // 无材料：用简单格式
                const ids = solutions.map((q) => q.id).join(',');
                prompt = `这是一些题目 ID，${ids}，根据以上题目 ID 生成一次练习，要乱序版的`;
            }

            copyToClipboard(prompt, promptBtn);
        });
    }

    // 批量复制按钮
    body.querySelectorAll('[data-copy]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const type = (btn as HTMLElement).dataset.copy;
            const fmt = (btn as HTMLElement).dataset.fmt || 'comma';
            let text = '';

            const items = type === 'solution-ids' ? solutions : (type === 'material-ids' ? materials : null);

            if (items) {
                if (fmt === 'globalId') {
                    text = items.map((item) => item.globalId).join(',');
                } else if (fmt === 'newline') {
                    text = items.map((item) => item.id).join('\n');
                } else if (fmt === 'space') {
                    text = items.map((item) => item.id).join(' ');
                } else if (fmt === 'js') {
                    text = JSON.stringify(items.map((item) => item.id), null, 2);
                } else if (fmt === 'twoCol') {
                    text = items.map((item) => {
                        const matIds = item.materialIds && item.materialIds.length > 0
                            ? item.materialIds.join(',')
                            : '';
                        return `${item.id}\t${matIds}`;
                    }).join('\n');
                } else if (fmt === 'withKp') {
                    // 格式：题目ID + Tab + 知识点名称（顿号分隔）
                    text = items.map((item) => {
                        const kpNames = item.keypoints && item.keypoints.length > 0
                            ? item.keypoints.map((k) => k.name).join('、')
                            : '';
                        return `${item.id}\t${kpNames}`;
                    }).join('\n');
                } else {
                    text = items.map((item) => item.id).join(',');
                }
            } else if (type === 'full-json') {
                text = JSON.stringify(quizState.currentData, null, 2);
            }

            copyToClipboard(text, btn as HTMLElement);
        });
    });

    // 单条复制按钮
    body.querySelectorAll('.item-copy-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            copyToClipboard((btn as HTMLElement).dataset.copyId || '', btn as HTMLElement);
        });
    });

    // 折叠/展开区块
    body.querySelectorAll('.section-title.collapsible').forEach((title) => {
        title.addEventListener('click', (e) => {
            e.stopPropagation();
            const section = (title as HTMLElement).dataset.section;
            const content = body.querySelector(`[data-content="${section}"]`) as HTMLElement | null;
            if (!content) return;

            const isCollapsed = title.classList.toggle('collapsed');
            content.classList.toggle('collapsed', isCollapsed);

            // 设置 max-height 实现平滑动画
            if (!isCollapsed) {
                content.style.maxHeight = content.scrollHeight + 'px';
            } else {
                content.style.maxHeight = content.scrollHeight + 'px';
                // 触发重绘后设为0
                requestAnimationFrame(() => {
                    content.style.maxHeight = '0';
                });
            }
        });
    });

    // 初始化：设置展开状态的 max-height
    requestAnimationFrame(() => {
        body.querySelectorAll('.section-content').forEach((content) => {
            if (!content.classList.contains('collapsed')) {
                (content as HTMLElement).style.maxHeight = content.scrollHeight + 'px';
            }
        });
    });

    // 材料内题目列表的折叠/展开
    body.querySelectorAll('.material-questions .mq-title').forEach((title) => {
        title.addEventListener('click', (e) => {
            e.stopPropagation();
            const container = title.closest('.material-questions');
            if (!container) return;
            container.classList.toggle('collapsed');
        });
    });

    // 材料内题目ID点击复制
    body.querySelectorAll('.mq-item[data-copy-id]').forEach((item) => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            copyToClipboard((item as HTMLElement).dataset.copyId || '', item as HTMLElement);
        });
    });
}

// ========== 手动获取主函数（零新增请求：旁路捕获优先，内存扫描兜底） ==========
function scanPageForData(): Promise<void> {
    return new Promise((resolve) => {
        log('开始获取（旁路捕获优先，脚本不发请求）...');
        let found = false;

        // === 方式1: 读取旁路捕获的接口响应 ===
        const hit = findLatestCapture();
        if (hit) {
            log('从旁路捕获中读取到数据');
            quizState.currentData = parseApiData(hit.target);
            quizState.lastSource = 'capture';
            log('旁路捕获成功，题目数:', quizState.currentData.solutions.length);
            renderPanel();
            found = true;
            resolve();
            return;
        }

        // === 方式2: 用 unsafeWindow 扫描页面全局变量（读取内存已有数据） ===
        log('方式2: 快速扫描页面全局变量');
        const scanStartTime = Date.now();
        const SCAN_TIMEOUT = 1500; // 最多扫1.5秒

        try {
            const win: any = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
            const keys = Object.keys(win);
            log('全局变量数量:', keys.length);

            // 先按关键词优先级排序：含 solution/quiz/question/tiku/material 的优先
            const priorityKeywords = ['solution', 'quiz', 'question', 'tiku', 'material', 'paper', 'exam', 'practice'];
            const sortedKeys = keys.slice().sort((a, b) => {
                const aLow = a.toLowerCase();
                const bLow = b.toLowerCase();
                const aScore = priorityKeywords.some((kw) => aLow.includes(kw)) ? 1 : 0;
                const bScore = priorityKeywords.some((kw) => bLow.includes(kw)) ? 1 : 0;
                return bScore - aScore;
            });

            let scanned = 0;
            for (let i = 0; i < sortedKeys.length; i++) {
                // 超时保护
                if (Date.now() - scanStartTime > SCAN_TIMEOUT) {
                    log('扫描超时，已扫描', scanned, '个变量，跳过剩余');
                    break;
                }

                const key = sortedKeys[i];
                if (key === 'window' || key === 'top' || key === 'parent' || key === 'self') continue;
                if (key.startsWith('__') && key.endsWith('__')) continue; // 跳过内部变量

                try {
                    const val = win[key];
                    if (val && typeof val === 'object' && val !== win) {
                        scanned++;
                        const r = findSolutionsDeep(val, 5); // 限制深度为5
                        if (r) {
                            log('在全局变量', key, '中找到数据');
                            const parsed = parseApiData(r);
                            if (parsed.solutions.length > 0 || parsed.materials.length > 0) {
                                quizState.currentData = parsed;
                                quizState.lastSource = 'memory';
                                log('内存扫描成功，题目数:', parsed.solutions.length);
                                renderPanel();
                                found = true;
                                resolve();
                                return;
                            }
                        }
                    }
                } catch (e) {}
            }
            log('内存扫描完成，扫描了', scanned, '个对象，未找到题目数据（用时', Date.now() - scanStartTime, 'ms）');
        } catch (e) {
            log('内存扫描出错:', e);
        }

        // === 兜底: 无可读数据（脚本不再发起任何接口请求） ===
        if (!found) {
            log('未找到题目数据：请在页面手动触发一次题目接口请求后再试');
            renderPanel();
        }
        resolve();
    });
}
