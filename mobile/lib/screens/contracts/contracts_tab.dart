import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/widgets/custom_filter_chip.dart';
import '../../core/widgets/unauthenticated_card.dart';
import '../../providers/auth_provider.dart';
import '../../providers/contracts_provider.dart';
import '../dialogs/login_dialog.dart';
import 'contract_card.dart';

class ContractsTab extends ConsumerStatefulWidget {
  const ContractsTab({super.key});

  @override
  ConsumerState<ContractsTab> createState() => _ContractsTabState();
}

class _ContractsTabState extends ConsumerState<ContractsTab> {
  String _contractSearchQuery = '';
  String _contractStatusFilter = 'ALL';

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    if (!authState.isAuthenticated) {
      return UnauthenticatedCard(
        icon: Icons.lock_outline,
        title: 'Yêu Cầu Xác Thực',
        message: 'Vui lòng đăng nhập với tài khoản Kinh Doanh hoặc Quản Trị để tra cứu hợp đồng mua đất.',
        onLoginPressed: () => showLoginDialog(context),
      );
    }

    final contractsAsync = ref.watch(contractsProvider);

    return Column(
      children: [
        // Filter toolbar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          color: Colors.white,
          child: Column(
            children: [
              TextField(
                decoration: InputDecoration(
                  hintText: 'Tìm theo mã HĐ, tên KH, SĐT...',
                  prefixIcon: const Icon(Icons.search, size: 20),
                  isDense: true,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: Colors.black12),
                  ),
                ),
                onChanged: (val) {
                  setState(() {
                    _contractSearchQuery = val;
                  });
                },
              ),
              const SizedBox(height: 8),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    CustomFilterChip(
                      label: 'Tất cả',
                      isSelected: _contractStatusFilter == 'ALL',
                      onSelected: () => setState(() => _contractStatusFilter = 'ALL'),
                    ),
                    const SizedBox(width: 6),
                    CustomFilterChip(
                      label: 'Dự thảo',
                      isSelected: _contractStatusFilter == 'DRAFT',
                      onSelected: () => setState(() => _contractStatusFilter = 'DRAFT'),
                    ),
                    const SizedBox(width: 6),
                    CustomFilterChip(
                      label: 'Chờ ký',
                      isSelected: _contractStatusFilter == 'PENDING_SIGN',
                      onSelected: () => setState(() => _contractStatusFilter = 'PENDING_SIGN'),
                    ),
                    const SizedBox(width: 6),
                    CustomFilterChip(
                      label: 'Hiệu lực',
                      isSelected: _contractStatusFilter == 'ACTIVE',
                      onSelected: () => setState(() => _contractStatusFilter = 'ACTIVE'),
                    ),
                    const SizedBox(width: 6),
                    CustomFilterChip(
                      label: 'Đã hủy',
                      isSelected: _contractStatusFilter == 'CANCELLED',
                      onSelected: () => setState(() => _contractStatusFilter = 'CANCELLED'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const Divider(height: 1, color: Colors.black12),
        // List
        Expanded(
          child: contractsAsync.when(
            data: (contracts) {
              final filtered = contracts.where((c) {
                if (_contractStatusFilter != 'ALL' && c.status != _contractStatusFilter) {
                  return false;
                }
                if (_contractSearchQuery.trim().isNotEmpty) {
                  final q = _contractSearchQuery.trim().toLowerCase();
                  return c.contractCode.toLowerCase().contains(q) ||
                      c.customerName.toLowerCase().contains(q) ||
                      c.customerPhone.toLowerCase().contains(q) ||
                      (c.plotCode != null && c.plotCode!.toLowerCase().contains(q));
                }
                return true;
              }).toList();

              if (filtered.isEmpty) {
                return Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.description_outlined, size: 48, color: Colors.black26),
                      const SizedBox(height: 12),
                      const Text(
                        'Chưa có hợp đồng nào phù hợp',
                        style: TextStyle(fontWeight: FontWeight.w600, color: Colors.black54),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Kiểm tra lại từ khóa tìm kiếm hoặc bộ lọc trạng thái.',
                        style: TextStyle(fontSize: 12, color: Colors.black38),
                      ),
                    ],
                  ),
                );
              }

              return RefreshIndicator(
                onRefresh: () async => ref.invalidate(contractsProvider),
                child: ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: filtered.length,
                  itemBuilder: (ctx, idx) {
                    final item = filtered[idx];
                    return ContractCard(item: item);
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
                  Text('Đang tải danh sách hợp đồng...'),
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
                      'Lỗi tải hợp đồng: $err',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.red, fontSize: 13),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: () => ref.invalidate(contractsProvider),
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
