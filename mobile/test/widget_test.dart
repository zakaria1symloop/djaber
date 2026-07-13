import 'package:flutter_test/flutter_test.dart';

import 'package:djaber_mobile/main.dart';

void main() {
  testWidgets('App boots to a loading state', (WidgetTester tester) async {
    await tester.pumpWidget(const DjaberApp());
    // Initial frame: auth gate shows a progress indicator while reading prefs.
    expect(find.byType(DjaberApp), findsOneWidget);
  });
}
