class UserModel {
  final int userId;
  final String username;
  final String fullName;
  final String email;
  final List<String> roles;
  final List<String> permissions;

  UserModel({
    required this.userId,
    required this.username,
    required this.fullName,
    required this.email,
    required this.roles,
    required this.permissions,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    final rolesList = (json['roles'] as List<dynamic>?)
            ?.map((r) => (r as Map<String, dynamic>)['role_name'] as String)
            .toList() ??
        [];
    final permsList = (json['permissions'] as List<dynamic>?)
            ?.map((p) => p.toString())
            .toList() ??
        [];
    return UserModel(
      userId: json['user_id'] as int? ?? 0,
      username: json['username'] as String? ?? '',
      fullName: json['full_name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      roles: rolesList,
      permissions: permsList,
    );
  }
}

class AuthState {
  final UserModel? user;
  final String? accessToken;
  final String? refreshToken;
  final bool isLoading;
  final String? errorMessage;

  const AuthState({
    this.user,
    this.accessToken,
    this.refreshToken,
    this.isLoading = false,
    this.errorMessage,
  });

  bool get isAuthenticated => user != null && accessToken != null;

  bool hasRole(String role) =>
      user?.roles.any((r) => r.toUpperCase() == role.toUpperCase()) ?? false;

  bool hasPermission(String perm) =>
      user?.permissions.any((p) => p.toLowerCase() == perm.toLowerCase()) ?? false;

  AuthState copyWith({
    UserModel? user,
    String? accessToken,
    String? refreshToken,
    bool? isLoading,
    String? errorMessage,
    bool clearUser = false,
  }) {
    return AuthState(
      user: clearUser ? null : (user ?? this.user),
      accessToken: clearUser ? null : (accessToken ?? this.accessToken),
      refreshToken: clearUser ? null : (refreshToken ?? this.refreshToken),
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
    );
  }
}
