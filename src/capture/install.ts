import { log } from '../core/log';
import { isQuizApiUrl, isCourseApiUrl } from './urls';
import { onQuizApiCaptured } from './quiz';
import { onCourseApiCaptured } from './course';

// ========== 旁路捕获：监听页面自身的 fetch / XHR 响应（只读、不重放、零新增请求） ==========
// 只 patch 页面的真实网络对象（sandbox 下须用 unsafeWindow），且只安装一次

export function installApiCaptureHook(): void {
    try {
        const W: any = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
        if (!W || W.__fenbiQuizHookInstalled) return;
        W.__fenbiQuizHookInstalled = true;

        // ---- 拦截 fetch ----
        const origFetch = W.fetch;
        if (typeof origFetch === 'function') {
            W.fetch = function (...args: any[]) {
                const p = origFetch.apply(this, args);
                try {
                    let url = '';
                    const arg0 = args[0];
                    if (typeof arg0 === 'string') url = arg0;
                    else if (arg0 && arg0.url) url = arg0.url;
                    const isQuiz = isQuizApiUrl(url);
                    const isCourse = isCourseApiUrl(url);
                    if (isQuiz || isCourse) {
                        p.then((resp: any) => {
                            try {
                                resp.clone().text().then((txt: string) => {
                                    try {
                                        const json = JSON.parse(txt);
                                        if (!json) return;
                                        if (isQuiz) onQuizApiCaptured(url, json);
                                        if (isCourse) onCourseApiCaptured(url, json);
                                    } catch (e) {}
                                }).catch(() => {});
                            } catch (e) {}
                        }).catch(() => {});
                    }
                } catch (e) {}
                return p;
            };
            log('fetch 旁路捕获已安装');
        }

        // ---- 拦截 XMLHttpRequest ----
        const origOpen = W.XMLHttpRequest.prototype.open;
        const origSend = W.XMLHttpRequest.prototype.send;
        if (typeof origOpen === 'function' && typeof origSend === 'function') {
            W.XMLHttpRequest.prototype.open = function (method: string, url: string, ...rest: any[]) {
                this.__fenbiApiUrl = url || '';
                return origOpen.call(this, method, url, ...rest);
            };
            W.XMLHttpRequest.prototype.send = function (...args: any[]) {
                const url = this.__fenbiApiUrl || '';
                const isQuiz = isQuizApiUrl(url);
                const isCourse = isCourseApiUrl(url);
                if (isQuiz || isCourse) {
                    this.addEventListener('load', () => {
                        try {
                            const txt = this.responseText;
                            if (txt) {
                                const json = JSON.parse(txt);
                                if (!json) return;
                                if (isQuiz) onQuizApiCaptured(url, json);
                                if (isCourse) onCourseApiCaptured(url, json);
                            }
                        } catch (e) {}
                    });
                }
                return origSend.apply(this, args);
            };
            log('XHR 旁路捕获已安装');
        }
    } catch (e) {
        log('安装旁路捕获失败:', e);
    }
}
