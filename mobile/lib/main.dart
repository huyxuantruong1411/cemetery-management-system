import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme.dart';
import 'screens/dashboard_screen.dart';

// Exports for modular consumer usage, submodules & widget tests
export 'core/config.dart';
export 'core/theme.dart';
export 'core/widgets/custom_filter_chip.dart';
export 'core/widgets/detail_row.dart';
export 'core/widgets/kpi_card.dart';
export 'core/widgets/unauthenticated_card.dart';
export 'models/auth_model.dart';
export 'models/care_model.dart';
export 'models/catalog_model.dart';
export 'models/construction_model.dart';
export 'models/contract_model.dart';
export 'models/finance_model.dart';
export 'models/plot_model.dart';
export 'models/profile_model.dart';
export 'models/system_model.dart';
export 'providers/api_provider.dart';
export 'providers/auth_provider.dart';
export 'providers/care_provider.dart';
export 'providers/catalog_provider.dart';
export 'providers/construction_provider.dart';
export 'providers/contracts_provider.dart';
export 'providers/finance_provider.dart';
export 'providers/plots_provider.dart';
export 'providers/profiles_provider.dart';
export 'providers/system_provider.dart';
export 'screens/care/care_schedule_card.dart';
export 'screens/care/care_schedule_sheet.dart';
export 'screens/care/care_tab.dart';
export 'screens/catalog/care_packages_view.dart';
export 'screens/catalog/catalog_tab.dart';
export 'screens/catalog/price_lists_view.dart';
export 'screens/construction/construction_detail_sheet.dart';
export 'screens/construction/construction_order_card.dart';
export 'screens/construction/construction_tab.dart';
export 'screens/contracts/contract_card.dart';
export 'screens/contracts/contract_detail_sheet.dart';
export 'screens/contracts/contracts_tab.dart';
export 'screens/dashboard_screen.dart';
export 'screens/dialogs/login_dialog.dart';
export 'screens/finance/finance_tab.dart';
export 'screens/finance/receivable_card.dart';
export 'screens/finance/receivable_detail_sheet.dart';
export 'screens/home/home_tab.dart';
export 'screens/plots/plot_detail_sheet.dart';
export 'screens/plots/plots_tab.dart';
export 'screens/profiles/customers_view.dart';
export 'screens/profiles/deceased_profiles_view.dart';
export 'screens/profiles/profiles_tab.dart';
export 'screens/profiles/public_memorial_view.dart';

void main() {
  runApp(
    const ProviderScope(
      child: CemeteryMobileApp(),
    ),
  );
}

class CemeteryMobileApp extends StatelessWidget {
  const CemeteryMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Quản Lý Nghĩa Trang',
      debugShowCheckedModeBanner: false,
      theme: appTheme,
      home: const DashboardScreen(),
    );
  }
}
