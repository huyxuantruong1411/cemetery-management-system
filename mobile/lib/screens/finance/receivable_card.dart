import 'package:flutter/material.dart';
import '../../core/config.dart';
import '../../models/finance_model.dart';
import 'receivable_detail_sheet.dart';

class ReceivableCard extends StatelessWidget {
  final ReceivableBriefModel item;

  const ReceivableCard({
    super.key,
    required this.item,
  });

  @override
  Widget build(BuildContext context) {
    Color statusColor;
    String statusText;
    switch (item.status) {
      case 'PAID':
        statusColor = const Color(0xFF16A34A);
        statusText = 'Đã thu xong';
        break;
      case 'PARTIALLY_PAID':
        statusColor = const Color(0xFF2563EB);
        statusText = 'Thu 1 phần';
        break;
      case 'OVERDUE':
        statusColor = const Color(0xFFDC2626);
        statusText = 'Quá hạn';
        break;
      case 'UNPAID':
      default:
        statusColor = const Color(0xFFD97706);
        statusText = 'Chưa thanh toán';
        break;
    }

    final sourceLabel = item.contractCode != null
        ? 'HĐ: ${item.contractCode}'
        : 'Phụ lục: ${item.annexCode ?? "#${item.annexId}"}';

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      elevation: 1,
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: () => showReceivableDetailSheet(context, item),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFF24594D).withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            'Đợt ${item.installmentNo}',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF24594D),
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            sourceLabel,
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      statusText,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: statusColor,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Phải thu thực tế:', style: TextStyle(fontSize: 11, color: Colors.black54)),
                      Text(
                        formatVnd(item.finalPayableAmount),
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      const Text('Còn nợ:', style: TextStyle(fontSize: 11, color: Colors.black54)),
                      Text(
                        formatVnd(item.remainingBalance),
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: item.remainingBalance > 0 ? const Color(0xFFDC2626) : const Color(0xFF16A34A),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const Divider(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Hạn TT: ${item.dueDate ?? "Không thời hạn"}',
                    style: const TextStyle(fontSize: 11, color: Colors.black54),
                  ),
                  Text(
                    '${item.paymentsCount} lượt thu',
                    style: const TextStyle(
                      fontSize: 11,
                      color: Color(0xFF24594D),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
