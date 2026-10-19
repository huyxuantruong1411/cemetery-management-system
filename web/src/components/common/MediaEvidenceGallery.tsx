import React, { useState, useEffect, useRef } from 'react';
import {
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  X,
  Upload,
  User,
  Calendar,
  Trash2,
} from 'lucide-react';

export interface MediaEvidenceItem {
  id: string | number;
  file_id: string;
  download_url?: string | null;
  caption?: string | null;
  file_name?: string | null;
  uploaded_at?: string | null;
  uploader_name?: string | null;
}

interface MediaEvidenceGalleryProps {
  items: MediaEvidenceItem[];
  maxFiles?: number;
  title?: string;
  token?: string | null;
  canUpload?: boolean;
  onUpload?: (file: File, caption: string) => Promise<void>;
  uploadLoading?: boolean;
  canDelete?: boolean;
  onDelete?: (item: MediaEvidenceItem) => Promise<void> | void;
  compact?: boolean;
}

export const MediaEvidenceGallery: React.FC<MediaEvidenceGalleryProps> = ({
  items = [],
  maxFiles = 5,
  title,
  token,
  canUpload = false,
  onUpload,
  uploadLoading = false,
  canDelete = false,
  onDelete,
  compact = false,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [panPosition, setPanPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Touch swipe & pinch states for mobile
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [initialPinchDist, setInitialPinchDist] = useState<number | null>(null);

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCaption, setUploadCaption] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const imageRef = useRef<HTMLImageElement>(null);

  const getMediaUrl = (item: MediaEvidenceItem): string => {
    if (!item.file_id) return item.download_url || '';
    const base = `/api/v1/documents/public/${item.file_id}`;
    return token ? `${base}?token=${encodeURIComponent(token)}` : base;
  };

  const handleOpenLightbox = (index: number) => {
    setSelectedIndex(index);
    setZoomScale(1);
    setPanPosition({ x: 0, y: 0 });
  };

  const handleCloseLightbox = () => {
    setSelectedIndex(null);
    setZoomScale(1);
    setPanPosition({ x: 0, y: 0 });
  };

  const handlePrev = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (selectedIndex === null || items.length === 0) return;
    setSelectedIndex((prev) => (prev! > 0 ? prev! - 1 : items.length - 1));
    setZoomScale(1);
    setPanPosition({ x: 0, y: 0 });
  };

  const handleNext = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (selectedIndex === null || items.length === 0) return;
    setSelectedIndex((prev) => (prev! < items.length - 1 ? prev! + 1 : 0));
    setZoomScale(1);
    setPanPosition({ x: 0, y: 0 });
  };

  const handleZoomIn = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setZoomScale((prev) => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setZoomScale((prev) => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setPanPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setZoomScale(1);
    setPanPosition({ x: 0, y: 0 });
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedIndex === null) return;
      if (e.key === 'Escape') handleCloseLightbox();
      else if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, items.length]);

  // Touch gestures for mobile: Swipe & Pinch-to-zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setTouchStartX(e.touches[0].clientX);
      setTouchStartY(e.touches[0].clientY);
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setInitialPinchDist(dist);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDist !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / initialPinchDist;
      setZoomScale((prev) => Math.min(Math.max(prev * ratio, 1), 4));
      setInitialPinchDist(dist);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX !== null && e.changedTouches.length === 1 && zoomScale === 1) {
      const deltaX = e.changedTouches[0].clientX - touchStartX;
      const deltaY = e.changedTouches[0].clientY - (touchStartY || 0);
      if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > 0) handlePrev();
        else handleNext();
      }
    }
    setTouchStartX(null);
    setTouchStartY(null);
    setInitialPinchDist(null);
  };

  // Mouse pan when zoomed
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomScale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoomScale > 1) {
      setPanPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDoubleTap = () => {
    if (zoomScale > 1) {
      setZoomScale(1);
      setPanPosition({ x: 0, y: 0 });
    } else {
      setZoomScale(2);
    }
  };

  const handleSubmitUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !onUpload) return;
    try {
      setUploadError(null);
      await onUpload(uploadFile, uploadCaption.trim());
      setIsUploadOpen(false);
      setUploadFile(null);
      setUploadCaption('');
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Lỗi khi tải ảnh lên');
    }
  };

  const activeItem = selectedIndex !== null ? items[selectedIndex] : null;

  return (
    <div style={{ marginTop: '8px', marginBottom: '8px' }}>
      {/* Header bar with Count and Max Limit */}
      {(title || canUpload || items.length > 0) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '6px',
            fontSize: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontWeight: 600 }}>
            <ImageIcon size={14} color="#059669" />
            <span>{title || 'Ảnh minh chứng thực địa'}</span>
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '10px',
                backgroundColor: items.length >= maxFiles ? '#FEF2F2' : '#F1F5F9',
                color: items.length >= maxFiles ? '#DC2626' : '#475569',
                border: '1px solid #E2E8F0',
                fontWeight: 700,
              }}
            >
              {items.length}/{maxFiles} ảnh
            </span>
          </div>

          {canUpload && items.length < maxFiles && (
            <button
              type="button"
              onClick={() => {
                setUploadFile(null);
                setUploadCaption('');
                setUploadError(null);
                setIsUploadOpen(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                padding: '3px 8px',
                backgroundColor: '#ECFDF5',
                color: '#047857',
                border: '1px solid #A7F3D0',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              <Upload size={12} />
              <span>+ Đính kèm ảnh ({maxFiles - items.length} còn lại)</span>
            </button>
          )}
        </div>
      )}

      {/* Mini Thumbnails Grid */}
      {items.length === 0 ? (
        <div
          style={{
            padding: compact ? '8px' : '14px',
            backgroundColor: '#F8FAFC',
            borderRadius: '8px',
            border: '1px dashed #CBD5E1',
            textAlign: 'center',
            fontSize: '12px',
            color: '#94A3B8',
          }}
        >
          Chưa có hình ảnh minh chứng thực địa nào được tải lên.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${compact ? '64px' : '84px'}, 1fr))`,
            gap: '8px',
          }}
        >
          {items.map((item, idx) => {
            const url = getMediaUrl(item);
            return (
              <div
                key={item.id || idx}
                onClick={() => handleOpenLightbox(idx)}
                style={{
                  position: 'relative',
                  width: '100%',
                  paddingBottom: '100%',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#0F172A',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.04)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                }}
              >
                <img
                  src={url}
                  alt={item.caption || item.file_name || `Ảnh minh chứng ${idx + 1}`}
                  loading="lazy"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                  onError={(e) => {
                    // Fallback placeholder icon
                    e.currentTarget.style.display = 'none';
                  }}
                />
                {item.caption && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      backgroundColor: 'rgba(0,0,0,0.65)',
                      color: '#FFFFFF',
                      fontSize: '9px',
                      padding: '2px 4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.caption}
                  </div>
                )}
                {canDelete && onDelete && (
                  <button
                    type="button"
                    title="Xóa ảnh này (trước khi xác nhận hoàn tất)"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('Bạn có chắc chắn muốn xóa ảnh minh chứng này khỏi đầu việc? (Chỉ có thể xóa trước khi nhấn Hoàn tất đầu việc).')) {
                        onDelete(item);
                      }
                    }}
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      zIndex: 10,
                      backgroundColor: 'rgba(220, 38, 38, 0.9)',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '50%',
                      width: '22px',
                      height: '22px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Fullscreen Interactive Lightbox Modal */}
      {selectedIndex !== null && activeItem && (
        <div
          onClick={handleCloseLightbox}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(0, 0, 0, 0.92)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '16px',
            userSelect: 'none',
          }}
        >
          {/* Top Bar Controls */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              maxWidth: '900px',
              margin: '0 auto',
              color: '#FFFFFF',
              zIndex: 10,
            }}
          >
            {/* Title & Counter */}
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#FCD34D' }}>
                Ảnh {selectedIndex + 1} / {items.length}
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '2px' }}>
                {activeItem.caption || activeItem.file_name || 'Ảnh minh chứng thực địa'}
              </div>
              {(activeItem.uploader_name || activeItem.uploaded_at) && (
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px', display: 'flex', gap: '12px' }}>
                  {activeItem.uploader_name && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <User size={12} /> {activeItem.uploader_name}
                    </span>
                  )}
                  {activeItem.uploaded_at && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} /> {new Date(activeItem.uploaded_at).toLocaleString('vi-VN')}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Zoom & Close Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleZoomIn}
                title="Phóng to"
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  color: '#FFFFFF',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <ZoomIn size={18} />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                title="Thu nhỏ"
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  color: '#FFFFFF',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <ZoomOut size={18} />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                title="Khôi phục kích thước ban đầu"
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  color: '#FFFFFF',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={16} />
              </button>
              {canDelete && onDelete && activeItem && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Bạn có chắc chắn muốn xóa ảnh minh chứng này khỏi đầu việc? (Chỉ có thể xóa trước khi nhấn Hoàn tất đầu việc).')) {
                      onDelete(activeItem);
                      handleCloseLightbox();
                    }
                  }}
                  title="Xóa ảnh minh chứng này"
                  style={{
                    background: 'rgba(239, 68, 68, 0.85)',
                    border: 'none',
                    color: '#FFFFFF',
                    borderRadius: '50%',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <Trash2 size={16} />
                </button>
              )}
              <button
                type="button"
                onClick={handleCloseLightbox}
                title="Đóng (Esc)"
                style={{
                  background: 'rgba(220, 38, 38, 0.8)',
                  border: 'none',
                  color: '#FFFFFF',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  marginLeft: '8px',
                }}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Central Image Canvas */}
          <div
            style={{
              position: 'relative',
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              cursor: zoomScale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onDoubleClick={handleDoubleTap}
          >
            {/* Previous Button */}
            {items.length > 1 && (
              <button
                type="button"
                onClick={handlePrev}
                style={{
                  position: 'absolute',
                  left: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  color: '#FFFFFF',
                  borderRadius: '50%',
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 20,
                  transition: 'background 0.2s',
                }}
              >
                <ChevronLeft size={28} />
              </button>
            )}

            {/* Displayed Image */}
            <img
              ref={imageRef}
              src={getMediaUrl(activeItem)}
              alt={activeItem.caption || activeItem.file_name || 'Minh chứng'}
              draggable={false}
              style={{
                maxWidth: '90vw',
                maxHeight: '75vh',
                objectFit: 'contain',
                borderRadius: '8px',
                transform: `scale(${zoomScale}) translate(${panPosition.x / zoomScale}px, ${panPosition.y / zoomScale}px)`,
                transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
              }}
              onClick={(e) => e.stopPropagation()}
            />

            {/* Next Button */}
            {items.length > 1 && (
              <button
                type="button"
                onClick={handleNext}
                style={{
                  position: 'absolute',
                  right: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  color: '#FFFFFF',
                  borderRadius: '50%',
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 20,
                  transition: 'background 0.2s',
                }}
              >
                <ChevronRight size={28} />
              </button>
            )}
          </div>

          {/* Bottom Thumbnails Strip for Quick Switching */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              gap: '8px',
              justifyContent: 'center',
              overflowX: 'auto',
              padding: '8px 0',
              zIndex: 10,
            }}
          >
            {items.map((it, idx) => (
              <button
                key={it.id || idx}
                type="button"
                onClick={() => handleOpenLightbox(idx)}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  border: selectedIndex === idx ? '2px solid #F59E0B' : '2px solid transparent',
                  opacity: selectedIndex === idx ? 1 : 0.6,
                  padding: 0,
                  background: '#000000',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
              >
                <img
                  src={getMediaUrl(it)}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Upload Evidence Modal */}
      {isUploadOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '460px',
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                backgroundColor: 'var(--brand-primary)',
                color: '#FFFFFF',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Đính Kèm Ảnh Minh Chứng Thực Địa</h3>
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                style={{ background: 'none', border: 'none', color: '#FFFFFF', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitUpload} style={{ padding: '20px' }}>
              {uploadError && (
                <div
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: '6px',
                    color: '#DC2626',
                    fontSize: '12px',
                    marginBottom: '12px',
                  }}
                >
                  {uploadError}
                </div>
              )}

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Chọn tệp ảnh (*) (PNG, JPG, JPEG)
                </label>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg"
                  required
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Chú thích / Mô tả ảnh
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Nghiệm thu đổ bê tông kim tĩnh, hoàn thành dán đá hoa cương..."
                  value={uploadCaption}
                  onChange={(e) => setUploadCaption(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: '#F1F5F9',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={uploadLoading || !uploadFile}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'var(--brand-primary)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: uploadLoading || !uploadFile ? 'not-allowed' : 'pointer',
                    opacity: uploadLoading || !uploadFile ? 0.6 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Upload size={14} />
                  <span>{uploadLoading ? 'Đang tải lên...' : 'Tải Lên Minh Chứng'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
