// API Base URL configuration: can be overridden via --dart-define=API_BASE_URL=...
const String defaultApiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:8000/api/v1',
);

// Currency helper
String formatVnd(num amount) {
  final str = amount.round().toString();
  final regExp = RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))');
  final formatted = str.replaceAllMapped(regExp, (Match m) => '${m[1]}.');
  return '$formatted đ';
}
