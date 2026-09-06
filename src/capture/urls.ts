// ========== 旁路捕获 URL 匹配（只读判断，不发请求） ==========

export function isQuizApiUrl(url: unknown): boolean {
    if (!url || typeof url !== 'string') return false;
    if (!url.includes('fenbi.com') && !url.includes('fenbike.cn')) return false;
    return url.includes('/solution') || url.includes('/exercise');
}

export function isCourseApiUrl(url: unknown): boolean {
    if (!url || typeof url !== 'string') return false;
    if (!url.includes('fenbi.com') && !url.includes('fenbike.cn')) return false;
    return url.includes('/detail_for_sale') || url.includes('/episode_nodes');
}
