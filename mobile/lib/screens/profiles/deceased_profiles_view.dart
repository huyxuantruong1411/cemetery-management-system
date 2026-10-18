import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/widgets/unauthenticated_card.dart';
import '../../providers/auth_provider.dart';
import '../../providers/profiles_provider.dart';
import '../dialogs/login_dialog.dart';

class DeceasedProfilesView extends ConsumerStatefulWidget {
  const DeceasedProfilesView({super.key});

  @override
  ConsumerState<DeceasedProfilesView> createState() => _DeceasedProfilesViewState();
}

class _DeceasedProfilesViewState extends ConsumerState<DeceasedProfilesView> {
  String _deceasedSearchQuery = '';

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    if (!authState.isAuthenticated) {
      return UnauthenticatedCard(
        icon: Icons.verified_user_outlined,
        title: 'Xác Thực Hồ Sơ An Táng',
        message: 'Xem trạng thái phê duyệt Giấy báo tử và kiểm soát an táng yêu cầu đăng nhập nghiệp vụ.',
        onLoginPressed: () => showLoginDialog(context),
      );
    }

    final deceasedAsync = ref.watch(deceasedProfilesProvider);

    return Column(
      children: [
        // Search bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          color: Colors.white,
          child: TextField(
            decoration: InputDecoration(
              hintText: 'Tìm theo tên, mã người quá cố...',
              prefixIcon: const Icon(Icons.search, size: 20),
              isDense: true,
              filled: true,
              fillColor: const Color(0xFFF3F4F6),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide.none,
              ),
            ),
            onChanged: (val) {
              setState(() {
                _deceasedSearchQuery = val.trim().toLowerCase();
              });
            },
          ),
        ),

        Expanded(
          child: deceasedAsync.when(
            data: (deceasedList) {
              final filtered = deceasedList.where((d) {
                if (_deceasedSearchQuery.isEmpty) return true;
                return d.fullName.toLowerCase().contains(_deceasedSearchQuery) ||
                    d.deceasedCode.toLowerCase().contains(_deceasedSearchQuery);
              }).toList();

              if (filtered.isEmpty) {
                return Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.sentiment_dissatisfied, size: 48, color: Colors.grey),
                      const SizedBox(height: 12),
                      const Text('Không tìm thấy hồ sơ người quá cố', style: TextStyle(color: Colors.black54)),
                      const SizedBox(height: 12),
                      ElevatedButton(
                        onPressed: () => ref.invalidate(deceasedProfilesProvider),
                        child: const Text('Làm mới danh sách'),
                      ),
                    ],
                  ),
                );
              }

              return RefreshIndicator(
                onRefresh: () async {
                  ref.invalidate(deceasedProfilesProvider);
                  await ref.read(deceasedProfilesProvider.future);
                },
                child: ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: filtered.length,
                  itemBuilder: (context, index) {
                    final d = filtered[index];
                    final cert = d.deathCertificate;

                    return Card(
                      elevation: 0,
                      margin: const EdgeInsets.only(bottom: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: const BorderSide(color: Color(0xFFE5E7EB)),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(14.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        d.fullName,
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                                      ),
                                      Text(
                                        'Mã: ${d.deceasedCode} · Giới tính: ${d.gender == "MALE" ? "Nam" : d.gender == "FEMALE" ? "Nữ" : "Khác"}',
                                        style: const TextStyle(fontSize: 11, color: Colors.black54),
                                      ),
                                    ],
                                  ),
                                ),
                                // G07 Precision tag
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: d.birthDatePrecision == 'YEAR_ONLY'
                                        ? const Color(0xFFFEF3C7)
                                        : const Color(0xFFF1F5F9),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    d.birthDatePrecision == 'YEAR_ONLY'
                                        ? 'Năm sinh: ${d.birthYear}'
                                        : 'Sinh: ${d.dateOfBirth ?? "---"}',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: d.birthDatePrecision == 'YEAR_ONLY'
                                          ? const Color(0xFF92400E)
                                          : const Color(0xFF334155),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Mất ngày: ${d.dateOfDeath} ${d.hometown != null ? "· Quê: ${d.hometown!}" : ""}',
                              style: const TextStyle(fontSize: 12, color: Colors.black87),
                            ),
                            if (d.burialSlot != null) ...[
                              const SizedBox(height: 6),
                              Row(
                                children: [
                                  const Icon(Icons.place, size: 14, color: Color(0xFF24594D)),
                                  const SizedBox(width: 4),
                                  Text(
                                    '${d.burialSlot!.zoneName} · Ô ${d.burialSlot!.plotCode} (Huyệt ${d.burialSlot!.slotNumber})',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      color: Color(0xFF24594D),
                                    ),
                                  ),
                                  if (d.burialSlot!.isKimTinh) ...[
                                    const SizedBox(width: 6),
                                    const Text(
                                      '· [Kim Tĩnh]',
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: Color(0xFFD97706),
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ],
                            const SizedBox(height: 10),
                            // G08 Death Certificate Verification Status
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: cert == null
                                    ? const Color(0xFFF3F4F6)
                                    : cert.isVerified
                                        ? const Color(0xFFF0FDF4)
                                        : (cert.rejectionReason != null
                                            ? const Color(0xFFFEF2F2)
                                            : const Color(0xFFFFFBEB)),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                  color: cert == null
                                      ? const Color(0xFFE5E7EB)
                                      : cert.isVerified
                                          ? const Color(0xFFBBF7D0)
                                          : (cert.rejectionReason != null
                                              ? const Color(0xFFFECACA)
                                              : const Color(0xFFFDE68A)),
                                ),
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    cert == null
                                        ? Icons.info_outline
                                        : cert.isVerified
                                            ? Icons.check_circle
                                            : (cert.rejectionReason != null ? Icons.cancel : Icons.pending),
                                    size: 16,
                                    color: cert == null
                                        ? Colors.grey
                                        : cert.isVerified
                                            ? const Color(0xFF16A34A)
                                            : (cert.rejectionReason != null ? Colors.red : const Color(0xFFD97706)),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      cert == null
                                          ? 'Chưa nộp giấy báo tử (Yêu cầu bổ sung trước khi an táng)'
                                          : cert.isVerified
                                              ? 'Giấy báo tử ĐÃ XÁC THỰC: Số ${cert.certificateNumber} (${cert.issuingAuthority})'
                                              : (cert.rejectionReason != null
                                                  ? 'Giấy báo tử BỊ TỪ CHỐI: ${cert.rejectionReason}'
                                                  : 'Giấy báo tử CHỜ DUYỆT: Số ${cert.certificateNumber}'),
                                      style: TextStyle(
                                        fontSize: 11.5,
                                        fontWeight: FontWeight.w600,
                                        color: cert == null
                                            ? Colors.black54
                                            : cert.isVerified
                                                ? const Color(0xFF15803D)
                                                : (cert.rejectionReason != null ? Colors.red : const Color(0xFFB45309)),
                                      ),
                                    ),
                                  ),
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
                  Text('Đang tải hồ sơ an táng & giấy báo tử...'),
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
                      'Lỗi tải hồ sơ an táng: $err',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.red, fontSize: 13),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: () => ref.invalidate(deceasedProfilesProvider),
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
