import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/config.dart';
import '../../core/widgets/kpi_card.dart';
import '../../core/widgets/unauthenticated_card.dart';
import '../../providers/auth_provider.dart';
import '../../providers/finance_provider.dart';
import '../dialogs/login_dialog.dart';
import 'receivable_card.dart';

class FinanceTab extends ConsumerStatefulWidget {
  const FinanceTab({super.key});

  @override
  ConsumerState<FinanceTab> createState() => _FinanceTabState();
}

class _FinanceTabState extends ConsumerState<FinanceTab> {
  String _financeSearchQuery = '';
  String _financeStatusFilter = 'ALL';

  Widget _buildFilterChip(String label, String value) {
    final isSelected = _financeStatusFilter == value;
    return ChoiceChip(
      label: Text(label, style: TextStyle(fontSize: 12, color: isSelected ? Colors.white : Colors.black87)),
      selected: isSelected,
      selectedColor: const Color(0xFF24594D),
      backgroundColor: Colors.white,
      side: BorderSide(color: isSelected ? const Color(0xFF24594D) : Colors.black12),
      onSelected: (selected) {
        if (selected) {
          setState(() {
            _financeStatusFilter = value;
          });
        }
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    if (!authState.isAuthenticated) {
      return UnauthenticatedCard(
        icon: Icons.account_balance_wallet_outlined,
        title: 'Yêu Cầu Xác Thực Kế Toán / Nhân Viên',
        message: 'Vui lòng đăng nhập với tài khoản có quyền tài chính (finance:read) để tra cứu công nợ và biên lai.',
        onLoginPressed: () => showLoginDialog(context),
      );
    }

    final receivablesAsync = ref.watch(receivablesProvider);
    final summaryAsync = ref.watch(financeSummaryProvider);

    return receivablesAsync.when(
      loading: () => const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(color: Color(0xFF24594D)),
            SizedBox(height: 12),
            Text('Đang tải dữ liệu công nợ & thu chi...', style: TextStyle(color: Colors.black54)),
          ],
        ),
      ),
      error: (err, stack) => Center(
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Color(0xFFDC2626)),
              const SizedBox(height: 12),
              Text(
                'Lỗi khi tải dữ liệu công nợ: $err',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Color(0xFFDC2626)),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: () {
                  ref.invalidate(receivablesProvider);
                  ref.invalidate(financeSummaryProvider);
                },
                icon: const Icon(Icons.refresh),
                label: const Text('Thử lại'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF24594D),
                  foregroundColor: Colors.white,
                ),
              ),
            ],
          ),
        ),
      ),
      data: (items) {
        final summary = summaryAsync.value;
        final totalPayable = summary?.totalPayableAmount ?? items.fold<double>(0, (sum, i) => sum + i.finalPayableAmount);
        final totalPaid = summary?.totalCollectedAmount ?? items.fold<double>(0, (sum, i) => sum + i.paidAmount);
        final totalRemaining = summary?.totalOutstandingAmount ?? items.fold<double>(0, (sum, i) => sum + i.remainingBalance);

        final filtered = items.where((r) {
          if (_financeStatusFilter != 'ALL' && r.status != _financeStatusFilter) {
            return false;
          }
          if (_financeSearchQuery.isNotEmpty) {
            final q = _financeSearchQuery.toLowerCase();
            final contractMatch = r.contractCode?.toLowerCase().contains(q) ?? false;
            final annexMatch = r.annexCode?.toLowerCase().contains(q) ?? false;
            final notesMatch = r.notes?.toLowerCase().contains(q) ?? false;
            final idMatch = r.receivableId.toString().contains(q);
            return contractMatch || annexMatch || notesMatch || idMatch;
          }
          return true;
        }).toList();

        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(receivablesProvider);
            ref.invalidate(financeSummaryProvider);
            await ref.read(receivablesProvider.future);
          },
          child: ListView(
            padding: const EdgeInsets.all(12),
            children: [
              // Header Card
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF24594D), Color(0xFF2E6F62)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Sổ Cái Công Nợ & Thu Tiền (M11)',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Ràng buộc XOR nguồn thu (G14), thanh toán lũy kế chống trùng (G15), chiết khấu chuẩn hóa (G16)',
                      style: TextStyle(color: Colors.white70, fontSize: 11),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // KPI Cards
              Row(
                children: [
                  Expanded(
                    child: KpiCard(
                      label: 'Tổng Phải Thu',
                      value: formatVnd(totalPayable),
                      icon: Icons.receipt_long,
                      color: const Color(0xFF24594D),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: KpiCard(
                      label: 'Đã Thu',
                      value: formatVnd(totalPaid),
                      icon: Icons.check_circle_outline,
                      color: const Color(0xFF16A34A),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: KpiCard(
                      label: 'Còn Nợ Tồn',
                      value: formatVnd(totalRemaining),
                      icon: Icons.warning_amber_rounded,
                      color: const Color(0xFFDC2626),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Search Input
              TextField(
                decoration: InputDecoration(
                  hintText: 'Tìm mã HĐ, phụ lục, ghi chú...',
                  prefixIcon: const Icon(Icons.search, size: 20),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  isDense: true,
                ),
                onChanged: (val) {
                  setState(() {
                    _financeSearchQuery = val.trim();
                  });
                },
              ),
              const SizedBox(height: 10),

              // Filter Chips
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _buildFilterChip('Tất cả', 'ALL'),
                    const SizedBox(width: 6),
                    _buildFilterChip('Chưa trả', 'UNPAID'),
                    const SizedBox(width: 6),
                    _buildFilterChip('Thu 1 phần', 'PARTIALLY_PAID'),
                    const SizedBox(width: 6),
                    _buildFilterChip('Đã thu xong', 'PAID'),
                    const SizedBox(width: 6),
                    _buildFilterChip('Quá hạn', 'OVERDUE'),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              if (filtered.isEmpty)
                Center(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 40.0),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.payments_outlined, size: 48, color: Colors.black26),
                        const SizedBox(height: 12),
                        const Text(
                          'Không tìm thấy khoản công nợ nào',
                          style: TextStyle(fontWeight: FontWeight.bold, color: Colors.black54),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _financeSearchQuery.isNotEmpty || _financeStatusFilter != 'ALL'
                              ? 'Thử thay đổi từ khóa hoặc bộ lọc trạng thái.'
                              : 'Chưa có dữ liệu công nợ được ghi nhận.',
                          style: const TextStyle(fontSize: 12, color: Colors.black45),
                        ),
                      ],
                    ),
                  ),
                )
              else
                ...filtered.map((item) => ReceivableCard(item: item)),
            ],
          ),
        );
      },
    );
  }
}
