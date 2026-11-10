import React, { useEffect, useRef, useState } from 'react';
import {
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  ArrowsOutSimple,
  X,
} from '@phosphor-icons/react';
import { sanitizeWordHtml } from '../lib/security-utils';
import { soundEngine } from '../lib/sound-engine';

interface ImageZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  svgContent?: string;
  caption?: string;
  altText: string;
}

export const ImageZoomModal: React.FC<ImageZoomModalProps> = ({
  isOpen,
  onClose,
  svgContent,
  caption,
  altText,
}) => {
  const [scale, setScale] = useState<number>(1.25);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setScale(1.25);
    const timer = setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 30);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setScale((s) => Math.min(2.25, Number((s + 0.25).toFixed(2))));
      } else if (e.key === '-') {
        e.preventDefault();
        setScale((s) => Math.max(0.75, Number((s - 0.25).toFixed(2))));
      } else if (e.key === '0') {
        e.preventDefault();
        setScale(1.0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const cleanSvg = svgContent ? sanitizeWordHtml(svgContent) : '';

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-[var(--bg-overlay)] backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="diagram-zoom-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          soundEngine.play('button_interaction');
          onClose();
        }
      }}
    >
      <div className="modal-transition w-full max-w-3xl rounded-[var(--radius-xl)] bg-[var(--bg-surface)] border border-[var(--border-default)] shadow-[var(--shadow-lg)] overflow-hidden flex flex-col max-h-[88dvh]">
        {/* Apple Sheet Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-subtle)]">
          <div className="min-w-0 pr-4">
            <h2
              id="diagram-zoom-title"
              className="text-sm font-semibold text-[var(--text-primary)] truncate"
            >
              {caption || altText}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                soundEngine.play('button_interaction');
                setScale((s) => Math.max(0.75, Number((s - 0.25).toFixed(2))));
              }}
              className="interactive-control h-8 w-8 rounded-full bg-[var(--bg-subtle)] text-xs font-medium flex items-center justify-center cursor-pointer"
              aria-label="Thu nhỏ hình vẽ"
            >
              <MagnifyingGlassMinus size={15} />
            </button>
            <span className="font-mono-tabular text-xs font-semibold h-8 px-3 rounded-full bg-[var(--bg-subtle)] flex items-center justify-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => {
                soundEngine.play('button_interaction');
                setScale((s) => Math.min(2.25, Number((s + 0.25).toFixed(2))));
              }}
              className="interactive-control h-8 w-8 rounded-full bg-[var(--bg-subtle)] text-xs font-medium flex items-center justify-center cursor-pointer"
              aria-label="Phóng to hình vẽ"
            >
              <MagnifyingGlassPlus size={15} />
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.play('button_interaction');
                setScale(1.0);
              }}
              className="interactive-control h-8 px-3 rounded-full bg-[var(--bg-subtle)] text-xs font-medium flex items-center gap-1 cursor-pointer"
              aria-label="Đặt lại tỷ lệ 100%"
            >
              <ArrowsOutSimple size={13} />
              <span>100%</span>
            </button>
            <button
              ref={closeBtnRef}
              type="button"
              onClick={() => {
                soundEngine.play('button_interaction');
                onClose();
              }}
              className="interactive-control ml-1 h-8 w-8 rounded-full bg-[var(--text-primary)] text-[var(--text-inverse)] flex items-center justify-center cursor-pointer"
              aria-label="Đóng cửa sổ phóng to (Esc)"
            >
              <X size={14} weight="bold" />
            </button>
          </div>
        </div>

        {/* Zoomable Viewport */}
        <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-[var(--bg-canvas)] min-h-[340px]">
          <div
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'center center',
              transition: 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
            className="max-w-full"
          >
            {cleanSvg ? (
              <div
                className="w-[480px] max-w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-white p-5 shadow-xs"
                dangerouslySetInnerHTML={{ __html: cleanSvg }}
              />
            ) : (
              <div className="p-8 text-sm text-[var(--text-muted)]">Không có dữ liệu hình vẽ</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
