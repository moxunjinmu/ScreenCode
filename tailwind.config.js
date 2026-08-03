/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // 语义色映射到 globals.css 的 CSS 变量（规范 6.2 + 5.2 末尾已确认），
      // 使组件可写 text-muted、bg-surface-2、border-accent-border 等短类名。
      // 注意：这些是 var() 色值，不能再叠加 Tailwind 透明度修饰（如 bg-accent/50 无效）。
      colors: {
        text: 'var(--text)',
        muted: 'var(--text-muted)',
        dim: 'var(--text-dim)',
        accent: {
          DEFAULT: 'var(--accent)',
          ink: 'var(--accent-ink)',
          text: 'var(--accent-text)',
          subtle: 'var(--accent-subtle)',
          border: 'var(--accent-border)',
        },
        surface: {
          0: 'var(--surface-0)',
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
          code: 'var(--surface-code)',
        },
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        ai: 'var(--ai)',
        success: {
          DEFAULT: 'var(--success)',
          text: 'var(--success-text)',
          subtle: 'var(--success-subtle)',
          border: 'var(--success-border)',
        },
        danger: {
          DEFAULT: 'var(--danger)',
          text: 'var(--danger-text)',
          subtle: 'var(--danger-subtle)',
          border: 'var(--danger-border)',
        },
      },
      // 三档圆角（规范 3.5），另保留 rounded-full 仅用于圆点
      borderRadius: {
        sm: 'var(--r-sm)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in',
        'slide-up': 'slideUp 0.3s ease-out',
        'toast': 'toast 1.5s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        toast: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '15%': { transform: 'translateX(0)', opacity: '1' },
          '85%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};
