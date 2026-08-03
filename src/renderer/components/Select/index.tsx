import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  /** 布局类（宽度等），作用于最外层容器，如 capture-device-select、w-full */
  className?: string;
  title?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

/**
 * 自定义下拉选择器。原生 <select> 的展开列表在 Chromium/Windows 上是系统弹层，
 * 无法跟随设计令牌，因此用按钮 + 弹层重写，样式与 .input/.btn 同源。
 */
const Select: React.FC<SelectProps> = ({
  value,
  options,
  onChange,
  placeholder = '请选择...',
  className = '',
  title,
  disabled = false,
  ariaLabel,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const selected = options.find((o) => o.value === value);

  const close = useCallback((refocus = false) => {
    setIsOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  const open = useCallback(() => {
    if (disabled) return;
    setActiveIndex(Math.max(0, options.findIndex((o) => o.value === value)));
    setIsOpen(true);
  }, [disabled, options, value]);

  const selectAt = useCallback(
    (index: number) => {
      const option = options[index];
      if (!option) return;
      onChange(option.value);
      close(true);
    },
    [options, onChange, close],
  );

  // 点击组件外部时关闭
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen, close]);

  // 打开时让激活项滚动到可见区域
  useEffect(() => {
    if (isOpen && activeIndex >= 0) {
      optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [isOpen, activeIndex]);

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (isOpen) {
        close(true);
      } else {
        open();
      }
    } else if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      close(true);
    }
  };

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectAt(activeIndex);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    } else if (e.key === 'Tab') {
      close();
    }
  };

  return (
    <div ref={rootRef} className={`select-root ${className}`} title={title}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={() => (isOpen ? close(true) : open())}
        onKeyDown={handleTriggerKeyDown}
        className={`select-trigger${isOpen ? ' is-open' : ''}${selected ? '' : ' is-placeholder'}`}
      >
        <span className="select-trigger-label">{selected ? selected.label : placeholder}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="select-popover" role="listbox" aria-label={ariaLabel} onKeyDown={handleListKeyDown}>
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                ref={(el) => {
                  optionRefs.current[index] = el;
                }}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => selectAt(index)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`select-option${isSelected ? ' is-selected' : ''}${index === activeIndex ? ' is-active' : ''}`}
              >
                <span className="select-option-label">{option.label}</span>
                {isSelected && <Check size={14} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Select;
