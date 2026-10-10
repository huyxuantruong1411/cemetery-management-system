import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/auth_provider.dart';

void showLoginDialog(BuildContext context) {
  final usernameController = TextEditingController();
  final passwordController = TextEditingController();

  showDialog<void>(
    context: context,
    builder: (ctx) {
      return Consumer(
        builder: (dialogCtx, ref, _) {
          final authState = ref.watch(authProvider);

          return AlertDialog(
            title: const Row(
              children: [
                Icon(Icons.shield, color: Color(0xFF24594D)),
                SizedBox(width: 8),
                Text('Đăng Nhập', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              ],
            ),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextField(
                    controller: usernameController,
                    decoration: const InputDecoration(
                      labelText: 'Tên đăng nhập',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: passwordController,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'Mật khẩu',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                  ),
                  if (authState.errorMessage != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      authState.errorMessage!,
                      style: const TextStyle(color: Colors.red, fontSize: 12),
                    ),
                  ],
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('Hủy'),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF24594D),
                  foregroundColor: Colors.white,
                ),
                onPressed: authState.isLoading
                    ? null
                    : () async {
                        final success = await ref.read(authProvider.notifier).login(
                              usernameController.text.trim(),
                              passwordController.text,
                            );
                        if (success && context.mounted) {
                          Navigator.of(ctx).pop();
                        }
                      },
                child: authState.isLoading
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Đăng nhập'),
              ),
            ],
          );
        },
      );
    },
  );
}
