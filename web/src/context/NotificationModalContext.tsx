import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { AlertTriangle, CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export interface AlertOptions {
  title?: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  confirmText?: string;
}

interface NotificationModalContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (options: string | AlertOptions) => Promise<void>;
}

const NotificationModalContext = createContext<NotificationModalContextType | undefined>(undefined);

export const NotificationModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Confirm state
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  // Alert state
  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    options: AlertOptions;
    resolve: () => void;
  } | null>(null);

  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const alertButtonRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        options,
        resolve,
      });
    });
  }, []);

  const alert = useCallback((options: string | AlertOptions): Promise<void> => {
    const opts: AlertOptions = typeof options === 'string' ? { message: options } : options;
    return new Promise((resolve) => {
      setAlertState({
        isOpen: true,
        options: opts,
        resolve,
      });
    });
  }, []);

  // Handle keyboard events (Escape, Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (confirmState?.isOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          confirmState.resolve(false);
          setConfirmState(null);
        }
      } else if (alertState?.isOpen) {
        if (e.key === 'Escape' || e.key === 'Enter') {
          e.preventDefault();
          alertState.resolve();
          setAlertState(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmState, alertState]);

  // Focus trap for confirm modal
  useEffect(() => {
    if (confirmState?.isOpen) {
      const timer = setTimeout(() => {
        confirmButtonRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [confirmState?.isOpen]);

  // Focus trap for alert modal
  useEffect(() => {
    if (alertState?.isOpen) {
      const timer = setTimeout(() => {
        alertButtonRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [alertState?.isOpen]);

  const handleConfirmClose = (confirmed: boolean) => {
    if (confirmState) {
      confirmState.resolve(confirmed);
      setConfirmState(null);
    }
  };

  const handleAlertClose = () => {
    if (alertState) {
      alertState.resolve();
      setAlertState(null);
    }
  };

  const getAlertIcon = (type?: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={24} className="text-emerald-600" style={{ color: '#059669' }} />;
      case 'error':
        return <AlertCircle size={24} className="text-rose-600" style={{ color: '#E11D48' }} />;
      case 'warning':
        return <AlertTriangle size={24} className="text-amber-600" style={{ color: '#D97706' }} />;
      default:
        return <Info size={24} className="text-sky-600" style={{ color: '#0284C7' }} />;
    }
  };

  return (
    <NotificationModalContext.Provider value={{ confirm, alert }}>
      {children}

      {/* Confirmation Modal */}
      {confirmState?.isOpen && (
        <div
          className="responsive-modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            padding: '16px',
          }}
          onClick={() => handleConfirmClose(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '440px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              border: '1px solid #E2E8F0',
              overflow: 'hidden',
              animation: 'modalSlideUp 0.2s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '24px 24px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <div
                  style={{
                    flexShrink: 0,
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    backgroundColor: confirmState.options.isDestructive ? '#FEE2E2' : '#FEF3C7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: confirmState.options.isDestructive ? '#DC2626' : '#D97706',
                  }}
                >
                  <AlertTriangle size={22} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3
                    id="confirm-dialog-title"
                    style={{
                      margin: '0 0 8px',
                      fontSize: '17px',
                      fontWeight: 700,
                      color: '#0F172A',
                      lineHeight: '1.3',
                    }}
                  >
                    {confirmState.options.title || 'Xác nhận hành động'}
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '14px',
                      color: '#475569',
                      lineHeight: '1.5',
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {confirmState.options.message}
                  </p>
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '10px',
                padding: '16px 24px',
                backgroundColor: '#F8FAFC',
                borderTop: '1px solid #E2E8F0',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={() => handleConfirmClose(false)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#334155',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  minHeight: '40px',
                  flex: '1 1 auto',
                  maxWidth: '140px',
                }}
              >
                {confirmState.options.cancelText || 'Hủy bỏ'}
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                onClick={() => handleConfirmClose(true)}
                style={{
                  padding: '9px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: confirmState.options.isDestructive ? '#DC2626' : '#24594D',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  minHeight: '40px',
                  boxShadow: confirmState.options.isDestructive
                    ? '0 1px 3px rgba(220, 38, 38, 0.3)'
                    : '0 1px 3px rgba(36, 89, 77, 0.3)',
                  flex: '1 1 auto',
                  maxWidth: '180px',
                }}
              >
                {confirmState.options.confirmText || 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      {alertState?.isOpen && (
        <div
          className="responsive-modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            padding: '16px',
          }}
          onClick={handleAlertClose}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="alert-dialog-title"
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '420px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              border: '1px solid #E2E8F0',
              overflow: 'hidden',
              animation: 'modalSlideUp 0.2s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '24px 24px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <div
                  style={{
                    flexShrink: 0,
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    backgroundColor:
                      alertState.options.type === 'error'
                        ? '#FEE2E2'
                        : alertState.options.type === 'success'
                        ? '#DCFCE7'
                        : alertState.options.type === 'warning'
                        ? '#FEF3C7'
                        : '#E0F2FE',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {getAlertIcon(alertState.options.type)}
                </div>
                <div style={{ flex: 1 }}>
                  <h3
                    id="alert-dialog-title"
                    style={{
                      margin: '0 0 8px',
                      fontSize: '17px',
                      fontWeight: 700,
                      color: '#0F172A',
                      lineHeight: '1.3',
                    }}
                  >
                    {alertState.options.title ||
                      (alertState.options.type === 'error'
                        ? 'Thông báo lỗi'
                        : alertState.options.type === 'success'
                        ? 'Thành công'
                        : 'Thông báo hệ thống')}
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '14px',
                      color: '#475569',
                      lineHeight: '1.5',
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {alertState.options.message}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAlertClose}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '6px',
                  }}
                  aria-label="Đóng"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                padding: '14px 24px',
                backgroundColor: '#F8FAFC',
                borderTop: '1px solid #E2E8F0',
              }}
            >
              <button
                ref={alertButtonRef}
                type="button"
                onClick={handleAlertClose}
                style={{
                  padding: '9px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#24594D',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  minHeight: '40px',
                  boxShadow: '0 1px 3px rgba(36, 89, 77, 0.3)',
                }}
              >
                {alertState.options.confirmText || 'Đã hiểu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationModalContext.Provider>
  );
};

export const useNotificationModal = () => {
  const context = useContext(NotificationModalContext);
  if (!context) {
    throw new Error('useNotificationModal must be used within a NotificationModalProvider');
  }
  return context;
};
