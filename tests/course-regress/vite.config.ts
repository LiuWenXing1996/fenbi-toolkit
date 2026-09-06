// 课程回归测试打包配置：把 tests/course-regress/run.ts 打包成单文件 mjs 后由 node 执行。
// 产物输出到 node_modules/.cache（已被 .gitignore 忽略），不污染仓库。
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        ssr: true,
        outDir: 'node_modules/.cache/course-regress',
        emptyOutDir: true,
        rollupOptions: {
            input: resolve(process.cwd(), 'tests/course-regress/run.ts'),
            output: { entryFileNames: 'run.mjs' }
        }
    }
});
