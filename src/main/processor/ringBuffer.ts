import { Frame } from '@shared/types';

/**
 * 环形缓冲区 - 用于存储最近的 N 帧
 */
export class RingBuffer {
  private buffer: (Frame | null)[];
  private capacity: number;
  private head: number = 0;
  private tail: number = 0;
  private count: number = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity).fill(null);
  }

  /**
   * 添加帧到缓冲区
   */
  push(frame: Frame): void {
    this.buffer[this.tail] = frame;
    this.tail = (this.tail + 1) % this.capacity;

    if (this.count < this.capacity) {
      this.count++;
    } else {
      this.head = (this.head + 1) % this.capacity;
    }
  }

  /**
   * 获取所有帧
   */
  getAll(): Frame[] {
    const result: Frame[] = [];
    for (let i = 0; i < this.count; i++) {
      const index = (this.head + i) % this.capacity;
      const frame = this.buffer[index];
      if (frame) {
        result.push(frame);
      }
    }
    return result;
  }

  /**
   * 清空缓冲区
   */
  clear(): void {
    this.buffer = new Array(this.capacity).fill(null);
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }

  /**
   * 缓冲区是否已满
   */
  isFull(): boolean {
    return this.count === this.capacity;
  }

  /**
   * 缓冲区是否为空
   */
  isEmpty(): boolean {
    return this.count === 0;
  }

  /**
   * 获取当前帧数
   */
  getCount(): number {
    return this.count;
  }
}
