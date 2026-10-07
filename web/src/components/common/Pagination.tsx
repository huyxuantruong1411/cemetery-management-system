import React, { useMemo, useState, useEffect } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'

export interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  pageSizeOptions?: number[]
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  startIndex?: number
  endIndex?: number
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  pageSizeOptions = [10, 20, 50, 100],
  onPageChange,
  onPageSizeChange,
  startIndex: propStart,
  endIndex: propEnd,
}) => {
  const start = propStart !== undefined ? propStart : totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const end = propEnd !== undefined ? propEnd : Math.min(currentPage * pageSize, totalItems)

  // Generate page numbers with ellipsis
  const pageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis')[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 3) {
        pages.push('ellipsis')
      }
      const startPage = Math.max(2, currentPage - 1)
      const endPage = Math.min(totalPages - 1, currentPage + 1)
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i)
      }
      if (currentPage < totalPages - 2) {
        pages.push('ellipsis')
      }
      pages.push(totalPages)
    }
    return pages
  }, [currentPage, totalPages])

  if (totalItems === 0) return null

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '12px 16px',
        backgroundColor: '#FFFFFF',
        borderTop: '1px solid #E2E8F0',
        borderRadius: '0 0 10px 10px',
        fontSize: '13px',
        color: '#475569',
      }}
    >
      {/* Left: Records summary & Page size selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          Hiển thị <strong style={{ color: '#0F172A' }}>{start}</strong> -{' '}
          <strong style={{ color: '#0F172A' }}>{end}</strong> trong{' '}
          <strong style={{ color: '#24594D' }}>{totalItems}</strong> bản ghi
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>Số dòng / trang:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              const newSize = Number(e.target.value)
              onPageSizeChange(newSize)
            }}
            style={{
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#0F172A',
              fontSize: '13px',
              cursor: 'pointer',
              outline: 'none',
              fontWeight: 500,
            }}
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right: Page navigation buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {/* First Page */}
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1}
          title="Trang đầu"
          style={{
            padding: '6px',
            borderRadius: '6px',
            border: '1px solid #E2E8F0',
            backgroundColor: currentPage <= 1 ? '#F8FAFC' : '#FFFFFF',
            color: currentPage <= 1 ? '#CBD5E1' : '#334155',
            cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
        >
          <ChevronsLeft size={16} />
        </button>

        {/* Prev Page */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          title="Trang trước"
          style={{
            padding: '6px 10px',
            borderRadius: '6px',
            border: '1px solid #E2E8F0',
            backgroundColor: currentPage <= 1 ? '#F8FAFC' : '#FFFFFF',
            color: currentPage <= 1 ? '#CBD5E1' : '#334155',
            cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            fontWeight: 500,
            transition: 'all 0.15s ease',
          }}
        >
          <ChevronLeft size={15} />
          <span>Trước</span>
        </button>

        {/* Number buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', margin: '0 2px' }}>
          {pageNumbers.map((p, idx) => {
            if (p === 'ellipsis') {
              return (
                <span key={`ell-${idx}`} style={{ padding: '0 6px', color: '#94A3B8' }}>
                  …
                </span>
              )
            }

            const isActive = p === currentPage
            return (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                style={{
                  minWidth: '32px',
                  height: '32px',
                  padding: '0 6px',
                  borderRadius: '6px',
                  border: isActive ? '1px solid #24594D' : '1px solid #E2E8F0',
                  backgroundColor: isActive ? '#24594D' : '#FFFFFF',
                  color: isActive ? '#FFFFFF' : '#334155',
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                {p}
              </button>
            )
          })}
        </div>

        {/* Next Page */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          title="Trang sau"
          style={{
            padding: '6px 10px',
            borderRadius: '6px',
            border: '1px solid #E2E8F0',
            backgroundColor: currentPage >= totalPages ? '#F8FAFC' : '#FFFFFF',
            color: currentPage >= totalPages ? '#CBD5E1' : '#334155',
            cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            fontWeight: 500,
            transition: 'all 0.15s ease',
          }}
        >
          <span>Sau</span>
          <ChevronRight size={15} />
        </button>

        {/* Last Page */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          title="Trang cuối"
          style={{
            padding: '6px',
            borderRadius: '6px',
            border: '1px solid #E2E8F0',
            backgroundColor: currentPage >= totalPages ? '#F8FAFC' : '#FFFFFF',
            color: currentPage >= totalPages ? '#CBD5E1' : '#334155',
            cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
        >
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  )
}

export interface UsePaginationOptions {
  initialPageSize?: number
  initialPage?: number
}

/**
 * Reusable client-side pagination hook
 */
export function usePagination<T>(
  items: T[],
  optionsOrSize: number | UsePaginationOptions = 10
) {
  const initialPageSize =
    typeof optionsOrSize === 'number'
      ? optionsOrSize
      : optionsOrSize?.initialPageSize ?? 10
  const initialPage =
    typeof optionsOrSize === 'number'
      ? 1
      : optionsOrSize?.initialPage ?? 1

  const [currentPage, setCurrentPage] = useState<number>(initialPage)
  const [pageSize, setPageSize] = useState<number>(initialPageSize)

  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  // Auto-reset page when items change or filter narrows
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1)
    }
  }, [totalItems, totalPages, currentPage])

  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endIndex = Math.min(currentPage * pageSize, totalItems)

  const paginatedItems = useMemo(() => {
    const from = (currentPage - 1) * pageSize
    const to = from + pageSize
    return items.slice(from, to)
  }, [items, currentPage, pageSize])

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize)
    setCurrentPage(1)
  }

  return {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedItems,
    pagedItems: paginatedItems,
    setCurrentPage,
    handlePageChange: setCurrentPage,
    setPageSize: handlePageSizeChange,
    handlePageSizeChange,
    startIndex,
    endIndex,
  }
}
