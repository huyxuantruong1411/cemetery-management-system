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
