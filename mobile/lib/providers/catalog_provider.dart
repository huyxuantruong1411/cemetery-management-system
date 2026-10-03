import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/catalog_model.dart';
import 'api_provider.dart';
import 'auth_provider.dart';

final priceListsProvider = FutureProvider.autoDispose<List<PriceListModel>>((ref) async {
  final authState = ref.watch(authProvider);
  if (!authState.isAuthenticated) {
    return [];
  }
  final dio = ref.watch(dioProvider);
  final res = await dio.get(
    '/catalog/price-lists',
    options: Options(headers: {'Authorization': 'Bearer ${authState.accessToken}'}),
  );
  final list = res.data as List<dynamic>;
  return list.map((item) => PriceListModel.fromJson(item as Map<String, dynamic>)).toList();
});

final carePackagesProvider = FutureProvider.autoDispose<List<CarePackageModel>>((ref) async {
  final authState = ref.watch(authProvider);
  if (!authState.isAuthenticated) {
    return [];
  }
  final dio = ref.watch(dioProvider);
  final res = await dio.get(
    '/catalog/care-packages',
    options: Options(headers: {'Authorization': 'Bearer ${authState.accessToken}'}),
  );
  final list = res.data as List<dynamic>;
  return list.map((item) => CarePackageModel.fromJson(item as Map<String, dynamic>)).toList();
});
