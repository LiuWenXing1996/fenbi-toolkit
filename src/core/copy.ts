// ========== 复制到剪贴板（GM_setClipboard 优先，失败降级 navigator.clipboard） ==========

export function copyToClipboard(text: string, btn?: HTMLElement | null): void {
    try {
        GM_setClipboard(text);
    } catch (e) {
        navigator.clipboard.writeText(text).catch(() => {});
    }
    if (btn) {
        const originalText = btn.textContent;
        btn.textContent = '✓ 已复制';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove('copied');
        }, 1500);
    }
}
