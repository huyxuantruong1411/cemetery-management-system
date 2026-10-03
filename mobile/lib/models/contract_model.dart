class ContractBriefModel {
  final int contractId;
  final String contractCode;
  final String contractType;
  final String status;
  final num totalAmount;
  final int customerId;
  final String customerName;
  final String customerPhone;
  final int? plotId;
  final String? plotCode;
  final String? zoneName;
  final String? signedAt;
  final String? activatedAt;
  final String createdAt;

  ContractBriefModel({
    required this.contractId,
    required this.contractCode,
    required this.contractType,
    required this.status,
    required this.totalAmount,
    required this.customerId,
    required this.customerName,
    required this.customerPhone,
    this.plotId,
    this.plotCode,
    this.zoneName,
    this.signedAt,
    this.activatedAt,
    required this.createdAt,
  });

  factory ContractBriefModel.fromJson(Map<String, dynamic> json) {
    return ContractBriefModel(
      contractId: json['contract_id'] as int? ?? 0,
      contractCode: json['contract_code'] as String? ?? '',
      contractType: json['contract_type'] as String? ?? 'LAND_PURCHASE',
      status: json['status'] as String? ?? 'DRAFT',
      totalAmount: json['total_amount'] as num? ?? 0,
      customerId: json['customer_id'] as int? ?? 0,
      customerName: json['customer_name'] as String? ?? '',
      customerPhone: json['customer_phone'] as String? ?? '',
      plotId: json['plot_id'] as int?,
      plotCode: json['plot_code'] as String?,
      zoneName: json['zone_name'] as String?,
      signedAt: json['signed_at'] as String?,
      activatedAt: json['activated_at'] as String?,
      createdAt: json['created_at'] as String? ?? '',
    );
  }
}
