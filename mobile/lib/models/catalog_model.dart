class PriceItemModel {
  final int priceItemId;
  final int priceListId;
  final String itemName;
  final String unit;
  final double unitPrice;
  final bool isActive;
  final int? zoneId;
  final int? plotTypeId;
  final int? packageId;
  final String? serviceCode;

  PriceItemModel({
    required this.priceItemId,
    required this.priceListId,
    required this.itemName,
    required this.unit,
    required this.unitPrice,
    required this.isActive,
    this.zoneId,
    this.plotTypeId,
    this.packageId,
    this.serviceCode,
  });

  factory PriceItemModel.fromJson(Map<String, dynamic> json) {
    return PriceItemModel(
      priceItemId: json['price_item_id'] as int? ?? 0,
      priceListId: json['price_list_id'] as int? ?? 0,
      itemName: json['item_name'] as String? ?? '',
      unit: json['unit'] as String? ?? '',
      unitPrice: (json['unit_price'] as num?)?.toDouble() ?? 0.0,
      isActive: json['is_active'] as bool? ?? true,
      zoneId: json['zone_id'] as int?,
      plotTypeId: json['plot_type_id'] as int?,
      packageId: json['package_id'] as int?,
      serviceCode: json['service_code'] as String?,
    );
  }
}

class PriceListModel {
  final int priceListId;
  final String priceListName;
  final String effectiveFrom;
  final String? effectiveTo;
  final bool isActive;
  final List<PriceItemModel> items;

  PriceListModel({
    required this.priceListId,
    required this.priceListName,
    required this.effectiveFrom,
    this.effectiveTo,
    required this.isActive,
    required this.items,
  });

  factory PriceListModel.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List<dynamic>? ?? [];
    return PriceListModel(
      priceListId: json['price_list_id'] as int? ?? 0,
      priceListName: json['price_list_name'] as String? ?? '',
      effectiveFrom: json['effective_from'] as String? ?? '',
      effectiveTo: json['effective_to'] as String?,
      isActive: json['is_active'] as bool? ?? true,
      items: rawItems
          .map((i) => PriceItemModel.fromJson(i as Map<String, dynamic>))
          .toList(),
    );
  }
}

class CarePackageModel {
  final int packageId;
  final String packageName;
  final String cycleType;
  final int periodMonths;
  final double price;
  final String? description;
  final List<String> taskList;
  final bool isActive;

  CarePackageModel({
    required this.packageId,
    required this.packageName,
    required this.cycleType,
    required this.periodMonths,
    required this.price,
    this.description,
    required this.taskList,
    required this.isActive,
  });

  factory CarePackageModel.fromJson(Map<String, dynamic> json) {
    final tasks = (json['task_list'] as List<dynamic>?)
            ?.map((e) => e.toString())
            .toList() ??
        [];
    return CarePackageModel(
      packageId: json['package_id'] as int? ?? 0,
      packageName: json['package_name'] as String? ?? '',
      cycleType: json['cycle_type'] as String? ?? '',
      periodMonths: json['period_months'] as int? ?? 1,
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      description: json['description'] as String?,
      taskList: tasks,
      isActive: json['is_active'] as bool? ?? true,
    );
  }
}
