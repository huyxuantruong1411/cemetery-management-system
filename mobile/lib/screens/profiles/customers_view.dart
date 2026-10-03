import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/widgets/unauthenticated_card.dart';
import '../../providers/auth_provider.dart';
import '../../providers/profiles_provider.dart';
import '../dialogs/login_dialog.dart';

class CustomersView extends ConsumerStatefulWidget {
  const CustomersView({super.key});

  @override
  ConsumerState<CustomersView> createState() => _CustomersViewState();
}

class _CustomersViewState extends ConsumerState<CustomersView> {
  String _customerSearchQuery = '';

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    if (!authState.isAuthenticated) {
      return UnauthenticatedCard(
        icon: Icons.lock_outline,
        title: 'Yêu Cầu Xác Thực Nhân Viên',
        message: 'Dữ liệu thân nhân và thông tin liên hệ được bảo vệ theo chuẩn an toàn thông tin. Vui lòng đăng nhập để tiếp tục.',
        onLoginPressed: () => showLoginDialog(context),
      );
    }

    final customersAsync = ref.watch(customersProvider);

    return Column(
      children: [
        // Search bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          color: Colors.white,
          child: TextField(
            decoration: InputDecoration(
              hintText: 'Tìm theo tên, CCCD, SĐT thân nhân...',
              prefixIcon: const Icon(Icons.search, size: 20),
              isDense: true,
              filled: true,
              fillColor: const Color(0xFFF3F4F6),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide.none,
              ),
            ),
            onChanged: (val) {
              setState(() {
                _customerSearchQuery = val.trim().toLowerCase();
              });
            },
          ),
        ),

        Expanded(
          child: customersAsync.when(
            data: (customers) {
              final filtered = customers.where((c) {
                if (_customerSearchQuery.isEmpty) return true;
                return c.fullName.toLowerCase().contains(_customerSearchQuery) ||
                    c.citizenId.toLowerCase().contains(_customerSearchQuery) ||
                    c.phoneNumber.contains(_customerSearchQuery) ||
                    c.customerCode.toLowerCase().contains(_customerSearchQuery);
              }).toList();

              if (filtered.isEmpty) {
                return Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.group_off, size: 48, color: Colors.grey),
                      const SizedBox(height: 12),
                      const Text('Không tìm thấy thân nhân phù hợp', style: TextStyle(color: Colors.black54)),
                      const SizedBox(height: 12),
                      ElevatedButton(
                        onPressed: () => ref.invalidate(customersProvider),
                        child: const Text('Làm mới danh sách'),
                      ),
                    ],
                  ),
                );
              }

              return RefreshIndicator(
                onRefresh: () async {
                  ref.invalidate(customersProvider);
                  await ref.read(customersProvider.future);
                },
                child: ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: filtered.length,
                  itemBuilder: (context, index) {
                    final customer = filtered[index];
                    return Card(
                      elevation: 0,
                      margin: const EdgeInsets.only(bottom: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: const BorderSide(color: Color(0xFFE5E7EB)),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(14.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                CircleAvatar(
                                  radius: 18,
                                  backgroundColor: const Color(0xFF24594D).withValues(alpha: 0.1),
                                  child: const Icon(Icons.person, color: Color(0xFF24594D), size: 20),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        customer.fullName,
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                      ),
                                      Text(
                                        'Mã KH: ${customer.customerCode} · CCCD: ${customer.citizenId}',
                                        style: const TextStyle(fontSize: 11, color: Colors.black54),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'SĐT: ${customer.phoneNumber} ${customer.email != null ? "· Email: ${customer.email!}" : ""}',
                              style: const TextStyle(fontSize: 12, color: Colors.black87),
                            ),
                            Text(
                              'Địa chỉ: ${customer.address}',
                              style: const TextStyle(fontSize: 11, color: Colors.black54),
                            ),
                            if (customer.relations.isNotEmpty) ...[
                              const SizedBox(height: 10),
                              const Text(
                                'Quan hệ với người quá cố:',
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.black54),
                              ),
                              const SizedBox(height: 4),
                              Wrap(
                                spacing: 6,
                                runSpacing: 4,
                                children: customer.relations.map((rel) {
                                  return Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: rel.isPrimaryContact ? const Color(0xFFFEF3C7) : const Color(0xFFF1F5F9),
                                      borderRadius: BorderRadius.circular(6),
                                      border: Border.all(
                                        color: rel.isPrimaryContact ? const Color(0xFFFCD34D) : const Color(0xFFCBD5E1),
                                      ),
                                    ),
                                    child: Text(
                                      '${rel.deceasedFullName} (${rel.relationshipType})${rel.isPrimaryContact ? " ★ Đại diện" : ""}',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: rel.isPrimaryContact ? FontWeight.bold : FontWeight.normal,
                                        color: rel.isPrimaryContact ? const Color(0xFF92400E) : const Color(0xFF334155),
                                      ),
                                    ),
                                  );
                                }).toList(),
                              ),
                            ],
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
                  Text('Đang tải danh sách thân nhân...'),
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
                      'Lỗi tải thân nhân: $err',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.red, fontSize: 13),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: () => ref.invalidate(customersProvider),
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
