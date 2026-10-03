import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/auth_provider.dart';
import '../providers/care_provider.dart';
import '../providers/catalog_provider.dart';
import '../providers/construction_provider.dart';
import '../providers/contracts_provider.dart';
import '../providers/finance_provider.dart';
import '../providers/plots_provider.dart';
import '../providers/profiles_provider.dart';
import '../providers/system_provider.dart';
import 'care/care_tab.dart';
import 'catalog/catalog_tab.dart';
import 'construction/construction_tab.dart';
import 'contracts/contracts_tab.dart';
import 'dialogs/login_dialog.dart';
import 'finance/finance_tab.dart';
import 'home/home_tab.dart';
import 'plots/plots_tab.dart';
import 'profiles/profiles_tab.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  int _currentTabIndex = 0;

  @override
  Widget build(BuildContext context) {
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
              onPressed: () => showLoginDialog(context),
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
                ref.invalidate(contractsProvider);
                ref.invalidate(constructionOrdersProvider);
                ref.invalidate(careSchedulesProvider);
                ref.invalidate(receivablesProvider);
                ref.invalidate(financeSummaryProvider);
              }
              ref.invalidate(memorialSearchResultsProvider);
            },
          ),
        ],
      ),
      body: IndexedStack(
        index: _currentTabIndex,
        children: const [
          HomeTab(),
          PlotsTab(),
          CatalogTab(),
          ProfilesTab(),
          ContractsTab(),
          ConstructionTab(),
          CareTab(),
          FinanceTab(),
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
          BottomNavigationBarItem(
            icon: Icon(Icons.description_outlined),
            activeIcon: Icon(Icons.description),
            label: 'Hợp Đồng',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.handyman_outlined),
            activeIcon: Icon(Icons.handyman),
            label: 'Thi Công',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.cleaning_services_outlined),
            activeIcon: Icon(Icons.cleaning_services),
            label: 'Chăm Sóc',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.payments_outlined),
            activeIcon: Icon(Icons.payments),
            label: 'Tài Chính',
          ),
        ],
      ),
    );
  }
}
