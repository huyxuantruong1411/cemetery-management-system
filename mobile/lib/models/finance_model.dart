class ReceivableBriefModel {
  final int receivableId;
  final int? contractId;
  final String? contractCode;
  final int? annexId;
  final String? annexCode;
  final int installmentNo;
  final double originalAmount;
  final double discountAmount;
  final double finalPayableAmount;
  final double paidAmount;
  final double remainingBalance;
  final String status;
  final String? dueDate;
  final String createdAt;
  final int paymentsCount;
  final String? notes;

  ReceivableBriefModel({
    required this.receivableId,
    this.contractId,
    this.contractCode,
    this.annexId,
    this.annexCode,
    required this.installmentNo,
    required this.originalAmount,
    required this.discountAmount,
    required this.finalPayableAmount,
    required this.paidAmount,
    required this.remainingBalance,
    required this.status,
    this.dueDate,
    required this.createdAt,
    required this.paymentsCount,
    this.notes,
  });

  factory ReceivableBriefModel.fromJson(Map<String, dynamic> json) {
    return ReceivableBriefModel(
      receivableId: json['receivable_id'] as int? ?? 0,
      contractId: json['contract_id'] as int?,
      contractCode: json['contract_code'] as String?,
      annexId: json['annex_id'] as int?,
      annexCode: json['annex_code'] as String?,
      installmentNo: json['installment_no'] as int? ?? 1,
      originalAmount: (json['original_amount'] as num?)?.toDouble() ?? 0.0,
      discountAmount: (json['discount_amount'] as num?)?.toDouble() ?? 0.0,
      finalPayableAmount: (json['final_payable_amount'] as num?)?.toDouble() ?? 0.0,
      paidAmount: (json['paid_amount'] as num?)?.toDouble() ?? 0.0,
      remainingBalance: (json['remaining_balance'] as num?)?.toDouble() ?? 0.0,
      status: json['status'] as String? ?? 'UNPAID',
      dueDate: json['due_date'] as String?,
      createdAt: json['created_at'] as String? ?? '',
      paymentsCount: json['payments_count'] as int? ?? 0,
      notes: json['notes'] as String?,
    );
  }
}

class FinanceSummaryModel {
  final int totalReceivables;
  final double totalOriginalAmount;
  final double totalDiscountAmount;
  final double totalPayableAmount;
  final double totalCollectedAmount;
  final double totalOutstandingAmount;
  final int unpaidCount;
  final int partiallyPaidCount;
  final int paidCount;
  final int overdueCount;

  FinanceSummaryModel({
    required this.totalReceivables,
    required this.totalOriginalAmount,
    required this.totalDiscountAmount,
    required this.totalPayableAmount,
    required this.totalCollectedAmount,
    required this.totalOutstandingAmount,
    required this.unpaidCount,
    required this.partiallyPaidCount,
    required this.paidCount,
    required this.overdueCount,
  });

  factory FinanceSummaryModel.fromJson(Map<String, dynamic> json) {
    return FinanceSummaryModel(
      totalReceivables: json['total_receivables'] as int? ?? 0,
      totalOriginalAmount: (json['total_original_amount'] as num?)?.toDouble() ?? 0.0,
      totalDiscountAmount: (json['total_discount_amount'] as num?)?.toDouble() ?? 0.0,
      totalPayableAmount: (json['total_payable_amount'] as num?)?.toDouble() ?? 0.0,
      totalCollectedAmount: (json['total_collected_amount'] as num?)?.toDouble() ?? 0.0,
      totalOutstandingAmount: (json['total_outstanding_amount'] as num?)?.toDouble() ?? 0.0,
      unpaidCount: json['unpaid_count'] as int? ?? 0,
      partiallyPaidCount: json['partially_paid_count'] as int? ?? 0,
      paidCount: json['paid_count'] as int? ?? 0,
      overdueCount: json['overdue_count'] as int? ?? 0,
    );
  }
}
