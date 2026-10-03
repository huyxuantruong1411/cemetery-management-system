import 'package:flutter/material.dart';
import '../../core/widgets/detail_row.dart';
import '../../models/care_model.dart';

void showCareScheduleDetailsSheet(BuildContext context, CareScheduleModel schedule) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (ctx) {
      return DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.4,
        maxChildSize: 0.95,
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
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Ca Chăm Sóc #${schedule.scheduleId}',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF24594D),
                          ),
                        ),
                        Text(
                          'Kỳ: ${schedule.periodKey ?? "Định kỳ"} · Ngày: ${schedule.scheduledDate}',
                          style: const TextStyle(fontSize: 12, color: Colors.black54),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFF24594D).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        schedule.status,
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
                  label: 'Ô Mộ:',
                  value: '${schedule.plotCode ?? "Plot #${schedule.plotId}"} - ${schedule.zoneName ?? ""}',
                ),
                DetailRow(label: 'Gói Dịch Vụ:', value: schedule.packageName ?? 'Tiêu chuẩn'),
                DetailRow(label: 'Người Phụ Trách:', value: schedule.caretakerName ?? 'Chưa chỉ định'),
                if (schedule.closedAt != null)
                  DetailRow(label: 'Đã Đóng Ca:', value: schedule.closedAt!),
                if (schedule.notes != null)
                  DetailRow(label: 'Ghi Chú:', value: schedule.notes!),

                const SizedBox(height: 16),
                const Text(
                  'Hạng Mục Công Việc & Minh Chứng (G12)',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF24594D)),
                ),
                const SizedBox(height: 8),

                if (schedule.checklistItems.isEmpty)
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Text(
                      'Chưa có hạng mục công việc được tạo.',
                      style: TextStyle(color: Colors.black54, fontSize: 13),
                    ),
                  )
                else
                  ...schedule.checklistItems.map((task) {
                    return Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: task.isCompleted ? const Color(0xFFF0FDF4) : const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: task.isCompleted ? const Color(0xFFBBF7D0) : Colors.black12,
                        ),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            task.isCompleted ? Icons.check_circle : Icons.radio_button_unchecked,
                            color: task.isCompleted ? const Color(0xFF16A34A) : Colors.black38,
                            size: 18,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        task.taskDescription,
                                        style: TextStyle(
                                          fontWeight: FontWeight.w600,
                                          fontSize: 13,
                                          decoration: task.isCompleted ? TextDecoration.lineThrough : null,
                                          color: task.isCompleted ? Colors.black54 : Colors.black87,
                                        ),
                                      ),
                                    ),
                                    if (task.isRequired)
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                        margin: const EdgeInsets.only(left: 4),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFFEE2E2),
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: const Text(
                                          'Bắt buộc',
                                          style: TextStyle(
                                            fontSize: 10,
                                            color: Color(0xFFDC2626),
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                                if (task.fieldNotes != null) ...[
                                  const SizedBox(height: 2),
                                  Text(
                                    'Ghi chú: ${task.fieldNotes}',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: Colors.black54,
                                      fontStyle: FontStyle.italic,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
                const SizedBox(height: 20),
              ],
            ),
          );
        },
      );
    },
  );
}
