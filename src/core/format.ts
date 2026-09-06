// ========== 展示格式化（纯函数） ==========

// duration 单位为秒
export function formatDuration(sec: unknown): string {
    const s = Number(sec) || 0;
    const m = Math.round(s / 60);
    if (m < 1) return '<1分钟';
    const h = Math.floor(m / 60);
    const mm = m % 60;
    if (h === 0) return m + '分钟';
    if (mm === 0) return h + '小时';
    return h + '小时' + mm + '分钟';
}

export function formatStartTime(ms: unknown): string {
    if (!ms) return '';
    const d = new Date(Number(ms));
    if (isNaN(d.getTime())) return '';
    const p = (n: number) => (n < 10 ? '0' + n : '' + n);
    return d.getMonth() + 1 + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
