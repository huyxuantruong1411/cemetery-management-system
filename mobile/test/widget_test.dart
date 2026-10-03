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
        latitude: 10.776889,
        longitude: 106.700806,
        navigationGuidance: 'Khu Khu A - Dãy A1 - Lô A1-01 (Slot 1)',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=10.776889,106.700806',
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
    expect(find.textContaining('10.776889'), findsWidgets);
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

  testWidgets('CemeteryMobileApp construction tab unauthenticated prompt test', (WidgetTester tester) async {
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
                version: '0.10.0',
                environment: 'test',
              )),
        ],
        child: const CemeteryMobileApp(),
      ),
    );

    await tester.pumpAndSettle();

    // Tap the Thi Công tab
    await tester.tap(find.text('Thi Công'));
    await tester.pumpAndSettle();

    // Verify unauthenticated card is shown
    expect(find.text('Yêu Cầu Đăng Nhập Quản Trang'), findsOneWidget);
    expect(find.text('Đăng nhập ngay'), findsOneWidget);
  });

  testWidgets('CemeteryMobileApp construction tab authenticated displays orders and opens checklist sheet test', (WidgetTester tester) async {
    final fakeUser = UserModel(
      userId: 1,
      username: 'quan_trang',
      fullName: 'Trần Văn Quản Trang',
      email: 'quantrang@nghiatrang.vn',
      roles: ['QUAN_TRANG'],
      permissions: ['construction:read', 'construction:execute'],
    );

    final fakeOrders = [
      ConstructionOrderModel(
        orderId: 1,
        orderCode: 'CT-202610-0001',
        annexId: 1,
        plotId: 10,
        plotCode: 'A1-01',
        zoneName: 'Khu A',
        supervisorId: 1,
        supervisorName: 'Trần Văn Quản Trang',
        startDate: '2026-10-01',
        expectedEndDate: '2026-10-15',
        actualEndDate: null,
        status: 'IN_PROGRESS',
        notes: 'Thi công kim tĩnh chuẩn',
        tasksCount: 2,
        completedTasksCount: 1,
        progressPercent: 50,
        tasks: [
          ConstructionTaskBriefModel(
            taskId: 1,
            orderId: 1,
            taskName: 'Đào móng kim tĩnh',
            status: 'DONE',
            isRequired: true,
            sortOrder: 1,
            evidenceCount: 2,
            notes: 'Đã chụp ảnh đáy móng',
          ),
          ConstructionTaskBriefModel(
            taskId: 2,
            orderId: 1,
            taskName: 'Đổ bê tông thành mộ',
            status: 'TODO',
            isRequired: true,
            sortOrder: 2,
            evidenceCount: 0,
            notes: null,
          ),
        ],
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
                version: '0.10.0',
                environment: 'test',
              )),
          authProvider.overrideWith(() => _FakeAuthNotifier(fakeUser)),
          constructionOrdersProvider.overrideWith((ref) async => fakeOrders),
        ],
        child: const CemeteryMobileApp(),
      ),
    );

    await tester.pumpAndSettle();

    // Tap the Thi Công tab
    await tester.tap(find.text('Thi Công'));
    await tester.pumpAndSettle();

    // Verify order is rendered
    expect(find.text('CT-202610-0001'), findsOneWidget);
    expect(find.text('Đang thi công'), findsWidgets);
    expect(find.text('G11 Minh chứng'), findsOneWidget);
    expect(find.textContaining('Tiến độ: 50%'), findsOneWidget);

    // Tap order card to open details sheet
    await tester.tap(find.text('CT-202610-0001'));
    await tester.pumpAndSettle();

    // Verify task checklist items
    expect(find.text('Hạng Mục Công Việc & Minh Chứng (G11)'), findsOneWidget);
    expect(find.text('Đào móng kim tĩnh'), findsOneWidget);
    expect(find.text('2 ảnh'), findsOneWidget);
    expect(find.text('Bắt buộc'), findsWidgets);

    // Scroll to see remaining tasks
    await tester.drag(find.text('Đào móng kim tĩnh'), const Offset(0, -200));
    await tester.pumpAndSettle();
    expect(find.text('Đổ bê tông thành mộ'), findsOneWidget);
  });

  testWidgets('CemeteryMobileApp care tab unauthenticated prompt test', (WidgetTester tester) async {
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
                version: '0.11.0',
                environment: 'test',
              )),
        ],
        child: const CemeteryMobileApp(),
      ),
    );

    await tester.pumpAndSettle();

    // Tap the Chăm Sóc tab
    await tester.tap(find.text('Chăm Sóc'));
    await tester.pumpAndSettle();

    // Verify unauthenticated card is shown
    expect(find.text('Yêu Cầu Đăng Nhập Chăm Sóc'), findsOneWidget);
    expect(find.text('Đăng nhập ngay'), findsOneWidget);
  });

  testWidgets('CemeteryMobileApp care tab authenticated displays schedules and opens checklist sheet test', (WidgetTester tester) async {
    final fakeUser = UserModel(
      userId: 2,
      username: 'caretaker_2',
      fullName: 'Lê Văn Chăm Sóc',
      email: 'chamsoc@nghiatrang.vn',
      roles: ['CARETAKER'],
      permissions: ['care:read', 'care:execute'],
    );

    final fakeSchedules = [
      CareScheduleModel(
        scheduleId: 101,
        careAnnexId: 5,
        plotId: 20,
        plotCode: 'B2-05',
        zoneName: 'Khu B',
        packageId: 1,
        packageName: 'Gói Chăm Sóc Toàn Diện',
        caretakerId: 2,
        caretakerName: 'Lê Văn Chăm Sóc',
        scheduledDate: '2026-10-15',
        performedDate: null,
        status: 'IN_PROGRESS',
        periodKey: '2026-M10',
        notes: 'Chăm sóc định kỳ rằm tháng 10',
        closedAt: null,
        tasksCount: 2,
        completedTasksCount: 1,
        evidenceCount: 1,
        checklistItems: [
          CareChecklistItemModel(
            itemId: 11,
            scheduleId: 101,
            taskDescription: 'Dọn sạch cỏ dại xung quanh mộ',
            isRequired: true,
            sortOrder: 1,
            isCompleted: true,
            fieldNotes: 'Đã cắt cỏ sạch sẽ',
          ),
          CareChecklistItemModel(
            itemId: 12,
            scheduleId: 101,
            taskDescription: 'Lau chùi bia đá và thắp hương',
            isRequired: true,
            sortOrder: 2,
            isCompleted: false,
            fieldNotes: null,
          ),
        ],
        mediaEvidences: [
          CareMediaEvidenceModel(
            evidenceId: 50,
            scheduleId: 101,
            fileId: 'file_care_test_01',
            caption: 'Ảnh sau dọn cỏ',
            uploadedAt: '2026-10-15T08:30:00Z',
          ),
        ],
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
                version: '0.11.0',
                environment: 'test',
              )),
          authProvider.overrideWith(() => _FakeAuthNotifier(fakeUser)),
          careSchedulesProvider.overrideWith((ref) async => fakeSchedules),
        ],
        child: const CemeteryMobileApp(),
      ),
    );

    await tester.pumpAndSettle();

    // Tap the Chăm Sóc tab
    await tester.tap(find.text('Chăm Sóc'));
    await tester.pumpAndSettle();

    // Verify schedule card is rendered
    expect(find.text('#101'), findsOneWidget);
    expect(find.text('2026-M10'), findsOneWidget);
    expect(find.text('Đang làm'), findsWidgets);
    expect(find.text('Gói Chăm Sóc Toàn Diện'), findsOneWidget);
    expect(find.text('1/2'), findsOneWidget);

    // Tap schedule card to open details sheet
    await tester.tap(find.text('#101'));
    await tester.pumpAndSettle();

    // Verify checklist items in sheet
    expect(find.text('Hạng Mục Công Việc & Minh Chứng (G12)'), findsOneWidget);
    expect(find.text('Dọn sạch cỏ dại xung quanh mộ'), findsOneWidget);
    expect(find.text('Bắt buộc'), findsWidgets);

    // Scroll to see second item
    await tester.drag(find.text('Dọn sạch cỏ dại xung quanh mộ'), const Offset(0, -150));
    await tester.pumpAndSettle();
    expect(find.text('Lau chùi bia đá và thắp hương'), findsOneWidget);
  });

  testWidgets('CemeteryMobileApp finance tab unauthenticated prompt test', (WidgetTester tester) async {
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
                version: '0.12.0',
                environment: 'test',
              )),
        ],
        child: const CemeteryMobileApp(),
      ),
    );

    await tester.pumpAndSettle();

    // Tap the Tài Chính tab
    await tester.tap(find.text('Tài Chính'));
    await tester.pumpAndSettle();

    // Verify unauthenticated prompt
    expect(find.text('Yêu Cầu Xác Thực Kế Toán / Nhân Viên'), findsOneWidget);
    expect(find.text('Đăng nhập ngay'), findsOneWidget);
  });

  testWidgets('CemeteryMobileApp finance tab authenticated renders data test', (WidgetTester tester) async {
    final fakeUser = UserModel(
      userId: 5,
      username: 'accountant',
      fullName: 'Trần Thị Thu Ngân',
      email: 'accountant@nghiatrang.vn',
      roles: ['ACCOUNTANT'],
      permissions: ['finance:read', 'finance:write'],
    );

    final fakeReceivable = ReceivableBriefModel(
      receivableId: 201,
      contractId: 10,
      contractCode: 'HD-2026-001',
      annexId: null,
      annexCode: null,
      installmentNo: 1,
      originalAmount: 50000000.0,
      discountAmount: 2000000.0,
      finalPayableAmount: 48000000.0,
      paidAmount: 20000000.0,
      remainingBalance: 28000000.0,
      status: 'PARTIALLY_PAID',
      dueDate: '2026-11-01',
      createdAt: '2026-10-04T00:00:00Z',
      paymentsCount: 1,
      notes: 'Thanh toán đợt 1',
    );

    final fakeSummary = FinanceSummaryModel(
      totalReceivables: 1,
      totalOriginalAmount: 50000000.0,
      totalDiscountAmount: 2000000.0,
      totalPayableAmount: 48000000.0,
      totalCollectedAmount: 20000000.0,
      totalOutstandingAmount: 28000000.0,
      unpaidCount: 0,
      partiallyPaidCount: 1,
      paidCount: 0,
      overdueCount: 0,
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
                version: '0.12.0',
                environment: 'test',
              )),
          authProvider.overrideWith(() => _FakeAuthNotifier(fakeUser)),
          receivablesProvider.overrideWith((ref) async => [fakeReceivable]),
          financeSummaryProvider.overrideWith((ref) async => fakeSummary),
        ],
        child: const CemeteryMobileApp(),
      ),
    );

    await tester.pumpAndSettle();

    // Tap the Tài Chính tab
    await tester.tap(find.text('Tài Chính'));
    await tester.pumpAndSettle();

    // Verify header and card
    expect(find.text('Sổ Cái Công Nợ & Thu Tiền (M11)'), findsOneWidget);
    expect(find.text('HĐ: HD-2026-001'), findsOneWidget);
    expect(find.text('Đợt 1'), findsOneWidget);
    expect(find.text('Thu 1 phần'), findsWidgets);
    expect(find.text('48.000.000 đ'), findsWidgets);
    expect(find.text('28.000.000 đ'), findsWidgets);
    expect(find.text('1 lượt thu'), findsOneWidget);

    // Tap receivable card to open details sheet
    await tester.tap(find.text('HĐ: HD-2026-001'));
    await tester.pumpAndSettle();

    // Verify detail sheet content
    expect(find.text('Khoản Phải Thu #201'), findsOneWidget);
    expect(find.text('Quy Tắc Quản Trị Tài Chính (G14, G15, G16)'), findsOneWidget);
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
