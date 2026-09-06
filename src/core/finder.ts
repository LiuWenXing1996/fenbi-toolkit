// ========== 递归查找含 solutions/questions/materials 的对象（带循环引用与深度保护） ==========

export function findSolutionsDeep(obj: unknown, maxDepth?: number): any {
    maxDepth = maxDepth || 6;
    const visited = new WeakSet();
    let count = 0;
    const maxCount = 5000; // 最多扫描5000个对象，防止卡死

    function search(obj: any, depth: number): any {
        count++;
        if (count > maxCount) return null;
        if (depth > maxDepth) return null;
        if (!obj || typeof obj !== 'object') return null;
        if (visited.has(obj)) return null;
        visited.add(obj);

        try {
            if (Array.isArray(obj.solutions) || Array.isArray(obj.questions) || Array.isArray(obj.materials)) {
                return obj;
            }
        } catch (e) {}

        for (const key in obj) {
            if (!obj.hasOwnProperty(key)) continue;
            const val = obj[key];
            if (val && typeof val === 'object') {
                const found = search(val, depth + 1);
                if (found) return found;
            }
        }
        return null;
    }

    return search(obj, 0);
}
