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

    // Let the futures settle
    await tester.pumpAndSettle();

    // Verify UI renders title and cards
    expect(find.text('QL Nghĩa Trang Tư Nhân'), findsOneWidget);
    expect(find.text('Ứng dụng Quản trang & Hiện trường'), findsOneWidget);
    expect(find.text('SQL Server 2022 (DESKTOP-HKIPI1M)'), findsOneWidget);
    expect(find.text('MinIO S3 Storage'), findsOneWidget);
  });
}
