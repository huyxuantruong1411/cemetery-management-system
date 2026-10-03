import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/contract_model.dart';
import 'api_provider.dart';
import 'auth_provider.dart';

final contractsProvider = FutureProvider.autoDispose<List<ContractBriefModel>>((ref) async {
  final authState = ref.watch(authProvider);
  if (!authState.isAuthenticated) {
    return [];
  }
  final dio = ref.watch(dioProvider);
  final res = await dio.get(
    '/contracts?limit=100',
    options: Options(headers: {'Authorization': 'Bearer ${authState.accessToken}'}),
  );
  final list = res.data as List<dynamic>;
  return list.map((item) => ContractBriefModel.fromJson(item as Map<String, dynamic>)).toList();
});
