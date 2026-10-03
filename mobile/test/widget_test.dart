import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/main.dart';

void main() {
  testWidgets('CemeteryMobileApp initial render smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          readinessProvider.overrideWith((ref) async => SystemReadiness(
                status: 'ready',
                database: 'Database connected',
                storage: 'Storage connected',
                timestamp: '2026-10-03T12:00:00Z',
              )),
          versionProvider.overrideWith((ref) async => SystemVersion(
                appName: 'Hệ thống Quản lý Nghĩa trang',
                version: '0.2.0',
                environment: 'test',
              )),
        ],
        child: const CemeteryMobileApp(),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('QL Nghĩa Trang Tư Nhân'), findsOneWidget);
    expect(find.text('Ứng dụng Quản trang & Hiện trường'), findsOneWidget);
    expect(find.text('SQL Server 2022 (DESKTOP-HKIPI1M)'), findsOneWidget);
    expect(find.text('MinIO S3 Storage'), findsOneWidget);
  });

  testWidgets('CemeteryMobileApp catalog tab unauthenticated prompt test', (WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          readinessProvider.overrideWith((ref) async => SystemReadiness(
                status: 'ready',
                database: 'Database connected',
                storage: 'Storage connected',
                timestamp: '2026-10-03T12:00:00Z',
              )),
          versionProvider.overrideWith((ref) async => SystemVersion(
                appName: 'Hệ thống Quản lý Nghĩa trang',
                version: '0.2.0',
                environment: 'test',
              )),
        ],
        child: const CemeteryMobileApp(),
      ),
    );

    await tester.pumpAndSettle();

    // Tap the catalog tab
    await tester.tap(find.text('Bảng Giá & Gói CS'));
    await tester.pumpAndSettle();

    // Verify unauthenticated card is shown
    expect(find.text('Yêu Cầu Xác Thực Nhân Viên'), findsOneWidget);
    expect(find.text('Đăng nhập ngay'), findsOneWidget);
  });

  testWidgets('CemeteryMobileApp catalog tab authenticated renders data test', (WidgetTester tester) async {
    final fakeUser = UserModel(
      userId: 1,
      username: 'marketing',
      fullName: 'Nguyễn Văn Kinh Doanh',
      email: 'marketing@nghiatrang.vn',
      roles: ['MARKETING'],
      permissions: ['catalog:read', 'care:read'],
    );

    final fakePriceList = PriceListModel(
      priceListId: 1,
      priceListName: 'Bảng giá niêm yết 2026',
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      isActive: true,
      items: [
        PriceItemModel(
          priceItemId: 1,
          priceListId: 1,
          itemName: 'Đất huyệt mộ tiêu chuẩn Khu A',
          unit: 'Lô',
          unitPrice: 50000000.0,
          isActive: true,
          serviceCode: 'PLOT-STD-A',
        ),
      ],
    );

    final fakeCarePackage = CarePackageModel(
      packageId: 1,
      packageName: 'Chăm sóc Tiêu chuẩn',
      cycleType: 'MONTHLY',
      periodMonths: 12,
      price: 6000000.0,
      description: 'Gói chăm sóc cảnh quan và thắp hương định kỳ',
      taskList: ['Dọn cỏ', 'Lau bia mộ', 'Thắp hương rằm'],
      isActive: true,
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          readinessProvider.overrideWith((ref) async => SystemReadiness(
                status: 'ready',
                database: 'Database connected',
                storage: 'Storage connected',
                timestamp: '2026-10-03T12:00:00Z',
              )),
          versionProvider.overrideWith((ref) async => SystemVersion(
                appName: 'Hệ thống Quản lý Nghĩa trang',
                version: '0.2.0',
                environment: 'test',
              )),
          authProvider.overrideWith(() => _FakeAuthNotifier(fakeUser)),
          priceListsProvider.overrideWith((ref) async => [fakePriceList]),
          carePackagesProvider.overrideWith((ref) async => [fakeCarePackage]),
        ],
        child: const CemeteryMobileApp(),
      ),
    );

    await tester.pumpAndSettle();

    // Verify user info is visible on home tab
    expect(find.text('Nguyễn Văn Kinh Doanh'), findsOneWidget);

    // Switch to Catalog tab
    await tester.tap(find.text('Bảng Giá & Gói CS'));
    await tester.pumpAndSettle();

    // Verify Price List is displayed
    expect(find.text('Bảng giá niêm yết 2026'), findsOneWidget);
    expect(find.text('Đất huyệt mộ tiêu chuẩn Khu A'), findsOneWidget);
    expect(find.text('50.000.000 đ'), findsOneWidget);

    // Switch to Care Packages sub-tab
    await tester.tap(find.text('Gói Chăm Sóc Định Kỳ'));
    await tester.pumpAndSettle();

    // Verify Care Package is displayed
    expect(find.text('Chăm sóc Tiêu chuẩn'), findsOneWidget);
    expect(find.text('6.000.000 đ'), findsOneWidget);
    expect(find.text('Dọn cỏ'), findsOneWidget);
  });

  testWidgets('CemeteryMobileApp plots tab unauthenticated prompt test', (WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          readinessProvider.overrideWith((ref) async => SystemReadiness(
                status: 'ready',
                database: 'Database connected',
                storage: 'Storage connected',
                timestamp: '2026-10-03T12:00:00Z',
              )),
          versionProvider.overrideWith((ref) async => SystemVersion(
                appName: 'Hệ thống Quản lý Nghĩa trang',
                version: '0.2.0',
                environment: 'test',
              )),
        ],
        child: const CemeteryMobileApp(),
      ),
    );

    await tester.pumpAndSettle();

    // Tap the Sơ Đồ Ô Mộ tab
    await tester.tap(find.text('Sơ Đồ Ô Mộ'));
    await tester.pumpAndSettle();

    // Verify unauthenticated card is shown
    expect(find.text('Tra Cứu Ô Mộ & Thực Địa'), findsOneWidget);
    expect(find.text('Đăng nhập ngay'), findsOneWidget);
  });

  testWidgets('CemeteryMobileApp plots tab authenticated renders plots & opens detail test', (WidgetTester tester) async {
    final fakeUser = UserModel(
      userId: 1,
      username: 'quan_trang',
      fullName: 'Trần Văn Quản Trang',
      email: 'quantrang@nghiatrang.vn',
      roles: ['QUAN_TRANG'],
      permissions: ['plots:read', 'plots:write'],
    );

    final fakePlots = [
      PlotModel(
        plotId: 101,
        plotCode: 'A1-01',
        rowCode: 'A1',
        zoneCode: 'KHU-A',
        zoneName: 'Khu A',
        typeName: 'Mộ Đơn Tiêu Chuẩn',
        defaultSlots: 1,
        status: 'EMPTY_UNSOLD',
        isKimTinh: true,
        isLocked: false,
        latitude: 10.8231,
        longitude: 106.6297,
        orientation: 'Đông Nam',
        ownerName: null,
      ),
      PlotModel(
        plotId: 102,
        plotCode: 'B1-02',
        rowCode: 'B1',
        zoneCode: 'KHU-B',
        zoneName: 'Khu B',
        typeName: 'Mộ Đôi Kim Tĩnh',
        defaultSlots: 2,
        status: 'RESERVED',
        isKimTinh: true,
        isLocked: false,
        latitude: 10.8235,
        longitude: 106.6300,
        orientation: 'Chính Nam',
        ownerName: 'Lê Văn An',
      ),
    ];

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          readinessProvider.overrideWith((ref) async => SystemReadiness(
                status: 'ready',
                database: 'Database connected',
                storage: 'Storage connected',
                timestamp: '2026-10-03T12:00:00Z',
              )),
          versionProvider.overrideWith((ref) async => SystemVersion(
                appName: 'Hệ thống Quản lý Nghĩa trang',
                version: '0.2.0',
                environment: 'test',
              )),
          authProvider.overrideWith(() => _FakeAuthNotifier(fakeUser)),
          plotsProvider.overrideWith((ref) async => fakePlots),
        ],
        child: const CemeteryMobileApp(),
      ),
    );

    await tester.pumpAndSettle();

    // Switch to Plots tab
    await tester.tap(find.text('Sơ Đồ Ô Mộ'));
    await tester.pumpAndSettle();

    // Verify plots are listed
    expect(find.text('A1-01'), findsOneWidget);
    expect(find.text('Khu A · Mộ Đơn Tiêu Chuẩn'), findsOneWidget);
    expect(find.text('Trống'), findsOneWidget);

    expect(find.text('B1-02'), findsOneWidget);
    expect(find.text('Khu B · Mộ Đôi Kim Tĩnh'), findsOneWidget);
    expect(find.text('Giữ chỗ'), findsOneWidget);

    // Tap on A1-01 to open bottom sheet detail
    await tester.tap(find.text('A1-01'));
    await tester.pumpAndSettle();

    // Verify detail sheet shows plot information
    expect(find.text('Chi tiết ô mộ: A1-01'), findsNothing); // Title is just A1-01 in sheet
    expect(find.text('Kim Tĩnh'), findsWidgets);
    expect(find.text('Đông Nam'), findsOneWidget);
    expect(find.text('10.823100, 106.629700'), findsOneWidget);
  });
}

class _FakeAuthNotifier extends AuthNotifier {
  final UserModel _user;
  _FakeAuthNotifier(this._user);

  @override
  AuthState build() => AuthState(
        user: _user,
        accessToken: 'fake_access_token',
        refreshToken: 'fake_refresh_token',
      );
}
