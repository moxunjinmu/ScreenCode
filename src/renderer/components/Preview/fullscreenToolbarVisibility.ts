export type FullscreenToolbarVisibilityListener = (visible: boolean) => void;

/**
 * 管理全屏截图菜单的空闲计时与强制可见状态。
 * 控制器不依赖 React，确保计时器能够独立测试并在组件卸载时集中清理。
 */
export class FullscreenToolbarVisibilityController {
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private autoHideActive = false;
  private heldVisible = false;
  private isVisible = true;

  constructor(
    private readonly delayMs: number,
    private readonly onVisibilityChange: FullscreenToolbarVisibilityListener,
  ) {
    if (!Number.isFinite(delayMs) || delayMs <= 0) {
      throw new Error('全屏截图菜单隐藏延迟必须为正数');
    }
  }

  get visible(): boolean {
    return this.isVisible;
  }

  /** 仅在“全屏 + 有视频流 + 用户开启设置”时启动自动隐藏。 */
  setAutoHideActive(active: boolean): void {
    this.autoHideActive = active;
    this.clearTimer();
    this.setVisible(true);
    this.scheduleHide();
  }

  /** 悬停、键盘焦点和截图交互期间强制保持菜单可见。 */
  setHeldVisible(held: boolean): void {
    this.heldVisible = held;
    this.clearTimer();
    this.setVisible(true);
    this.scheduleHide();
  }

  /** 用户活动后立即显示菜单，并从当前时刻重新计算空闲时间。 */
  notifyActivity(): void {
    this.clearTimer();
    this.setVisible(true);
    this.scheduleHide();
  }

  /** 组件卸载时清理定时器；控制器仍可被 React 严格模式重新激活。 */
  dispose(): void {
    this.clearTimer();
    this.autoHideActive = false;
    this.heldVisible = false;
    this.isVisible = true;
  }

  private scheduleHide(): void {
    if (!this.autoHideActive || this.heldVisible) return;
    this.timeoutId = setTimeout(() => {
      this.timeoutId = null;
      this.setVisible(false);
    }, this.delayMs);
  }

  private clearTimer(): void {
    if (this.timeoutId === null) return;
    clearTimeout(this.timeoutId);
    this.timeoutId = null;
  }

  private setVisible(visible: boolean): void {
    if (this.isVisible === visible) return;
    this.isVisible = visible;
    this.onVisibilityChange(visible);
  }
}
