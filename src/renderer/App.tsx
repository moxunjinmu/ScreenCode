import React, { useEffect, useState, useCallback } from 'react';
import Layout from './components/Layout';
import Preview from './components/Preview';
import ThumbnailQueue from './components/ThumbnailQueue';
import CodeDisplay from './components/CodeDisplay';
import Toast from './components/Toast';
import { useCaptureStore } from './store/captureStore';
import { useFrameStore } from './store/frameStore';
import { useAppStore } from './store/appStore';
import { Frame } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

const App: React.FC = () => {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const { loadDevices, captureFrame, stream } = useCaptureStore();
  const { addFrame, frames } = useFrameStore();
  const { setCodeResult, setError, setProcessing } = useAppStore();

  // 截图处理函数
  const handleCaptureFrame = useCallback(async () => {
    if (!stream) {
      setToast({ message: '请先启动视频采集', type: 'error' });
      setTimeout(() => setToast(null), 2000);
      return;
    }

    try {
      const base64Frame = await captureFrame();
      if (!base64Frame) {
        setToast({ message: '截图失败', type: 'error' });
        setTimeout(() => setToast(null), 2000);
        return;
      }

      // 创建帧对象
      const frame: Frame = {
        id: uuidv4(),
        timestamp: Date.now(),
        data: base64Frame,
        type: 'new_scene', // 后续实现帧差分检测
        overlap: undefined
      };

      // 添加到队列
      addFrame(frame);
      
      setToast({ message: `截图已入队 (${frames.length + 1}/8)`, type: 'success' });
      setTimeout(() => setToast(null), 1500);
    } catch (error) {
      console.error('Capture frame error:', error);
      setToast({ message: '截图失败', type: 'error' });
      setTimeout(() => setToast(null), 2000);
    }
  }, [stream, captureFrame, addFrame, frames.length]);

  useEffect(() => {
    // 加载设备列表
    loadDevices();

    // 监听截图事件 (来自全局热键)
    const unsubscribeCapture = window.electronAPI.onCaptureFrame(() => {
      handleCaptureFrame();
    });

    // 监听 AI 结果
    const unsubscribeAI = window.electronAPI.onAIResult((result) => {
      setCodeResult(result);
      setProcessing(false);
      setToast({ message: '代码提取完成', type: 'success' });
      setTimeout(() => setToast(null), 2000);
    });

    // 监听错误
    const unsubscribeError = window.electronAPI.onError((error) => {
      setError(error);
      setProcessing(false);
      setToast({ message: error.message, type: 'error' });
      setTimeout(() => setToast(null), 3000);
    });

    return () => {
      unsubscribeCapture();
      unsubscribeAI();
      unsubscribeError();
    };
  }, [loadDevices, setCodeResult, setError, setProcessing, handleCaptureFrame]);

  return (
    <Layout>
      <div className="flex flex-col h-full gap-4 p-4">
        {/* 实时预览 */}
        <section className="flex-1 min-h-[200px]">
          <Preview />
        </section>

        {/* 缩略图队列 */}
        <section className="h-24">
          <ThumbnailQueue onCaptureFrame={handleCaptureFrame} />
        </section>

        {/* 代码展示 */}
        <section className="flex-1 min-h-[200px]">
          <CodeDisplay />
        </section>
      </div>

      {/* Toast 通知 */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </Layout>
  );
};

export default App;
