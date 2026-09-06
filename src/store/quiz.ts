import type { Keypoint } from '../core/utils';

// ========== 题目侧共享状态 ==========

// 从接口响应归一化后的展示数据结构（题目 / 材料）
export interface SolutionItem {
    id: number;
    globalId: string;
    tikuPrefix?: string;
    type?: string | number;
    contentText: string;
    source?: string;
    correctAnswer?: unknown;
    keypoints: Keypoint[];
    materialGlobalIds: string[];
    materialIds: number[];
}

export interface MaterialItem {
    id: number;
    globalId: string;
    tikuPrefix?: string;
    contentText: string;
    questionGlobalIds: string[];
    questionIds: number[];
}

export interface QuizData {
    name: string;
    materials: MaterialItem[];
    solutions: SolutionItem[];
}

export function createEmptyQuizData(): QuizData {
    return { name: '', materials: [], solutions: [] };
}

// 旁路捕获的题目接口响应缓存：{ url, json, ts }
export const quizApiCaptures: { url: string; json: any; ts: number }[] = [];

// 当前展示的数据源与最近一次来源：'' | 'capture'（旁路捕获）| 'memory'（内存扫描）
export const quizState: { currentData: QuizData; lastSource: string } = {
    currentData: createEmptyQuizData(),
    lastSource: '',
};
