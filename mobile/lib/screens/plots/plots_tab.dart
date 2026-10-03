import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/widgets/unauthenticated_card.dart';
import '../../providers/auth_provider.dart';
import '../../providers/plots_provider.dart';
import '../dialogs/login_dialog.dart';
import 'plot_detail_sheet.dart';

class PlotsTab extends ConsumerStatefulWidget {
  const PlotsTab({super.key});

  @override
  ConsumerState<PlotsTab> createState() => _PlotsTabState();
}

class _PlotsTabState extends ConsumerState<PlotsTab> {
  String _plotSearchQuery = '';
  String _selectedZoneFilter = 'ALL';

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    if (!authState.isAuthenticated) {
      return UnauthenticatedCard(
        icon: Icons.map_outlined,
        title: 'Tra Cứu Ô Mộ & Thực Địa',
        message: 'Vui lòng đăng nhập với vai trò Quản Trang hoặc Kinh Doanh để tra cứu danh sách ô mộ, tọa độ GPS và trạng thái Kim Tĩnh.',
        onLoginPressed: () => showLoginDialog(context),
      );
    }

    final plotsAsync = ref.watch(plotsProvider);

    return Column(
      children: [
        // Search & Filter header
        Container(
          color: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Column(
            children: [
              TextField(
                decoration: InputDecoration(
                  hintText: 'Tìm theo mã ô mộ...',
                  prefixIcon: const Icon(Icons.search, size: 20),
                  isDense: true,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  contentPadding: const EdgeInsets.symmetric(vertical: 8),
                ),
                onChanged: (val) {
                  setState(() {
                    _plotSearchQuery = val;
                  });
                },
              ),
              const SizedBox(height: 8),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    ChoiceChip(
                      label: const Text('Tất cả'),
                      selected: _selectedZoneFilter == 'ALL',
                      onSelected: (_) => setState(() => _selectedZoneFilter = 'ALL'),
                    ),
                    const SizedBox(width: 6),
                    ChoiceChip(
                      label: const Text('Khu A'),
                      selected: _selectedZoneFilter == 'KHU-A',
                      onSelected: (_) => setState(() => _selectedZoneFilter = 'KHU-A'),
                    ),
                    const SizedBox(width: 6),
                    ChoiceChip(
                      label: const Text('Khu B'),
                      selected: _selectedZoneFilter == 'KHU-B',
                      onSelected: (_) => setState(() => _selectedZoneFilter = 'KHU-B'),
                    ),
                    const SizedBox(width: 6),
                    ChoiceChip(
                      label: const Text('Khu VIP'),
                      selected: _selectedZoneFilter == 'KHU-VIP',
                      onSelected: (_) => setState(() => _selectedZoneFilter = 'KHU-VIP'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: plotsAsync.when(
            data: (allPlots) {
              final filtered = allPlots.where((p) {
                if (_selectedZoneFilter != 'ALL' && p.zoneCode != _selectedZoneFilter) {
                  return false;
                }
                if (_plotSearchQuery.trim().isNotEmpty) {
                  final q = _plotSearchQuery.toLowerCase();
                  return p.plotCode.toLowerCase().contains(q) ||
                      p.zoneName.toLowerCase().contains(q);
                }
                return true;
              }).toList();

              if (filtered.isEmpty) {
                return Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.crop_free, size: 48, color: Colors.grey),
                      const SizedBox(height: 12),
                      const Text('Không tìm thấy ô mộ nào', style: TextStyle(color: Colors.black54)),
                      const SizedBox(height: 12),
                      ElevatedButton(
                        onPressed: () => ref.invalidate(plotsProvider),
                        child: const Text('Làm mới'),
                      ),
                    ],
                  ),
                );
              }

              return RefreshIndicator(
                onRefresh: () async {
                  ref.invalidate(plotsProvider);
                  await ref.read(plotsProvider.future);
                },
                child: ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: filtered.length,
                  itemBuilder: (context, index) {
                    final plot = filtered[index];
                    return Card(
                      elevation: 0,
                      margin: const EdgeInsets.only(bottom: 10),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: const BorderSide(color: Color(0xFFE5E7EB)),
                      ),
                      child: ListTile(
                        onTap: () => showPlotDetailSheet(context, plot),
                        leading: Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: plot.isKimTinh
                                ? const Color(0xFFFEF3C7)
                                : const Color(0xFF24594D).withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(8),
                            border: plot.isKimTinh
                                ? Border.all(color: const Color(0xFFFCD34D), width: 1.5)
                                : null,
                          ),
                          child: Icon(
                            plot.isKimTinh ? Icons.shield : Icons.place,
                            color: plot.isKimTinh
                                ? const Color(0xFFD97706)
                                : const Color(0xFF24594D),
                            size: 20,
                          ),
                        ),
                        title: Text(
                          plot.plotCode,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                        subtitle: Text(
                          '${plot.zoneName} · ${plot.typeName}',
                          style: const TextStyle(fontSize: 12, color: Colors.black54),
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: plot.status == 'EMPTY_UNSOLD'
                                    ? const Color(0xFFDCFCE7)
                                    : (plot.status == 'RESERVED'
                                        ? const Color(0xFFFEF3C7)
                                        : const Color(0xFFFEE2E2)),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                plot.status == 'EMPTY_UNSOLD'
                                    ? 'Trống'
                                    : (plot.status == 'RESERVED' ? 'Giữ chỗ' : 'Đã chôn'),
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: plot.status == 'EMPTY_UNSOLD'
                                      ? const Color(0xFF166534)
                                      : (plot.status == 'RESERVED'
                                          ? const Color(0xFF92400E)
                                          : const Color(0xFF991B1B)),
                                ),
                              ),
                            ),
                            const SizedBox(width: 4),
                            const Icon(Icons.chevron_right, size: 18, color: Colors.black26),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              );
            },
            loading: () => const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(color: Color(0xFF24594D)),
                  SizedBox(height: 12),
                  Text('Đang tải danh sách ô mộ thực địa...'),
                ],
              ),
            ),
            error: (err, _) => Center(
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error_outline, size: 40, color: Colors.red),
                    const SizedBox(height: 12),
                    Text(
                      'Lỗi tải sơ đồ ô mộ: $err',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.red, fontSize: 13),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: () => ref.invalidate(plotsProvider),
                      icon: const Icon(Icons.refresh, size: 16),
                      label: const Text('Thử lại'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
