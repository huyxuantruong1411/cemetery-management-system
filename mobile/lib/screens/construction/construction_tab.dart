import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/widgets/kpi_card.dart';
import '../../core/widgets/unauthenticated_card.dart';
import '../../providers/auth_provider.dart';
import '../../providers/construction_provider.dart';
import '../dialogs/login_dialog.dart';
import 'construction_order_card.dart';

class ConstructionTab extends ConsumerStatefulWidget {
  const ConstructionTab({super.key});

  @override
  ConsumerState<ConstructionTab> createState() => _ConstructionTabState();
}

class _ConstructionTabState extends ConsumerState<ConstructionTab> {
  String _constructionSearchQuery = '';
  String _constructionStatusFilter = 'ALL';

  Widget _buildFilterChip(String label, String statusKey) {
    final isSelected = _constructionStatusFilter == statusKey;
    return ChoiceChip(
      label: Text(
        label,
        style: TextStyle(fontSize: 12, color: isSelected ? Colors.white : Colors.black87),
      ),
      selected: isSelected,
      selectedColor: const Color(0xFF24594D),
      backgroundColor: Colors.white,
      onSelected: (val) {
        setState(() {
          _constructionStatusFilter = val ? statusKey : 'ALL';
        });
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    if (!authState.isAuthenticated) {
      return UnauthenticatedCard(
        icon: Icons.handyman_outlined,
        title: 'Yêu Cầu Đăng Nhập Quản Trang',
        message: 'Vui lòng đăng nhập với tài khoản Quản trang hoặc Admin để kiểm tra hiện trường, tiến độ thi công và minh chứng hình ảnh.',
        onLoginPressed: () => showLoginDialog(context),
      );
    }

    final ordersAsync = ref.watch(constructionOrdersProvider);

    return ordersAsync.when(
      loading: () => const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(color: Color(0xFF24594D)),
            SizedBox(height: 12),
            Text('Đang tải danh sách lệnh thi công...', style: TextStyle(color: Colors.black54)),
          ],
        ),
      ),
      error: (err, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.red),
              const SizedBox(height: 12),
              Text(
                'Lỗi tải lệnh thi công: ${err.toString()}',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.black87),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: () => ref.invalidate(constructionOrdersProvider),
                icon: const Icon(Icons.refresh),
                label: const Text('Thử lại'),
              ),
            ],
          ),
        ),
      ),
      data: (orders) {
        final filtered = orders.where((o) {
          if (_constructionStatusFilter != 'ALL' && o.status != _constructionStatusFilter) {
            return false;
          }
          if (_constructionSearchQuery.isNotEmpty) {
            final q = _constructionSearchQuery.toLowerCase();
            final matchesCode = o.orderCode.toLowerCase().contains(q);
            final matchesPlot = (o.plotCode ?? '').toLowerCase().contains(q);
            final matchesNotes = (o.notes ?? '').toLowerCase().contains(q);
            return matchesCode || matchesPlot || matchesNotes;
          }
          return true;
        }).toList();

        final totalCount = orders.length;
        final inProgressCount = orders.where((o) => o.status == 'IN_PROGRESS').length;
        final pendingCount = orders.where((o) => o.status == 'PENDING').length;
        final completedCount = orders.where((o) => o.status == 'COMPLETED').length;

        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(constructionOrdersProvider);
            await ref.read(constructionOrdersProvider.future);
          },
          child: ListView(
            padding: const EdgeInsets.all(16.0),
            children: [
              // Summary KPIs
              Row(
                children: [
                  Expanded(child: KpiCard(label: 'Tổng số lệnh', value: '$totalCount', icon: Icons.assignment, color: const Color(0xFF1E293B))),
                  const SizedBox(width: 6),
                  Expanded(child: KpiCard(label: 'Đang làm', value: '$inProgressCount', icon: Icons.handyman, color: const Color(0xFF0284C7))),
                  const SizedBox(width: 6),
                  Expanded(child: KpiCard(label: 'Chờ thi công', value: '$pendingCount', icon: Icons.schedule, color: const Color(0xFFD97706))),
                  const SizedBox(width: 6),
                  Expanded(child: KpiCard(label: 'Hoàn tất', value: '$completedCount', icon: Icons.check_circle, color: const Color(0xFF16A34A))),
                ],
              ),
              const SizedBox(height: 12),

              // Search field
              TextField(
                decoration: InputDecoration(
                  hintText: 'Tìm theo mã lệnh, mã ô mộ...',
                  prefixIcon: const Icon(Icons.search, size: 20),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  isDense: true,
                ),
                onChanged: (val) {
                  setState(() {
                    _constructionSearchQuery = val.trim();
                  });
                },
              ),
              const SizedBox(height: 10),

              // Filter chips
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _buildFilterChip('Tất cả', 'ALL'),
                    const SizedBox(width: 6),
                    _buildFilterChip('Chờ thi công', 'PENDING'),
                    const SizedBox(width: 6),
                    _buildFilterChip('Đang thi công', 'IN_PROGRESS'),
                    const SizedBox(width: 6),
                    _buildFilterChip('Đã hoàn tất', 'COMPLETED'),
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
                        const Icon(Icons.handyman_outlined, size: 48, color: Colors.black26),
                        const SizedBox(height: 12),
                        const Text(
                          'Không có lệnh thi công nào phù hợp',
                          style: TextStyle(color: Colors.black54, fontSize: 14),
                        ),
                        const SizedBox(height: 8),
                        TextButton.icon(
                          onPressed: () {
                            setState(() {
                              _constructionStatusFilter = 'ALL';
                              _constructionSearchQuery = '';
                            });
                          },
                          icon: const Icon(Icons.clear, size: 16),
                          label: const Text('Xóa bộ lọc'),
                        ),
                      ],
                    ),
                  ),
                )
              else
                ...filtered.map((order) => ConstructionOrderCard(order: order)),
            ],
          ),
        );
      },
    );
  }
}
