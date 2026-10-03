import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/profile_model.dart';
import 'api_provider.dart';
import 'auth_provider.dart';

final customersProvider = FutureProvider.autoDispose<List<CustomerModel>>((ref) async {
  final authState = ref.watch(authProvider);
  if (!authState.isAuthenticated) {
    return [];
  }
  final dio = ref.watch(dioProvider);
  final res = await dio.get(
    '/profiles/customers',
    options: Options(headers: {'Authorization': 'Bearer ${authState.accessToken}'}),
  );
  final list = res.data as List<dynamic>;
  return list.map((item) => CustomerModel.fromJson(item as Map<String, dynamic>)).toList();
});

final deceasedProfilesProvider = FutureProvider.autoDispose<List<DeceasedProfileModel>>((ref) async {
  final authState = ref.watch(authProvider);
  if (!authState.isAuthenticated) {
    return [];
  }
  final dio = ref.watch(dioProvider);
  final res = await dio.get(
    '/profiles/deceased',
    options: Options(headers: {'Authorization': 'Bearer ${authState.accessToken}'}),
  );
  final list = res.data as List<dynamic>;
  return list.map((item) => DeceasedProfileModel.fromJson(item as Map<String, dynamic>)).toList();
});

class MemorialSearchNotifier extends Notifier<String> {
  @override
  String build() => 'Nguyễn';

  void setQuery(String q) {
    state = q;
  }
}

final memorialSearchQueryProvider = NotifierProvider<MemorialSearchNotifier, String>(() {
  return MemorialSearchNotifier();
});

final memorialSearchResultsProvider = FutureProvider.autoDispose<List<MemorialLookupModel>>((ref) async {
  final query = ref.watch(memorialSearchQueryProvider);
  if (query.trim().length < 2) {
    return [];
  }
  final dio = ref.watch(dioProvider);
  final res = await dio.get(
    '/profiles/public/memorials',
    queryParameters: {'q': query.trim()},
  );
  final list = res.data as List<dynamic>;
  return list.map((item) => MemorialLookupModel.fromJson(item as Map<String, dynamic>)).toList();
});
