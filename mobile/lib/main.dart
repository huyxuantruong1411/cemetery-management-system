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

// Plot Models (M05)
class PlotModel {
  final int plotId;
  final String plotCode;
  final String rowCode;
  final String zoneCode;
  final String zoneName;
  final String typeName;
  final int defaultSlots;
  final String status;
  final bool isKimTinh;
  final bool isLocked;
  final double? latitude;
  final double? longitude;
  final String? orientation;
  final String? ownerName;

  PlotModel({
    required this.plotId,
    required this.plotCode,
    required this.rowCode,
    required this.zoneCode,
    required this.zoneName,
    required this.typeName,
    required this.defaultSlots,
    required this.status,
    required this.isKimTinh,
    required this.isLocked,
    this.latitude,
    this.longitude,
    this.orientation,
    this.ownerName,
  });

  factory PlotModel.fromJson(Map<String, dynamic> json) {
    return PlotModel(
      plotId: json['plot_id'] as int? ?? 0,
      plotCode: json['plot_code'] as String? ?? '',
      rowCode: json['row_code'] as String? ?? '',
      zoneCode: json['zone_code'] as String? ?? '',
      zoneName: json['zone_name'] as String? ?? '',
      typeName: json['type_name'] as String? ?? '',
      defaultSlots: json['default_slots'] as int? ?? 1,
      status: json['status'] as String? ?? 'EMPTY_UNSOLD',
      isKimTinh: json['is_kim_tinh'] as bool? ?? false,
      isLocked: json['is_locked'] as bool? ?? false,
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      orientation: json['orientation'] as String?,
      ownerName: json['owner_name'] as String?,
    );
  }
}

// Profiles & Memorial Models (M06)
class CustomerRelationModel {
  final int relationId;
  final int deceasedId;
  final String deceasedCode;
  final String deceasedFullName;
  final String relationshipType;
  final bool isPrimaryContact;

  CustomerRelationModel({
    required this.relationId,
    required this.deceasedId,
    required this.deceasedCode,
    required this.deceasedFullName,
    required this.relationshipType,
    required this.isPrimaryContact,
  });

  factory CustomerRelationModel.fromJson(Map<String, dynamic> json) {
    return CustomerRelationModel(
      relationId: json['relation_id'] as int? ?? 0,
      deceasedId: json['deceased_id'] as int? ?? 0,
      deceasedCode: json['deceased_code'] as String? ?? '',
      deceasedFullName: json['deceased_full_name'] as String? ?? '',
      relationshipType: json['relationship_type'] as String? ?? '',
      isPrimaryContact: json['is_primary_contact'] as bool? ?? false,
    );
  }
}

class CustomerModel {
  final int customerId;
  final String customerCode;
  final String fullName;
  final String citizenId;
  final String phoneNumber;
  final String? email;
  final String address;
  final String? dateOfBirth;
  final List<CustomerRelationModel> relations;

  CustomerModel({
    required this.customerId,
    required this.customerCode,
    required this.fullName,
    required this.citizenId,
    required this.phoneNumber,
    this.email,
    required this.address,
    this.dateOfBirth,
    required this.relations,
  });

  factory CustomerModel.fromJson(Map<String, dynamic> json) {
    final rawRels = json['relations'] as List<dynamic>? ?? [];
    return CustomerModel(
      customerId: json['customer_id'] as int? ?? 0,
      customerCode: json['customer_code'] as String? ?? '',
      fullName: json['full_name'] as String? ?? '',
      citizenId: json['citizen_id'] as String? ?? '',
      phoneNumber: json['phone_number'] as String? ?? '',
      email: json['email'] as String?,
      address: json['address'] as String? ?? '',
      dateOfBirth: json['date_of_birth'] as String?,
      relations: rawRels
          .map((r) => CustomerRelationModel.fromJson(r as Map<String, dynamic>))
          .toList(),
    );
  }
}

class DeathCertificateModel {
  final int certId;
  final String certificateNumber;
  final String issuingAuthority;
  final String issueDate;
  final bool isVerified;
  final String? verifiedAt;
  final String? verifierName;
  final String? rejectionReason;

  DeathCertificateModel({
    required this.certId,
    required this.certificateNumber,
    required this.issuingAuthority,
    required this.issueDate,
    required this.isVerified,
    this.verifiedAt,
    this.verifierName,
    this.rejectionReason,
  });

  factory DeathCertificateModel.fromJson(Map<String, dynamic> json) {
    return DeathCertificateModel(
      certId: json['cert_id'] as int? ?? 0,
      certificateNumber: json['certificate_number'] as String? ?? '',
      issuingAuthority: json['issuing_authority'] as String? ?? '',
      issueDate: json['issue_date'] as String? ?? '',
      isVerified: json['is_verified'] as bool? ?? false,
      verifiedAt: json['verified_at'] as String?,
      verifierName: json['verifier_name'] as String?,
      rejectionReason: json['rejection_reason'] as String?,
    );
  }
}

class BurialSlotBriefModel {
  final int slotId;
  final int plotId;
  final int slotNumber;
  final String plotCode;
  final String zoneName;
  final String rowCode;
  final String status;
  final bool isKimTinh;

  BurialSlotBriefModel({
    required this.slotId,
    required this.plotId,
    required this.slotNumber,
    required this.plotCode,
    required this.zoneName,
    required this.rowCode,
    required this.status,
    required this.isKimTinh,
  });

  factory BurialSlotBriefModel.fromJson(Map<String, dynamic> json) {
    return BurialSlotBriefModel(
      slotId: json['slot_id'] as int? ?? 0,
      plotId: json['plot_id'] as int? ?? 0,
      slotNumber: json['slot_number'] as int? ?? 1,
      plotCode: json['plot_code'] as String? ?? '',
      zoneName: json['zone_name'] as String? ?? '',
      rowCode: json['row_code'] as String? ?? '',
      status: json['status'] as String? ?? '',
      isKimTinh: json['is_kim_tinh'] as bool? ?? false,
    );
  }
}

class DeceasedProfileModel {
  final int deceasedId;
  final String deceasedCode;
  final String fullName;
  final String gender;
  final String? dateOfBirth;
  final String dateOfDeath;
  final int? birthYear;
  final String birthDatePrecision;
  final String? hometown;
  final String? religion;
  final bool hasDeathCertificate;
  final DeathCertificateModel? deathCertificate;
  final BurialSlotBriefModel? burialSlot;

  DeceasedProfileModel({
    required this.deceasedId,
    required this.deceasedCode,
    required this.fullName,
    required this.gender,
    this.dateOfBirth,
    required this.dateOfDeath,
    this.birthYear,
    required this.birthDatePrecision,
    this.hometown,
    this.religion,
    required this.hasDeathCertificate,
    this.deathCertificate,
    this.burialSlot,
  });

  factory DeceasedProfileModel.fromJson(Map<String, dynamic> json) {
    return DeceasedProfileModel(
      deceasedId: json['deceased_id'] as int? ?? 0,
      deceasedCode: json['deceased_code'] as String? ?? '',
      fullName: json['full_name'] as String? ?? '',
      gender: json['gender'] as String? ?? 'UNKNOWN',
      dateOfBirth: json['date_of_birth'] as String?,
      dateOfDeath: json['date_of_death'] as String? ?? '',
      birthYear: json['birth_year'] as int?,
      birthDatePrecision: json['birth_date_precision'] as String? ?? 'EXACT',
      hometown: json['hometown'] as String?,
      religion: json['religion'] as String?,
      hasDeathCertificate: json['has_death_certificate'] as bool? ?? false,
      deathCertificate: json['death_certificate'] != null
          ? DeathCertificateModel.fromJson(json['death_certificate'] as Map<String, dynamic>)
          : null,
      burialSlot: json['burial_slot'] != null
          ? BurialSlotBriefModel.fromJson(json['burial_slot'] as Map<String, dynamic>)
          : null,
    );
  }
}

class MemorialLookupModel {
  final String deceasedCode;
  final String fullName;
  final int? yearOfBirth;
  final String dateOfDeath;
  final String? hometown;
  final String? zoneName;
  final String? rowCode;
  final String? plotCode;
  final int? slotNumber;
  final bool isKimTinh;

  MemorialLookupModel({
    required this.deceasedCode,
    required this.fullName,
    this.yearOfBirth,
    required this.dateOfDeath,
    this.hometown,
    this.zoneName,
    this.rowCode,
    this.plotCode,
    this.slotNumber,
    required this.isKimTinh,
  });

  factory MemorialLookupModel.fromJson(Map<String, dynamic> json) {
    return MemorialLookupModel(
      deceasedCode: json['deceased_code'] as String? ?? '',
      fullName: json['full_name'] as String? ?? '',
      yearOfBirth: json['year_of_birth'] as int?,
      dateOfDeath: json['date_of_death'] as String? ?? '',
      hometown: json['hometown'] as String?,
      zoneName: json['zone_name'] as String?,
      rowCode: json['row_code'] as String?,
      plotCode: json['plot_code'] as String?,
      slotNumber: json['slot_number'] as int?,
      isKimTinh: json['is_kim_tinh'] as bool? ?? false,
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

// Plot Providers (M05)
final plotsProvider = FutureProvider.autoDispose<List<PlotModel>>((ref) async {
  final authState = ref.watch(authProvider);
  if (!authState.isAuthenticated) {
    return [];
  }
  final dio = ref.watch(dioProvider);
  final res = await dio.get(
    '/plots?limit=200',
    options: Options(headers: {'Authorization': 'Bearer ${authState.accessToken}'}),
  );
  final list = res.data as List<dynamic>;
  return list.map((item) => PlotModel.fromJson(item as Map<String, dynamic>)).toList();
});

// Profiles Providers (M06)
final customersProvider = FutureProvider.autoDispose<List<CustomerModel>>((ref) async {
  final authState = ref.watch(authProvider);
  if (!authState.isAuthenticated) {
    return [];
  }
  final dio = ref.watch(dioProvider);
  final res = await dio.get(
    '/profiles/customers',
    options: Options(headers: {'Authorization': 'Bearer ${authState.accessToken}'}),
  );
  final list = res.data as List<dynamic>;
  return list.map((item) => CustomerModel.fromJson(item as Map<String, dynamic>)).toList();
});

final deceasedProfilesProvider = FutureProvider.autoDispose<List<DeceasedProfileModel>>((ref) async {
  final authState = ref.watch(authProvider);
  if (!authState.isAuthenticated) {
    return [];
  }
  final dio = ref.watch(dioProvider);
  final res = await dio.get(
    '/profiles/deceased',
    options: Options(headers: {'Authorization': 'Bearer ${authState.accessToken}'}),
  );
  final list = res.data as List<dynamic>;
  return list.map((item) => DeceasedProfileModel.fromJson(item as Map<String, dynamic>)).toList();
});

class MemorialSearchNotifier extends Notifier<String> {
  @override
  String build() => 'Nguyễn';

  void setQuery(String q) {
    state = q;
  }
}

final memorialSearchQueryProvider = NotifierProvider<MemorialSearchNotifier, String>(() {
  return MemorialSearchNotifier();
});

final memorialSearchResultsProvider = FutureProvider.autoDispose<List<MemorialLookupModel>>((ref) async {
  final query = ref.watch(memorialSearchQueryProvider);
  if (query.trim().length < 2) {
    return [];
  }
  final dio = ref.watch(dioProvider);
  final res = await dio.get(
    '/profiles/public/memorials',
    queryParameters: {'q': query.trim()},
  );
  final list = res.data as List<dynamic>;
  return list.map((item) => MemorialLookupModel.fromJson(item as Map<String, dynamic>)).toList();
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
  String _selectedZoneFilter = 'ALL';
  String _plotSearchQuery = '';
  late final TextEditingController _memorialSearchController;
  String _customerSearchQuery = '';
  String _deceasedSearchQuery = '';

  @override
  void initState() {
    super.initState();
    _memorialSearchController = TextEditingController(text: 'Nguyễn');
  }

  @override
  void dispose() {
    _memorialSearchController.dispose();
    super.dispose();
  }

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

  void _showPlotDetailSheet(BuildContext context, PlotModel plot) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    plot.plotCode,
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  if (plot.isKimTinh)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: const Color(0xFFFCD34D)),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.shield, color: Color(0xFFD97706), size: 14),
                          SizedBox(width: 4),
                          Text(
                            'Kim Tĩnh',
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF92400E)),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                '${plot.zoneName} · ${plot.rowCode}',
                style: const TextStyle(color: Colors.black54, fontSize: 13),
              ),
              const Divider(height: 24),
              _buildDetailRow('Loại mộ:', plot.typeName),
              _buildDetailRow('Dung lượng:', '${plot.defaultSlots} slot an táng'),
              _buildDetailRow('Hướng phong thủy:', plot.orientation ?? 'Chưa định hướng'),
              _buildDetailRow('Trạng thái:', plot.status),
              if (plot.latitude != null && plot.longitude != null)
                _buildDetailRow(
                  'Tọa độ GPS:',
                  '${plot.latitude!.toStringAsFixed(6)}, ${plot.longitude!.toStringAsFixed(6)}',
                ),
              if (plot.isLocked) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF2F2),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFFECACA)),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.lock, color: Colors.red, size: 18),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Ô mộ Kim Tĩnh đã an táng và khóa vĩnh viễn. Nghiêm cấm cải táng.',
                          style: TextStyle(color: Colors.red, fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 20),
            ],
          ),
        );
      },
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.black54, fontSize: 13)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
        ],
      ),
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
                ref.invalidate(plotsProvider);
                ref.invalidate(priceListsProvider);
                ref.invalidate(carePackagesProvider);
                ref.invalidate(customersProvider);
                ref.invalidate(deceasedProfilesProvider);
              }
              ref.invalidate(memorialSearchResultsProvider);
            },
          ),
        ],
      ),
      body: IndexedStack(
        index: _currentTabIndex,
        children: [
          _buildHomeTab(context, readinessAsync, versionAsync, authState),
          _buildPlotsTab(context, authState),
          _buildCatalogTab(context, authState),
          _buildProfilesTab(context, authState),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
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
            icon: Icon(Icons.map_outlined),
            activeIcon: Icon(Icons.map),
            label: 'Sơ Đồ Ô Mộ',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.price_change_outlined),
            activeIcon: Icon(Icons.price_change),
            label: 'Bảng Giá & Gói CS',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.people_alt_outlined),
            activeIcon: Icon(Icons.people_alt),
            label: 'Hồ Sơ & Tra Cứu',
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
  // M05: Plots & Maps Tab
  // ===========================================================================
  Widget _buildPlotsTab(BuildContext context, AuthState authState) {
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
                  const Icon(Icons.map_outlined, size: 48, color: Color(0xFF24594D)),
                  const SizedBox(height: 16),
                  const Text(
                    'Tra Cứu Ô Mộ & Thực Địa',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Vui lòng đăng nhập với vai trò Quản Trang hoặc Kinh Doanh để tra cứu danh sách ô mộ, tọa độ GPS và trạng thái Kim Tĩnh.',
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
                        onTap: () => _showPlotDetailSheet(context, plot),
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

  // ===========================================================================
  // M06: Profiles & Public Memorial Tab Implementation
  // ===========================================================================
  Widget _buildProfilesTab(BuildContext context, AuthState authState) {
    return DefaultTabController(
      length: 3,
      child: Column(
        children: [
          Container(
            color: Colors.white,
            child: const TabBar(
              labelColor: Color(0xFF24594D),
              unselectedLabelColor: Colors.black54,
              indicatorColor: Color(0xFF24594D),
              isScrollable: true,
              tabAlignment: TabAlignment.start,
              tabs: [
                Tab(icon: Icon(Icons.search, size: 18), text: 'Tra Cứu Tưởng Niệm'),
                Tab(icon: Icon(Icons.people, size: 18), text: 'Thân Nhân (KH)'),
                Tab(icon: Icon(Icons.verified_user, size: 18), text: 'Quá Cố & Giấy Báo Tử'),
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              children: [
                _buildPublicMemorialView(),
                _buildCustomersView(context, authState),
                _buildDeceasedProfilesView(context, authState),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // 1. Public Memorial Lookup View (Zero PII - Open for families & visitors)
  Widget _buildPublicMemorialView() {
    final memorialResultsAsync = ref.watch(memorialSearchResultsProvider);
    final currentQuery = ref.watch(memorialSearchQueryProvider);

    return Column(
      children: [
        // Search header bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          color: Colors.white,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextField(
                controller: _memorialSearchController,
                decoration: InputDecoration(
                  hintText: 'Nhập họ tên người quá cố (tối thiểu 2 ký tự)...',
                  prefixIcon: const Icon(Icons.search, color: Color(0xFF24594D)),
                  suffixIcon: _memorialSearchController.text.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear, size: 18),
                          onPressed: () {
                            _memorialSearchController.clear();
                            ref.read(memorialSearchQueryProvider.notifier).setQuery('');
                          },
                        )
                      : null,
                  isDense: true,
                  filled: true,
                  fillColor: const Color(0xFFF3F4F6),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide.none,
                  ),
                ),
                onSubmitted: (val) {
                  ref.read(memorialSearchQueryProvider.notifier).setQuery(val.trim());
                },
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  const Text('Gợi ý tìm kiếm:', style: TextStyle(fontSize: 11, color: Colors.black54)),
                  const SizedBox(width: 8),
                  Wrap(
                    spacing: 6,
                    children: ['Nguyễn', 'Trần', 'Lê', 'A1'].map((tag) {
                      return InkWell(
                        onTap: () {
                          _memorialSearchController.text = tag;
                          ref.read(memorialSearchQueryProvider.notifier).setQuery(tag);
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: currentQuery == tag ? const Color(0xFF24594D) : const Color(0xFFE2E8F0),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            tag,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                              color: currentQuery == tag ? Colors.white : const Color(0xFF334155),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ),
            ],
          ),
        ),

        // Privacy assurance banner
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          color: const Color(0xFFEFF6FF),
          child: const Row(
            children: [
              Icon(Icons.shield_outlined, size: 14, color: Color(0xFF1D4ED8)),
              SizedBox(width: 6),
              Expanded(
                child: Text(
                  'Cổng tra cứu công khai: Bảo mật tuyệt đối danh tính thân nhân & số CCCD/SĐT (Zero PII).',
                  style: TextStyle(fontSize: 10.5, color: Color(0xFF1E40AF)),
                ),
              ),
            ],
          ),
        ),

        // Results view
        Expanded(
          child: memorialResultsAsync.when(
            data: (results) {
              if (results.isEmpty) {
                return Center(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.person_search, size: 48, color: Colors.grey),
                        const SizedBox(height: 12),
                        const Text(
                          'Không tìm thấy hồ sơ tưởng niệm phù hợp',
                          style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.black87),
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'Vui lòng thử lại với từ khóa khác hoặc nhập ít nhất 2 ký tự họ tên.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.black54, fontSize: 12),
                        ),
                        const SizedBox(height: 16),
                        ElevatedButton(
                          onPressed: () {
                            _memorialSearchController.text = 'Nguyễn';
                            ref.read(memorialSearchQueryProvider.notifier).setQuery('Nguyễn');
                          },
                          child: const Text('Xem danh sách mẫu'),
                        ),
                      ],
                    ),
                  ),
                );
              }

              return RefreshIndicator(
                onRefresh: () async {
                  ref.invalidate(memorialSearchResultsProvider);
                  await ref.read(memorialSearchResultsProvider.future);
                },
                child: ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: results.length,
                  itemBuilder: (context, index) {
                    final item = results[index];
                    return Card(
                      elevation: 0,
                      margin: const EdgeInsets.only(bottom: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: const BorderSide(color: Color(0xFFE2E8F0)),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(14.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(6),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF24594D).withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: const Icon(Icons.local_florist, color: Color(0xFF24594D), size: 18),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        item.fullName,
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                                      ),
                                      Text(
                                        'Mã quá cố: ${item.deceasedCode}',
                                        style: const TextStyle(fontSize: 11, color: Colors.black45),
                                      ),
                                    ],
                                  ),
                                ),
                                if (item.isKimTinh)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFFEF3C7),
                                      borderRadius: BorderRadius.circular(4),
                                      border: Border.all(color: const Color(0xFFFCD34D)),
                                    ),
                                    child: const Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(Icons.shield, color: Color(0xFFD97706), size: 12),
                                        SizedBox(width: 3),
                                        Text(
                                          'Kim Tĩnh',
                                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF92400E)),
                                        ),
                                      ],
                                    ),
                                  ),
                              ],
                            ),
                            const Divider(height: 18),
                            Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        'Sinh - Mất: ${item.yearOfBirth ?? "---"} - ${item.dateOfDeath}',
                                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
                                      ),
                                      if (item.hometown != null)
                                        Text(
                                          'Quê quán: ${item.hometown}',
                                          style: const TextStyle(fontSize: 11, color: Colors.black54),
                                        ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF0FDF4),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: const Color(0xFFBBF7D0)),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.place, size: 16, color: Color(0xFF15803D)),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      item.plotCode != null
                                          ? 'Nơi an táng: ${item.zoneName ?? ""} · Lô ${item.plotCode} · Hàng ${item.rowCode ?? ""} (Huyệt ${item.slotNumber ?? 1})'
                                          : 'Nơi an táng: Chưa phân bổ huyệt mộ chính thức',
                                      style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                        color: Color(0xFF166534),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
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
                  Text('Đang tra cứu dữ liệu tưởng niệm công khai...'),
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
                      'Lỗi kết nối tra cứu tưởng niệm: $err',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.red, fontSize: 13),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: () => ref.invalidate(memorialSearchResultsProvider),
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

  // 2. Customers / Relatives View (Requires Authentication)
  Widget _buildCustomersView(BuildContext context, AuthState authState) {
    if (!authState.isAuthenticated) {
      return Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: const BorderSide(color: Color(0xFFE5E7EB)),
            ),
            child: Padding(
              padding: const EdgeInsets.all(20.0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.lock_outline, size: 40, color: Color(0xFF24594D)),
                  const SizedBox(height: 12),
                  const Text(
                    'Yêu Cầu Xác Thực Nhân Viên',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Dữ liệu thân nhân và thông tin liên hệ được bảo vệ theo chuẩn an toàn thông tin. Vui lòng đăng nhập để tiếp tục.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.black54, fontSize: 13),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF24594D),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
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

  // 3. Deceased Profiles & Death Certificate View (Requires Authentication)
  Widget _buildDeceasedProfilesView(BuildContext context, AuthState authState) {
    if (!authState.isAuthenticated) {
      return Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: const BorderSide(color: Color(0xFFE5E7EB)),
            ),
            child: Padding(
              padding: const EdgeInsets.all(20.0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.verified_user_outlined, size: 40, color: Color(0xFF24594D)),
                  const SizedBox(height: 12),
                  const Text(
                    'Xác Thực Hồ Sơ An Táng',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Xem trạng thái phê duyệt Giấy báo tử và kiểm soát an táng yêu cầu đăng nhập nghiệp vụ.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.black54, fontSize: 13),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF24594D),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
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

    final deceasedAsync = ref.watch(deceasedProfilesProvider);

    return Column(
      children: [
        // Search bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          color: Colors.white,
          child: TextField(
            decoration: InputDecoration(
              hintText: 'Tìm theo tên, mã người quá cố...',
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
                _deceasedSearchQuery = val.trim().toLowerCase();
              });
            },
          ),
        ),

        Expanded(
          child: deceasedAsync.when(
            data: (deceasedList) {
              final filtered = deceasedList.where((d) {
                if (_deceasedSearchQuery.isEmpty) return true;
                return d.fullName.toLowerCase().contains(_deceasedSearchQuery) ||
                    d.deceasedCode.toLowerCase().contains(_deceasedSearchQuery);
              }).toList();

              if (filtered.isEmpty) {
                return Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.sentiment_dissatisfied, size: 48, color: Colors.grey),
                      const SizedBox(height: 12),
                      const Text('Không tìm thấy hồ sơ người quá cố', style: TextStyle(color: Colors.black54)),
                      const SizedBox(height: 12),
                      ElevatedButton(
                        onPressed: () => ref.invalidate(deceasedProfilesProvider),
                        child: const Text('Làm mới danh sách'),
                      ),
                    ],
                  ),
                );
              }

              return RefreshIndicator(
                onRefresh: () async {
                  ref.invalidate(deceasedProfilesProvider);
                  await ref.read(deceasedProfilesProvider.future);
                },
                child: ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: filtered.length,
                  itemBuilder: (context, index) {
                    final d = filtered[index];
                    final cert = d.deathCertificate;

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
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        d.fullName,
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                                      ),
                                      Text(
                                        'Mã: ${d.deceasedCode} · Giới tính: ${d.gender == "MALE" ? "Nam" : d.gender == "FEMALE" ? "Nữ" : "Khác"}',
                                        style: const TextStyle(fontSize: 11, color: Colors.black54),
                                      ),
                                    ],
                                  ),
                                ),
                                // G07 Precision tag
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: d.birthDatePrecision == 'YEAR_ONLY'
                                        ? const Color(0xFFFEF3C7)
                                        : const Color(0xFFF1F5F9),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    d.birthDatePrecision == 'YEAR_ONLY'
                                        ? 'Năm sinh: ${d.birthYear}'
                                        : 'Sinh: ${d.dateOfBirth ?? "---"}',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: d.birthDatePrecision == 'YEAR_ONLY'
                                          ? const Color(0xFF92400E)
                                          : const Color(0xFF334155),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Mất ngày: ${d.dateOfDeath} ${d.hometown != null ? "· Quê: ${d.hometown!}" : ""}',
                              style: const TextStyle(fontSize: 12, color: Colors.black87),
                            ),
                            if (d.burialSlot != null) ...[
                              const SizedBox(height: 6),
                              Row(
                                children: [
                                  const Icon(Icons.place, size: 14, color: Color(0xFF24594D)),
                                  const SizedBox(width: 4),
                                  Text(
                                    '${d.burialSlot!.zoneName} · Ô ${d.burialSlot!.plotCode} (Huyệt ${d.burialSlot!.slotNumber})',
                                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF24594D)),
                                  ),
                                  if (d.burialSlot!.isKimTinh) ...[
                                    const SizedBox(width: 6),
                                    const Text('· [Kim Tĩnh]', style: TextStyle(fontSize: 11, color: Color(0xFFD97706), fontWeight: FontWeight.bold)),
                                  ],
                                ],
                              ),
                            ],
                            const SizedBox(height: 10),
                            // G08 Death Certificate Verification Status
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: cert == null
                                    ? const Color(0xFFF3F4F6)
                                    : cert.isVerified
                                        ? const Color(0xFFF0FDF4)
                                        : (cert.rejectionReason != null
                                            ? const Color(0xFFFEF2F2)
                                            : const Color(0xFFFFFBEB)),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                  color: cert == null
                                      ? const Color(0xFFE5E7EB)
                                      : cert.isVerified
                                          ? const Color(0xFFBBF7D0)
                                          : (cert.rejectionReason != null
                                              ? const Color(0xFFFECACA)
                                              : const Color(0xFFFDE68A)),
                                ),
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    cert == null
                                        ? Icons.info_outline
                                        : cert.isVerified
                                            ? Icons.check_circle
                                            : (cert.rejectionReason != null ? Icons.cancel : Icons.pending),
                                    size: 16,
                                    color: cert == null
                                        ? Colors.grey
                                        : cert.isVerified
                                            ? const Color(0xFF16A34A)
                                            : (cert.rejectionReason != null ? Colors.red : const Color(0xFFD97706)),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      cert == null
                                          ? 'Chưa nộp giấy báo tử (Yêu cầu bổ sung trước khi an táng)'
                                          : cert.isVerified
                                              ? 'Giấy báo tử ĐÃ XÁC THỰC: Số ${cert.certificateNumber} (${cert.issuingAuthority})'
                                              : (cert.rejectionReason != null
                                                  ? 'Giấy báo tử BỊ TỪ CHỐI: ${cert.rejectionReason}'
                                                  : 'Giấy báo tử CHỜ DUYỆT: Số ${cert.certificateNumber}'),
                                      style: TextStyle(
                                        fontSize: 11.5,
                                        fontWeight: FontWeight.w600,
                                        color: cert == null
                                            ? Colors.black54
                                            : cert.isVerified
                                                ? const Color(0xFF15803D)
                                                : (cert.rejectionReason != null ? Colors.red : const Color(0xFFB45309)),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
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
                  Text('Đang tải hồ sơ an táng & giấy báo tử...'),
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
                      'Lỗi tải hồ sơ an táng: $err',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.red, fontSize: 13),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: () => ref.invalidate(deceasedProfilesProvider),
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
