import { log } from '../core/log';
import { courseByCourseId, courseLastId } from '../store/course';
import { scheduleCourseRefresh } from '../features/coursePanel';

// ========== 课程接口捕获（detail_for_sale / episode_nodes 落缓存） ==========
// episode_nodes 深度不固定：URL 带 episode_set_id 参数时取的是该 set 的下一层内容，
// 这一层可能是分组描述、也可能是课时，统一按响应体 data.episodeSetId 落 sets 缓存，
// 展示层再按 set id 递归拼树（见 features/coursePanel）。

export function extractCourseIdFromUrl(url: string): number {
    const m = String(url).match(/\/lectures\/(\d+)\//);
    return m ? Number(m[1]) : 0;
}

export function extractQueryParam(url: string, key: string): string | null {
    const s = String(url);
    const qi = s.indexOf('?');
    if (qi < 0) return null;
    try {
        return new URLSearchParams(s.slice(qi + 1)).get(key);
    } catch (e) {
        return null;
    }
}

/** URL 路径里的 /episode_sets/{id}/（顶层列表请求未带 episode_set_id 参数时，它即本次返回的 set） */
export function extractPathSetId(url: string): string | null {
    const m = String(url).match(/\/episode_sets\/(\d+)\//);
    return m ? m[1] : null;
}

/** 本次 episode_nodes 响应对应的 set id：优先响应体自带，其次 URL query，最后 URL 路径 */
export function extractEpisodeSetId(url: string, json: any): string | null {
    const d = json && json.data;
    if (d && d.episodeSetId != null) return String(d.episodeSetId);
    const q = extractQueryParam(url, 'episode_set_id');
    if (q) return q;
    return extractPathSetId(url);
}

export function onCourseApiCaptured(url: string, json: any): void {
    const courseId = extractCourseIdFromUrl(url);
    if (!courseId) {
        log('课程接口 URL 未包含课程 ID，忽略:', String(url).substring(0, 90));
        return;
    }
    const rec = courseByCourseId[courseId] || (courseByCourseId[courseId] = { detail: null, sets: {}, rootSetId: null, ts: 0 });
    const item = { data: json, ts: Date.now() };
    if (url.includes('/detail_for_sale')) {
        rec.detail = item;
        log('旁路捕获课程详情: courseId=' + courseId);
    } else if (url.includes('/episode_nodes')) {
        const setId = extractEpisodeSetId(url, json);
        if (!setId) {
            log('episode_nodes 响应无法确定 episode set id，忽略:', String(url).substring(0, 90));
            return;
        }
        rec.sets[setId] = item;
        if (!extractQueryParam(url, 'episode_set_id')) {
            rec.rootSetId = setId;
            log('旁路捕获顶层分组列表: courseId=' + courseId + ' episodeSetId=' + setId);
        } else {
            log('旁路捕获分组内容: courseId=' + courseId + ' episodeSetId=' + setId);
        }
    } else {
        return;
    }
    rec.ts = item.ts;
    courseLastId.value = courseId;
    scheduleCourseRefresh();
}
