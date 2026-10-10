import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/auth_provider.dart';
import 'customers_view.dart';
import 'deceased_profiles_view.dart';
import 'public_memorial_view.dart';

class ProfilesTab extends ConsumerWidget {
  const ProfilesTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);

    // Unauthenticated visitors: strictly limited to Public Memorial Search (Zero PII)
    if (!authState.isAuthenticated) {
      return Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: const Color(0xFFF0FDF4),
            child: const Row(
              children: [
                Icon(Icons.public, color: Color(0xFF16A34A), size: 20),
                SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Tra Cứu Tưởng Niệm',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF166534),
                        ),
                      ),
                      Text(
                        'Cổng thông tin công khai · Bảo vệ quyền riêng tư & không tiết lộ PII',
                        style: TextStyle(
                          fontSize: 11,
                          color: Color(0xFF15803D),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const Expanded(child: PublicMemorialView()),
        ],
      );
    }

    // Authenticated staff: Full access with tabs
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
          const Expanded(
            child: TabBarView(
              children: [
                PublicMemorialView(),
                CustomersView(),
                DeceasedProfilesView(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

