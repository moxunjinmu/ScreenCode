import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import Select from './index';

describe('通用下拉框', () => {
  it('使用标准组合框语义并显示当前选择', () => {
    const markup = renderToStaticMarkup(React.createElement(Select, {
      value: 'gstreamer-mf',
      options: [
        { value: 'browser-auto', label: '浏览器自动' },
        { value: 'gstreamer-mf', label: '精确协议' },
      ],
      onChange: vi.fn(),
      ariaLabel: '采集方式',
    }));

    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('aria-label="采集方式"');
    expect(markup).toContain('精确协议');
  });
});
