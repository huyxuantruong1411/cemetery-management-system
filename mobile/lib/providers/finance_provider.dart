import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/finance_model.dart';
import 'api_provider.dart';
import 'auth_provider.dart';

final receivablesProvider = FutureProvider.autoDispose<List<ReceivableBriefModel>>((ref) async {
  final authState = ref.watch(authProvider);
  if (!authState.isAuthenticated) {
    return [];
  }
  final dio = ref.watch(dioProvider);
  final res = await dio.get(
    '/finance/receivables',
    options: Options(headers: {'Authorization': 'Bearer ${authState.accessToken}'}),
  );
  final list = res.data as List<dynamic>;
  return list.map((item) => ReceivableBriefModel.fromJson(item as Map<String, dynamic>)).toList();
});

final financeSummaryProvider = FutureProvider.autoDispose<FinanceSummaryModel?>((ref) async {
  final authState = ref.watch(authProvider);
  if (!authState.isAuthenticated) {
    return null;
  }
  final dio = ref.watch(dioProvider);
  final res = await dio.get(
    '/finance/summary',
    options: Options(headers: {'Authorization': 'Bearer ${authState.accessToken}'}),
  );
  return FinanceSummaryModel.fromJson(res.data as Map<String, dynamic>);
});
