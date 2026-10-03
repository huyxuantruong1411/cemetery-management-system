import 'package:flutter/material.dart';
import '../../models/construction_model.dart';
import 'construction_detail_sheet.dart';

class ConstructionOrderCard extends StatelessWidget {
  final ConstructionOrderModel order;

  const ConstructionOrderCard({
    super.key,
    required this.order,
  });

  @override
  Widget build(BuildContext context) {
    Color statusColor;
    String statusText;
    switch (order.status) {
      case 'IN_PROGRESS':
        statusColor = const Color(0xFF0284C7);
        statusText = 'Đang thi công';
        break;
      case 'COMPLETED':
        statusColor = const Color(0xFF16A34A);
        statusText = 'Hoàn tất';
        break;
      case 'OVERDUE':
        statusColor = const Color(0xFFDC2626);
        statusText = 'Quá hạn';
        break;
      case 'PENDING':
      default:
        statusColor = const Color(0xFFD97706);
        statusText = 'Chờ thi công';
        break;
    }

    final hasUncompletedRequired = order.tasks.any((t) => t.isRequired && t.status != 'DONE');

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      elevation: 1,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => showConstructionOrderDetailSheet(context, order),
        child: Padding(
          padding: const EdgeInsets.all(14.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    order.orderCode,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                      color: Color(0xFF24594D),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: statusColor.withValues(alpha: 0.3)),
                    ),
                    child: Text(
                      statusText,
                      style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  const Icon(Icons.place_outlined, size: 15, color: Colors.black54),
                  const SizedBox(width: 4),
                  Text(
                    'Ô mộ: ${order.plotCode ?? "Chưa gán"}${order.zoneName != null ? " (${order.zoneName})" : ""}',
                    style: const TextStyle(fontSize: 13, color: Colors.black87),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Tiến độ: ${order.progressPercent}% (${order.completedTasksCount}/${order.tasksCount} việc)',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
                  ),
                  if (hasUncompletedRequired && order.status != 'COMPLETED')
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: const Color(0xFFFDE68A)),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.shield_outlined, size: 11, color: Color(0xFFB45309)),
                          SizedBox(width: 3),
                          Text(
                            'G11 Minh chứng',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFFB45309),
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: order.tasksCount > 0 ? (order.completedTasksCount / order.tasksCount) : 0,
                  backgroundColor: const Color(0xFFE2E8F0),
                  color: order.progressPercent == 100 ? const Color(0xFF16A34A) : const Color(0xFF24594D),
                  minHeight: 6,
                ),
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    order.supervisorName != null ? 'GS: ${order.supervisorName}' : 'Chưa chỉ định GS',
                    style: const TextStyle(fontSize: 11, color: Colors.black54),
                  ),
                  if (order.expectedEndDate != null)
                    Text('Hạn: ${order.expectedEndDate}', style: const TextStyle(fontSize: 11, color: Colors.black54)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
