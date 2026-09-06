import { log } from '../core/log';
import { courseByCourseId, courseLastId } from '../store/course';
import { scheduleCourseRefresh } from '../features/coursePanel';

// ========== 课程接口捕获（detail_for_sale / episode_nodes 落缓存） ==========

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

export function onCourseApiCaptured(url: string, json: any): void {
    const courseId = extractCourseIdFromUrl(url);
    if (!courseId) {
        log('课程接口 URL 未包含课程 ID，忽略:', String(url).substring(0, 90));
        return;
    }
    const rec = courseByCourseId[courseId] || (courseByCourseId[courseId] = { detail: null, root: null, groups: {}, ts: 0 });
    const item = { data: json, ts: Date.now() };
    if (url.includes('/detail_for_sale')) {
        rec.detail = item;
        log('旁路捕获课程详情: courseId=' + courseId);
    } else if (url.includes('/episode_nodes')) {
        const gid = extractQueryParam(url, 'episode_set_id');
        if (gid) {
            rec.groups[gid] = item;
            log('旁路捕获分组课时: courseId=' + courseId + ' episode_set_id=' + gid);
        } else {
            rec.root = item;
            log('旁路捕获分组列表: courseId=' + courseId);
        }
    }
    rec.ts = item.ts;
    courseLastId.value = courseId;
    scheduleCourseRefresh();
}
