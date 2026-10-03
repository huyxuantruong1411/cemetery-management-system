class ConstructionTaskBriefModel {
  final int taskId;
  final int orderId;
  final String taskName;
  final String status;
  final bool isRequired;
  final int sortOrder;
  final String? startDate;
  final String? dueDate;
  final int evidenceCount;
  final String? notes;

  ConstructionTaskBriefModel({
    required this.taskId,
    required this.orderId,
    required this.taskName,
    required this.status,
    required this.isRequired,
    required this.sortOrder,
    this.startDate,
    this.dueDate,
    required this.evidenceCount,
    this.notes,
  });

  factory ConstructionTaskBriefModel.fromJson(Map<String, dynamic> json) {
    return ConstructionTaskBriefModel(
      taskId: json['task_id'] as int? ?? 0,
      orderId: json['order_id'] as int? ?? 0,
      taskName: json['task_name'] as String? ?? '',
      status: json['status'] as String? ?? 'TODO',
      isRequired: json['is_required'] as bool? ?? false,
      sortOrder: json['sort_order'] as int? ?? 0,
      startDate: json['start_date'] as String?,
      dueDate: json['due_date'] as String?,
      evidenceCount: json['evidence_count'] as int? ?? 0,
      notes: json['notes'] as String?,
    );
  }
}

class ConstructionOrderModel {
  final int orderId;
  final String orderCode;
  final int annexId;
  final int plotId;
  final String? plotCode;
  final String? zoneName;
  final int? supervisorId;
  final String? supervisorName;
  final String? startDate;
  final String? expectedEndDate;
  final String? actualEndDate;
  final String status;
  final String? notes;
  final int tasksCount;
  final int completedTasksCount;
  final int progressPercent;
  final List<ConstructionTaskBriefModel> tasks;

  ConstructionOrderModel({
    required this.orderId,
    required this.orderCode,
    required this.annexId,
    required this.plotId,
    this.plotCode,
    this.zoneName,
    this.supervisorId,
    this.supervisorName,
    this.startDate,
    this.expectedEndDate,
    this.actualEndDate,
    required this.status,
    this.notes,
    required this.tasksCount,
    required this.completedTasksCount,
    required this.progressPercent,
    required this.tasks,
  });

  factory ConstructionOrderModel.fromJson(Map<String, dynamic> json) {
    final rawTasks = json['tasks'] as List<dynamic>? ?? [];
    return ConstructionOrderModel(
      orderId: json['order_id'] as int? ?? 0,
      orderCode: json['order_code'] as String? ?? '',
      annexId: json['annex_id'] as int? ?? 0,
      plotId: json['plot_id'] as int? ?? 0,
      plotCode: json['plot_code'] as String?,
      zoneName: json['zone_name'] as String?,
      supervisorId: json['supervisor_id'] as int?,
      supervisorName: json['supervisor_name'] as String?,
      startDate: json['start_date'] as String?,
      expectedEndDate: json['expected_end_date'] as String?,
      actualEndDate: json['actual_end_date'] as String?,
      status: json['status'] as String? ?? 'PENDING',
      notes: json['notes'] as String?,
      tasksCount: json['tasks_count'] as int? ?? 0,
      completedTasksCount: json['completed_tasks_count'] as int? ?? 0,
      progressPercent: json['progress_percent'] as int? ?? 0,
      tasks: rawTasks
          .map((t) => ConstructionTaskBriefModel.fromJson(t as Map<String, dynamic>))
          .toList(),
    );
  }
}
