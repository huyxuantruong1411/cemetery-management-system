import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/widgets/unauthenticated_card.dart';
import '../../providers/auth_provider.dart';
import '../dialogs/login_dialog.dart';
import 'care_packages_view.dart';
import 'price_lists_view.dart';

class CatalogTab extends ConsumerWidget {
  const CatalogTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);

    if (!authState.isAuthenticated) {
      return UnauthenticatedCard(
        icon: Icons.lock_outline,
        title: 'Yêu Cầu Xác Thực Nhân Viên',
        message: 'Vui lòng đăng nhập với vai trò Kinh Doanh, Kế Toán hoặc Quản Trang để tra cứu bảng giá và dịch vụ thực địa.',
        onLoginPressed: () => showLoginDialog(context),
      );
    }

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
          const Expanded(
            child: TabBarView(
              children: [
                PriceListsView(),
                CarePackagesView(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
