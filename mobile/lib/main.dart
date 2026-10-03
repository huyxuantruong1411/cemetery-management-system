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

class UserModel {
  final int userId;
  final String username;
  final String fullName;
  final String email;
  final List<String> roles;
  final List<String> permissions;

  UserModel({
    required this.userId,
    required this.username,
    required this.fullName,
    required this.email,
    required this.roles,
    required this.permissions,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    final rolesList = (json['roles'] as List<dynamic>?)
            ?.map((r) => (r as Map<String, dynamic>)['role_name'] as String)
            .toList() ??
        [];
    final permsList = (json['permissions'] as List<dynamic>?)
            ?.map((p) => p.toString())
            .toList() ??
        [];
    return UserModel(
      userId: json['user_id'] as int? ?? 0,
      username: json['username'] as String? ?? '',
      fullName: json['full_name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      roles: rolesList,
      permissions: permsList,
    );
  }
}

class AuthState {
  final UserModel? user;
  final String? accessToken;
  final String? refreshToken;
  final bool isLoading;
  final String? errorMessage;

  const AuthState({
    this.user,
    this.accessToken,
    this.refreshToken,
    this.isLoading = false,
    this.errorMessage,
  });

  bool get isAuthenticated => user != null && accessToken != null;

  AuthState copyWith({
    UserModel? user,
    String? accessToken,
    String? refreshToken,
    bool? isLoading,
    String? errorMessage,
    bool clearUser = false,
  }) {
    return AuthState(
      user: clearUser ? null : (user ?? this.user),
      accessToken: clearUser ? null : (accessToken ?? this.accessToken),
      refreshToken: clearUser ? null : (refreshToken ?? this.refreshToken),
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
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

class AuthNotifier extends Notifier<AuthState> {
  @override
  AuthState build() => const AuthState();

  Future<bool> login(String username, String password) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final dio = ref.read(dioProvider);
      final loginRes = await dio.post(
        '/auth/login',
        data: {'username': username, 'password': password},
      );
      final loginData = loginRes.data as Map<String, dynamic>;
      final accessToken = loginData['access_token'] as String;
      final refreshToken = loginData['refresh_token'] as String;

      final meRes = await dio.get(
        '/auth/me',
        options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
      );
      final user = UserModel.fromJson(meRes.data as Map<String, dynamic>);

      state = state.copyWith(
        user: user,
        accessToken: accessToken,
        refreshToken: refreshToken,
        isLoading: false,
      );
      return true;
    } on DioException catch (e) {
      final msg = e.response?.data is Map
          ? (e.response?.data['detail'] as String? ?? 'Đăng nhập thất bại')
          : 'Lỗi kết nối máy chủ';
      state = state.copyWith(isLoading: false, errorMessage: msg);
      return false;
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.toString());
      return false;
    }
  }

  Future<void> logout() async {
    final token = state.refreshToken;
    if (token != null) {
      try {
        await ref.read(dioProvider).post('/auth/logout', data: {'refresh_token': token});
      } catch (_) {}
    }
    state = const AuthState();
  }
}

final authProvider = NotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);

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
          elevation: 2,
        ),
      ),
      home: const DashboardScreen(),
    );
  }
}

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  void _showLoginDialog(BuildContext context, WidgetRef ref) {
    final usernameController = TextEditingController();
    final passwordController = TextEditingController();

    showDialog<void>(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setState) {
            final authState = ref.watch(authProvider);

            return AlertDialog(
              title: const Row(
                children: [
                  Icon(Icons.shield, color: Color(0xFF24594D)),
                  SizedBox(width: 8),
                  Text('Đăng Nhập', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                ],
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text(
                      'Chọn nhanh vai trò kiểm thử:',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        ActionChip(
                          avatar: const Icon(Icons.person, size: 14),
                          label: const Text('Quản Trang', style: TextStyle(fontSize: 11)),
                          onPressed: () {
                            usernameController.text = 'caretaker';
                            passwordController.text = 'Caretaker2026!';
                          },
                        ),
                        ActionChip(
                          avatar: const Icon(Icons.admin_panel_settings, size: 14),
                          label: const Text('Admin', style: TextStyle(fontSize: 11)),
                          onPressed: () {
                            usernameController.text = 'admin';
                            passwordController.text = 'Admin2026!';
                          },
                        ),
                        ActionChip(
                          avatar: const Icon(Icons.campaign, size: 14),
                          label: const Text('Kinh Doanh', style: TextStyle(fontSize: 11)),
                          onPressed: () {
                            usernameController.text = 'marketing';
                            passwordController.text = 'Marketing2026!';
                          },
                        ),
                        ActionChip(
                          avatar: const Icon(Icons.account_balance, size: 14),
                          label: const Text('Kế Toán', style: TextStyle(fontSize: 11)),
                          onPressed: () {
                            usernameController.text = 'accountant';
                            passwordController.text = 'Accountant2026!';
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: usernameController,
                      decoration: const InputDecoration(
                        labelText: 'Tên đăng nhập',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: passwordController,
                      obscureText: true,
                      decoration: const InputDecoration(
                        labelText: 'Mật khẩu',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                    ),
                    if (authState.errorMessage != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        authState.errorMessage!,
                        style: const TextStyle(color: Colors.red, fontSize: 12),
                      ),
                    ],
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: const Text('Hủy'),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF24594D),
                    foregroundColor: Colors.white,
                  ),
                  onPressed: authState.isLoading
                      ? null
                      : () async {
                          final success = await ref.read(authProvider.notifier).login(
                                usernameController.text.trim(),
                                passwordController.text,
                              );
                          if (success && context.mounted) {
                            Navigator.of(ctx).pop();
                          }
                        },
                  child: authState.isLoading
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Đăng nhập'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final readinessAsync = ref.watch(readinessProvider);
    final versionAsync = ref.watch(versionProvider);
    final authState = ref.watch(authProvider);

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'QL Nghĩa Trang Tư Nhân',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            Text(
              authState.isAuthenticated
                  ? '${authState.user!.fullName} · [${authState.user!.roles.join(", ")}]'
                  : 'Ứng dụng Quản trang & Hiện trường',
              style: const TextStyle(fontSize: 12, color: Colors.white70),
            ),
          ],
        ),
        actions: [
          if (authState.isAuthenticated)
            IconButton(
              icon: const Icon(Icons.logout),
              tooltip: 'Đăng xuất',
              onPressed: () => ref.read(authProvider.notifier).logout(),
            )
          else
            TextButton.icon(
              onPressed: () => _showLoginDialog(context, ref),
              icon: const Icon(Icons.login, color: Colors.white, size: 18),
              label: const Text('Đăng nhập', style: TextStyle(color: Colors.white, fontSize: 13)),
            ),
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Làm mới kết nối',
            onPressed: () {
              ref.invalidate(readinessProvider);
              ref.invalidate(versionProvider);
            },
          ),
        ],
      ),
      body: RefreshIndicator(
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
                              style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Số quyền hiệu lực (RBAC): ${authState.user!.permissions.length}',
                        style: const TextStyle(fontSize: 13, color: Colors.black87),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],

            // Section 1: Overview Banner
            _buildHeaderCard(context, versionAsync),
            const SizedBox(height: 16),

            // Section 2: Infrastructure Status (Readiness)
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
      ),
    );
  }

  Widget _buildHeaderCard(BuildContext context, AsyncValue<SystemVersion> versionAsync) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: Color(0xFFE5E7EB)),
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
                        'Hệ Thống Nghĩa Trang',
                        style: TextStyle(
                          fontSize: 16,
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
