import 'package:flutter/material.dart';
import '../../core/config.dart';
import '../../core/widgets/detail_row.dart';
import '../../models/finance_model.dart';

void showReceivableDetailSheet(BuildContext context, ReceivableBriefModel item) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (ctx) {
      return DraggableScrollableSheet(
        initialChildSize: 0.65,
        minChildSize: 0.4,
        maxChildSize: 0.9,
        expand: false,
        builder: (context, scrollController) {
          return SingleChildScrollView(
            controller: scrollController,
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Khoản Phải Thu #${item.receivableId}',
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF24594D),
                            ),
                          ),
                          Text(
                            'Đợt ${item.installmentNo} · Tạo: ${item.createdAt.split("T").first}',
                            style: const TextStyle(fontSize: 12, color: Colors.black54),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFF24594D).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        item.status,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF24594D),
                        ),
                      ),
                    ),
                  ],
                ),
                const Divider(height: 24),

                DetailRow(
                  label: 'Nguồn Phát Sinh (G14):',
                  value: item.contractCode != null
                      ? 'Hợp đồng ${item.contractCode}'
                      : 'Phụ lục hợp đồng ${item.annexCode ?? "#${item.annexId}"}',
                ),
                DetailRow(label: 'Số Tiền Niêm Yết:', value: formatVnd(item.originalAmount)),
                DetailRow(label: 'Chiết Khấu (G16):', value: '- ${formatVnd(item.discountAmount)}'),
                DetailRow(label: 'Phải Thu Thực Tế:', value: formatVnd(item.finalPayableAmount)),
                DetailRow(label: 'Đã Thanh Toán:', value: formatVnd(item.paidAmount)),
                DetailRow(label: 'Số Dư Còn Nợ:', value: formatVnd(item.remainingBalance)),
                if (item.dueDate != null) DetailRow(label: 'Hạn Thanh Toán:', value: item.dueDate!),
                if (item.notes != null) DetailRow(label: 'Ghi Chú:', value: item.notes!),

                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.black12),
                  ),
                  child: const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Quy Tắc Quản Trị Tài Chính (G14, G15, G16)',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                          color: Color(0xFF24594D),
                        ),
                      ),
                      SizedBox(height: 4),
                      Text(
                        '• G14: Nguồn thu chỉ thuộc đúng Hợp đồng hoặc Phụ lục (XOR constraint).\n'
                        '• G15: Phiếu thu là bản ghi chỉ thêm (append-only), chống trùng lặp theo actor và request-key.\n'
                        '• G16: Chiết khấu được kiểm toán chặt chẽ, không thể vượt quá giá trị còn lại.',
                        style: TextStyle(fontSize: 11, color: Colors.black54, height: 1.4),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
              ],
            ),
          );
        },
      );
    },
  );
}
