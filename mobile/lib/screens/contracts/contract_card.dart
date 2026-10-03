import 'package:flutter/material.dart';
import '../../core/config.dart';
import '../../models/contract_model.dart';
import 'contract_detail_sheet.dart';

class ContractCard extends StatelessWidget {
  final ContractBriefModel item;

  const ContractCard({
    super.key,
    required this.item,
  });

  @override
  Widget build(BuildContext context) {
    Color statusColor;
    String statusLabel;
    switch (item.status) {
      case 'DRAFT':
        statusColor = Colors.grey.shade700;
        statusLabel = 'Dự thảo';
        break;
      case 'PENDING_SIGN':
        statusColor = Colors.orange.shade800;
        statusLabel = 'Chờ ký';
        break;
      case 'ACTIVE':
        statusColor = const Color(0xFF16A34A);
        statusLabel = 'Hiệu lực';
        break;
      case 'CANCELLED':
        statusColor = Colors.red.shade700;
        statusLabel = 'Đã hủy';
        break;
      default:
        statusColor = Colors.grey;
        statusLabel = item.status;
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: () => showContractDetailsSheet(context, item),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Text(
                        item.contractCode,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                          color: Color(0xFF24594D),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFE2E8F0),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          getContractTypeShort(item.contractType),
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF334155),
                          ),
                        ),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: statusColor.withValues(alpha: 0.3)),
                    ),
                    child: Text(
                      statusLabel,
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
                children: [
                  const Icon(Icons.person_outline, size: 16, color: Colors.black54),
                  const SizedBox(width: 6),
                  Text(
                    item.customerName,
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                  const SizedBox(width: 8),
                  Text('(${item.customerPhone})', style: const TextStyle(fontSize: 12, color: Colors.black54)),
                ],
              ),
              if (item.plotCode != null) ...[
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(Icons.place_outlined, size: 16, color: Colors.black54),
                    const SizedBox(width: 6),
                    Text(
                      'Ô: ${item.plotCode}${item.zoneName != null ? " (${item.zoneName})" : ""}',
                      style: const TextStyle(fontSize: 13, color: Colors.black87),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 6),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Giá trị: ${formatVnd(item.totalAmount)}',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  const Icon(Icons.chevron_right, size: 18, color: Colors.black38),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
