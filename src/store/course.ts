// ========== 课程侧共享状态 ==========

export interface CourseCaptureItem {
    data: any; // 旁路捕获到的接口响应 JSON
    ts: number;
}

export interface CourseRec {
    detail: CourseCaptureItem | null; // /detail_for_sale 响应（可缺：部分页面不触发）
    // /episode_nodes 响应按 episode set id 缓存。
    // 一层响应可能是“分组描述列表”（nodeType ≠ 6）也可能是“课时列表”（nodeType = 6），
    // 分组描述按 payload.id 到本表里再取下一层，从而支持任意多层嵌套。
    sets: Record<string, CourseCaptureItem>;
    // 顶层分组列表所在 set id：URL 未带 episode_set_id 参数的请求记录为入口；
    // 若全程未捕获顶层（深层直开），渲染期再从 sets 推断最顶层。
    rootSetId: string | null;
    ts: number;
}

// courseId -> 课程捕获记录
export const courseByCourseId: Record<number, CourseRec> = {};

// 最近有响应的课程 id（用对象包装，便于跨模块只读引用）
export const courseLastId: { value: number } = { value: 0 };
