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
            // 本区块展开/收起会改变外层内容总高：向上刷新所有已展开父级，避免外层 max-height 固定把新增内容裁掉
            if (!isCollapsed) {
                refreshAncestorHeights(content);
            } else {
                scheduleAncestorRefresh(content);
            }
        });
    });
}

// 向上刷新处于展开状态的父级 .section-content 高度（配合 overflow:hidden，防止内容被裁且滚动条滚不到）
function refreshAncestorHeights(content: HTMLElement): void {
    let parent = content.parentElement;
    while (parent) {
        if (parent.classList.contains('section-content') && !parent.classList.contains('collapsed')) {
            parent.style.maxHeight = parent.scrollHeight + 'px';
        }
        parent = parent.parentElement;
    }
}

// 收起有 0.25s max-height 过渡，等动画结束再让父级收缩
function scheduleAncestorRefresh(content: HTMLElement): void {
    setTimeout(() => refreshAncestorHeights(content), 300);
}

// 让 scope 内所有处于展开状态的折叠区块高度自适应内容
export function refreshSectionHeights(scope: ParentNode): void {
    scope.querySelectorAll('.section-content').forEach((content) => {
        if (!content.classList.contains('collapsed')) {
            (content as HTMLElement).style.maxHeight = content.scrollHeight + 'px';
        }
    });
}
