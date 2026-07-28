/**
 * 帧处理模块。
 *
 * 帧队列的唯一真源是渲染进程的 frameStore —— 主进程不再镜像一份缓冲区，
 * 避免两套状态不同步。主进程只在 AI 请求前介入，负责图像压缩。
 */
export { compressFrames, compressImages } from './compressFrames';
export { ImageCompressor } from './imageCompressor';
