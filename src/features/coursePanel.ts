import { escapeHtml } from '../core/utils';
import { copyToClipboard } from '../core/copy';
import { formatDuration, formatStartTime } from '../core/format';
import { bindCollapsibles } from '../ui/collapsible';
import { courseByCourseId, courseLastId } from '../store/course';

// ========== 课程信息：组装 / 渲染 / 导出（数据全部来自旁路捕获，零新增请求） ==========

function getCourseContent(): HTMLElement | null {
    const panel = document.getElementById('fenbi-id-panel');
    return panel ? panel.querySelector('[data-content="course-info"]') : null;
}

export function bindCourseButton(container: ParentNode): void {
    const btn = container.querySelector('#fenbi-course-btn') as HTMLButtonElement | null;
    if (!btn) return;
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        renderCoursePanel();
    });
}

export interface CourseEpisode {
    id: number;
    title: string;
    duration: number;
    startTime: number;
}

export interface CourseGroup {
    id: number;
    title: string;
    episodeCount: number;
    episodes: CourseEpisode[];
    missing: boolean;
    seconds: number;
}

export interface CourseView {
    courseId: number;
    name: string;
    noRoot: boolean;
    groups: CourseGroup[];
    totalEpisodes: number;
    totalSeconds: number;
}

function buildCourseView(): CourseView | null {
    const rec = courseByCourseId[courseLastId.value];
    if (!rec) return null;
    const view: CourseView = { courseId: courseLastId.value, name: '', noRoot: false, groups: [], totalEpisodes: 0, totalSeconds: 0 };
    const detailData = rec.detail && rec.detail.data && rec.detail.data.data;
    if (detailData && detailData.title) {
        view.name = detailData.title;
    }
    const rootData = rec.root && rec.root.data && rec.root.data.data;
    if (!rootData || !Array.isArray(rootData.episodeNodes)) {
        view.noRoot = true;
        return view;
    }
    rootData.episodeNodes.forEach((node: any) => {
        if (!node || node.nodeType !== 1 || !node.payload) return;
        const g = node.payload;
        const group: CourseGroup = { id: g.id, title: g.title || ('分组 ' + g.id), episodeCount: g.episodeCount || 0, episodes: [], missing: false, seconds: 0 };
        const gRec = rec.groups[String(g.id)];
        const nodes = gRec && gRec.data && gRec.data.data && Array.isArray(gRec.data.data.episodeNodes)
            ? gRec.data.data.episodeNodes
            : null;
        if (!nodes) {
            group.missing = true;
        } else {
            nodes.forEach((n: any) => {
                if (!n || n.nodeType !== 6 || !n.payload) return;
                const p = n.payload;
                group.episodes.push({ id: p.id, title: p.title || '', duration: p.duration || 0, startTime: p.startTime || 0 });
                group.seconds += (p.duration || 0);
            });
        }
        view.groups.push(group);
        view.totalEpisodes += group.episodes.length;
        view.totalSeconds += group.seconds;
    });
    return view;
}

function viewToExport(v: CourseView): any {
    return {
        courseId: v.courseId,
        name: v.name,
        groupsLoaded: !v.noRoot,
        totalGroups: v.groups.length,
        totalEpisodes: v.totalEpisodes,
        totalDurationSeconds: v.totalSeconds,
        groups: v.groups.map((g) => ({
            id: g.id,
            title: g.title,
            episodeCount: g.episodeCount,
            episodesLoaded: !g.missing,
            episodes: g.episodes.map((ep) => ({
                id: ep.id,
                title: ep.title,
                durationSeconds: ep.duration,
                startTime: ep.startTime
            }))
        }))
    };
}

function viewToText(v: CourseView): string {
    const lines: string[] = [];
    lines.push('课程：' + (v.name || ('ID ' + v.courseId)) + (v.noRoot ? '（分组列表未捕获）' : ''));
    if (!v.noRoot) {
        v.groups.forEach((g) => {
            if (g.missing) {
                lines.push('├─ ' + g.title + '（' + (g.episodeCount || '?') + '课时，未加载：请手动触发下接口请求）');
            } else {
                lines.push('├─ ' + g.title + '（' + g.episodes.length + '课时 · ' + formatDuration(g.seconds) + '）');
                g.episodes.forEach((ep, j) => {
                    lines.push('│   ' + (j + 1) + '. ' + ep.title + '（' + formatDuration(ep.duration)
                        + (ep.startTime ? ' · ' + formatStartTime(ep.startTime) : '') + '）');
                });
            }
        });
    }
    return lines.join('\n');
}

// 单个分组的课程标题列表（复制用，每行一个标题）
function groupToText(g: CourseGroup): string {
    return g.episodes.map((ep) => ep.title).join('\n');
}

function renderCoursePanel(): void {
    const content = getCourseContent();
    if (!content) return;
    content.dataset.ready = '1';
    const view = buildCourseView();
    let html = '';

    if (!view) {
        html = `
            <div class="empty-tip">
                尚未捕获到课程接口响应<br>
                <span style="font-size:11px;color:#9ca3af;">请先在页面打开课程目录/详情页，触发 detail_for_sale 或 episode_nodes 请求；脚本不主动发请求</span>
            </div>
            <button class="scan-btn" id="fenbi-course-btn">🔄 重新获取</button>
        `;
    } else {
        const headText = view.name ? ('📚 ' + escapeHtml(view.name)) : ('课程 ID：' + view.courseId + '（详情接口尚未捕获）');
        html += `<div style="margin-bottom:10px;padding:8px;background:#eff6ff;border-radius:4px;color:#1e40af;font-weight:500;">${headText}</div>`;
        if (!view.noRoot) {
            html += `<div style="margin-bottom:8px;color:#6b7280;font-size:11px;">共 ${view.groups.length} 个分组 · ${view.totalEpisodes} 课时 · 总时长 ${formatDuration(view.totalSeconds)}</div>`;
        }
        html += `<button class="scan-btn" id="fenbi-course-btn">🔄 重新获取</button>`;

        if (view.noRoot) {
            html += `<div class="error-tip" style="margin-top:8px;">已捕获课时接口但缺少分组列表：请在页面展开课程目录，触发一次分组列表请求</div>`;
        } else {
            view.groups.forEach((g, i) => {
                const seg = 'cg' + i;
                const stat = g.missing ? '课时未加载'
                    : (g.episodes.length + '课时 · ' + formatDuration(g.seconds));
                const hasEpisodes = !g.missing && g.episodes.length > 0;
                html += `
                    <div class="section-title collapsible collapsed" data-section="${seg}">
                        <div class="section-left">
                            <span class="collapse-arrow">▼</span>
                            <span title="${escapeHtml(g.title)}">${escapeHtml(g.title)}</span>
                            <span class="stats">(${stat})</span>
                        </div>
                        ${hasEpisodes ? `<button class="copy-btn" data-group-copy="${i}" title="复制该组课程列表">复制</button>` : ''}
                    </div>
                    <div class="section-content collapsed" data-content="${seg}">`;
                if (g.missing) {
                    html += `<div class="empty-tip" style="padding:8px 0;">请手动触发下接口请求</div>`;
                } else if (g.episodes.length === 0) {
                    html += `<div class="empty-tip" style="padding:8px 0;">该组暂无课时</div>`;
                } else {
                    g.episodes.forEach((ep, j) => {
                        html += `
                            <div class="id-item">
                                <div class="id-info">
                                    <span class="id-num">${j + 1}.</span>
                                    <span>${escapeHtml(ep.title)}</span>
                                </div>
                                <span style="color:#6b7280;font-size:11px;flex-shrink:0;white-space:nowrap;">${formatDuration(ep.duration)}${ep.startTime ? ' · ' + formatStartTime(ep.startTime) : ''}</span>
                            </div>`;
                    });
                }
                html += `</div>`;
            });
        }

        html += `
            <div class="section-title">
                <span>数据导出</span>
            </div>
            <div class="copy-format-group">
                <button class="copy-btn" data-course-copy="json">复制 JSON</button>
                <button class="copy-btn" data-course-copy="tree">复制文本树</button>
            </div>
        `;
    }

    content.innerHTML = html;
    bindCourseButton(content);
    bindCollapsibles(content);
    content.querySelectorAll('[data-course-copy]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const v = buildCourseView();
            if (!v) return;
            const text = (btn as HTMLElement).dataset.courseCopy === 'json' ? JSON.stringify(viewToExport(v), null, 2) : viewToText(v);
            copyToClipboard(text, btn as HTMLElement);
        });
    });
    content.querySelectorAll('[data-group-copy]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const v = buildCourseView();
            const g = v && v.groups[Number((btn as HTMLElement).dataset.groupCopy)];
            if (!g || g.missing || g.episodes.length === 0) return;
            copyToClipboard(groupToText(g), btn as HTMLElement);
        });
    });

    // 刷新外层“获取课程信息”面板高度
    requestAnimationFrame(() => {
        if (!content.classList.contains('collapsed')) {
            content.style.maxHeight = content.scrollHeight + 'px';
        }
    });
}

// 捕获到新的课程接口响应后，若课程面板正在展示则自动刷新（防抖）
let courseRefreshTimer: ReturnType<typeof setTimeout> | null = null;
export function scheduleCourseRefresh(): void {
    if (courseRefreshTimer) return;
    courseRefreshTimer = setTimeout(() => {
        courseRefreshTimer = null;
        const panel = document.getElementById('fenbi-id-panel');
        if (!panel || panel.classList.contains('collapsed')) return;
        const content = panel.querySelector('[data-content="course-info"]') as HTMLElement | null;
        if (!content || content.dataset.ready !== '1') return;
        renderCoursePanel();
    }, 400);
}
