import 'package:flutter/material.dart';
import 'customers_view.dart';
import 'deceased_profiles_view.dart';
import 'public_memorial_view.dart';

class ProfilesTab extends StatelessWidget {
  const ProfilesTab({super.key});

  @override
  Widget build(BuildContext context) {
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
