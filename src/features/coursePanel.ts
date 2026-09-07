import { escapeHtml } from '../core/utils';
import { copyToClipboard } from '../core/copy';
import { formatDuration, formatStartTime } from '../core/format';
import { bindCollapsibles } from '../ui/collapsible';
import { courseByCourseId, courseLastId, CourseRec, CourseCaptureItem, CourseSetCapture } from '../store/course';

// ========== 课程信息：组装 / 渲染 / 导出（数据全部来自旁路捕获，零新增请求） ==========
// episode_nodes 按“episode set id”分多次请求返回；同一 set 还按 URL start/len 分页，
// 捕获层按页缓存（store 见 CourseSetCapture），这里渲染前先按 start 合并各页节点。
// 一次响应里的节点可能是分组描述（nodeType ≠ 6，需用 payload.id 到 sets 缓存里再取
// 下一层）或课时（nodeType = 6）。课程树深度不固定（可多层嵌套），这里按 set id 递归
// 拼树；detail_for_sale 非必需，缺失时直接以 episode_nodes 数据展示（课程名缺省为“课程 ID”）。

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
    id: number; // 分组/子集 id（episode set id）
    title: string;
    episodeCount: number; // 描述中的课时总数（可能含未捕获的更深层）
    loaded: boolean; // 该 set 的节点列表是否已捕获
    nodeTotal: number | null; // 该 set 直接子节点总数（响应 data.total；null 表示响应未带），用于提示分页未捕获完整
    children: CourseGroup[]; // 更深一层分组（可能再嵌套）
    episodes: CourseEpisode[]; // 本层直接课时（nodeType = 6）
    seconds: number; // 本层直接课时总秒数
}

export interface CourseView {
    courseId: number;
    name: string; // 课程名：detail_for_sale.title，缺省为空字符串
    fromNodes: boolean; // detail_for_sale 缺失，数据来自 episode_nodes
    noNodes: boolean; // 尚未捕获任何 episode_nodes
    groups: CourseGroup[];
    totalEpisodes: number; // 整树已加载课时数
    totalSeconds: number; // 整树已加载课时总秒数
}

// ---------- 纯拼树：把某层节点列表构建成课程树（可脱离 DOM 复核） ----------

/** 某 set 的分页节点列表（已按各页 start 升序合并去重）。无任何页带节点数组时返回 null */
function mergedNodesOf(set: CourseSetCapture | undefined | null): any[] | null {
    const item = mergedSetView(set);
    const d = item && item.data && item.data.data;
    if (!d || !Array.isArray(d.episodeNodes)) return null;
    return d.episodeNodes;
}

/** 把某 set 的已捕获页合并成“单响应视图”，供拼树/兜底标题统一读取（不改写 store） */
function mergedSetView(set: CourseSetCapture | undefined | null): CourseCaptureItem | null {
    if (!set) return null;
    const starts = Object.keys(set.pages).map(Number).sort((a, b) => a - b);
    if (!starts.length) return null;
    const merged: any = {};
    const nodes: any[] = [];
    const seen = new Set<string>();
    let hasNodes = false;
    starts.forEach((s) => {
        const p = set.pages[s];
        if (!p) return;
        const d = p.data && p.data.data;
        if (!d) return;
        if (merged.episodeSetId == null && d.episodeSetId != null) merged.episodeSetId = d.episodeSetId;
        if (merged.title == null && typeof d.title === 'string') merged.title = d.title;
        if (Array.isArray(d.episodeNodes)) {
            hasNodes = true;
            d.episodeNodes.forEach((n: any) => {
                // 跨页去重：刷新时若某一页被更宽的页重新覆盖，同一节点只保留一次
                if (n && n.payload && n.payload.id != null) {
                    const key = (n.nodeType == null ? '' : n.nodeType) + ':' + n.payload.id;
                    if (seen.has(key)) return;
                    seen.add(key);
                }
                nodes.push(n);
            });
        }
    });
    if (!hasNodes) return null;
    merged.episodeNodes = nodes;
    return { data: { data: merged }, ts: set.ts };
}

function collectStats(groups: CourseGroup[], out?: { episodes: number; seconds: number }): { episodes: number; seconds: number } {
    const acc = out || { episodes: 0, seconds: 0 };
    groups.forEach((g) => {
        acc.episodes += g.episodes.length;
        acc.seconds += g.seconds;
        collectStats(g.children, acc);
    });
    return acc;
}

/** 递归层级上限：防止缓存异常自引用导致死循环 */
const MAX_TREE_DEPTH = 20;

function buildGroupTree(nodes: any[], rec: CourseRec, depth: number): CourseGroup[] {
    const out: CourseGroup[] = [];
    if (depth > MAX_TREE_DEPTH) return out;
    nodes.forEach((node: any) => {
        if (!node || !node.payload) return;
        const p = node.payload;
        if (p.id == null) return;
        const gid = String(p.id);
        const g: CourseGroup = {
            id: p.id,
            title: p.title || ('分组 ' + p.id),
            episodeCount: p.episodeCount || 0,
            loaded: false,
            nodeTotal: null,
            children: [],
            episodes: [],
            seconds: 0
        };
        const set = rec.sets[gid];
        const childNodes = mergedNodesOf(set);
        if (childNodes) {
            g.loaded = true;
            g.nodeTotal = set && set.total != null ? set.total : null;
            childNodes.forEach((cn: any) => {
                if (!cn || !cn.payload) return;
                const cp = cn.payload;
                if (cn.nodeType === 6) {
                    if (cp.id == null) return;
                    g.episodes.push({ id: cp.id, title: cp.title || '', duration: cp.duration || 0, startTime: cp.startTime || 0 });
                    g.seconds += (cp.duration || 0);
                } else if (cp.id != null) {
                    const sub = buildGroupTree([cn], rec, depth + 1);
                    if (sub.length) g.children.push(sub[0]);
                }
            });
        }
        out.push(g);
    });
    return out;
}

/** 选择展示入口 set：优先捕获到的顶层；否则在已捕获 set 中推断“未被任何分组描述引用”的最顶层 */
function pickEntry(rec: CourseRec): CourseSetCapture | null {
    if (rec.rootSetId && rec.sets[rec.rootSetId]) return rec.sets[rec.rootSetId];
    const keys = Object.keys(rec.sets);
    if (!keys.length) return null;
    const referenced = new Set<string>();
    keys.forEach((k) => {
        const nodes = mergedNodesOf(rec.sets[k]);
        if (!nodes) return;
        nodes.forEach((n: any) => {
            if (n && n.nodeType !== 6 && n.payload && n.payload.id != null) referenced.add(String(n.payload.id));
        });
    });
    const candidates = keys.filter((k) => !referenced.has(k));
    const pool = candidates.length ? candidates : keys;
    let bestKey = pool[0];
    pool.forEach((k) => {
        if (rec.sets[k].ts < rec.sets[bestKey].ts) bestKey = k;
    });
    return rec.sets[bestKey];
}

// 导出视图构建供无 DOM 回归验证；渲染仍走 renderCoursePanel
export function buildCourseView(): CourseView | null {
    const rec = courseByCourseId[courseLastId.value];
    if (!rec) return null;
    const view: CourseView = {
        courseId: courseLastId.value,
        name: '',
        fromNodes: !rec.detail,
        noNodes: true,
        groups: [],
        totalEpisodes: 0,
        totalSeconds: 0
    };
    const detailData = rec.detail && rec.detail.data && rec.detail.data.data;
    if (detailData && detailData.title) view.name = detailData.title;
    const entrySet = pickEntry(rec);
    const entry = mergedSetView(entrySet);
    const nodes = mergedNodesOf(entrySet);
    if (!nodes || !nodes.length) {
        // 只有 detail（或响应异常）而没有课时节点
        return view;
    }
    view.noNodes = false;
    if (!view.name && entry && entry.data && entry.data.data && typeof entry.data.data.title === 'string') {
        view.name = entry.data.data.title; // 个别场景顶层响应自带标题，作为兜底
    }
    // 顶层列表通常都是分组描述；若整层直接是课时（深层直开且无更顶层），包装成单分组展示
    const leafs: CourseEpisode[] = [];
    let hasGroupNode = false;
    nodes.forEach((n: any) => {
        if (!n || !n.payload || n.payload.id == null) return;
        if (n.nodeType === 6) {
            leafs.push({ id: n.payload.id, title: n.payload.title || '', duration: n.payload.duration || 0, startTime: n.payload.startTime || 0 });
        } else {
            hasGroupNode = true;
        }
    });
    if (!hasGroupNode && leafs.length) {
        const entryKey = entry && entry.data && entry.data.data && entry.data.data.episodeSetId != null
            ? entry.data.data.episodeSetId : 0;
        const seconds = leafs.reduce((s, ep) => s + (ep.duration || 0), 0);
        view.groups.push({
            id: Number(entryKey) || 0,
            title: '课时（入口分组未识别）',
            episodeCount: leafs.length,
            loaded: true,
            nodeTotal: entrySet && entrySet.total != null ? entrySet.total : null,
            children: [],
            episodes: leafs,
            seconds
        });
    } else {
        view.groups = buildGroupTree(nodes, rec, 0);
    }
    const stats = collectStats(view.groups);
    view.totalEpisodes = stats.episodes;
    view.totalSeconds = stats.seconds;
    return view;
}

// ---------- 导出：JSON / 文本树 ----------

function exportGroup(g: CourseGroup): any {
    const o: any = {
        id: g.id,
        title: g.title,
        episodeCount: g.episodeCount,
        episodesLoaded: g.loaded,
        episodes: g.episodes.map((ep) => ({
            id: ep.id,
            title: ep.title,
            durationSeconds: ep.duration,
            startTime: ep.startTime
        }))
    };
    if (g.children.length) {
        o.children = g.children.map(exportGroup);
    }
    return o;
}

function viewToExport(v: CourseView): any {
    return {
        courseId: v.courseId,
        name: v.name,
        source: v.fromNodes ? 'episode_nodes' : 'detail_for_sale',
        groupsLoaded: !v.noNodes,
        totalGroups: v.groups.length,
        totalEpisodes: v.totalEpisodes,
        totalDurationSeconds: v.totalSeconds,
        groups: v.groups.map(exportGroup)
    };
}

function viewToText(v: CourseView): string {
    const lines: string[] = [];
    let head = '课程：' + (v.name || ('ID ' + v.courseId));
    if (v.noNodes) {
        head += '（尚未捕获到课时接口）';
    } else if (v.fromNodes && !v.name) {
        head += '（无销售详情，数据来自课时接口）';
    }
    lines.push(head);
    if (!v.noNodes) {
        v.groups.forEach((g) => {
            lines.push(...groupToLines(g, 0));
        });
    }
    return lines.join('\n');
}

// 叶子分组（直接课时）统计文案；分页未捕获完整（已捕获课时 < 该 set 的 data.total）时追加提示
function leafStatText(g: CourseGroup): string {
    let t = g.episodes.length + '课时 · ' + formatDuration(g.seconds);
    if (g.nodeTotal != null && g.episodes.length < g.nodeTotal) {
        t += '（部分加载：已捕获 ' + g.episodes.length + '/' + g.nodeTotal + ' 课时，请继续展开加载）';
    }
    return t;
}

function groupStatText(g: CourseGroup): string {
    if (!g.loaded) {
        return g.episodeCount ? (g.episodeCount + '课时，未加载：请手动触发下接口请求') : '未加载';
    }
    if (g.children.length) {
        const st = collectStats(g.children);
        return st.episodes + '课时 · ' + formatDuration(st.seconds) + (st.episodes ? '' : '');
    }
    return leafStatText(g);
}

function groupToLines(g: CourseGroup, depth: number): string[] {
    const lines: string[] = [];
    const pad = '│   '.repeat(depth);
    lines.push(pad + '├─ ' + g.title + '（' + groupStatText(g) + '）');
    g.episodes.forEach((ep, j) => {
        lines.push(pad + '│   ' + (j + 1) + '. ' + ep.title + '（' + formatDuration(ep.duration)
            + (ep.startTime ? ' · ' + formatStartTime(ep.startTime) : '') + '）');
    });
    g.children.forEach((ch) => {
        lines.push(...groupToLines(ch, depth + 1));
    });
    return lines;
}

// 单个分组的课时标题列表（复制用，每行一个标题）
function groupToText(g: CourseGroup): string {
    return g.episodes.map((ep) => ep.title).join('\n');
}

// ---------- 渲染 ----------

/** 递归统计某分组内“未加载”的叶子分组数（仅用于汇总提示） */
function countMissingGroups(groups: CourseGroup[], acc?: number): number {
    let c = acc || 0;
    groups.forEach((g) => {
        if (!g.loaded) c += 1;
        else c = countMissingGroups(g.children, c);
    });
    return c;
}

// path 为当前分组在课程树里的索引链（从顶层分组数组开始），用于给子分组“复制”按钮生成唯一路径
function renderGroupBody(g: CourseGroup, depth: number, path: number[]): string {
    let html = '';
    const margin = 8 + depth * 14;
    if (!g.loaded) {
        html += `<div class="empty-tip" style="padding:8px 0;margin-left:${margin}px;">课时未加载：请手动触发下接口请求</div>`;
        return html;
    }
    if (g.episodes.length === 0 && g.children.length === 0) {
        html += `<div class="empty-tip" style="padding:8px 0;margin-left:${margin}px;">该组暂无课时</div>`;
        return html;
    }
    // 先渲染更深层分组，再渲染本层课时
    g.children.forEach((ch, ci) => {
        const childPath = path.concat(ci);
        const childStat = (() => {
            if (!ch.loaded) return '课时未加载';
            if (ch.children.length) {
                const st = collectStats(ch.children);
                return st.episodes + '课时' + (st.seconds ? ' · ' + formatDuration(st.seconds) : '');
            }
            return leafStatText(ch);
        })();
        html += `<div class="course-sub-group" style="margin-left:${margin}px;">`;
        html += `
            <div class="section-title" style="border-left:3px solid #93c5fd;padding-left:8px;margin-top:6px;">
                <div class="section-left">
                    <span title="${escapeHtml(ch.title)}">${escapeHtml(ch.title)}</span>
                    <span class="stats">(${childStat})</span>
                </div>
                ${ch.children.length === 0 && ch.episodes.length > 0
                    ? `<button class="copy-btn" data-group-copy="${childPath.join('_')}" title="复制该组课程列表">复制</button>` : ''}
            </div>`;
        html += renderGroupBody(ch, depth + 1, childPath);
        html += `</div>`;
    });
    g.episodes.forEach((ep, j) => {
        html += `
            <div class="id-item" style="margin-left:${margin}px;">
                <div class="id-info">
                    <span class="id-num">${j + 1}.</span>
                    <span>${escapeHtml(ep.title)}</span>
                </div>
                <span style="color:#6b7280;font-size:11px;flex-shrink:0;white-space:nowrap;">${formatDuration(ep.duration)}${ep.startTime ? ' · ' + formatStartTime(ep.startTime) : ''}</span>
            </div>`;
    });
    return html;
}

// 导出渲染入口供无 DOM 回归验证（标记层断言）；面板使用方仍由 createPanel/bind 触发
export function renderCoursePanel(): void {
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
        let headText = '';
        if (view.name) {
            headText = '📚 ' + escapeHtml(view.name);
        } else {
            headText = '课程 ID：' + view.courseId + (view.noNodes ? '' : '（无详情接口，数据来自课时接口）');
        }
        html += `<div style="margin-bottom:10px;padding:8px;background:#eff6ff;border-radius:4px;color:#1e40af;font-weight:500;">${headText}</div>`;
        if (!view.noNodes) {
            html += `<div style="margin-bottom:8px;color:#6b7280;font-size:11px;">共 ${view.groups.length} 个分组 · ${view.totalEpisodes} 课时 · 总时长 ${formatDuration(view.totalSeconds)}</div>`;
        }
        html += `<button class="scan-btn" id="fenbi-course-btn">🔄 重新获取</button>`;

        if (view.noNodes) {
            html += `<div class="error-tip" style="margin-top:8px;">已捕获课程详情但缺少课时接口：请在页面展开课程目录，触发一次 episode_nodes 请求</div>`;
        } else {
            view.groups.forEach((g, i) => {
                const seg = 'cg' + i;
                const leaf = g.children.length === 0 && g.episodes.length > 0;
                const stat = g.loaded
                    ? (g.children.length ? (collectStats(g.children).episodes + '课时 · ' + formatDuration(collectStats(g.children).seconds)) : leafStatText(g))
                    : '课时未加载';
                html += `
                    <div class="section-title collapsible collapsed" data-section="${seg}">
                        <div class="section-left">
                            <span class="collapse-arrow">▼</span>
                            <span title="${escapeHtml(g.title)}">${escapeHtml(g.title)}</span>
                            <span class="stats">(${stat})</span>
                        </div>
                        ${leaf ? `<button class="copy-btn" data-group-copy="${i}" title="复制该组课程列表">复制</button>` : ''}
                    </div>
                    <div class="section-content collapsed" data-content="${seg}">`;
                html += renderGroupBody(g, 0, [i]);
                html += `</div>`;
            });
            const missingCount = countMissingGroups(view.groups);
            if (missingCount > 0) {
                html += `<div class="empty-tip" style="margin-top:6px;">${missingCount} 个分组课时未加载：请手动展开对应目录触发接口请求后自动刷新</div>`;
            }
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
            if (!v) return;
            const g = resolveGroupByPath(v.groups, (btn as HTMLElement).dataset.groupCopy || '');
            if (!g || !g.loaded || g.episodes.length === 0) return;
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

/** 依据路径字符串（形如 0 或 1_2_0）在课程树中定位分组 */
function resolveGroupByPath(groups: CourseGroup[], path: string): CourseGroup | null {
    const parts = path.split('_').map(Number);
    let list: CourseGroup[] = groups;
    let cur: CourseGroup | null = null;
    for (const p of parts) {
        if (p == null || Number.isNaN(p) || p < 0 || p >= list.length) return null;
        cur = list[p];
        list = cur.children;
    }
    return cur;
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
