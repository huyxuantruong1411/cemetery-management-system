class CareChecklistItemModel {
  final int itemId;
  final int scheduleId;
  final String taskDescription;
  final bool isRequired;
  final int sortOrder;
  final bool isCompleted;
  final String? fieldNotes;

  CareChecklistItemModel({
    required this.itemId,
    required this.scheduleId,
    required this.taskDescription,
    required this.isRequired,
    required this.sortOrder,
    required this.isCompleted,
    this.fieldNotes,
  });

  factory CareChecklistItemModel.fromJson(Map<String, dynamic> json) {
    return CareChecklistItemModel(
      itemId: json['item_id'] as int? ?? 0,
      scheduleId: json['schedule_id'] as int? ?? 0,
      taskDescription: json['task_description'] as String? ?? '',
      isRequired: json['is_required'] as bool? ?? true,
      sortOrder: json['sort_order'] as int? ?? 0,
      isCompleted: json['is_completed'] as bool? ?? false,
      fieldNotes: json['field_notes'] as String?,
    );
  }
}

class CareMediaEvidenceModel {
  final int evidenceId;
  final int scheduleId;
  final String? fileId;
  final String? mediaUrl;
  final String? caption;
  final String uploadedAt;

  CareMediaEvidenceModel({
    required this.evidenceId,
    required this.scheduleId,
    this.fileId,
    this.mediaUrl,
    this.caption,
    required this.uploadedAt,
  });

  factory CareMediaEvidenceModel.fromJson(Map<String, dynamic> json) {
    return CareMediaEvidenceModel(
      evidenceId: json['evidence_id'] as int? ?? 0,
      scheduleId: json['schedule_id'] as int? ?? 0,
      fileId: json['file_id'] as String?,
      mediaUrl: json['media_url'] as String?,
      caption: json['caption'] as String?,
      uploadedAt: json['uploaded_at'] as String? ?? '',
    );
  }
}

class CareScheduleModel {
  final int scheduleId;
  final int careAnnexId;
  final int plotId;
  final String? plotCode;
  final String? zoneName;
  final int packageId;
  final String? packageName;
  final int? caretakerId;
  final String? caretakerName;
  final String scheduledDate;
  final String? performedDate;
  final String status;
  final String? periodKey;
  final String? notes;
  final String? closedAt;
  final int tasksCount;
  final int completedTasksCount;
  final int evidenceCount;
  final List<CareChecklistItemModel> checklistItems;
  final List<CareMediaEvidenceModel> mediaEvidences;

  CareScheduleModel({
    required this.scheduleId,
    required this.careAnnexId,
    required this.plotId,
    this.plotCode,
    this.zoneName,
    required this.packageId,
    this.packageName,
    this.caretakerId,
    this.caretakerName,
    required this.scheduledDate,
    this.performedDate,
    required this.status,
    this.periodKey,
    this.notes,
    this.closedAt,
    required this.tasksCount,
    required this.completedTasksCount,
    required this.evidenceCount,
    required this.checklistItems,
    required this.mediaEvidences,
  });

  factory CareScheduleModel.fromJson(Map<String, dynamic> json) {
    final rawItems = json['checklist_items'] as List<dynamic>? ?? [];
    final rawEvidences = json['media_evidences'] as List<dynamic>? ?? [];
    return CareScheduleModel(
      scheduleId: json['schedule_id'] as int? ?? 0,
      careAnnexId: json['care_annex_id'] as int? ?? 0,
      plotId: json['plot_id'] as int? ?? 0,
      plotCode: json['plot_code'] as String?,
      zoneName: json['zone_name'] as String?,
      packageId: json['package_id'] as int? ?? 0,
      packageName: json['package_name'] as String?,
      caretakerId: json['caretaker_id'] as int?,
      caretakerName: json['caretaker_name'] as String?,
      scheduledDate: json['scheduled_date'] as String? ?? '',
      performedDate: json['performed_date'] as String?,
      status: json['status'] as String? ?? 'SCHEDULED',
      periodKey: json['period_key'] as String?,
      notes: json['notes'] as String?,
      closedAt: json['closed_at'] as String?,
      tasksCount: json['tasks_count'] as int? ?? 0,
      completedTasksCount: json['completed_tasks_count'] as int? ?? 0,
      evidenceCount: json['evidence_count'] as int? ?? 0,
      checklistItems: rawItems
          .map((i) => CareChecklistItemModel.fromJson(i as Map<String, dynamic>))
          .toList(),
      mediaEvidences: rawEvidences
          .map((e) => CareMediaEvidenceModel.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}
