// Auto-namespace translation dict for the reports/analytics suite.
// Filled by the translation workflow. Keys are prefixed to avoid collisions.
export const ReportsFinanceI18n: { en: Record<string, string>; fr: Record<string, string>; ar: Record<string, string> } = {
  en: {
    // Report titles + descriptions (fed to ReportShell)
    'rep.fin.profitLoss.title': 'Profit & Loss',
    'rep.fin.profitLoss.desc': 'Revenue, cost of goods, expenses and net profit for the period.',
    'rep.fin.cashFlow.title': 'Cash Flow',
    'rep.fin.cashFlow.desc': 'Money in vs money out over time, with running balance.',
    'rep.fin.cashRegister.title': 'Cash Register',
    'rep.fin.cashRegister.desc': 'Every caisse transaction: income, expenses and balance.',
    'rep.fin.payments.title': 'Payments & Transactions',
    'rep.fin.payments.desc': 'All payments received and paid across sales, orders and purchases.',
    'rep.fin.expenses.title': 'Expenses',
    'rep.fin.expenses.desc': 'Spending by category — operating costs and per-product expenses.',
    'rep.fin.taxSummary.title': 'Tax Summary',
    'rep.fin.taxSummary.desc': 'Tax collected on sales and orders for the period.',
    'rep.fin.discounts.title': 'Discount Summary',
    'rep.fin.discounts.desc': 'Discounts given on sales and orders, and their revenue impact.',

    // Shared finance labels
    'rep.fin.byCategory': 'By category',
    'rep.fin.bySource': 'By source',
    'rep.fin.source': 'Source',
    'rep.fin.marginWord': 'margin',

    // Profit & Loss
    'rep.fin.pl.revProfit': 'Revenue & profit',
    'rep.fin.pl.moneyGoes': 'Where the money goes',
    'rep.fin.pl.shareOfRevenue': 'share of revenue',

    // Cash Flow
    'rep.fin.cf.moneyIn': 'Money in',
    'rep.fin.cf.moneyOut': 'Money out',
    'rep.fin.cf.netMovement': 'Net movement',
    'rep.fin.cf.closingBalance': 'Closing balance',
    'rep.fin.cf.openedAt': 'opened at',
    'rep.fin.cf.runningBalance': 'Running balance',
    'rep.fin.cf.noCategories': 'No categories yet',
    'rep.fin.cf.inVsOut': 'Money in vs money out',

    // Cash Register
    'rep.fin.cr.transactions': 'Transactions',
    'rep.fin.cr.noTransactions': 'No transactions',
    'rep.fin.cr.noTransactionsHint': 'Cash movements will appear here as they are recorded.',
    'rep.fin.cr.auto': 'Auto',

    // Payments
    'rep.fin.pay.received': 'Received',
    'rep.fin.pay.paidOut': 'Paid out',
    'rep.fin.pay.paymentMethods': 'Payment methods',
    'rep.fin.pay.receivedVsPaid': 'Received vs paid out',
    'rep.fin.pay.byMethod': 'By payment method',
    'rep.fin.pay.noPayments': 'No payments yet',

    // Expenses
    'rep.fin.exp.entries': 'Entries',
    'rep.fin.exp.largestCategory': 'Largest category',
    'rep.fin.exp.spendingOverTime': 'Spending over time',
    'rep.fin.exp.noExpenses': 'No expenses',
    'rep.fin.exp.noExpensesHint': 'Recorded expenses will appear here.',

    // Tax Summary
    'rep.fin.tax.collected': 'Tax collected',
    'rep.fin.tax.taxableRevenue': 'Taxable revenue',
    'rep.fin.tax.effectiveRate': 'Effective rate',
    'rep.fin.tax.sources': 'Sources',
    'rep.fin.tax.collectedOverTime': 'Tax collected over time',
    'rep.fin.tax.tax': 'Tax',
    'rep.fin.tax.noTax': 'No tax yet',

    // Discounts
    'rep.fin.disc.total': 'Total discount',
    'rep.fin.disc.rate': 'Discount rate',
    'rep.fin.disc.discountedRevenue': 'Discounted revenue',
    'rep.fin.disc.productsDiscounted': 'Products discounted',
    'rep.fin.disc.overTime': 'Discounts over time',
    'rep.fin.disc.mostDiscounted': 'Most discounted products',
    'rep.fin.disc.noDiscounts': 'No discounts yet',
  },
  fr: {
    // Report titles + descriptions (fed to ReportShell)
    'rep.fin.profitLoss.title': 'Compte de résultat',
    'rep.fin.profitLoss.desc': "Chiffre d'affaires, coût des marchandises, dépenses et bénéfice net sur la période.",
    'rep.fin.cashFlow.title': 'Flux de trésorerie',
    'rep.fin.cashFlow.desc': "Entrées et sorties d'argent dans le temps, avec solde cumulé.",
    'rep.fin.cashRegister.title': 'Caisse',
    'rep.fin.cashRegister.desc': 'Chaque transaction de caisse : entrées, dépenses et solde.',
    'rep.fin.payments.title': 'Paiements et transactions',
    'rep.fin.payments.desc': 'Tous les paiements reçus et versés sur les ventes, commandes et achats.',
    'rep.fin.expenses.title': 'Dépenses',
    'rep.fin.expenses.desc': "Dépenses par catégorie — coûts d'exploitation et dépenses par produit.",
    'rep.fin.taxSummary.title': 'Récapitulatif des taxes',
    'rep.fin.taxSummary.desc': 'Taxes perçues sur les ventes et les commandes sur la période.',
    'rep.fin.discounts.title': 'Récapitulatif des remises',
    'rep.fin.discounts.desc': "Remises accordées sur les ventes et les commandes, et leur impact sur le chiffre d'affaires.",

    // Shared finance labels
    'rep.fin.byCategory': 'Par catégorie',
    'rep.fin.bySource': 'Par source',
    'rep.fin.source': 'Source',
    'rep.fin.marginWord': 'de marge',

    // Profit & Loss
    'rep.fin.pl.revProfit': "Chiffre d'affaires et bénéfice",
    'rep.fin.pl.moneyGoes': "Où va l'argent",
    'rep.fin.pl.shareOfRevenue': "part du chiffre d'affaires",

    // Cash Flow
    'rep.fin.cf.moneyIn': "Entrées d'argent",
    'rep.fin.cf.moneyOut': "Sorties d'argent",
    'rep.fin.cf.netMovement': 'Mouvement net',
    'rep.fin.cf.closingBalance': 'Solde de clôture',
    'rep.fin.cf.openedAt': 'ouvert à',
    'rep.fin.cf.runningBalance': 'Solde cumulé',
    'rep.fin.cf.noCategories': "Aucune catégorie pour l'instant",
    'rep.fin.cf.inVsOut': "Entrées et sorties d'argent",

    // Cash Register
    'rep.fin.cr.transactions': 'Transactions',
    'rep.fin.cr.noTransactions': 'Aucune transaction',
    'rep.fin.cr.noTransactionsHint': 'Les mouvements de caisse apparaîtront ici au fur et à mesure de leur enregistrement.',
    'rep.fin.cr.auto': 'Auto',

    // Payments
    'rep.fin.pay.received': 'Reçu',
    'rep.fin.pay.paidOut': 'Versé',
    'rep.fin.pay.paymentMethods': 'Modes de paiement',
    'rep.fin.pay.receivedVsPaid': 'Reçu et versé',
    'rep.fin.pay.byMethod': 'Par mode de paiement',
    'rep.fin.pay.noPayments': "Aucun paiement pour l'instant",

    // Expenses
    'rep.fin.exp.entries': 'Écritures',
    'rep.fin.exp.largestCategory': 'Catégorie principale',
    'rep.fin.exp.spendingOverTime': 'Dépenses dans le temps',
    'rep.fin.exp.noExpenses': 'Aucune dépense',
    'rep.fin.exp.noExpensesHint': 'Les dépenses enregistrées apparaîtront ici.',

    // Tax Summary
    'rep.fin.tax.collected': 'Taxes perçues',
    'rep.fin.tax.taxableRevenue': "Chiffre d'affaires imposable",
    'rep.fin.tax.effectiveRate': 'Taux effectif',
    'rep.fin.tax.sources': 'Sources',
    'rep.fin.tax.collectedOverTime': 'Taxes perçues dans le temps',
    'rep.fin.tax.tax': 'Taxe',
    'rep.fin.tax.noTax': "Aucune taxe pour l'instant",

    // Discounts
    'rep.fin.disc.total': 'Total des remises',
    'rep.fin.disc.rate': 'Taux de remise',
    'rep.fin.disc.discountedRevenue': "Chiffre d'affaires remisé",
    'rep.fin.disc.productsDiscounted': 'Produits remisés',
    'rep.fin.disc.overTime': 'Remises dans le temps',
    'rep.fin.disc.mostDiscounted': 'Produits les plus remisés',
    'rep.fin.disc.noDiscounts': "Aucune remise pour l'instant",
  },
  ar: {
    // Report titles + descriptions (fed to ReportShell)
    'rep.fin.profitLoss.title': 'الأرباح والخسائر',
    'rep.fin.profitLoss.desc': 'رقم الأعمال وتكلفة البضاعة والمصاريف والربح الصافي خلال الفترة.',
    'rep.fin.cashFlow.title': 'التدفق النقدي',
    'rep.fin.cashFlow.desc': 'الأموال الداخلة مقابل الخارجة عبر الزمن، مع الرصيد الجاري.',
    'rep.fin.cashRegister.title': 'الصندوق',
    'rep.fin.cashRegister.desc': 'كل عملية في الصندوق: الإيرادات والمصاريف والرصيد.',
    'rep.fin.payments.title': 'المدفوعات والمعاملات',
    'rep.fin.payments.desc': 'جميع المدفوعات المقبوضة والمدفوعة عبر المبيعات والطلبات والمشتريات.',
    'rep.fin.expenses.title': 'المصاريف',
    'rep.fin.expenses.desc': 'الإنفاق حسب الفئة — تكاليف التشغيل والمصاريف لكل منتج.',
    'rep.fin.taxSummary.title': 'ملخّص الضرائب',
    'rep.fin.taxSummary.desc': 'الضرائب المحصّلة على المبيعات والطلبات خلال الفترة.',
    'rep.fin.discounts.title': 'ملخّص التخفيضات',
    'rep.fin.discounts.desc': 'التخفيضات الممنوحة على المبيعات والطلبات وأثرها على رقم الأعمال.',

    // Shared finance labels
    'rep.fin.byCategory': 'حسب الفئة',
    'rep.fin.bySource': 'حسب المصدر',
    'rep.fin.source': 'المصدر',
    'rep.fin.marginWord': 'هامش',

    // Profit & Loss
    'rep.fin.pl.revProfit': 'رقم الأعمال والربح',
    'rep.fin.pl.moneyGoes': 'أين يذهب المال',
    'rep.fin.pl.shareOfRevenue': 'نسبة من رقم الأعمال',

    // Cash Flow
    'rep.fin.cf.moneyIn': 'الأموال الداخلة',
    'rep.fin.cf.moneyOut': 'الأموال الخارجة',
    'rep.fin.cf.netMovement': 'الحركة الصافية',
    'rep.fin.cf.closingBalance': 'رصيد الإقفال',
    'rep.fin.cf.openedAt': 'افتُتح عند',
    'rep.fin.cf.runningBalance': 'الرصيد الجاري',
    'rep.fin.cf.noCategories': 'لا توجد فئات بعد',
    'rep.fin.cf.inVsOut': 'الأموال الداخلة مقابل الخارجة',

    // Cash Register
    'rep.fin.cr.transactions': 'المعاملات',
    'rep.fin.cr.noTransactions': 'لا توجد معاملات',
    'rep.fin.cr.noTransactionsHint': 'ستظهر حركات الصندوق هنا عند تسجيلها.',
    'rep.fin.cr.auto': 'تلقائي',

    // Payments
    'rep.fin.pay.received': 'المقبوض',
    'rep.fin.pay.paidOut': 'المدفوع',
    'rep.fin.pay.paymentMethods': 'طرق الدفع',
    'rep.fin.pay.receivedVsPaid': 'المقبوض مقابل المدفوع',
    'rep.fin.pay.byMethod': 'حسب طريقة الدفع',
    'rep.fin.pay.noPayments': 'لا توجد مدفوعات بعد',

    // Expenses
    'rep.fin.exp.entries': 'القيود',
    'rep.fin.exp.largestCategory': 'أكبر فئة',
    'rep.fin.exp.spendingOverTime': 'الإنفاق عبر الزمن',
    'rep.fin.exp.noExpenses': 'لا توجد مصاريف',
    'rep.fin.exp.noExpensesHint': 'ستظهر المصاريف المسجّلة هنا.',

    // Tax Summary
    'rep.fin.tax.collected': 'الضرائب المحصّلة',
    'rep.fin.tax.taxableRevenue': 'رقم الأعمال الخاضع للضريبة',
    'rep.fin.tax.effectiveRate': 'المعدل الفعلي',
    'rep.fin.tax.sources': 'المصادر',
    'rep.fin.tax.collectedOverTime': 'الضرائب المحصّلة عبر الزمن',
    'rep.fin.tax.tax': 'الضريبة',
    'rep.fin.tax.noTax': 'لا توجد ضرائب بعد',

    // Discounts
    'rep.fin.disc.total': 'إجمالي التخفيضات',
    'rep.fin.disc.rate': 'معدل التخفيض',
    'rep.fin.disc.discountedRevenue': 'رقم الأعمال المخفَّض',
    'rep.fin.disc.productsDiscounted': 'المنتجات المخفّضة',
    'rep.fin.disc.overTime': 'التخفيضات عبر الزمن',
    'rep.fin.disc.mostDiscounted': 'المنتجات الأكثر تخفيضاً',
    'rep.fin.disc.noDiscounts': 'لا توجد تخفيضات بعد',
  },
};
