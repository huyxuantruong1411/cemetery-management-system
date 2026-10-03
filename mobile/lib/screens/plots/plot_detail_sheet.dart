import 'package:flutter/material.dart';
import '../../core/widgets/detail_row.dart';
import '../../models/plot_model.dart';

void showPlotDetailSheet(BuildContext context, PlotModel plot) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) {
      return Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  plot.plotCode,
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                if (plot.isKimTinh)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: const Color(0xFFFCD34D)),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.shield, color: Color(0xFFD97706), size: 14),
                        SizedBox(width: 4),
                        Text(
                          'Kim Tĩnh',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF92400E),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              '${plot.zoneName} · ${plot.rowCode}',
              style: const TextStyle(color: Colors.black54, fontSize: 13),
            ),
            const Divider(height: 24),
            DetailRow(label: 'Loại mộ:', value: plot.typeName),
            DetailRow(label: 'Dung lượng:', value: '${plot.defaultSlots} slot an táng'),
            DetailRow(label: 'Hướng phong thủy:', value: plot.orientation ?? 'Chưa định hướng'),
            DetailRow(label: 'Trạng thái:', value: plot.status),
            if (plot.latitude != null && plot.longitude != null)
              DetailRow(
                label: 'Tọa độ GPS:',
                value: '${plot.latitude!.toStringAsFixed(6)}, ${plot.longitude!.toStringAsFixed(6)}',
              ),
            if (plot.isLocked) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFFECACA)),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.lock, color: Colors.red, size: 18),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Ô mộ Kim Tĩnh đã an táng và khóa vĩnh viễn. Nghiêm cấm cải táng.',
                        style: TextStyle(
                          color: Colors.red,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 20),
          ],
        ),
      );
    },
  );
}
