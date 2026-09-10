import type { ErrorCatalog } from './catalog';

/** Module-specific codes (analytics + reports). Add codes here; the merged catalog is in ./catalog.ts. */
export const analytics = {
  ANALYTICS_FAILED: {
    status: 500,
    en: 'We could not compute these analytics. Please try again.',
    fr: 'Impossible de calculer ces statistiques. Veuillez réessayer.',
    ar: 'تعذّر حساب هذه الإحصائيات. يرجى المحاولة مرة أخرى.',
  },
  REPORT_FAILED: {
    status: 500,
    en: 'We could not generate this report. Please try again.',
    fr: 'Impossible de générer ce rapport. Veuillez réessayer.',
    ar: 'تعذّر إنشاء هذا التقرير. يرجى المحاولة مرة أخرى.',
  },
  ANALYTICS_RANGE_TOO_LONG: {
    status: 400,
    en: 'The selected date range is too long (maximum {maxYears} years).',
    fr: 'La plage de dates sélectionnée est trop longue (maximum {maxYears} ans).',
    ar: 'نطاق التاريخ المحدد طويل جدًا (الحد الأقصى {maxYears} سنوات).',
  },
  ANALYTICS_CUSTOM_RANGE_REQUIRED: {
    status: 400,
    en: 'A custom period requires both a start date and an end date.',
    fr: 'Une période personnalisée nécessite une date de début et une date de fin.',
    ar: 'تتطلب الفترة المخصصة تاريخ بداية وتاريخ نهاية معًا.',
  },
} as const satisfies ErrorCatalog;
