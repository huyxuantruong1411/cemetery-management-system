class PlotModel {
  final int plotId;
  final String plotCode;
  final String rowCode;
  final String zoneCode;
  final String zoneName;
  final String typeName;
  final int defaultSlots;
  final String status;
  final bool isKimTinh;
  final bool isLocked;
  final double? latitude;
  final double? longitude;
  final String? orientation;
  final String? ownerName;

  PlotModel({
    required this.plotId,
    required this.plotCode,
    required this.rowCode,
    required this.zoneCode,
    required this.zoneName,
    required this.typeName,
    required this.defaultSlots,
    required this.status,
    required this.isKimTinh,
    required this.isLocked,
    this.latitude,
    this.longitude,
    this.orientation,
    this.ownerName,
  });

  factory PlotModel.fromJson(Map<String, dynamic> json) {
    return PlotModel(
      plotId: json['plot_id'] as int? ?? 0,
      plotCode: json['plot_code'] as String? ?? '',
      rowCode: json['row_code'] as String? ?? '',
      zoneCode: json['zone_code'] as String? ?? '',
      zoneName: json['zone_name'] as String? ?? '',
      typeName: json['type_name'] as String? ?? '',
      defaultSlots: json['default_slots'] as int? ?? 1,
      status: json['status'] as String? ?? 'EMPTY_UNSOLD',
      isKimTinh: json['is_kim_tinh'] as bool? ?? false,
      isLocked: json['is_locked'] as bool? ?? false,
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      orientation: json['orientation'] as String?,
      ownerName: json['owner_name'] as String?,
    );
  }
}
