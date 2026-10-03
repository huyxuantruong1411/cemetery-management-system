import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/plot_model.dart';
import 'api_provider.dart';
import 'auth_provider.dart';

final plotsProvider = FutureProvider.autoDispose<List<PlotModel>>((ref) async {
  final authState = ref.watch(authProvider);
  if (!authState.isAuthenticated) {
    return [];
  }
  final dio = ref.watch(dioProvider);
  final res = await dio.get(
    '/plots?limit=200',
    options: Options(headers: {'Authorization': 'Bearer ${authState.accessToken}'}),
  );
  final list = res.data as List<dynamic>;
  return list.map((item) => PlotModel.fromJson(item as Map<String, dynamic>)).toList();
});
