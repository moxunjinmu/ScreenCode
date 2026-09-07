import React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  /** 布局类（宽度等），作用于最外层容器，如 capture-device-select、w-full。 */
  className?: string;
  title?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

/**
 * Radix Select 的项目级薄封装，统一外观，同时复用其定位、焦点和键盘交互。
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
}) => (
  <div className={`select-root ${className}`} title={title}>
    <SelectPrimitive.Root
      value={value}
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger className="select-trigger" aria-label={ariaLabel}>
        <SelectPrimitive.Value className="select-trigger-label" placeholder={placeholder}>
          {options.find((option) => option.value === value)?.label}
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon className="select-trigger-icon" asChild>
          <ChevronDown size={14} aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="select-popover"
          position="popper"
          sideOffset={4}
          collisionPadding={8}
        >
          <SelectPrimitive.ScrollUpButton className="select-scroll-button">
            <ChevronUp size={14} aria-hidden="true" />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="select-viewport">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                className="select-option"
              >
                <SelectPrimitive.ItemText>
                  <span className="select-option-label">{option.label}</span>
                </SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="select-option-indicator">
                  <Check size={14} aria-hidden="true" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="select-scroll-button">
            <ChevronDown size={14} aria-hidden="true" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  </div>
);

export default Select;
