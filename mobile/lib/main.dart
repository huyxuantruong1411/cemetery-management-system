import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

// API Base URL configuration: can be overridden via --dart-define=API_BASE_URL=...
const String defaultApiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:8000/api/v1',
);

// Models
class SystemReadiness {
  final String status;
  final String database;
  final String storage;
  final String timestamp;

  SystemReadiness({
    required this.status,
    required this.database,
    required this.storage,
    required this.timestamp,
  });

  factory SystemReadiness.fromJson(Map<String, dynamic> json) {
    return SystemReadiness(
      status: json['status'] as String? ?? 'unknown',
      database: json['database'] as String? ?? 'unknown',
      storage: json['storage'] as String? ?? 'unknown',
      timestamp: json['timestamp'] as String? ?? '',
    );
  }
}

class SystemVersion {
  final String appName;
  final String version;
  final String environment;

  SystemVersion({
    required this.appName,
    required this.version,
    required this.environment,
  });

  factory SystemVersion.fromJson(Map<String, dynamic> json) {
    return SystemVersion(
      appName: json['app_name'] as String? ?? '',
      version: json['version'] as String? ?? '',
      environment: json['environment'] as String? ?? '',
    );
  }
}

// Providers
final dioProvider = Provider<Dio>((ref) {
  return Dio(
    BaseOptions(
      baseUrl: defaultApiBaseUrl,
      connectTimeout: const Duration(seconds: 5),
      receiveTimeout: const Duration(seconds: 5),
      headers: {
        'Accept': 'application/json',
      },
    ),
  );
});

final readinessProvider = FutureProvider.autoDispose<SystemReadiness>((ref) async {
  final dio = ref.watch(dioProvider);
  final response = await dio.get('/health/ready');
  return SystemReadiness.fromJson(response.data as Map<String, dynamic>);
});

final versionProvider = FutureProvider.autoDispose<SystemVersion>((ref) async {
  final dio = ref.watch(dioProvider);
  final response = await dio.get('/version');
  return SystemVersion.fromJson(response.data as Map<String, dynamic>);
});

void main() {
  runApp(const ProviderScope(child: CemeteryMobileApp()));
}

class CemeteryMobileApp extends StatelessWidget {
  const CemeteryMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    const brandPrimary = Color(0xFF24594D);
    const bgPrimary = Color(0xFFF7F8F5);

    return MaterialApp(
      title: 'Quản Lý Nghĩa Trang',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: bgPrimary,
        colorScheme: ColorScheme.fromSeed(
          seedColor: brandPrimary,
          primary: brandPrimary,
          surface: Colors.white,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: brandPrimary,
          foregroundColor: Colors.white,
          elevation: 1,
        ),
      ),
      home: const DashboardShellScreen(),
    );
  }
}

class DashboardShellScreen extends ConsumerWidget {
  const DashboardShellScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final readinessAsync = ref.watch(readinessProvider);
    final versionAsync = ref.watch(versionProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'QL Nghĩa Trang Tư Nhân',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            Text(
              'Ứng dụng Quản trang & Hiện trường',
              style: TextStyle(fontSize: 12, color: Colors.white70),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Làm mới',
            onPressed: () {
              ref.invalidate(readinessProvider);
              ref.invalidate(versionProvider);
            },
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header Card
              Card(
                elevation: 0,
                color: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: const BorderSide(color: Color(0xFFE2E8F0)),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: const Color(0xFFE8F1EE),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Icon(
                              Icons.verified_user_outlined,
                              color: Color(0xFF24594D),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Kiểm tra kết nối hệ thống',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF1F2933),
                                  ),
                                ),
                                versionAsync.when(
                                  data: (v) => Text(
                                    'Phiên bản: v${v.version} • ${v.environment}',
                                    style: const TextStyle(fontSize: 12, color: Color(0xFF52606D)),
                                  ),
                                  loading: () => const Text(
                                    'Đang nạp phiên bản...',
                                    style: TextStyle(fontSize: 12, color: Color(0xFF52606D)),
                                  ),
                                  error: (err, stack) => const Text(
                                    'API: Chưa kết nối',
                                    style: TextStyle(fontSize: 12, color: Colors.red),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'API Base: $defaultApiBaseUrl',
                        style: const TextStyle(fontSize: 11, color: Color(0xFF52606D)),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // 4 State Rendering
              Expanded(
                child: readinessAsync.when(
                  // State 1: Loading
                  loading: () => const Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        CircularProgressIndicator(
                          color: Color(0xFF24594D),
                        ),
                        SizedBox(height: 16),
                        Text(
                          'Đang kết nối tới Backend FastAPI...',
                          style: TextStyle(color: Color(0xFF52606D), fontSize: 14),
                        ),
                      ],
                    ),
                  ),

                  // State 2: Error (with Retry CTA)
                  error: (error, _) => Center(
                    child: Card(
                      color: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: const BorderSide(color: Color(0xFFFCA5A5)),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(24.0),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.error_outline,
                              color: Color(0xFFDC2626),
                              size: 48,
                            ),
                            const SizedBox(height: 12),
                            const Text(
                              'Không thể kết nối đến máy chủ',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF1F2933),
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              error.toString(),
                              textAlign: TextAlign.center,
                              style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626)),
                            ),
                            const SizedBox(height: 16),
                            SizedBox(
                              height: 48,
                              child: ElevatedButton.icon(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF24594D),
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                ),
                                icon: const Icon(Icons.refresh),
                                label: const Text('Thử lại'),
                                onPressed: () {
                                  ref.invalidate(readinessProvider);
                                  ref.invalidate(versionProvider);
                                },
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),

                  // State 3: Normal Data
                  data: (data) => ListView(
                    children: [
                      _buildStatusCard(
                        title: 'SQL Server 2022 (DESKTOP-HKIPI1M)',
                        subtitle: 'CSDL QL_NghiaTrang với 37 bảng nghiệp vụ',
                        statusText: data.database,
                        icon: Icons.storage,
                        isOk: data.database.contains('connected') || data.database.contains('Database connected'),
                      ),
                      const SizedBox(height: 12),
                      _buildStatusCard(
                        title: 'MinIO S3 Storage',
                        subtitle: 'Lưu trữ tệp gắn kết trên ổ đĩa D',
                        statusText: data.storage,
                        icon: Icons.cloud_done_outlined,
                        isOk: data.storage.contains('connected') || data.storage.contains('Storage connected'),
                      ),
                      const SizedBox(height: 12),
                      _buildStatusCard(
                        title: 'FastAPI Backend Core',
                        subtitle: 'Hệ thống endpoint chia sẻ Web & Mobile',
                        statusText: 'Trạng thái: ${data.status.toUpperCase()}',
                        icon: Icons.hub_outlined,
                        isOk: data.status == 'ready',
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatusCard({
    required String title,
    required String subtitle,
    required String statusText,
    required IconData icon,
    required bool isOk,
  }) {
    return Card(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: isOk ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                icon,
                color: isOk ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF1F2933),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: const TextStyle(fontSize: 12, color: Color(0xFF52606D)),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    statusText,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      color: isOk ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
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
}
