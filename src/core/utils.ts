// ========== 通用工具函数（纯逻辑，可单测） ==========

export function escapeHtml(str: unknown): string {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
}

export function stripHtml(html: unknown): string {
    const div = document.createElement('div');
    div.innerHTML = html == null ? '' : String(html);
    return div.textContent || div.innerText || '';
}

// 解析知识点列表：keypoints 形如 [{id, name}, ...]，部分接口/题目可能缺失
export interface Keypoint {
    id: number | string;
    name: string;
}

export function parseKeypoints(kp: unknown): Keypoint[] {
    if (!Array.isArray(kp)) return [];
    return kp
        .filter((k) => k && typeof k === 'object' && (k.id != null || k.name))
        .map((k) => ({ id: (k as any).id != null ? (k as any).id : '', name: (k as any).name || '' }));
}
