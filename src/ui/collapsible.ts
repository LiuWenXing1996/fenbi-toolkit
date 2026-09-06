// ========== 折叠面板通用逻辑 ==========
// 将 scope 内 .section-title.collapsible 与其 [data-content] 区块绑定折叠/展开

export function bindCollapsibles(scope: ParentNode): void {
    scope.querySelectorAll('.section-title.collapsible').forEach((title) => {
        title.addEventListener('click', (e) => {
            e.stopPropagation();
            const section = (title as HTMLElement).dataset.section;
            const content = scope.querySelector(`[data-content="${section}"]`) as HTMLElement | null;
            if (!content) return;
            const isCollapsed = title.classList.toggle('collapsed');
            content.classList.toggle('collapsed', isCollapsed);
            if (!isCollapsed) {
                content.style.maxHeight = content.scrollHeight + 'px';
            } else {
                content.style.maxHeight = content.scrollHeight + 'px';
                requestAnimationFrame(() => {
                    content.style.maxHeight = '0';
                });
            }
        });
    });
}

// 让 scope 内所有处于展开状态的折叠区块高度自适应内容
export function refreshSectionHeights(scope: ParentNode): void {
    scope.querySelectorAll('.section-content').forEach((content) => {
        if (!content.classList.contains('collapsed')) {
            (content as HTMLElement).style.maxHeight = content.scrollHeight + 'px';
        }
    });
}
