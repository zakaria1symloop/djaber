// Auto-namespace translation dict for the reports/analytics suite.
// Owns the reports hub/catalog (rep.hub.*, rep.cat.*), the ReportShell chrome
// and the chart-kit fallback strings. Common commerce terms live in
// reports-common.ts under the `rep.c.*` prefix and are reused, not redefined.
export const ReportsHubI18n: { en: Record<string, string>; fr: Record<string, string>; ar: Record<string, string> } = {
  en: {
    // Hub chrome
    'rep.hub.eyebrow': 'Reports',
    'rep.hub.title': 'Reports',
    'rep.hub.subtitle':
      '{count} live reports across finance, sales, inventory and more — every figure in DA, straight from your data.',
    'rep.hub.search': 'Search reports…',
    'rep.hub.searchAria': 'Search reports',
    'rep.hub.requiresSetup': 'Requires setup',
    'rep.hub.noMatches': 'No reports match “{query}”',
    'rep.hub.noMatchesHint': 'Try a different search term.',
    'rep.hub.clearSearch': 'Clear search',

    // Category section labels
    'rep.hub.cat.finance': 'Finance',
    'rep.hub.cat.sales': 'Sales',
    'rep.hub.cat.purchases': 'Purchases',
    'rep.hub.cat.inventory': 'Inventory',
    'rep.hub.cat.customers': 'Customers',
    'rep.hub.cat.suppliers': 'Suppliers',

    // ReportShell chrome
    'rep.hub.shell.back': 'Reports',

    // Chart-kit fallbacks (empty states / bucket labels)
    'rep.hub.chart.noData': 'No data yet',
    'rep.hub.chart.rowsHint': 'Rows will appear here as data comes in.',
    'rep.hub.chart.columnsHint': 'Columns will appear here as data comes in.',
    'rep.hub.chart.trendHint': 'The trend line will appear here as data comes in.',
    'rep.hub.chart.noFunnel': 'No funnel data yet',
    'rep.hub.chart.stagesHint': 'Stages will appear here as data comes in.',
    'rep.hub.chart.other': 'Other',

    // Catalog — Finance
    'rep.cat.profit-loss.title': 'Profit & Loss',
    'rep.cat.profit-loss.desc': 'Revenue, cost of goods, expenses and net profit for the period.',
    'rep.cat.cash-flow.title': 'Cash Flow',
    'rep.cat.cash-flow.desc': 'Money in vs money out over time, with running balance.',
    'rep.cat.cash-register.title': 'Cash Register',
    'rep.cat.cash-register.desc': 'Every caisse transaction: income, expenses and balance.',
    'rep.cat.payments.title': 'Payments & Transactions',
    'rep.cat.payments.desc': 'All payments received and paid across sales, orders and purchases.',
    'rep.cat.expenses.title': 'Expenses',
    'rep.cat.expenses.desc': 'Spending by category — operating costs and per-product expenses.',
    'rep.cat.tax-summary.title': 'Tax Summary',
    'rep.cat.tax-summary.desc': 'Tax collected on sales and orders for the period.',
    'rep.cat.discounts.title': 'Discount Summary',
    'rep.cat.discounts.desc': 'Discounts given on sales and orders, and their revenue impact.',

    // Catalog — Sales
    'rep.cat.sales.title': 'Sales Report',
    'rep.cat.sales.desc': 'Sales and delivered orders: revenue, volume and trend.',
    'rep.cat.sales-by-category.title': 'Sales by Category',
    'rep.cat.sales-by-category.desc': 'Which product categories drive revenue.',
    'rep.cat.top-products.title': 'Top Selling Products',
    'rep.cat.top-products.desc': 'Best sellers by revenue and units, with margin.',
    'rep.cat.return-ratio.title': 'Return Ratio',
    'rep.cat.return-ratio.desc': 'Order return and cancellation rates — the COD cost.',

    // Catalog — Purchases
    'rep.cat.purchases.title': 'Purchases Report',
    'rep.cat.purchases.desc': 'Purchase orders: committed vs paid, by status and over time.',
    'rep.cat.product-purchases.title': 'Product Purchases',
    'rep.cat.product-purchases.desc': 'What you restock most, by quantity and cost.',

    // Catalog — Suppliers
    'rep.cat.suppliers.title': 'Suppliers Report',
    'rep.cat.suppliers.desc': 'Every supplier with spend and purchase count.',
    'rep.cat.top-suppliers.title': 'Top Suppliers',
    'rep.cat.top-suppliers.desc': 'Your biggest suppliers by total spend.',

    // Catalog — Inventory
    'rep.cat.inventory-valuation.title': 'Inventory Valuation',
    'rep.cat.inventory-valuation.desc': 'Stock value at cost and retail, by category.',
    'rep.cat.stock-alerts.title': 'Stock Alerts',
    'rep.cat.stock-alerts.desc': 'Low stock, negative stock and out-of-stock products.',
    'rep.cat.dead-stock.title': 'Dead & Zero-Sales Stock',
    'rep.cat.dead-stock.desc': 'Products holding cash with no recent sales.',
    'rep.cat.stock-aging.title': 'Stock Aging',
    'rep.cat.stock-aging.desc': 'How long stock has sat since its last movement.',
    'rep.cat.stock-adjustments.title': 'Stock Adjustments',
    'rep.cat.stock-adjustments.desc': 'Manual stock corrections audit trail.',
    'rep.cat.products.title': 'Products Report',
    'rep.cat.products.desc': 'Full catalog with stock, value and status.',

    // Catalog — Customers
    'rep.cat.top-customers.title': 'Top Customers',
    'rep.cat.top-customers.desc': 'Your most valuable customers by spend and orders.',
    'rep.cat.inactive-customers.title': 'Inactive Customers',
    'rep.cat.inactive-customers.desc': 'Customers who have not ordered recently — win them back.',

    // Catalog — Requires setup (soon)
    'rep.cat.warranty.title': 'Warranty / Guarantee',
    'rep.cat.warranty.desc': 'Needs a warranty tracking feature.',
    'rep.cat.warranty.soon': 'No warranty data model yet',
    'rep.cat.service-jobs.title': 'Service Jobs',
    'rep.cat.service-jobs.desc': 'Needs a service/repair jobs feature.',
    'rep.cat.service-jobs.soon': 'No service-jobs module yet',
    'rep.cat.warehouses.title': 'Warehouses & Locations',
    'rep.cat.warehouses.desc': 'Needs multi-warehouse inventory.',
    'rep.cat.warehouses.soon': 'Single-location inventory only',
    'rep.cat.stock-transfer.title': 'Stock Transfers',
    'rep.cat.stock-transfer.desc': 'Needs multi-location stock transfers.',
    'rep.cat.stock-transfer.soon': 'No warehouses to transfer between',
    'rep.cat.expiry.title': 'Expiry & Batches',
    'rep.cat.expiry.desc': 'Needs batch/expiry tracking on products.',
    'rep.cat.expiry.soon': 'No batch/expiry fields',
    'rep.cat.loyalty.title': 'Loyalty Points',
    'rep.cat.loyalty.desc': 'Needs a loyalty points program.',
    'rep.cat.loyalty.soon': 'No loyalty module yet',
    'rep.cat.attendance.title': 'Attendance',
    'rep.cat.attendance.desc': 'Needs staff/attendance tracking.',
    'rep.cat.attendance.soon': 'No staff module yet',
    'rep.cat.login-activity.title': 'Login Activity',
    'rep.cat.login-activity.desc': 'Needs session/audit logging.',
    'rep.cat.login-activity.soon': 'No login audit yet',
  },
  fr: {
    // Hub chrome
    'rep.hub.eyebrow': 'Rapports',
    'rep.hub.title': 'Rapports',
    'rep.hub.subtitle':
      '{count} rapports en direct — finance, ventes, stock et plus — chaque chiffre en DA, directement depuis vos données.',
    'rep.hub.search': 'Rechercher des rapports…',
    'rep.hub.searchAria': 'Rechercher des rapports',
    'rep.hub.requiresSetup': 'Configuration requise',
    'rep.hub.noMatches': 'Aucun rapport ne correspond à « {query} »',
    'rep.hub.noMatchesHint': 'Essayez un autre terme de recherche.',
    'rep.hub.clearSearch': 'Effacer la recherche',

    // Category section labels
    'rep.hub.cat.finance': 'Finance',
    'rep.hub.cat.sales': 'Ventes',
    'rep.hub.cat.purchases': 'Achats',
    'rep.hub.cat.inventory': 'Stock',
    'rep.hub.cat.customers': 'Clients',
    'rep.hub.cat.suppliers': 'Fournisseurs',

    // ReportShell chrome
    'rep.hub.shell.back': 'Rapports',

    // Chart-kit fallbacks (empty states / bucket labels)
    'rep.hub.chart.noData': 'Aucune donnée pour le moment',
    'rep.hub.chart.rowsHint': 'Les lignes apparaîtront ici au fur et à mesure des données.',
    'rep.hub.chart.columnsHint': 'Les colonnes apparaîtront ici au fur et à mesure des données.',
    'rep.hub.chart.trendHint': 'La courbe de tendance apparaîtra ici au fur et à mesure des données.',
    'rep.hub.chart.noFunnel': "Aucune donnée d'entonnoir pour le moment",
    'rep.hub.chart.stagesHint': 'Les étapes apparaîtront ici au fur et à mesure des données.',
    'rep.hub.chart.other': 'Autres',

    // Catalog — Finance
    'rep.cat.profit-loss.title': 'Compte de résultat',
    'rep.cat.profit-loss.desc': 'Chiffre d\'affaires, coût des marchandises, dépenses et bénéfice net pour la période.',
    'rep.cat.cash-flow.title': 'Flux de trésorerie',
    'rep.cat.cash-flow.desc': "Entrées et sorties d'argent dans le temps, avec solde courant.",
    'rep.cat.cash-register.title': 'Caisse',
    'rep.cat.cash-register.desc': 'Toutes les transactions de caisse : revenus, dépenses et solde.',
    'rep.cat.payments.title': 'Paiements et transactions',
    'rep.cat.payments.desc': 'Tous les paiements reçus et versés sur les ventes, commandes et achats.',
    'rep.cat.expenses.title': 'Dépenses',
    'rep.cat.expenses.desc': "Dépenses par catégorie — coûts d'exploitation et dépenses par produit.",
    'rep.cat.tax-summary.title': 'Récapitulatif des taxes',
    'rep.cat.tax-summary.desc': 'Taxes perçues sur les ventes et commandes pour la période.',
    'rep.cat.discounts.title': 'Récapitulatif des remises',
    'rep.cat.discounts.desc': "Remises accordées sur les ventes et commandes, et leur impact sur le chiffre d'affaires.",

    // Catalog — Sales
    'rep.cat.sales.title': 'Rapport des ventes',
    'rep.cat.sales.desc': "Ventes et commandes livrées : chiffre d'affaires, volume et tendance.",
    'rep.cat.sales-by-category.title': 'Ventes par catégorie',
    'rep.cat.sales-by-category.desc': "Quelles catégories de produits génèrent le chiffre d'affaires.",
    'rep.cat.top-products.title': 'Produits les plus vendus',
    'rep.cat.top-products.desc': "Meilleures ventes par chiffre d'affaires et unités, avec la marge.",
    'rep.cat.return-ratio.title': 'Taux de retour',
    'rep.cat.return-ratio.desc': "Taux de retour et d'annulation des commandes — le coût du paiement à la livraison.",

    // Catalog — Purchases
    'rep.cat.purchases.title': 'Rapport des achats',
    'rep.cat.purchases.desc': 'Bons de commande : engagé vs payé, par statut et dans le temps.',
    'rep.cat.product-purchases.title': 'Achats de produits',
    'rep.cat.product-purchases.desc': 'Ce que vous réapprovisionnez le plus, par quantité et coût.',

    // Catalog — Suppliers
    'rep.cat.suppliers.title': 'Rapport des fournisseurs',
    'rep.cat.suppliers.desc': "Chaque fournisseur avec le montant dépensé et le nombre d'achats.",
    'rep.cat.top-suppliers.title': 'Principaux fournisseurs',
    'rep.cat.top-suppliers.desc': 'Vos plus grands fournisseurs par montant total dépensé.',

    // Catalog — Inventory
    'rep.cat.inventory-valuation.title': 'Valorisation du stock',
    'rep.cat.inventory-valuation.desc': 'Valeur du stock au coût et au prix de vente, par catégorie.',
    'rep.cat.stock-alerts.title': 'Alertes de stock',
    'rep.cat.stock-alerts.desc': 'Produits en stock faible, stock négatif et en rupture.',
    'rep.cat.dead-stock.title': 'Stock dormant et sans ventes',
    'rep.cat.dead-stock.desc': 'Produits qui immobilisent de la trésorerie sans ventes récentes.',
    'rep.cat.stock-aging.title': 'Ancienneté du stock',
    'rep.cat.stock-aging.desc': 'Depuis combien de temps le stock est immobilisé depuis son dernier mouvement.',
    'rep.cat.stock-adjustments.title': 'Ajustements de stock',
    'rep.cat.stock-adjustments.desc': "Journal d'audit des corrections manuelles de stock.",
    'rep.cat.products.title': 'Rapport des produits',
    'rep.cat.products.desc': 'Catalogue complet avec stock, valeur et statut.',

    // Catalog — Customers
    'rep.cat.top-customers.title': 'Meilleurs clients',
    'rep.cat.top-customers.desc': 'Vos clients les plus précieux par montant dépensé et commandes.',
    'rep.cat.inactive-customers.title': 'Clients inactifs',
    'rep.cat.inactive-customers.desc': "Clients qui n'ont pas commandé récemment — reconquérez-les.",

    // Catalog — Requires setup (soon)
    'rep.cat.warranty.title': 'Garantie',
    'rep.cat.warranty.desc': 'Nécessite une fonctionnalité de suivi des garanties.',
    'rep.cat.warranty.soon': 'Pas encore de modèle de données de garantie',
    'rep.cat.service-jobs.title': 'Interventions SAV',
    'rep.cat.service-jobs.desc': 'Nécessite une fonctionnalité de services/réparations.',
    'rep.cat.service-jobs.soon': "Pas encore de module d'interventions",
    'rep.cat.warehouses.title': 'Entrepôts et emplacements',
    'rep.cat.warehouses.desc': 'Nécessite un inventaire multi-entrepôts.',
    'rep.cat.warehouses.soon': 'Inventaire mono-emplacement uniquement',
    'rep.cat.stock-transfer.title': 'Transferts de stock',
    'rep.cat.stock-transfer.desc': 'Nécessite des transferts de stock multi-emplacements.',
    'rep.cat.stock-transfer.soon': 'Aucun entrepôt entre lesquels transférer',
    'rep.cat.expiry.title': 'Péremption et lots',
    'rep.cat.expiry.desc': 'Nécessite le suivi des lots/péremption sur les produits.',
    'rep.cat.expiry.soon': 'Pas de champs lot/péremption',
    'rep.cat.loyalty.title': 'Points de fidélité',
    'rep.cat.loyalty.desc': 'Nécessite un programme de points de fidélité.',
    'rep.cat.loyalty.soon': 'Pas encore de module de fidélité',
    'rep.cat.attendance.title': 'Présence',
    'rep.cat.attendance.desc': 'Nécessite le suivi du personnel/des présences.',
    'rep.cat.attendance.soon': 'Pas encore de module personnel',
    'rep.cat.login-activity.title': 'Activité de connexion',
    'rep.cat.login-activity.desc': 'Nécessite la journalisation des sessions/audit.',
    'rep.cat.login-activity.soon': 'Pas encore de journal de connexion',
  },
  ar: {
    // Hub chrome
    'rep.hub.eyebrow': 'التقارير',
    'rep.hub.title': 'التقارير',
    'rep.hub.subtitle':
      '{count} تقارير مباشرة عبر المالية والمبيعات والمخزون والمزيد — كل رقم بالدينار، مباشرة من بياناتك.',
    'rep.hub.search': 'ابحث في التقارير…',
    'rep.hub.searchAria': 'ابحث في التقارير',
    'rep.hub.requiresSetup': 'يتطلّب إعدادًا',
    'rep.hub.noMatches': 'لا توجد تقارير تطابق «{query}»',
    'rep.hub.noMatchesHint': 'جرّب مصطلح بحث آخر.',
    'rep.hub.clearSearch': 'مسح البحث',

    // Category section labels
    'rep.hub.cat.finance': 'المالية',
    'rep.hub.cat.sales': 'المبيعات',
    'rep.hub.cat.purchases': 'المشتريات',
    'rep.hub.cat.inventory': 'المخزون',
    'rep.hub.cat.customers': 'العملاء',
    'rep.hub.cat.suppliers': 'الموردون',

    // ReportShell chrome
    'rep.hub.shell.back': 'التقارير',

    // Chart-kit fallbacks (empty states / bucket labels)
    'rep.hub.chart.noData': 'لا توجد بيانات بعد',
    'rep.hub.chart.rowsHint': 'ستظهر الصفوف هنا عند توفّر البيانات.',
    'rep.hub.chart.columnsHint': 'ستظهر الأعمدة هنا عند توفّر البيانات.',
    'rep.hub.chart.trendHint': 'سيظهر خط الاتجاه هنا عند توفّر البيانات.',
    'rep.hub.chart.noFunnel': 'لا توجد بيانات مسار بعد',
    'rep.hub.chart.stagesHint': 'ستظهر المراحل هنا عند توفّر البيانات.',
    'rep.hub.chart.other': 'أخرى',

    // Catalog — Finance
    'rep.cat.profit-loss.title': 'الأرباح والخسائر',
    'rep.cat.profit-loss.desc': 'رقم الأعمال وتكلفة البضاعة والمصاريف والربح الصافي للفترة.',
    'rep.cat.cash-flow.title': 'التدفّق النقدي',
    'rep.cat.cash-flow.desc': 'الأموال الداخلة مقابل الخارجة عبر الزمن، مع الرصيد الجاري.',
    'rep.cat.cash-register.title': 'الصندوق',
    'rep.cat.cash-register.desc': 'كل معاملات الصندوق: الإيرادات والمصاريف والرصيد.',
    'rep.cat.payments.title': 'المدفوعات والمعاملات',
    'rep.cat.payments.desc': 'جميع المدفوعات المستلمة والمدفوعة عبر المبيعات والطلبات والمشتريات.',
    'rep.cat.expenses.title': 'المصاريف',
    'rep.cat.expenses.desc': 'الإنفاق حسب الفئة — تكاليف التشغيل والمصاريف لكل منتج.',
    'rep.cat.tax-summary.title': 'ملخّص الضرائب',
    'rep.cat.tax-summary.desc': 'الضرائب المحصّلة على المبيعات والطلبات خلال الفترة.',
    'rep.cat.discounts.title': 'ملخّص التخفيضات',
    'rep.cat.discounts.desc': 'التخفيضات الممنوحة على المبيعات والطلبات وأثرها على رقم الأعمال.',

    // Catalog — Sales
    'rep.cat.sales.title': 'تقرير المبيعات',
    'rep.cat.sales.desc': 'المبيعات والطلبات المسلّمة: رقم الأعمال والحجم والاتجاه.',
    'rep.cat.sales-by-category.title': 'المبيعات حسب الفئة',
    'rep.cat.sales-by-category.desc': 'فئات المنتجات التي تحقّق رقم الأعمال.',
    'rep.cat.top-products.title': 'المنتجات الأكثر مبيعًا',
    'rep.cat.top-products.desc': 'الأكثر مبيعًا حسب رقم الأعمال والوحدات، مع الهامش.',
    'rep.cat.return-ratio.title': 'نسبة الإرجاع',
    'rep.cat.return-ratio.desc': 'معدّلات إرجاع الطلبات وإلغائها — تكلفة الدفع عند الاستلام.',

    // Catalog — Purchases
    'rep.cat.purchases.title': 'تقرير المشتريات',
    'rep.cat.purchases.desc': 'أوامر الشراء: الملتزَم به مقابل المدفوع، حسب الحالة وعبر الزمن.',
    'rep.cat.product-purchases.title': 'مشتريات المنتجات',
    'rep.cat.product-purchases.desc': 'ما تعيد تخزينه أكثر، حسب الكمية والتكلفة.',

    // Catalog — Suppliers
    'rep.cat.suppliers.title': 'تقرير الموردين',
    'rep.cat.suppliers.desc': 'كل مورّد مع المبلغ المنفَق وعدد المشتريات.',
    'rep.cat.top-suppliers.title': 'أبرز الموردين',
    'rep.cat.top-suppliers.desc': 'أكبر مورّديك حسب إجمالي الإنفاق.',

    // Catalog — Inventory
    'rep.cat.inventory-valuation.title': 'تقييم المخزون',
    'rep.cat.inventory-valuation.desc': 'قيمة المخزون بالتكلفة وبسعر البيع، حسب الفئة.',
    'rep.cat.stock-alerts.title': 'تنبيهات المخزون',
    'rep.cat.stock-alerts.desc': 'المنتجات ذات المخزون المنخفض والسالب والمنتهي.',
    'rep.cat.dead-stock.title': 'المخزون الراكد وعديم المبيعات',
    'rep.cat.dead-stock.desc': 'منتجات تجمّد أموالك دون مبيعات حديثة.',
    'rep.cat.stock-aging.title': 'تقادم المخزون',
    'rep.cat.stock-aging.desc': 'مدّة بقاء المخزون منذ آخر حركة له.',
    'rep.cat.stock-adjustments.title': 'تسويات المخزون',
    'rep.cat.stock-adjustments.desc': 'سجلّ تدقيق تصحيحات المخزون اليدوية.',
    'rep.cat.products.title': 'تقرير المنتجات',
    'rep.cat.products.desc': 'الكتالوج الكامل مع المخزون والقيمة والحالة.',

    // Catalog — Customers
    'rep.cat.top-customers.title': 'أفضل العملاء',
    'rep.cat.top-customers.desc': 'عملاؤك الأكثر قيمة حسب الإنفاق والطلبات.',
    'rep.cat.inactive-customers.title': 'العملاء غير النشطين',
    'rep.cat.inactive-customers.desc': 'عملاء لم يطلبوا مؤخّرًا — استعِدهم.',

    // Catalog — Requires setup (soon)
    'rep.cat.warranty.title': 'الضمان',
    'rep.cat.warranty.desc': 'يتطلّب ميزة لتتبّع الضمانات.',
    'rep.cat.warranty.soon': 'لا يوجد نموذج بيانات للضمان بعد',
    'rep.cat.service-jobs.title': 'أعمال الصيانة',
    'rep.cat.service-jobs.desc': 'يتطلّب ميزة لأعمال الخدمة/الإصلاح.',
    'rep.cat.service-jobs.soon': 'لا توجد وحدة أعمال صيانة بعد',
    'rep.cat.warehouses.title': 'المستودعات والمواقع',
    'rep.cat.warehouses.desc': 'يتطلّب مخزونًا متعدّد المستودعات.',
    'rep.cat.warehouses.soon': 'المخزون بموقع واحد فقط',
    'rep.cat.stock-transfer.title': 'تحويلات المخزون',
    'rep.cat.stock-transfer.desc': 'يتطلّب تحويلات مخزون متعدّدة المواقع.',
    'rep.cat.stock-transfer.soon': 'لا توجد مستودعات للتحويل بينها',
    'rep.cat.expiry.title': 'الصلاحية والدفعات',
    'rep.cat.expiry.desc': 'يتطلّب تتبّع الدفعات/الصلاحية على المنتجات.',
    'rep.cat.expiry.soon': 'لا توجد حقول للدفعة/الصلاحية',
    'rep.cat.loyalty.title': 'نقاط الولاء',
    'rep.cat.loyalty.desc': 'يتطلّب برنامج نقاط ولاء.',
    'rep.cat.loyalty.soon': 'لا توجد وحدة ولاء بعد',
    'rep.cat.attendance.title': 'الحضور',
    'rep.cat.attendance.desc': 'يتطلّب تتبّع الموظفين/الحضور.',
    'rep.cat.attendance.soon': 'لا توجد وحدة موظفين بعد',
    'rep.cat.login-activity.title': 'نشاط تسجيل الدخول',
    'rep.cat.login-activity.desc': 'يتطلّب تسجيل الجلسات/التدقيق.',
    'rep.cat.login-activity.soon': 'لا يوجد تدقيق لتسجيل الدخول بعد',
  },
};
