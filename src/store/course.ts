// ========== 课程侧共享状态 ==========

export interface CourseCaptureItem {
    data: any; // 旁路捕获到的接口响应 JSON
    ts: number;
}

/** 某个 episode set 的分页捕获：episode_nodes 按 URL start/len 分页，同一 set 会多次请求 */
export interface CourseSetCapture {
    // URL start 参数 -> 该页原始响应（不带 start 参数的请求视为第 0 页）
    pages: Record<number, CourseCaptureItem>;
    // 最近一页响应里的 data.total：该 set 直接子节点总数（跨页统计），
    // 用于提示“已捕获页数是否完整”，null 表示响应未带该字段
    total: number | null;
    ts: number; // 最近一页响应时间
}

export interface CourseRec {
    detail: CourseCaptureItem | null; // /detail_for_sale 响应（可缺：部分页面不触发）
    // /episode_nodes 响应按 episode set id 缓存（同一 set 的分页响应合并于 CourseSetCapture.pages）。
    // 一层响应可能是“分组描述列表”（nodeType ≠ 6）也可能是“课时列表”（nodeType = 6），
    // 分组描述按 payload.id 到本表里再取下一层，从而支持任意多层嵌套。
    sets: Record<string, CourseSetCapture>;
    // 顶层分组列表所在 set id：URL 未带 episode_set_id 参数的请求记录为入口；
    // 若全程未捕获顶层（深层直开），渲染期再从 sets 推断最顶层。
    rootSetId: string | null;
    ts: number;
}

// courseId -> 课程捕获记录
export const courseByCourseId: Record<number, CourseRec> = {};

// 最近有响应的课程 id（用对象包装，便于跨模块只读引用）
export const courseLastId: { value: number } = { value: 0 };
