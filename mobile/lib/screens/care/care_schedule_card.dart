import 'package:flutter/material.dart';
import '../../models/care_model.dart';
import 'care_schedule_sheet.dart';

class CareScheduleCard extends StatelessWidget {
  final CareScheduleModel item;

  const CareScheduleCard({
    super.key,
    required this.item,
  });

  @override
  Widget build(BuildContext context) {
    Color statusColor;
    String statusText;
    switch (item.status) {
      case 'CLOSED':
        statusColor = const Color(0xFF16A34A);
        statusText = 'Đã đóng ca';
        break;
      case 'IN_PROGRESS':
        statusColor = const Color(0xFF0284C7);
        statusText = 'Đang làm';
        break;
      case 'ASSIGNED':
        statusColor = const Color(0xFF6366F1);
        statusText = 'Đã giao việc';
        break;
      case 'OVERDUE':
        statusColor = const Color(0xFFDC2626);
        statusText = 'Quá hạn';
        break;
      case 'SCHEDULED':
      default:
        statusColor = const Color(0xFFD97706);
        statusText = 'Chờ giao';
        break;
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: () => showCareScheduleDetailsSheet(context, item),
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
                        '#${item.scheduleId}',
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
                          item.periodKey ?? 'Định kỳ',
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
                children: [
                  const Icon(Icons.place_outlined, size: 14, color: Colors.black54),
                  const SizedBox(width: 4),
                  Text(
                    '${item.plotCode ?? "Ô mộ #${item.plotId}"} (${item.zoneName ?? "Khu chung"})',
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  const Icon(Icons.spa_outlined, size: 14, color: Colors.black54),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      item.packageName ?? 'Gói tiêu chuẩn',
                      style: const TextStyle(fontSize: 12, color: Colors.black87),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  const Icon(Icons.person_outline, size: 14, color: Colors.black54),
                  const SizedBox(width: 4),
                  Text(
                    item.caretakerName ?? 'Chưa phân công',
                    style: TextStyle(
                      fontSize: 12,
                      color: item.caretakerName != null ? Colors.black87 : Colors.orange.shade800,
                      fontStyle: item.caretakerName == null ? FontStyle.italic : FontStyle.normal,
                    ),
                  ),
                  const Spacer(),
                  Row(
                    children: [
                      const Icon(Icons.checklist, size: 14, color: Colors.black54),
                      const SizedBox(width: 2),
                      Text(
                        '${item.completedTasksCount}/${item.tasksCount}',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(width: 8),
                      const Icon(Icons.photo_camera_outlined, size: 14, color: Colors.black54),
                      const SizedBox(width: 2),
                      Text(
                        '${item.evidenceCount}',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                      ),
                    ],
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
