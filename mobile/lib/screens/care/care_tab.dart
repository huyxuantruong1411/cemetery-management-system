import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/widgets/kpi_card.dart';
import '../../core/widgets/unauthenticated_card.dart';
import '../../providers/auth_provider.dart';
import '../../providers/care_provider.dart';
import '../dialogs/login_dialog.dart';
import 'care_schedule_card.dart';

class CareTab extends ConsumerStatefulWidget {
  const CareTab({super.key});

  @override
  ConsumerState<CareTab> createState() => _CareTabState();
}

class _CareTabState extends ConsumerState<CareTab> {
  String _careSearchQuery = '';
  String _careStatusFilter = 'ALL';

  Widget _buildFilterChip(String label, String value) {
    final isSelected = _careStatusFilter == value;
    return ChoiceChip(
      label: Text(label, style: TextStyle(fontSize: 12, color: isSelected ? Colors.white : Colors.black87)),
      selected: isSelected,
      selectedColor: const Color(0xFF24594D),
      backgroundColor: Colors.white,
      side: BorderSide(color: isSelected ? const Color(0xFF24594D) : Colors.black12),
      onSelected: (selected) {
        if (selected) {
          setState(() {
            _careStatusFilter = value;
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
        icon: Icons.cleaning_services_outlined,
        title: 'Yêu Cầu Đăng Nhập Chăm Sóc',
        message: 'Vui lòng đăng nhập với tài khoản Quản trang hoặc Admin để xem ca chăm sóc định kỳ, checklist công việc và ghi nhận ảnh thực địa.',
        onLoginPressed: () => showLoginDialog(context),
      );
    }

    final careAsync = ref.watch(careSchedulesProvider);

    return careAsync.when(
      loading: () => const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(color: Color(0xFF24594D)),
            SizedBox(height: 12),
            Text('Đang tải danh sách lịch chăm sóc...', style: TextStyle(color: Colors.black54)),
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
                'Lỗi tải lịch chăm sóc: ${err.toString()}',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.black87),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: () => ref.invalidate(careSchedulesProvider),
                icon: const Icon(Icons.refresh),
                label: const Text('Thử lại'),
              ),
            ],
          ),
        ),
      ),
      data: (schedules) {
        final filtered = schedules.where((s) {
          if (_careStatusFilter != 'ALL' && s.status != _careStatusFilter) {
            return false;
          }
          if (_careSearchQuery.isNotEmpty) {
            final q = _careSearchQuery.toLowerCase();
            final matchesPlot = (s.plotCode ?? '').toLowerCase().contains(q);
            final matchesPkg = (s.packageName ?? '').toLowerCase().contains(q);
            final matchesCare = (s.caretakerName ?? '').toLowerCase().contains(q);
            final matchesPeriod = (s.periodKey ?? '').toLowerCase().contains(q);
            return matchesPlot || matchesPkg || matchesCare || matchesPeriod;
          }
          return true;
        }).toList();

        final totalCount = schedules.length;
        final scheduledCount = schedules.where((s) => s.status == 'SCHEDULED').length;
        final inProgressCount = schedules.where((s) => s.status == 'IN_PROGRESS').length;
        final closedCount = schedules.where((s) => s.status == 'CLOSED').length;

        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(careSchedulesProvider);
            await ref.read(careSchedulesProvider.future);
          },
          child: ListView(
            padding: const EdgeInsets.all(16.0),
            children: [
              // Summary KPIs
              Row(
                children: [
                  Expanded(child: KpiCard(label: 'Tổng ca', value: '$totalCount', icon: Icons.assignment, color: const Color(0xFF1E293B))),
                  const SizedBox(width: 6),
                  Expanded(child: KpiCard(label: 'Chờ giao', value: '$scheduledCount', icon: Icons.schedule, color: const Color(0xFFD97706))),
                  const SizedBox(width: 6),
                  Expanded(child: KpiCard(label: 'Đang làm', value: '$inProgressCount', icon: Icons.cleaning_services, color: const Color(0xFF0284C7))),
                  const SizedBox(width: 6),
                  Expanded(child: KpiCard(label: 'Đã đóng ca', value: '$closedCount', icon: Icons.check_circle, color: const Color(0xFF16A34A))),
                ],
              ),
              const SizedBox(height: 12),

              // Search field
              TextField(
                decoration: InputDecoration(
                  hintText: 'Tìm theo mã ô mộ, kỳ, nhân viên...',
                  prefixIcon: const Icon(Icons.search, size: 20),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  isDense: true,
                ),
                onChanged: (val) {
                  setState(() {
                    _careSearchQuery = val.trim();
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
                    _buildFilterChip('Chờ giao', 'SCHEDULED'),
                    const SizedBox(width: 6),
                    _buildFilterChip('Đã giao việc', 'ASSIGNED'),
                    const SizedBox(width: 6),
                    _buildFilterChip('Đang làm', 'IN_PROGRESS'),
                    const SizedBox(width: 6),
                    _buildFilterChip('Đã đóng ca', 'CLOSED'),
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
                        const Icon(Icons.cleaning_services_outlined, size: 48, color: Colors.black26),
                        const SizedBox(height: 12),
                        const Text(
                          'Không tìm thấy ca chăm sóc nào',
                          style: TextStyle(fontWeight: FontWeight.bold, color: Colors.black54),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _careSearchQuery.isNotEmpty || _careStatusFilter != 'ALL'
                              ? 'Thử thay đổi từ khóa hoặc bộ lọc trạng thái.'
                              : 'Chưa có dữ liệu chăm sóc định kỳ được ghi nhận.',
                          style: const TextStyle(fontSize: 12, color: Colors.black45),
                        ),
                      ],
                    ),
                  ),
                )
              else
                ...filtered.map((item) => CareScheduleCard(item: item)),
            ],
          ),
        );
      },
    );
  }
}
