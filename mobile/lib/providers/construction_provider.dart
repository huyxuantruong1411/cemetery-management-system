import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/construction_model.dart';
import 'api_provider.dart';
import 'auth_provider.dart';

final constructionOrdersProvider = FutureProvider.autoDispose<List<ConstructionOrderModel>>((ref) async {
  final authState = ref.watch(authProvider);
  if (!authState.isAuthenticated) {
    return [];
  }
  final dio = ref.watch(dioProvider);
  final res = await dio.get(
    '/construction/orders',
    options: Options(headers: {'Authorization': 'Bearer ${authState.accessToken}'}),
  );
  final list = res.data as List<dynamic>;
  return list.map((item) => ConstructionOrderModel.fromJson(item as Map<String, dynamic>)).toList();
});
