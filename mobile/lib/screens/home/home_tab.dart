import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/system_model.dart';
import '../../providers/auth_provider.dart';
import '../../providers/system_provider.dart';

class HomeTab extends ConsumerWidget {
  const HomeTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final readinessAsync = ref.watch(readinessProvider);
    final versionAsync = ref.watch(versionProvider);
    final authState = ref.watch(authProvider);

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(readinessProvider);
        ref.invalidate(versionProvider);
        await ref.read(readinessProvider.future);
      },
      child: ListView(
        padding: const EdgeInsets.all(16.0),
        children: [
          // User status card if logged in
          if (authState.isAuthenticated) ...[
            Card(
              color: const Color(0xFFF0FDF4),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: Color(0xFFBBF7D0)),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.verified_user, color: Color(0xFF16A34A)),
                        const SizedBox(width: 8),
                        Text(
                          authState.user!.fullName,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                        const Spacer(),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFF24594D),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            authState.user!.roles.join(', '),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Quyền hiệu lực: ${authState.user!.permissions.length} quyền | Email: ${authState.user!.email}',
                      style: const TextStyle(fontSize: 12, color: Colors.black87),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
          ],

          // Banner overview
          _buildHeaderCard(versionAsync),
          const SizedBox(height: 16),

          // Infrastructure readiness section
          const Text(
            'Trạng Thái Hạ Tầng & Kết Nối',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1F2933),
            ),
          ),
          const SizedBox(height: 8),
          _buildReadinessSection(context, ref, readinessAsync),
        ],
      ),
    );
  }

  Widget _buildHeaderCard(AsyncValue<SystemVersion> versionAsync) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: Color(0xFFE5E7EB)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFF24594D).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(
                Icons.security,
                color: Color(0xFF24594D),
                size: 24,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Hệ Thống Quản Lý Nghĩa Trang',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1F2933),
                    ),
                  ),
                  versionAsync.when(
                    data: (version) => Text(
                      'Phiên bản: ${version.version} (${version.environment})',
                      style: const TextStyle(fontSize: 13, color: Colors.black54),
                    ),
                    loading: () => const Text(
                      'Đang kết nối API...',
                      style: TextStyle(fontSize: 13, color: Colors.black38),
                    ),
                    error: (err, _) => const Text(
                      'Mất kết nối máy chủ',
                      style: TextStyle(fontSize: 13, color: Colors.redAccent),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildReadinessSection(
    BuildContext context,
    WidgetRef ref,
    AsyncValue<SystemReadiness> readinessAsync,
  ) {
    return readinessAsync.when(
      data: (readiness) {
        return Column(
          children: [
            _buildStatusTile(
              icon: Icons.storage,
              title: 'SQL Server 2022 (DESKTOP-HKIPI1M)',
              subtitle: readiness.database,
              isOk: readiness.database.contains('connected'),
            ),
            const SizedBox(height: 8),
            _buildStatusTile(
              icon: Icons.cloud_done,
              title: 'MinIO S3 Storage',
              subtitle: readiness.storage,
              isOk: readiness.storage.contains('connected'),
            ),
          ],
        );
      },
      loading: () => const Card(
        child: Padding(
          padding: EdgeInsets.all(24.0),
          child: Center(
            child: Column(
              children: [
                CircularProgressIndicator(color: Color(0xFF24594D)),
                SizedBox(height: 12),
                Text('Đang kiểm tra kết nối CSDL và Storage...'),
              ],
            ),
          ),
        ),
      ),
      error: (error, _) => Card(
        color: const Color(0xFFFEF2F2),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: Color(0xFFFECACA)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(Icons.error_outline, color: Colors.red),
                  SizedBox(width: 8),
                  Text(
                    'Không thể kết nối máy chủ',
                    style: TextStyle(fontWeight: FontWeight.bold, color: Colors.red),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                error.toString(),
                style: const TextStyle(fontSize: 12, color: Colors.black87),
              ),
              const SizedBox(height: 12),
              ElevatedButton.icon(
                onPressed: () => ref.invalidate(readinessProvider),
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text('Thử lại'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatusTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required bool isOk,
  }) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: Color(0xFFE5E7EB)),
      ),
      child: ListTile(
        leading: Icon(
          icon,
          color: isOk ? const Color(0xFF24594D) : Colors.red,
        ),
        title: Text(
          title,
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
        ),
        subtitle: Text(
          subtitle,
          style: const TextStyle(fontSize: 12),
        ),
        trailing: Icon(
          isOk ? Icons.check_circle : Icons.cancel,
          color: isOk ? Colors.green : Colors.red,
        ),
      ),
    );
  }
}
