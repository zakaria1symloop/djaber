// Merges the reports/analytics namespace dictionaries into one set that
// i18n.ts folds into its master dictionaries. Each namespace file is owned by
// a single translation pass, so they never collide.

import { reportsCommonI18n } from './i18n/reports-common';
import { ReportsFinanceI18n } from './i18n/reports-finance';
import { ReportsCommerceI18n } from './i18n/reports-commerce';
import { ReportsInventoryI18n } from './i18n/reports-inventory';
import { AnalyticsTabsI18n } from './i18n/analytics-tabs';
import { ReportsHubI18n } from './i18n/reports-hub';
import { UiDialogsI18n } from './i18n/ui-dialogs';
import { AppShellI18n } from './i18n/app-shell';
import { StockOpsI18n } from './i18n/stock-ops';
import { StockTradeI18n } from './i18n/stock-trade';
import { AdminAccountsI18n } from './i18n/admin-accounts';
import { AdminPlatformI18n } from './i18n/admin-platform';

const parts = [
  reportsCommonI18n,
  ReportsFinanceI18n,
  ReportsCommerceI18n,
  ReportsInventoryI18n,
  AnalyticsTabsI18n,
  ReportsHubI18n,
  UiDialogsI18n,
  AppShellI18n,
  StockOpsI18n,
  StockTradeI18n,
  AdminAccountsI18n,
  AdminPlatformI18n,
];

export const extraI18n = {
  en: Object.assign({}, ...parts.map((p) => p.en)) as Record<string, string>,
  fr: Object.assign({}, ...parts.map((p) => p.fr)) as Record<string, string>,
  ar: Object.assign({}, ...parts.map((p) => p.ar)) as Record<string, string>,
};
