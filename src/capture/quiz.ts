import { log } from '../core/log';
import { findSolutionsDeep } from '../core/finder';
import { quizApiCaptures } from '../store/quiz';

// ========== 题目接口捕获（/solution /exercise 响应落缓存） ==========

export function onQuizApiCaptured(url: string, json: any): void {
    quizApiCaptures.push({ url: url, json: json, ts: Date.now() });
    if (quizApiCaptures.length > 50) quizApiCaptures.shift(); // 最多保留最近 50 条
    log('旁路捕获题目接口响应:', url.substring(0, 90) + '...');
}

// 从已捕获的响应里找最新的、含题目数据的对象
export function findLatestCapture(): { cap: (typeof quizApiCaptures)[number]; target: any } | null {
    for (let i = quizApiCaptures.length - 1; i >= 0; i--) {
        const cap = quizApiCaptures[i];
        const target = cap && findSolutionsDeep(cap.json);
        if (target && (Array.isArray(target.solutions) || Array.isArray(target.materials))) {
            return { cap: cap, target: target };
        }
    }
    return null;
}
