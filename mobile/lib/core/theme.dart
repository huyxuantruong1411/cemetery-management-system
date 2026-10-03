import 'package:flutter/material.dart';

const Color brandPrimary = Color(0xFF24594D);
const Color bgPrimary = Color(0xFFF7F8F5);

ThemeData get appTheme => ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: bgPrimary,
      colorScheme: ColorScheme.fromSeed(
        seedColor: brandPrimary,
        primary: brandPrimary,
        surface: Colors.white,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: brandPrimary,
        foregroundColor: Colors.white,
        elevation: 2,
      ),
    );
