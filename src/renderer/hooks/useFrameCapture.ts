import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Frame } from '@shared/types';
import { FRAME_QUEUE } from '@shared/constants';
import { useCaptureStore } from '../store/captureStore';
import { useFrameStore } from '../store/frameStore';
import { ToastType } from './useToast';

/**
 * 截图并入队，附带 Toast 反馈。
 * 供全局热键和界面按钮共用。
 */
export function useFrameCapture(showToast: (message: string, type: ToastType) => void) {
  const { stream, isCapturing, captureFrame } = useCaptureStore();
  const { addFrame } = useFrameStore();

  return useCallback(async () => {
    if (!stream && !isCapturing) {
      showToast('请先启动视频采集', 'error');
      return;
    }

    try {
      const outcome = await captureFrame();
      if (!outcome) {
        showToast('截图失败', 'error');
        return;
      }

      const frame: Frame = {
        id: uuidv4(),
        timestamp: Date.now(),
        ...outcome.image,
        type: 'new_scene',
        overlap: undefined,
      };

      addFrame(frame);

      // 直接读最新队列长度，避免把 frames 放进依赖导致事件监听反复重建
      const queued = useFrameStore.getState().frames.length;
      if (outcome.restoreError || outcome.warning) {
        showToast(outcome.restoreError || outcome.warning || '截图已回退', 'error');
      } else {
        const qualityLabel = outcome.image.qualityProfile === 'original'
          ? '无损 PNG'
          : `${outcome.image.qualityProfile || '配置'}档`;
        showToast(`${outcome.sourceFormat || (outcome.source === 'yuy2' ? 'YUY2' : '预览')} ${qualityLabel}已入队 (${queued}/${FRAME_QUEUE.MAX_FRAMES})`, 'success');
      }
    } catch (error) {
      console.error('Capture frame error:', error);
      showToast('截图失败', 'error');
    }
  }, [stream, isCapturing, captureFrame, addFrame, showToast]);
}
