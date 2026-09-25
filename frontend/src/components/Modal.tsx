import React from 'react';
import { theme } from '../theme';
import { Button } from './Button';
import { CloseIcon } from './icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
  accessibleDialog?: boolean;
}

export function Modal({ isOpen, onClose, title, children, footer, width = '560px', accessibleDialog = false }: ModalProps) {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!isOpen || !accessibleDialog) return;
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.focus();
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, [isOpen, accessibleDialog]);
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: theme.spacing[4],
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role={accessibleDialog ? 'dialog' : undefined}
        aria-modal={accessibleDialog ? true : undefined}
        aria-label={accessibleDialog ? title : undefined}
        tabIndex={accessibleDialog ? -1 : undefined}
        onKeyDown={accessibleDialog ? (event) => {
          if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
          if (event.key !== 'Tab') return;
          const targets = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]')].filter(element => element.getClientRects().length);
          const first = targets[0]; const last = targets[targets.length - 1];
          if (!first) { event.preventDefault(); return; }
          if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        } : undefined}
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.xl,
          boxShadow: theme.shadows.lg,
          width: '100%',
          maxWidth: width,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          animation: 'modalFadeIn 0.2s ease',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: theme.spacing[6],
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: theme.typography.sizes.xl,
              fontWeight: theme.typography.weights.semibold,
              color: theme.colors.text.main,
            }}
          >
            {title}
          </h2>
          <Button aria-label="Close dialog" variant="ghost" size="sm" onClick={onClose} style={{ padding: theme.spacing[2] }}>
            <CloseIcon size={20} />
          </Button>
        </div>

        {/* Content */}
        <div
          style={{
            padding: theme.spacing[6],
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            style={{
              padding: theme.spacing[6],
              borderTop: `1px solid ${theme.colors.border}`,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: theme.spacing[3],
            }}
          >
            {footer}
          </div>
        )}
      </div>
      <style>{`
        @keyframes modalFadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
