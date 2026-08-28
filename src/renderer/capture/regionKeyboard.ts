export type RegionKeyboardAction =
  | { type: 'move'; dx: number; dy: number }
  | { type: 'confirm' }
  | { type: 'cancel' }
  | { type: 'restore-last' };

export interface RegionKeyboardInput {
  key: string;
  shiftKey: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
}

/** 将键盘事件收敛为区域截图支持的有限动作集合。 */
export function getRegionKeyboardAction(input: RegionKeyboardInput): RegionKeyboardAction | null {
  if (input.altKey || input.ctrlKey || input.metaKey) return null;
  const step = input.shiftKey ? 10 : 1;
  switch (input.key) {
    case 'ArrowLeft': return { type: 'move', dx: -step, dy: 0 };
    case 'ArrowRight': return { type: 'move', dx: step, dy: 0 };
    case 'ArrowUp': return { type: 'move', dx: 0, dy: -step };
    case 'ArrowDown': return { type: 'move', dx: 0, dy: step };
    case 'Enter': return { type: 'confirm' };
    case 'Escape': return { type: 'cancel' };
    default:
      return input.key.toLowerCase() === 'r' ? { type: 'restore-last' } : null;
  }
}
