import { log } from './core/log';
import { installApiCaptureHook } from './capture/install';
import { createPanel } from './ui/panel';

// ========== 初始化（version 见 package.json 与 vite.config.ts 元数据） ==========

log('脚本开始加载 v3.17.2');

// document-start 即安装网络旁路捕获（零新增请求）
installApiCaptureHook();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        log('DOMContentLoaded 触发');
        createPanel();
    });
} else {
    createPanel();
}

log('脚本初始化完成');
