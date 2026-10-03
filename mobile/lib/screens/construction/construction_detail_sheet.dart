import 'package:flutter/material.dart';
import '../../core/widgets/detail_row.dart';
import '../../models/construction_model.dart';

void showConstructionOrderDetailSheet(BuildContext context, ConstructionOrderModel order) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
    builder: (ctx) {
      return DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.4,
        maxChildSize: 0.95,
        expand: false,
        builder: (_, scrollController) {
          return Padding(
            padding: const EdgeInsets.all(20.0),
            child: ListView(
              controller: scrollController,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      order.orderCode,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF24594D),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
                const Divider(),
                DetailRow(label: 'Mã ô mộ', value: order.plotCode ?? 'Chưa gán'),
                if (order.zoneName != null) DetailRow(label: 'Khu mộ', value: order.zoneName!),
                DetailRow(label: 'Trạng thái', value: order.status),
                DetailRow(
                  label: 'Tiến độ',
                  value: '${order.progressPercent}% (${order.completedTasksCount}/${order.tasksCount} hoàn tất)',
                ),
                if (order.supervisorName != null) DetailRow(label: 'Giám sát viên', value: order.supervisorName!),
                if (order.startDate != null) DetailRow(label: 'Ngày bắt đầu', value: order.startDate!),
                if (order.expectedEndDate != null) DetailRow(label: 'Dự kiến hoàn tất', value: order.expectedEndDate!),
                if (order.actualEndDate != null) DetailRow(label: 'Thực tế hoàn tất', value: order.actualEndDate!),
                if (order.notes != null) DetailRow(label: 'Ghi chú', value: order.notes!),
                const SizedBox(height: 16),
                const Text(
                  'Hạng Mục Công Việc & Minh Chứng (G11)',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF0F172A)),
                ),
                const SizedBox(height: 8),
                if (order.tasks.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12.0),
                    child: Text('Chưa có hạng mục công việc nào', style: TextStyle(color: Colors.black54, fontSize: 13)),
                  )
                else
                  ...order.tasks.map((task) {
                    Color taskStatusColor;
                    String taskStatusText;
                    switch (task.status) {
                      case 'DONE':
                        taskStatusColor = const Color(0xFF16A34A);
                        taskStatusText = 'Hoàn tất';
                        break;
                      case 'DOING':
                        taskStatusColor = const Color(0xFF0284C7);
                        taskStatusText = 'Đang làm';
                        break;
                      case 'TODO':
                      default:
                        taskStatusColor = const Color(0xFF64748B);
                        taskStatusText = 'Chưa làm';
                        break;
                    }

                    return Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 24,
                            height: 24,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: task.status == 'DONE' ? const Color(0xFFDCFCE7) : const Color(0xFFE2E8F0),
                              shape: BoxShape.circle,
                            ),
                            child: Text(
                              '${task.sortOrder}',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: task.status == 'DONE' ? const Color(0xFF16A34A) : const Color(0xFF475569),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        task.taskName,
                                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
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
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: taskStatusColor.withValues(alpha: 0.1),
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(
                                        taskStatusText,
                                        style: TextStyle(
                                          fontSize: 10,
                                          color: taskStatusColor,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Row(
                                      children: [
                                        const Icon(Icons.photo_camera_outlined, size: 13, color: Colors.black54),
                                        const SizedBox(width: 3),
                                        Text(
                                          '${task.evidenceCount} ảnh',
                                          style: const TextStyle(fontSize: 11, color: Colors.black54),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
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
