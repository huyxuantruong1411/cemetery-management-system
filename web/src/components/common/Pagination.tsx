import React, { useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'

export interface PaginationProps {
  currentPage: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  pageSizeOptions?: number[]
  totalPages?: number
  startIndex?: number
  endIndex?: number
}

export function usePagination<T>(
  items: T[],
  optionsOrSize: number | { initialPageSize?: number } = 10
) {
  const initSize =
    typeof optionsOrSize === 'number'
      ? optionsOrSize
      : (optionsOrSize?.initialPageSize ?? 10)

  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(initSize)

  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  const validPage = Math.min(Math.max(1, currentPage), totalPages)
  const startIndex = totalItems === 0 ? 0 : (validPage - 1) * pageSize
  const endIndex = Math.min(totalItems, validPage * pageSize)
  const paginatedItems = items.slice(startIndex, endIndex)

  return {
    currentPage: validPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedItems,
    pagedItems: paginatedItems,
    setCurrentPage,
    setPageSize,
    handlePageChange: setCurrentPage,
    handlePageSizeChange: setPageSize,
    startIndex: totalItems === 0 ? 0 : startIndex + 1,
    endIndex,
  }
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  totalPages: propTotalPages,
  startIndex: propStartIndex,
  endIndex: propEndIndex,
}) => {
  const totalPages = propTotalPages ?? Math.max(1, Math.ceil(totalItems / pageSize))
  const [jumpInput, setJumpInput] = useState<string>('')

  const startItem = propStartIndex ?? (totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1)
  const endItem = propEndIndex ?? Math.min(totalItems, currentPage * pageSize)

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      if (currentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages)
      } else if (currentPage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages)
      }
    }
    return pages
  }

  const handleJump = (e: React.FormEvent) => {
    e.preventDefault()
    const target = parseInt(jumpInput, 10)
    if (!isNaN(target) && target >= 1 && target <= totalPages) {
      onPageChange(target)
      setJumpInput('')
    }
  }

  if (totalItems <= 0) {
    return null
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '14px 18px',
        backgroundColor: '#FAFCFA',
        borderTop: '1px solid #E2E8F0',
        borderRadius: '0 0 10px 10px',
        fontSize: '13px',
        color: '#475569',
      }}
    >
      {/* Information & Page Size Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <span>
          Hiển thị <strong>{startItem}</strong> - <strong>{endItem}</strong> trong tổng số{' '}
          <strong>{totalItems.toLocaleString('vi-VN')}</strong> bản ghi
        </span>

        {onPageSizeChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#64748B', fontSize: '12px' }}>Cỡ trang:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value))
                onPageChange(1)
              }}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                fontSize: '12px',
                color: '#1E293B',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} / trang
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Page Navigation Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {/* First Page */}
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(1)}
          title="Trang đầu"
          style={{
            padding: '5px 7px',
            borderRadius: '6px',
            border: '1px solid #E2E8F0',
            backgroundColor: currentPage <= 1 ? '#F1F5F9' : '#FFFFFF',
            color: currentPage <= 1 ? '#94A3B8' : '#334155',
            cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChevronsLeft size={15} />
        </button>

        {/* Previous Page */}
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          title="Trang trước"
          style={{
            padding: '5px 7px',
            borderRadius: '6px',
            border: '1px solid #E2E8F0',
            backgroundColor: currentPage <= 1 ? '#F1F5F9' : '#FFFFFF',
            color: currentPage <= 1 ? '#94A3B8' : '#334155',
            cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChevronLeft size={15} />
        </button>

        {/* Page numbers */}
        {getPageNumbers().map((p, idx) => {
          if (p === '...') {
            return (
              <span key={`dots-${idx}`} style={{ padding: '0 4px', color: '#94A3B8' }}>
                …
              </span>
            )
          }

          const pageNum = Number(p)
          const isActive = pageNum === currentPage

          return (
            <button
              key={`page-${pageNum}`}
              type="button"
              onClick={() => onPageChange(pageNum)}
              style={{
                minWidth: '30px',
                height: '30px',
                padding: '0 6px',
                borderRadius: '6px',
                border: isActive ? '1px solid var(--brand-primary)' : '1px solid #E2E8F0',
                backgroundColor: isActive ? 'var(--brand-primary)' : '#FFFFFF',
                color: isActive ? '#FFFFFF' : '#334155',
                fontWeight: isActive ? 600 : 500,
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {pageNum}
            </button>
          )
        })}

        {/* Next Page */}
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          title="Trang sau"
          style={{
            padding: '5px 7px',
            borderRadius: '6px',
            border: '1px solid #E2E8F0',
            backgroundColor: currentPage >= totalPages ? '#F1F5F9' : '#FFFFFF',
            color: currentPage >= totalPages ? '#94A3B8' : '#334155',
            cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChevronRight size={15} />
        </button>

        {/* Last Page */}
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(totalPages)}
          title="Trang cuối"
          style={{
            padding: '5px 7px',
            borderRadius: '6px',
            border: '1px solid #E2E8F0',
            backgroundColor: currentPage >= totalPages ? '#F1F5F9' : '#FFFFFF',
            color: currentPage >= totalPages ? '#94A3B8' : '#334155',
            cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChevronsRight size={15} />
        </button>

        {/* Direct Page Jump */}
        {totalPages > 3 && (
          <form
            onSubmit={handleJump}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}
          >
            <span style={{ fontSize: '11px', color: '#64748B' }}>Đến:</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              placeholder={`${currentPage}`}
              style={{
                width: '42px',
                padding: '4px',
                textAlign: 'center',
                borderRadius: '5px',
                border: '1px solid #CBD5E1',
                fontSize: '12px',
              }}
            />
            <button
              type="submit"
              style={{
                padding: '4px 8px',
                borderRadius: '5px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                fontSize: '11px',
                fontWeight: 600,
                color: '#334155',
              }}
            >
              Đi
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
