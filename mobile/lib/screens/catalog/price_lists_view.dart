import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/config.dart';
import '../../providers/catalog_provider.dart';

class PriceListsView extends ConsumerWidget {
  const PriceListsView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final priceListsAsync = ref.watch(priceListsProvider);

    return priceListsAsync.when(
      data: (priceLists) {
        if (priceLists.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.inventory_2_outlined, size: 48, color: Colors.grey),
                const SizedBox(height: 12),
                const Text('Chưa có bảng giá nào hiệu lực', style: TextStyle(color: Colors.black54)),
                const SizedBox(height: 12),
                ElevatedButton(
                  onPressed: () => ref.invalidate(priceListsProvider),
                  child: const Text('Làm mới'),
                ),
              ],
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(priceListsProvider);
            await ref.read(priceListsProvider.future);
          },
          child: ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: priceLists.length,
            itemBuilder: (context, index) {
              final pl = priceLists[index];
              return Card(
                elevation: 0,
                margin: const EdgeInsets.only(bottom: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: const BorderSide(color: Color(0xFFE5E7EB)),
                ),
                child: ExpansionTile(
                  leading: const Icon(Icons.receipt_long, color: Color(0xFF24594D)),
                  title: Text(
                    pl.priceListName,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                  subtitle: Text(
                    'Hiệu lực: ${pl.effectiveFrom} ${pl.effectiveTo != null ? "-> ${pl.effectiveTo!}" : "(Đang áp dụng)"}',
                    style: const TextStyle(fontSize: 12, color: Colors.black54),
                  ),
                  trailing: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: pl.isActive ? const Color(0xFFDCFCE7) : const Color(0xFFF3F4F6),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      pl.isActive ? 'Áp dụng' : 'Khóa',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: pl.isActive ? const Color(0xFF166534) : Colors.black45,
                      ),
                    ),
                  ),
                  initiallyExpanded: index == 0,
                  children: [
                    const Divider(height: 1),
                    if (pl.items.isEmpty)
                      const Padding(
                        padding: EdgeInsets.all(16.0),
                        child: Text(
                          'Chưa có khoản mục giá chi tiết',
                          style: TextStyle(color: Colors.black38, fontSize: 13),
                        ),
                      )
                    else
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: pl.items.length,
                        separatorBuilder: (context, _) => const Divider(height: 1, indent: 16, endIndent: 16),
                        itemBuilder: (context, iIdx) {
                          final item = pl.items[iIdx];
                          return ListTile(
                            dense: true,
                            title: Text(
                              item.itemName,
                              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                            ),
                            subtitle: Text(
                              'Đơn vị: ${item.unit} ${item.serviceCode != null ? "· Mã: ${item.serviceCode!}" : ""}',
                              style: const TextStyle(fontSize: 11, color: Colors.black54),
                            ),
                            trailing: Text(
                              formatVnd(item.unitPrice),
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF24594D),
                                fontSize: 13,
                              ),
                            ),
                          );
                        },
                      ),
                  ],
                ),
              );
            },
          ),
        );
      },
      loading: () => const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(color: Color(0xFF24594D)),
            SizedBox(height: 12),
            Text('Đang tải danh mục bảng giá...'),
          ],
        ),
      ),
      error: (err, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 40, color: Colors.red),
              const SizedBox(height: 12),
              Text(
                'Lỗi tải bảng giá: $err',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.red, fontSize: 13),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: () => ref.invalidate(priceListsProvider),
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text('Thử lại'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
