export const LOG_PREFIX = '[粉笔综合工具] ';

export function log(...args: unknown[]): void {
    console.log(LOG_PREFIX, ...args);
}
