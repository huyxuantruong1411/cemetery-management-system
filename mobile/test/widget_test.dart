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

  testWidgets('CemeteryMobileApp public memorial lookup renders without auth and displays results test', (WidgetTester tester) async {
    final fakeMemorials = [
      MemorialLookupModel(
        deceasedCode: 'QC-2026-0001',
        fullName: 'Nguyễn Văn Tiên',
        yearOfBirth: 1940,
        dateOfDeath: '2025-11-20',
        hometown: 'Hà Nội',
        zoneName: 'Khu A',
        rowCode: 'A1',
        plotCode: 'A1-01',
        slotNumber: 1,
        isKimTinh: true,
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
          memorialSearchResultsProvider.overrideWith((ref) async => fakeMemorials),
        ],
        child: const CemeteryMobileApp(),
      ),
    );

    await tester.pumpAndSettle();

    // Switch to Profiles & Memorial tab
    await tester.tap(find.text('Hồ Sơ & Tra Cứu'));
    await tester.pumpAndSettle();

    // Verify Public Memorial Tab is shown without needing login
    expect(find.text('Tra Cứu Tưởng Niệm'), findsOneWidget);
    expect(find.text('Nguyễn Văn Tiên'), findsOneWidget);
    expect(find.text('Mã quá cố: QC-2026-0001'), findsOneWidget);
    expect(find.textContaining('A1-01'), findsWidgets);
    expect(find.text('Kim Tĩnh'), findsWidgets);
  });

  testWidgets('CemeteryMobileApp profiles tab authenticated displays customers and deceased with G07/G08 test', (WidgetTester tester) async {
    final fakeUser = UserModel(
      userId: 1,
      username: 'quan_trang',
      fullName: 'Trần Văn Quản Trang',
      email: 'quantrang@nghiatrang.vn',
      roles: ['QUAN_TRANG'],
      permissions: ['profiles:read', 'profiles:write'],
    );

    final fakeCustomers = [
      CustomerModel(
        customerId: 1,
        customerCode: 'KH-2026-0001',
        fullName: 'Nguyễn Văn An',
        citizenId: '001085001234',
        phoneNumber: '0901234567',
        email: 'an.nguyen@example.com',
        address: 'Hà Nội',
        dateOfBirth: '1975-05-15',
        relations: [
          CustomerRelationModel(
            relationId: 1,
            deceasedId: 1,
            deceasedCode: 'QC-2026-0001',
            deceasedFullName: 'Nguyễn Văn Tiên',
            relationshipType: 'Con trai',
            isPrimaryContact: true,
          ),
        ],
      ),
    ];

    final fakeDeceased = [
      DeceasedProfileModel(
        deceasedId: 1,
        deceasedCode: 'QC-2026-0001',
        fullName: 'Nguyễn Văn Tiên',
        gender: 'MALE',
        dateOfBirth: null,
        dateOfDeath: '2025-11-20',
        birthYear: 1940,
        birthDatePrecision: 'YEAR_ONLY',
        hometown: 'Hà Nội',
        religion: 'Không',
        hasDeathCertificate: true,
        deathCertificate: DeathCertificateModel(
          certId: 1,
          certificateNumber: 'GBC-2025-001',
          issuingAuthority: 'UBND Phường Kim Mã',
          issueDate: '2025-11-21',
          isVerified: true,
          verifierName: 'Trần Văn Quản Trang',
        ),
        burialSlot: BurialSlotBriefModel(
          slotId: 1,
          plotId: 101,
          slotNumber: 1,
          plotCode: 'A1-01',
          zoneName: 'Khu A',
          rowCode: 'A1',
          status: 'BURIAL',
          isKimTinh: true,
        ),
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
          customersProvider.overrideWith((ref) async => fakeCustomers),
          deceasedProfilesProvider.overrideWith((ref) async => fakeDeceased),
          memorialSearchResultsProvider.overrideWith((ref) async => []),
        ],
        child: const CemeteryMobileApp(),
      ),
    );

    await tester.pumpAndSettle();

    // Switch to Profiles tab
    await tester.tap(find.text('Hồ Sơ & Tra Cứu'));
    await tester.pumpAndSettle();

    // Switch to Customers sub-tab
    await tester.tap(find.text('Thân Nhân (KH)'));
    await tester.pumpAndSettle();

    expect(find.text('Nguyễn Văn An'), findsOneWidget);
    expect(find.textContaining('001085001234'), findsOneWidget);
    expect(find.textContaining('Con trai'), findsOneWidget);

    // Switch to Deceased sub-tab
    await tester.tap(find.text('Quá Cố & Giấy Báo Tử'));
    await tester.pumpAndSettle();

    expect(find.text('Nguyễn Văn Tiên'), findsOneWidget);
    // G07 precision check
    expect(find.text('Năm sinh: 1940'), findsOneWidget);
    // G08 verified certificate check
    expect(find.textContaining('ĐÃ XÁC THỰC'), findsOneWidget);
  });

  testWidgets('CemeteryMobileApp contracts tab authenticated displays contracts list and opens detail sheet test',
      (WidgetTester tester) async {
    final fakeUser = UserModel(
      userId: 15,
      username: 'marketing',
      fullName: 'Chuyên Viên Kinh Doanh',
      email: 'marketing@nghiatrang.vn',
      roles: ['MARKETING'],
      permissions: ['contracts:read', 'contracts:write'],
    );

    final fakeContracts = [
      ContractBriefModel(
        contractId: 101,
        contractCode: 'HD-MD-2026-0001',
        contractType: 'LAND_PURCHASE',
        status: 'ACTIVE',
        totalAmount: 45000000,
        customerId: 1,
        customerName: 'Nguyễn Văn An',
        customerPhone: '0901234567',
        plotId: 10,
        plotCode: 'A-H01-01',
        zoneName: 'Khu A',
        signedAt: '2026-10-01',
        activatedAt: '2026-10-02T10:00:00Z',
        createdAt: '2026-10-01T08:00:00Z',
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
                version: '0.8.0',
                environment: 'test',
              )),
          authProvider.overrideWith(() => _FakeAuthNotifier(fakeUser)),
          contractsProvider.overrideWith((ref) async => fakeContracts),
        ],
        child: const CemeteryMobileApp(),
      ),
    );

    await tester.pumpAndSettle();

    // Tap the contracts tab
    await tester.tap(find.text('Hợp Đồng'));
    await tester.pumpAndSettle();

    // Verify contract code and customer name are visible
    expect(find.text('HD-MD-2026-0001'), findsOneWidget);
    expect(find.text('Nguyễn Văn An'), findsOneWidget);
    expect(find.text('Hiệu lực'), findsWidgets);

    // Tap contract card to open details sheet
    await tester.tap(find.text('HD-MD-2026-0001'));
    await tester.pumpAndSettle();

    expect(find.text('Mua Bán Quyền Sử Dụng Đất'), findsOneWidget);
    expect(find.text('0901234567'), findsWidgets);
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
