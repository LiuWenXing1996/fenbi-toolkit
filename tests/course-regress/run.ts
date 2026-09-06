// 课程信息获取回归测试（真实抓包样例驱动，走真实源码 capture/course + coursePanel 拼树逻辑）
// 运行：npm run test:course（vite 打包后再由 node 执行，零新增依赖）
import { readFileSync } from 'fs';
import { join } from 'path';
import { courseByCourseId } from '../../src/store/course';
import { onCourseApiCaptured } from '../../src/capture/course';
import { buildCourseView } from '../../src/features/coursePanel';

// scheduleCourseRefresh 的防抖定时回调需要 document 桩
(globalThis as any).document = { getElementById: () => null };

const ROOT = process.cwd(); // 测试必须从项目根运行，以便读取 samples/
const S = 'https://ke.fenbi.com/win/gwy/v3';

function load(p: string): any {
    return JSON.parse(readFileSync(join(ROOT, 'samples', p), 'utf8'));
}

let failed = 0;
function assert(cond: any, msg: string): void {
    if (!cond) {
        failed += 1;
        console.error('FAIL:', msg);
    }
}

// ---------- levels-1（788204）：无分组，顶层内容直接是课时 ----------
{
    const b = 'episodes/levels-1';
    onCourseApiCaptured(S + '/lectures/788204/detail_for_sale?platform=win', load(b + '/l-0/res.json'));
    onCourseApiCaptured(S + '/my/lectures/788204/episode_sets/2146872/episode_nodes?platform=win&start=0&len=20', load(b + '/l-1/res.json'));
    const v = buildCourseView();
    assert(v && v.name.length > 0, 'L1: 课程名应来自 detail_for_sale');
    assert(v && !v.noNodes, 'L1: 应识别到课时节点');
    assert(v && v.groups.length === 1 && v.groups[0].loaded && v.groups[0].episodes.length === 13,
        'L1: 顶层直接课时应包装为 1 个分组、13 课时，实际 groups=' + (v ? v.groups.length : -1));
}

// ---------- levels-2（793991）：2166628 -> 2202081（课时） ----------
{
    const b = 'episodes/levels-2';
    onCourseApiCaptured(S + '/lectures/793991/detail_for_sale?platform=win', load(b + '/l-0/res.json'));
    onCourseApiCaptured(S + '/my/lectures/793991/episode_sets/2166628/episode_nodes?platform=win&start=0&len=20', load(b + '/l-1/res.json'));
    onCourseApiCaptured(S + '/my/lectures/793991/episode_sets/2166628/episode_nodes?platform=win&start=0&len=20&episode_set_id=2202081', load(b + '/l-2/res.json'));
    const v = buildCourseView();
    assert(v && v.groups.length === 8, 'L2: 顶层应有 8 个分组，实际=' + (v ? v.groups.length : -1));
    const g: any = v && v.groups.find((x: any) => x.id === 2202081);
    assert(g && g.loaded && g.episodes.length === 18, 'L2: 2202081 应加载 18 课时');
    assert(v && v.totalEpisodes === 18, 'L2: 整树课时数应为 18，实际=' + (v ? v.totalEpisodes : -1));
}

// ---------- levels-3（784882）：2133038 -> 2133043【言语】 -> 2133047（课时），三层嵌套 ----------
{
    const b = 'episodes/levels-3';
    onCourseApiCaptured(S + '/lectures/784882/detail_for_sale?platform=win', load(b + '/l-0/res.json'));
    onCourseApiCaptured(S + '/my/lectures/784882/episode_sets/2133038/episode_nodes?platform=win&start=0&len=20', load(b + '/l-1/res.json'));
    onCourseApiCaptured(S + '/my/lectures/784882/episode_sets/2133038/episode_nodes?platform=win&start=0&len=20&episode_set_id=2133043', load(b + '/l-2/res.json'));
    onCourseApiCaptured(S + '/my/lectures/784882/episode_sets/2133038/episode_nodes?platform=win&start=0&len=20&episode_set_id=2133047', load(b + '/l-3/res.json'));

    const v = buildCourseView();
    assert(v && v.groups.length === 4, 'L3: 顶层应有 4 个学科分组，实际=' + (v ? v.groups.length : -1));
    const yuyan: any = v && v.groups.find((x: any) => x.id === 2133043);
    assert(yuyan && yuyan.loaded, 'L3: 【言语】(2133043) 应已加载其子分组列表');
    assert(yuyan && yuyan.children.length === 7, 'L3: 【言语】应含 7 个系列子分组，实际=' + (yuyan ? yuyan.children.length : -1));
    const s1: any = yuyan && yuyan.children[0];
    const s2: any = yuyan && yuyan.children[1];
    assert(s1 && s1.id === 2133047 && s1.loaded && s1.episodes.length === 5, 'L3: 系列1(2133047) 应加载 5 课时');
    assert(s2 && s2.id === 2146591 && !s2.loaded, 'L3: 系列2(2146591) 内容未捕获时应为未加载（但标题保留）');
    assert(yuyan && yuyan.children.slice(2).every((c: any) => !c.loaded), 'L3: 系列3..7 均应为未加载');
    assert(v && v.totalEpisodes === 5 && v.totalSeconds > 0, 'L3: 整树课时/时长统计');

    // 关键回归：第二层的第二项——补上 2146591 的内容后，应能从“未加载”变为正常展示课时
    onCourseApiCaptured(S + '/my/lectures/784882/episode_sets/2133038/episode_nodes?platform=win&start=0&len=20&episode_set_id=2146591', {
        code: 1,
        data: {
            episodeSetId: 2146591,
            episodeNodes: [
                { nodeType: 6, payload: { id: 900001, title: '并列结构识别', duration: 1800, startTime: 0 } },
                { nodeType: 6, payload: { id: 900002, title: '并列结构解题', duration: 1500, startTime: 0 } }
            ]
        }
    });
    const v2 = buildCourseView();
    const yuyan2: any = v2 && v2.groups.find((x: any) => x.id === 2133043);
    const s2b: any = yuyan2 && yuyan2.children[1];
    assert(s2b && s2b.loaded && s2b.episodes.length === 2, 'L3: 补捕获后 系列2 应可正常显示 2 课时');
    assert(v2 && v2.totalEpisodes === 7, 'L3: 补捕获后整树课时数应为 7，实际=' + (v2 ? v2.totalEpisodes : -1));
}

// ---------- 无 detail、无顶层（深层直开）：应直接用 episode_nodes 包装展示 ----------
{
    const b = 'episodes/levels-2';
    onCourseApiCaptured(S + '/my/lectures/555888/episode_sets/2166628/episode_nodes?platform=win&start=0&len=20&episode_set_id=2202081', load(b + '/l-2/res.json'));
    const rec = courseByCourseId[555888];
    assert(rec && rec.rootSetId === null, '深层直开: 不应设置 rootSetId');
    const v = buildCourseView();
    assert(v && v.fromNodes === true && v.name === '', '深层直开: 应标记数据来自课时接口且无课程名');
    assert(v && v.noNodes === false && v.groups.length === 1 && v.groups[0].episodes.length === 18,
        '深层直开: 应包装为单分组并展示 18 课时');
}

if (failed > 0) {
    console.error('共 ' + failed + ' 条断言失败');
    process.exit(1);
}
console.log('REGRESSION_OK');
process.exit(0);
