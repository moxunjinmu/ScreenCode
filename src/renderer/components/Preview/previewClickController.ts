/**
 * 区分预览区单击截图和双击全屏，避免双击时遗留的单击定时器触发截图。
 */
export class PreviewClickController {
  private pendingCapture: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly delayMs: number) {}

  /** 延迟执行单击截图，为后续双击事件预留取消窗口。 */
  scheduleCapture(capture: () => void): void {
    this.cancelPendingCapture();
    this.pendingCapture = setTimeout(() => {
      this.pendingCapture = null;
      capture();
    }, this.delayMs);
  }

  /** 全屏切换前取消单击截图，再执行进入或退出全屏。 */
  toggleFullscreen(toggle: () => void): void {
    this.cancelPendingCapture();
    toggle();
  }

  /** 组件卸载或交互意图改变时取消待执行截图。 */
  cancelPendingCapture(): void {
    if (!this.pendingCapture) return;
    clearTimeout(this.pendingCapture);
    this.pendingCapture = null;
  }
}
