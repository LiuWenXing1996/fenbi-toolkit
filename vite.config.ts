import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';

// 构建产物：dist/fenbi-question-id.user.js
// UserScript 元数据集中在此，与业务代码分离
export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/index.ts',
      userscript: {
        name: '粉笔综合工具',
        namespace: 'http://tampermonkey.net/',
        version: '3.17.2',
        description: '粉笔综合工具面板：题目 ID / 课程信息获取（接口旁路捕获·零新增请求）',
        author: 'You',
        match: ['*://*.fenbi.com/*', '*://*.fenbike.cn/*'],
        grant: ['GM_setClipboard', 'GM_addStyle', 'unsafeWindow'],
        'run-at': 'document-start',
      },
      build: {
        fileName: 'fenbi-question-id.user.js',
      },
    }),
  ],
});
