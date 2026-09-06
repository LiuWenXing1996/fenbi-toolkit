import { stripHtml, parseKeypoints } from '../core/utils';
import type { QuizData, SolutionItem, MaterialItem } from '../store/quiz';

// ========== 归一化接口响应：题目 / 材料 / card 关联 ==========
// 纯函数：输入旁路捕获（或内存扫描）到的接口 JSON，输出展示数据结构，不发请求
export function parseApiData(data: any): QuizData {
    const result: QuizData = {
        name: data.name || '',
        materials: [],
        solutions: [],
    };

    if (Array.isArray(data.materials)) {
        result.materials = data.materials.map((m: any): MaterialItem => ({
            id: m.id,
            globalId: m.globalId,
            tikuPrefix: m.tikuPrefix,
            contentText: stripHtml(m.content || '').substring(0, 50),
            questionGlobalIds: [],
            questionIds: [],
        }));
    }

    if (Array.isArray(data.solutions)) {
        result.solutions = data.solutions.map((s: any): SolutionItem => ({
            id: s.id,
            globalId: s.globalId,
            tikuPrefix: s.tikuPrefix,
            type: s.type,
            contentText: stripHtml(s.content || '').substring(0, 60),
            source: s.source || '',
            correctAnswer: s.correctAnswer,
            keypoints: parseKeypoints(s.keypoints),
            materialGlobalIds: [],
            materialIds: [],
        }));
    } else if (Array.isArray(data.questions)) {
        // exercise 接口：字段叫 questions
        result.solutions = data.questions.map((q: any): SolutionItem => ({
            id: q.id,
            globalId: q.globalId,
            tikuPrefix: q.tikuPrefix,
            type: q.type,
            contentText: stripHtml(q.content || '').substring(0, 60),
            source: q.source || '',
            correctAnswer: q.correctAnswer,
            keypoints: parseKeypoints(q.keypoints),
            materialGlobalIds: [],
            materialIds: [],
        }));
    }

    // 解析 card 字段，建立材料-题目关联
    const materialQMap: Record<string, string[]> = {}; // materialGlobalId -> [questionGlobalId]
    const questionMaterialMap: Record<string, string[]> = {}; // questionGlobalId -> [materialGlobalId]
    if (data.card && data.card.children) {
        function walkNodes(nodes: any[]): void {
            if (!Array.isArray(nodes)) return;
            nodes.forEach((node: any) => {
                if (node.nodeType === 2 && node.key && Array.isArray(node.materialKeys)) {
                    // 叶子节点：一道题
                    const qGlobalId = node.key;
                    questionMaterialMap[qGlobalId] = node.materialKeys.slice();
                    node.materialKeys.forEach((mKey: string) => {
                        if (!materialQMap[mKey]) materialQMap[mKey] = [];
                        materialQMap[mKey].push(qGlobalId);
                    });
                }
                if (node.children) walkNodes(node.children);
            });
        }
        walkNodes(data.card.children);
    }

    // 把关联关系写入 materials 和 solutions
    result.materials.forEach((m) => {
        const qIds = materialQMap[m.globalId] || [];
        m.questionGlobalIds = qIds;
        m.questionIds = qIds
            .map((gId) => {
                const q = result.solutions.find((s) => s.globalId === gId);
                return q ? q.id : null;
            })
            .filter((id): id is number => id !== null);
    });

    result.solutions.forEach((s) => {
        s.materialGlobalIds = questionMaterialMap[s.globalId] || [];
        s.materialIds = s.materialGlobalIds
            .map((gId) => {
                const m = result.materials.find((m) => m.globalId === gId);
                return m ? m.id : null;
            })
            .filter((id): id is number => id !== null);
    });

    return result;
}
