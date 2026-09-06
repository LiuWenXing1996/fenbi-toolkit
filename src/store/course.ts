// ========== 课程侧共享状态 ==========

export interface CourseCaptureItem {
    data: any; // 旁路捕获到的接口响应 JSON
    ts: number;
}

export interface CourseRec {
    detail: CourseCaptureItem | null; // /detail_for_sale 响应
    root: CourseCaptureItem | null;   // /episode_nodes（无 episode_set_id）响应
    groups: Record<string, CourseCaptureItem>; // episode_set_id -> 响应
    ts: number;
}

// courseId -> 课程捕获记录
export const courseByCourseId: Record<number, CourseRec> = {};

// 最近有响应的课程 id（用对象包装，便于跨模块只读引用）
export const courseLastId: { value: number } = { value: 0 };
