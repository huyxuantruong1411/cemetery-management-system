import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

// API Base URL configuration: can be overridden via --dart-define=API_BASE_URL=...
const String defaultApiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:8000/api/v1',
);

// Currency helper
String formatVnd(num amount) {
  final str = amount.round().toString();
  final regExp = RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))');
  final formatted = str.replaceAllMapped(regExp, (Match m) => '${m[1]}.');
  return '$formatted đ';
}

// =============================================================================
// Models
// =============================================================================
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

  bool hasRole(String role) =>
      user?.roles.any((r) => r.toUpperCase() == role.toUpperCase()) ?? false;

  bool hasPermission(String perm) =>
      user?.permissions.any((p) => p.toLowerCase() == perm.toLowerCase()) ?? false;

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

// Catalog Models (M04)
class PriceItemModel {
  final int priceItemId;
  final int priceListId;
  final String itemName;
  final String unit;
  final double unitPrice;
  final bool isActive;
  final int? zoneId;
  final int? plotTypeId;
  final int? packageId;
  final String? serviceCode;

  PriceItemModel({
    required this.priceItemId,
    required this.priceListId,
    required this.itemName,
    required this.unit,
    required this.unitPrice,
    required this.isActive,
    this.zoneId,
    this.plotTypeId,
    this.packageId,
    this.serviceCode,
  });

  factory PriceItemModel.fromJson(Map<String, dynamic> json) {
    return PriceItemModel(
      priceItemId: json['price_item_id'] as int? ?? 0,
      priceListId: json['price_list_id'] as int? ?? 0,
      itemName: json['item_name'] as String? ?? '',
      unit: json['unit'] as String? ?? '',
      unitPrice: (json['unit_price'] as num?)?.toDouble() ?? 0.0,
      isActive: json['is_active'] as bool? ?? true,
      zoneId: json['zone_id'] as int?,
      plotTypeId: json['plot_type_id'] as int?,
      packageId: json['package_id'] as int?,
      serviceCode: json['service_code'] as String?,
    );
  }
}

class PriceListModel {
  final int priceListId;
  final String priceListName;
  final String effectiveFrom;
  final String? effectiveTo;
  final bool isActive;
  final List<PriceItemModel> items;

  PriceListModel({
    required this.priceListId,
    required this.priceListName,
    required this.effectiveFrom,
    this.effectiveTo,
    required this.isActive,
    required this.items,
  });

  factory PriceListModel.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List<dynamic>? ?? [];
    return PriceListModel(
      priceListId: json['price_list_id'] as int? ?? 0,
      priceListName: json['price_list_name'] as String? ?? '',
      effectiveFrom: json['effective_from'] as String? ?? '',
      effectiveTo: json['effective_to'] as String?,
      isActive: json['is_active'] as bool? ?? true,
      items: rawItems
          .map((i) => PriceItemModel.fromJson(i as Map<String, dynamic>))
          .toList(),
    );
  }
}

class CarePackageModel {
  final int packageId;
  final String packageName;
  final String cycleType;
  final int periodMonths;
  final double price;
  final String? description;
  final List<String> taskList;
  final bool isActive;

  CarePackageModel({
    required this.packageId,
    required this.packageName,
    required this.cycleType,
    required this.periodMonths,
    required this.price,
    this.description,
    required this.taskList,
    required this.isActive,
  });

  factory CarePackageModel.fromJson(Map<String, dynamic> json) {
    final tasks = (json['task_list'] as List<dynamic>?)
            ?.map((e) => e.toString())
            .toList() ??
        [];
    return CarePackageModel(
      packageId: json['package_id'] as int? ?? 0,
      packageName: json['package_name'] as String? ?? '',
      cycleType: json['cycle_type'] as String? ?? '',
      periodMonths: json['period_months'] as int? ?? 1,
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      description: json['description'] as String?,
      taskList: tasks,
      isActive: json['is_active'] as bool? ?? true,
    );
  }
}

// =============================================================================
// Providers
// =============================================================================
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

// Catalog Providers
final priceListsProvider = FutureProvider.autoDispose<List<PriceListModel>>((ref) async {
  final authState = ref.watch(authProvider);
  if (!authState.isAuthenticated) {
    return [];
  }
  final dio = ref.watch(dioProvider);
  final res = await dio.get(
    '/catalog/price-lists',
    options: Options(headers: {'Authorization': 'Bearer ${authState.accessToken}'}),
  );
  final list = res.data as List<dynamic>;
  return list.map((item) => PriceListModel.fromJson(item as Map<String, dynamic>)).toList();
});

final carePackagesProvider = FutureProvider.autoDispose<List<CarePackageModel>>((ref) async {
  final authState = ref.watch(authProvider);
  if (!authState.isAuthenticated) {
    return [];
  }
  final dio = ref.watch(dioProvider);
  final res = await dio.get(
    '/catalog/care-packages',
    options: Options(headers: {'Authorization': 'Bearer ${authState.accessToken}'}),
  );
  final list = res.data as List<dynamic>;
  return list.map((item) => CarePackageModel.fromJson(item as Map<String, dynamic>)).toList();
});

// =============================================================================
// App & Dashboard
// =============================================================================
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

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  int _currentTabIndex = 0;

  void _showLoginDialog(BuildContext context) {
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
                          avatar: const Icon(Icons.campaign, size: 14),
                          label: const Text('Kinh Doanh', style: TextStyle(fontSize: 11)),
                          onPressed: () {
                            usernameController.text = 'marketing';
                            passwordController.text = 'Marketing2026!';
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
  Widget build(BuildContext context) {
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
              onPressed: () => _showLoginDialog(context),
              icon: const Icon(Icons.login, color: Colors.white, size: 18),
              label: const Text('Đăng nhập', style: TextStyle(color: Colors.white, fontSize: 13)),
            ),
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Làm mới kết nối',
            onPressed: () {
              ref.invalidate(readinessProvider);
              ref.invalidate(versionProvider);
              if (authState.isAuthenticated) {
                ref.invalidate(priceListsProvider);
                ref.invalidate(carePackagesProvider);
              }
            },
          ),
        ],
      ),
      body: _currentTabIndex == 0
          ? _buildHomeTab(context, readinessAsync, versionAsync, authState)
          : _buildCatalogTab(context, authState),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentTabIndex,
        selectedItemColor: const Color(0xFF24594D),
        unselectedItemColor: Colors.black45,
        onTap: (index) {
          setState(() {
            _currentTabIndex = index;
          });
        },
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.dashboard_outlined),
            activeIcon: Icon(Icons.dashboard),
            label: 'Tổng Quan',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.price_change_outlined),
            activeIcon: Icon(Icons.price_change),
            label: 'Bảng Giá & Gói CS',
          ),
        ],
      ),
    );
  }

  Widget _buildHomeTab(
    BuildContext context,
    AsyncValue<SystemReadiness> readinessAsync,
    AsyncValue<SystemVersion> versionAsync,
    AuthState authState,
  ) {
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
          _buildHeaderCard(context, versionAsync),
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
          _buildReadinessSection(context, readinessAsync),
        ],
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

  // ===========================================================================
  // M04: Catalog & Pricing Tab
  // ===========================================================================
  Widget _buildCatalogTab(BuildContext context, AuthState authState) {
    if (!authState.isAuthenticated) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: const BorderSide(color: Color(0xFFE5E7EB)),
            ),
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.lock_outline, size: 48, color: Color(0xFF24594D)),
                  const SizedBox(height: 16),
                  const Text(
                    'Yêu Cầu Xác Thực Nhân Viên',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Vui lòng đăng nhập với vai trò Kinh Doanh, Kế Toán hoặc Quản Trang để tra cứu bảng giá và dịch vụ thực địa.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.black54, fontSize: 13),
                  ),
                  const SizedBox(height: 20),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF24594D),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                    ),
                    onPressed: () => _showLoginDialog(context),
                    icon: const Icon(Icons.login, size: 18),
                    label: const Text('Đăng nhập ngay'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    final priceListsAsync = ref.watch(priceListsProvider);
    final carePackagesAsync = ref.watch(carePackagesProvider);

    return DefaultTabController(
      length: 2,
      child: Column(
        children: [
          Container(
            color: Colors.white,
            child: const TabBar(
              labelColor: Color(0xFF24594D),
              unselectedLabelColor: Colors.black54,
              indicatorColor: Color(0xFF24594D),
              tabs: [
                Tab(icon: Icon(Icons.list_alt, size: 20), text: 'Bảng Giá & Khoản Mục'),
                Tab(icon: Icon(Icons.spa, size: 20), text: 'Gói Chăm Sóc Định Kỳ'),
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              children: [
                _buildPriceListsView(priceListsAsync),
                _buildCarePackagesView(carePackagesAsync),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPriceListsView(AsyncValue<List<PriceListModel>> priceListsAsync) {
    return priceListsAsync.when(
      data: (priceLists) {
        if (priceLists.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.inventory_2_outlined, size: 48, color: Colors.grey),
                const SizedBox(height: 12),
                const Text('Chưa có bảng giá nào hiệu lực', style: TextStyle(color: Colors.black54)),
                const SizedBox(height: 12),
                ElevatedButton(
                  onPressed: () => ref.invalidate(priceListsProvider),
                  child: const Text('Làm mới'),
                ),
              ],
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(priceListsProvider);
            await ref.read(priceListsProvider.future);
          },
          child: ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: priceLists.length,
            itemBuilder: (context, index) {
              final pl = priceLists[index];
              return Card(
                elevation: 0,
                margin: const EdgeInsets.only(bottom: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: const BorderSide(color: Color(0xFFE5E7EB)),
                ),
                child: ExpansionTile(
                  leading: const Icon(Icons.receipt_long, color: Color(0xFF24594D)),
                  title: Text(
                    pl.priceListName,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                  subtitle: Text(
                    'Hiệu lực: ${pl.effectiveFrom} ${pl.effectiveTo != null ? "-> ${pl.effectiveTo!}" : "(Đang áp dụng)"}',
                    style: const TextStyle(fontSize: 12, color: Colors.black54),
                  ),
                  trailing: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: pl.isActive ? const Color(0xFFDCFCE7) : const Color(0xFFF3F4F6),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      pl.isActive ? 'Áp dụng' : 'Khóa',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: pl.isActive ? const Color(0xFF166534) : Colors.black45,
                      ),
                    ),
                  ),
                  initiallyExpanded: index == 0,
                  children: [
                    const Divider(height: 1),
                    if (pl.items.isEmpty)
                      const Padding(
                        padding: EdgeInsets.all(16.0),
                        child: Text(
                          'Chưa có khoản mục giá chi tiết',
                          style: TextStyle(color: Colors.black38, fontSize: 13),
                        ),
                      )
                    else
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: pl.items.length,
                        separatorBuilder: (context, _) => const Divider(height: 1, indent: 16, endIndent: 16),
                        itemBuilder: (context, iIdx) {
                          final item = pl.items[iIdx];
                          return ListTile(
                            dense: true,
                            title: Text(
                              item.itemName,
                              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                            ),
                            subtitle: Text(
                              'Đơn vị: ${item.unit} ${item.serviceCode != null ? "· Mã: ${item.serviceCode!}" : ""}',
                              style: const TextStyle(fontSize: 11, color: Colors.black54),
                            ),
                            trailing: Text(
                              formatVnd(item.unitPrice),
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF24594D),
                                fontSize: 13,
                              ),
                            ),
                          );
                        },
                      ),
                  ],
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
            Text('Đang tải danh mục bảng giá...'),
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
                'Lỗi tải bảng giá: $err',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.red, fontSize: 13),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: () => ref.invalidate(priceListsProvider),
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text('Thử lại'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCarePackagesView(AsyncValue<List<CarePackageModel>> carePackagesAsync) {
    return carePackagesAsync.when(
      data: (packages) {
        if (packages.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.spa_outlined, size: 48, color: Colors.grey),
                const SizedBox(height: 12),
                const Text('Chưa có gói chăm sóc nào', style: TextStyle(color: Colors.black54)),
                const SizedBox(height: 12),
                ElevatedButton(
                  onPressed: () => ref.invalidate(carePackagesProvider),
                  child: const Text('Làm mới'),
                ),
              ],
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(carePackagesProvider);
            await ref.read(carePackagesProvider.future);
          },
          child: ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: packages.length,
            itemBuilder: (context, index) {
              final pkg = packages[index];
              return Card(
                elevation: 0,
                margin: const EdgeInsets.only(bottom: 12),
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
                            child: const Icon(Icons.spa, color: Color(0xFF24594D), size: 20),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              pkg.packageName,
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                            ),
                          ),
                          Text(
                            formatVnd(pkg.price),
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF24594D),
                              fontSize: 15,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Chu kỳ: ${pkg.cycleType} (${pkg.periodMonths} tháng) ${pkg.description != null ? "· ${pkg.description!}" : ""}',
                        style: const TextStyle(fontSize: 12, color: Colors.black54),
                      ),
                      if (pkg.taskList.isNotEmpty) ...[
                        const SizedBox(height: 10),
                        const Text(
                          'Hạng mục công việc chăm sóc:',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.black87),
                        ),
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 6,
                          runSpacing: 4,
                          children: pkg.taskList.map((task) {
                            return Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: const Color(0xFFCBD5E1)),
                              ),
                              child: Text(
                                task,
                                style: const TextStyle(fontSize: 11, color: Color(0xFF334155)),
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
            Text('Đang tải danh sách gói chăm sóc...'),
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
                'Lỗi tải gói chăm sóc: $err',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.red, fontSize: 13),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: () => ref.invalidate(carePackagesProvider),
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text('Thử lại'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
