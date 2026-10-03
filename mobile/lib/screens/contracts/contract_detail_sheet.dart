import 'package:flutter/material.dart';
import '../../core/config.dart';
import '../../core/widgets/detail_row.dart';
import '../../models/contract_model.dart';

String getContractTypeName(String type) {
  switch (type) {
    case 'LAND_PURCHASE':
      return 'Mua Bán Quyền Sử Dụng Đất';
    case 'EXHUMATION':
      return 'Cải Táng / Cất Bốc Hài Cốt';
    case 'TRANSFER':
      return 'Chuyển Nhượng Quyền Sử Dụng Đất';
    case 'CREMATION':
      return 'Hỏa Táng Trọn Gói';
    case 'SERVICE':
    default:
      return 'Dịch Vụ Nghĩa Trang';
  }
}

String getContractTypeShort(String type) {
  switch (type) {
    case 'LAND_PURCHASE':
      return 'Mua Đất';
    case 'EXHUMATION':
      return 'Cải Táng';
    case 'TRANSFER':
      return 'Chuyển Nhượng';
    case 'CREMATION':
      return 'Hỏa Táng';
    case 'SERVICE':
    default:
      return 'Dịch Vụ';
  }
}

void showContractDetailsSheet(BuildContext context, ContractBriefModel item) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
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
                  item.contractCode,
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
            DetailRow(label: 'Loại hợp đồng', value: getContractTypeName(item.contractType)),
            DetailRow(label: 'Trạng thái', value: item.status),
            DetailRow(label: 'Khách hàng', value: item.customerName),
            DetailRow(label: 'Số điện thoại', value: item.customerPhone),
            if (item.plotCode != null) DetailRow(label: 'Mã ô mộ', value: item.plotCode!),
            if (item.zoneName != null) DetailRow(label: 'Khu mộ', value: item.zoneName!),
            DetailRow(label: 'Tổng số tiền', value: formatVnd(item.totalAmount)),
            if (item.signedAt != null) DetailRow(label: 'Ngày ký', value: item.signedAt!),
            if (item.activatedAt != null) DetailRow(label: 'Ngày kích hoạt', value: item.activatedAt!),
            const SizedBox(height: 20),
          ],
        ),
      );
    },
  );
}
