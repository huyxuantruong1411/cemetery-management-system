import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/profiles_provider.dart';

class PublicMemorialView extends ConsumerStatefulWidget {
  const PublicMemorialView({super.key});

  @override
  ConsumerState<PublicMemorialView> createState() => _PublicMemorialViewState();
}

class _PublicMemorialViewState extends ConsumerState<PublicMemorialView> {
  late final TextEditingController _memorialSearchController;

  @override
  void initState() {
    super.initState();
    _memorialSearchController = TextEditingController(text: 'Nguyễn');
  }

  @override
  void dispose() {
    _memorialSearchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final memorialResultsAsync = ref.watch(memorialSearchResultsProvider);
    final currentQuery = ref.watch(memorialSearchQueryProvider);

    return Column(
      children: [
        // Search header bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          color: Colors.white,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextField(
                controller: _memorialSearchController,
                decoration: InputDecoration(
                  hintText: 'Nhập họ tên người quá cố (tối thiểu 2 ký tự)...',
                  prefixIcon: const Icon(Icons.search, color: Color(0xFF24594D)),
                  suffixIcon: _memorialSearchController.text.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear, size: 18),
                          onPressed: () {
                            _memorialSearchController.clear();
                            ref.read(memorialSearchQueryProvider.notifier).setQuery('');
                          },
                        )
                      : null,
                  isDense: true,
                  filled: true,
                  fillColor: const Color(0xFFF3F4F6),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide.none,
                  ),
                ),
                onSubmitted: (val) {
                  ref.read(memorialSearchQueryProvider.notifier).setQuery(val.trim());
                },
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  const Text('Gợi ý tìm kiếm:', style: TextStyle(fontSize: 11, color: Colors.black54)),
                  const SizedBox(width: 8),
                  Wrap(
                    spacing: 6,
                    children: ['Nguyễn', 'Trần', 'Lê', 'A1'].map((tag) {
                      return InkWell(
                        onTap: () {
                          _memorialSearchController.text = tag;
                          ref.read(memorialSearchQueryProvider.notifier).setQuery(tag);
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: currentQuery == tag ? const Color(0xFF24594D) : const Color(0xFFE2E8F0),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            tag,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                              color: currentQuery == tag ? Colors.white : const Color(0xFF334155),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ),
            ],
          ),
        ),

        // Privacy assurance banner
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          color: const Color(0xFFEFF6FF),
          child: const Row(
            children: [
              Icon(Icons.shield_outlined, size: 14, color: Color(0xFF1D4ED8)),
              SizedBox(width: 6),
              Expanded(
                child: Text(
                  'Cổng tra cứu công khai: Bảo mật tuyệt đối danh tính thân nhân & số CCCD/SĐT (Zero PII).',
                  style: TextStyle(fontSize: 10.5, color: Color(0xFF1E40AF)),
                ),
              ),
            ],
          ),
        ),

        // Results view
        Expanded(
          child: memorialResultsAsync.when(
            data: (results) {
              if (results.isEmpty) {
                return Center(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.person_search, size: 48, color: Colors.grey),
                        const SizedBox(height: 12),
                        const Text(
                          'Không tìm thấy hồ sơ tưởng niệm phù hợp',
                          style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.black87),
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'Vui lòng thử lại với từ khóa khác hoặc nhập ít nhất 2 ký tự họ tên.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.black54, fontSize: 12),
                        ),
                        const SizedBox(height: 16),
                        ElevatedButton(
                          onPressed: () {
                            _memorialSearchController.text = 'Nguyễn';
                            ref.read(memorialSearchQueryProvider.notifier).setQuery('Nguyễn');
                          },
                          child: const Text('Xem danh sách mẫu'),
                        ),
                      ],
                    ),
                  ),
                );
              }

              return RefreshIndicator(
                onRefresh: () async {
                  ref.invalidate(memorialSearchResultsProvider);
                  await ref.read(memorialSearchResultsProvider.future);
                },
                child: ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: results.length,
                  itemBuilder: (context, index) {
                    final item = results[index];
                    return Card(
                      elevation: 0,
                      margin: const EdgeInsets.only(bottom: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: const BorderSide(color: Color(0xFFE2E8F0)),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(14.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(6),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF24594D).withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: const Icon(Icons.local_florist, color: Color(0xFF24594D), size: 18),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        item.fullName,
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                                      ),
                                      Text(
                                        'Mã quá cố: ${item.deceasedCode}',
                                        style: const TextStyle(fontSize: 11, color: Colors.black45),
                                      ),
                                    ],
                                  ),
                                ),
                                if (item.isKimTinh)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFFEF3C7),
                                      borderRadius: BorderRadius.circular(4),
                                      border: Border.all(color: const Color(0xFFFCD34D)),
                                    ),
                                    child: const Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(Icons.shield, color: Color(0xFFD97706), size: 12),
                                        SizedBox(width: 3),
                                        Text(
                                          'Kim Tĩnh',
                                          style: TextStyle(
                                            fontSize: 10,
                                            fontWeight: FontWeight.bold,
                                            color: Color(0xFF92400E),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                              ],
                            ),
                            const Divider(height: 18),
                            Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        'Sinh - Mất: ${item.yearOfBirth ?? "---"} - ${item.dateOfDeath}',
                                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
                                      ),
                                      if (item.hometown != null)
                                        Text(
                                          'Quê quán: ${item.hometown}',
                                          style: const TextStyle(fontSize: 11, color: Colors.black54),
                                        ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF0FDF4),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: const Color(0xFFBBF7D0)),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      const Icon(Icons.place, size: 16, color: Color(0xFF15803D)),
                                      const SizedBox(width: 6),
                                      Expanded(
                                        child: Text(
                                          item.navigationGuidance ??
                                              (item.plotCode != null
                                                  ? 'Nơi an táng: ${item.zoneName ?? ""} · Lô ${item.plotCode} · Hàng ${item.rowCode ?? ""} (Huyệt ${item.slotNumber ?? 1})'
                                                  : 'Nơi an táng: Chưa phân bổ huyệt mộ chính thức'),
                                          style: const TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w600,
                                            color: Color(0xFF166534),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  if (item.latitude != null && item.longitude != null) ...[
                                    const SizedBox(height: 4),
                                    Row(
                                      children: [
                                        const Icon(Icons.near_me, size: 14, color: Color(0xFF15803D)),
                                        const SizedBox(width: 6),
                                        Expanded(
                                          child: Text(
                                            'Tọa độ GPS: ${item.latitude!.toStringAsFixed(6)}, ${item.longitude!.toStringAsFixed(6)}',
                                            style: const TextStyle(fontSize: 11, color: Color(0xFF166534)),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
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
                  Text('Đang tra cứu dữ liệu tưởng niệm công khai...'),
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
                      'Lỗi kết nối tra cứu tưởng niệm: $err',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.red, fontSize: 13),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: () => ref.invalidate(memorialSearchResultsProvider),
                      icon: const Icon(Icons.refresh, size: 16),
                      label: const Text('Thử lại'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
