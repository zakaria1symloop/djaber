import type { ErrorCatalog } from './catalog';

/** Module-specific codes (stock). Add codes here; the merged catalog is in ./catalog.ts. */
export const stock = {
  // ---- categories -----------------------------------------------------------
  CATEGORY_ALREADY_EXISTS: {
    status: 409,
    en: 'A category named "{name}" already exists.',
    fr: 'Une catégorie nommée « {name} » existe déjà.',
    ar: 'توجد فئة بالاسم "{name}" مسبقًا.',
  },
  CATEGORY_IN_USE: {
    status: 422,
    en: 'This category cannot be deleted: {count} product(s) still use it.',
    fr: 'Cette catégorie ne peut pas être supprimée : {count} produit(s) l’utilisent encore.',
    ar: 'لا يمكن حذف هذه الفئة: لا يزال {count} منتج(ات) يستخدمها.',
  },
  CATEGORY_LIST_FAILED: {
    status: 500,
    en: 'Could not load the categories. Please try again.',
    fr: 'Impossible de charger les catégories. Veuillez réessayer.',
    ar: 'تعذّر تحميل الفئات. يرجى المحاولة مرة أخرى.',
  },
  CATEGORY_CREATE_FAILED: {
    status: 500,
    en: 'Could not create the category. Please try again.',
    fr: 'Impossible de créer la catégorie. Veuillez réessayer.',
    ar: 'تعذّر إنشاء الفئة. يرجى المحاولة مرة أخرى.',
  },
  CATEGORY_UPDATE_FAILED: {
    status: 500,
    en: 'Could not update the category. Please try again.',
    fr: 'Impossible de modifier la catégorie. Veuillez réessayer.',
    ar: 'تعذّر تعديل الفئة. يرجى المحاولة مرة أخرى.',
  },
  CATEGORY_DELETE_FAILED: {
    status: 500,
    en: 'Could not delete the category. Please try again.',
    fr: 'Impossible de supprimer la catégorie. Veuillez réessayer.',
    ar: 'تعذّر حذف الفئة. يرجى المحاولة مرة أخرى.',
  },

  // ---- products -------------------------------------------------------------
  PRODUCT_SKU_ALREADY_EXISTS: {
    status: 409,
    en: 'A product with the SKU "{sku}" already exists.',
    fr: 'Un produit avec la référence « {sku} » existe déjà.',
    ar: 'يوجد منتج برمز التخزين "{sku}" مسبقًا.',
  },
  PRODUCT_SELLING_BELOW_COST: {
    status: 400,
    en: 'The selling price must be greater than or equal to the cost price.',
    fr: 'Le prix de vente doit être supérieur ou égal au prix d’achat.',
    ar: 'يجب أن يكون سعر البيع أكبر من أو يساوي سعر التكلفة.',
  },
  PRODUCT_HAS_VARIANTS: {
    status: 422,
    en: 'This product has variants: adjust the stock of each variant instead.',
    fr: 'Ce produit possède des variantes : ajustez plutôt le stock de chaque variante.',
    ar: 'هذا المنتج له نسخ متعددة: عدّل مخزون كل نسخة بدلًا من ذلك.',
  },
  PRODUCT_NOT_STOCK_TRACKED: {
    status: 422,
    en: 'This product is not stock-tracked (digital product): its stock cannot be adjusted.',
    fr: 'Ce produit n’est pas suivi en stock (produit numérique) : son stock ne peut pas être ajusté.',
    ar: 'هذا المنتج غير متابع بالمخزون (منتج رقمي): لا يمكن تعديل مخزونه.',
  },
  PRODUCT_LIST_FAILED: {
    status: 500,
    en: 'Could not load the products. Please try again.',
    fr: 'Impossible de charger les produits. Veuillez réessayer.',
    ar: 'تعذّر تحميل المنتجات. يرجى المحاولة مرة أخرى.',
  },
  PRODUCT_FETCH_FAILED: {
    status: 500,
    en: 'Could not load the product. Please try again.',
    fr: 'Impossible de charger le produit. Veuillez réessayer.',
    ar: 'تعذّر تحميل المنتج. يرجى المحاولة مرة أخرى.',
  },
  PRODUCT_CREATE_FAILED: {
    status: 500,
    en: 'Could not create the product. Please try again.',
    fr: 'Impossible de créer le produit. Veuillez réessayer.',
    ar: 'تعذّر إنشاء المنتج. يرجى المحاولة مرة أخرى.',
  },
  PRODUCT_UPDATE_FAILED: {
    status: 500,
    en: 'Could not update the product. Please try again.',
    fr: 'Impossible de modifier le produit. Veuillez réessayer.',
    ar: 'تعذّر تعديل المنتج. يرجى المحاولة مرة أخرى.',
  },
  PRODUCT_DELETE_FAILED: {
    status: 500,
    en: 'Could not delete the product. Please try again.',
    fr: 'Impossible de supprimer le produit. Veuillez réessayer.',
    ar: 'تعذّر حذف المنتج. يرجى المحاولة مرة أخرى.',
  },
  PRODUCT_MARGINS_FAILED: {
    status: 500,
    en: 'Could not calculate the product margins. Please try again.',
    fr: 'Impossible de calculer les marges du produit. Veuillez réessayer.',
    ar: 'تعذّر حساب هوامش المنتج. يرجى المحاولة مرة أخرى.',
  },

  // ---- stock movements ------------------------------------------------------
  STOCK_QUANTITY_ZERO: {
    status: 400,
    en: 'The quantity must be greater than zero for a stock entry or exit.',
    fr: 'La quantité doit être supérieure à zéro pour une entrée ou une sortie de stock.',
    ar: 'يجب أن تكون الكمية أكبر من صفر عند إدخال أو إخراج مخزون.',
  },
  STOCK_INSUFFICIENT: {
    status: 422,
    en: 'Not enough stock for "{name}": only {available} left.',
    fr: 'Stock insuffisant pour « {name} » : il ne reste que {available}.',
    ar: 'المخزون غير كافٍ لـ "{name}": لم يتبقَّ سوى {available}.',
  },
  STOCK_ADJUST_FAILED: {
    status: 500,
    en: 'Could not adjust the stock. Please try again.',
    fr: 'Impossible d’ajuster le stock. Veuillez réessayer.',
    ar: 'تعذّر تعديل المخزون. يرجى المحاولة مرة أخرى.',
  },
  STOCK_MOVEMENTS_FAILED: {
    status: 500,
    en: 'Could not load the stock movements. Please try again.',
    fr: 'Impossible de charger les mouvements de stock. Veuillez réessayer.',
    ar: 'تعذّر تحميل حركات المخزون. يرجى المحاولة مرة أخرى.',
  },
  STOCK_DASHBOARD_FAILED: {
    status: 500,
    en: 'Could not load the stock dashboard. Please try again.',
    fr: 'Impossible de charger le tableau de bord du stock. Veuillez réessayer.',
    ar: 'تعذّر تحميل لوحة المخزون. يرجى المحاولة مرة أخرى.',
  },

  // ---- suppliers ------------------------------------------------------------
  SUPPLIER_ALREADY_EXISTS: {
    status: 409,
    en: 'A supplier named "{name}" already exists.',
    fr: 'Un fournisseur nommé « {name} » existe déjà.',
    ar: 'يوجد مورّد بالاسم "{name}" مسبقًا.',
  },
  SUPPLIER_LIST_FAILED: {
    status: 500,
    en: 'Could not load the suppliers. Please try again.',
    fr: 'Impossible de charger les fournisseurs. Veuillez réessayer.',
    ar: 'تعذّر تحميل المورّدين. يرجى المحاولة مرة أخرى.',
  },
  SUPPLIER_CREATE_FAILED: {
    status: 500,
    en: 'Could not create the supplier. Please try again.',
    fr: 'Impossible de créer le fournisseur. Veuillez réessayer.',
    ar: 'تعذّر إنشاء المورّد. يرجى المحاولة مرة أخرى.',
  },
  SUPPLIER_UPDATE_FAILED: {
    status: 500,
    en: 'Could not update the supplier. Please try again.',
    fr: 'Impossible de modifier le fournisseur. Veuillez réessayer.',
    ar: 'تعذّر تعديل المورّد. يرجى المحاولة مرة أخرى.',
  },
  SUPPLIER_DELETE_FAILED: {
    status: 500,
    en: 'Could not delete the supplier. Please try again.',
    fr: 'Impossible de supprimer le fournisseur. Veuillez réessayer.',
    ar: 'تعذّر حذف المورّد. يرجى المحاولة مرة أخرى.',
  },

  // ---- units ----------------------------------------------------------------
  UNIT_ALREADY_EXISTS: {
    status: 409,
    en: 'A unit named "{name}" already exists.',
    fr: 'Une unité nommée « {name} » existe déjà.',
    ar: 'توجد وحدة بالاسم "{name}" مسبقًا.',
  },
  UNIT_SYSTEM_READONLY: {
    status: 403,
    en: 'System default units cannot be modified or deleted.',
    fr: 'Les unités système par défaut ne peuvent être ni modifiées ni supprimées.',
    ar: 'لا يمكن تعديل الوحدات الافتراضية للنظام أو حذفها.',
  },
  UNIT_IN_USE: {
    status: 422,
    en: 'This unit cannot be deleted: {count} product(s) still use it.',
    fr: 'Cette unité ne peut pas être supprimée : {count} produit(s) l’utilisent encore.',
    ar: 'لا يمكن حذف هذه الوحدة: لا يزال {count} منتج(ات) يستخدمها.',
  },
  UNIT_LIST_FAILED: {
    status: 500,
    en: 'Could not load the units. Please try again.',
    fr: 'Impossible de charger les unités. Veuillez réessayer.',
    ar: 'تعذّر تحميل الوحدات. يرجى المحاولة مرة أخرى.',
  },
  UNIT_CREATE_FAILED: {
    status: 500,
    en: 'Could not create the unit. Please try again.',
    fr: 'Impossible de créer l’unité. Veuillez réessayer.',
    ar: 'تعذّر إنشاء الوحدة. يرجى المحاولة مرة أخرى.',
  },
  UNIT_UPDATE_FAILED: {
    status: 500,
    en: 'Could not update the unit. Please try again.',
    fr: 'Impossible de modifier l’unité. Veuillez réessayer.',
    ar: 'تعذّر تعديل الوحدة. يرجى المحاولة مرة أخرى.',
  },
  UNIT_DELETE_FAILED: {
    status: 500,
    en: 'Could not delete the unit. Please try again.',
    fr: 'Impossible de supprimer l’unité. Veuillez réessayer.',
    ar: 'تعذّر حذف الوحدة. يرجى المحاولة مرة أخرى.',
  },

  // ---- product images -------------------------------------------------------
  IMAGE_IDS_INVALID: {
    status: 400,
    en: 'The image list must contain only images of this product, each at most once.',
    fr: 'La liste d’images ne doit contenir que des images de ce produit, chacune une seule fois.',
    ar: 'يجب أن تحتوي قائمة الصور على صور هذا المنتج فقط، وكل صورة مرة واحدة على الأكثر.',
  },
  IMAGE_UPLOAD_FAILED: {
    status: 500,
    en: 'Could not upload the images. Please try again.',
    fr: 'Impossible de téléverser les images. Veuillez réessayer.',
    ar: 'تعذّر رفع الصور. يرجى المحاولة مرة أخرى.',
  },
  IMAGE_LIST_FAILED: {
    status: 500,
    en: 'Could not load the images. Please try again.',
    fr: 'Impossible de charger les images. Veuillez réessayer.',
    ar: 'تعذّر تحميل الصور. يرجى المحاولة مرة أخرى.',
  },
  IMAGE_DELETE_FAILED: {
    status: 500,
    en: 'Could not delete the image. Please try again.',
    fr: 'Impossible de supprimer l’image. Veuillez réessayer.',
    ar: 'تعذّر حذف الصورة. يرجى المحاولة مرة أخرى.',
  },
  IMAGE_REORDER_FAILED: {
    status: 500,
    en: 'Could not reorder the images. Please try again.',
    fr: 'Impossible de réordonner les images. Veuillez réessayer.',
    ar: 'تعذّر إعادة ترتيب الصور. يرجى المحاولة مرة أخرى.',
  },
  IMAGE_SET_PRIMARY_FAILED: {
    status: 500,
    en: 'Could not set the main image. Please try again.',
    fr: 'Impossible de définir l’image principale. Veuillez réessayer.',
    ar: 'تعذّر تعيين الصورة الرئيسية. يرجى المحاولة مرة أخرى.',
  },
  IMAGE_ANALYSIS_UNAVAILABLE: {
    status: 503,
    en: 'AI image analysis is temporarily unavailable. Please try again later.',
    fr: 'L’analyse d’image par IA est temporairement indisponible. Veuillez réessayer plus tard.',
    ar: 'تحليل الصور بالذكاء الاصطناعي غير متوفر مؤقتًا. يرجى المحاولة لاحقًا.',
  },
  IMAGE_ANALYSIS_FAILED: {
    status: 502,
    en: 'The AI could not analyze this image. Please try again with another photo.',
    fr: 'L’IA n’a pas pu analyser cette image. Veuillez réessayer avec une autre photo.',
    ar: 'لم يتمكن الذكاء الاصطناعي من تحليل هذه الصورة. يرجى المحاولة بصورة أخرى.',
  },

  // ---- variants -------------------------------------------------------------
  VARIANT_ALREADY_EXISTS: {
    status: 409,
    en: 'A variant named "{name}" already exists for this product.',
    fr: 'Une variante nommée « {name} » existe déjà pour ce produit.',
    ar: 'توجد نسخة بالاسم "{name}" لهذا المنتج مسبقًا.',
  },
  VARIANT_LIST_FAILED: {
    status: 500,
    en: 'Could not load the variants. Please try again.',
    fr: 'Impossible de charger les variantes. Veuillez réessayer.',
    ar: 'تعذّر تحميل النسخ. يرجى المحاولة مرة أخرى.',
  },
  VARIANT_CREATE_FAILED: {
    status: 500,
    en: 'Could not create the variant. Please try again.',
    fr: 'Impossible de créer la variante. Veuillez réessayer.',
    ar: 'تعذّر إنشاء النسخة. يرجى المحاولة مرة أخرى.',
  },
  VARIANT_UPDATE_FAILED: {
    status: 500,
    en: 'Could not update the variant. Please try again.',
    fr: 'Impossible de modifier la variante. Veuillez réessayer.',
    ar: 'تعذّر تعديل النسخة. يرجى المحاولة مرة أخرى.',
  },
  VARIANT_DELETE_FAILED: {
    status: 500,
    en: 'Could not delete the variant. Please try again.',
    fr: 'Impossible de supprimer la variante. Veuillez réessayer.',
    ar: 'تعذّر حذف النسخة. يرجى المحاولة مرة أخرى.',
  },
  VARIANT_STOCK_ADJUST_FAILED: {
    status: 500,
    en: 'Could not adjust the variant stock. Please try again.',
    fr: 'Impossible d’ajuster le stock de la variante. Veuillez réessayer.',
    ar: 'تعذّر تعديل مخزون النسخة. يرجى المحاولة مرة أخرى.',
  },

  // ---- expenses -------------------------------------------------------------
  EXPENSE_LIST_FAILED: {
    status: 500,
    en: 'Could not load the expenses. Please try again.',
    fr: 'Impossible de charger les dépenses. Veuillez réessayer.',
    ar: 'تعذّر تحميل المصاريف. يرجى المحاولة مرة أخرى.',
  },
  EXPENSE_CREATE_FAILED: {
    status: 500,
    en: 'Could not create the expense. Please try again.',
    fr: 'Impossible de créer la dépense. Veuillez réessayer.',
    ar: 'تعذّر إنشاء المصروف. يرجى المحاولة مرة أخرى.',
  },
  EXPENSE_UPDATE_FAILED: {
    status: 500,
    en: 'Could not update the expense. Please try again.',
    fr: 'Impossible de modifier la dépense. Veuillez réessayer.',
    ar: 'تعذّر تعديل المصروف. يرجى المحاولة مرة أخرى.',
  },
  EXPENSE_DELETE_FAILED: {
    status: 500,
    en: 'Could not delete the expense. Please try again.',
    fr: 'Impossible de supprimer la dépense. Veuillez réessayer.',
    ar: 'تعذّر حذف المصروف. يرجى المحاولة مرة أخرى.',
  },

  // ---- product import (Excel / CSV) -----------------------------------------
  IMPORT_FILE_EMPTY: {
    status: 400,
    en: 'The file contains no product row. Add at least one row below the header line.',
    fr: 'Le fichier ne contient aucune ligne de produit. Ajoutez au moins une ligne sous l’en-tête.',
    ar: 'الملف لا يحتوي على أي سطر منتج. أضف سطرًا واحدًا على الأقل تحت سطر العناوين.',
  },
  IMPORT_FILE_UNREADABLE: {
    status: 400,
    en: 'This file could not be read. Please export it again as .xlsx or .csv.',
    fr: 'Ce fichier n’a pas pu être lu. Veuillez l’exporter de nouveau au format .xlsx ou .csv.',
    ar: 'تعذّر قراءة هذا الملف. يرجى تصديره مرة أخرى بصيغة .xlsx أو .csv.',
  },
  IMPORT_COLUMNS_MISSING: {
    status: 400,
    en: 'The header line must contain the columns {columns}.',
    fr: 'La ligne d’en-tête doit contenir les colonnes {columns}.',
    ar: 'يجب أن يحتوي سطر العناوين على الأعمدة {columns}.',
  },
  IMPORT_TOO_MANY_ROWS: {
    status: 400,
    en: 'The file holds too many rows: {count} instead of {max} at most. Please split it.',
    fr: 'Le fichier contient trop de lignes : {count} au lieu de {max} au maximum. Veuillez le découper.',
    ar: 'يحتوي الملف على عدد كبير من الأسطر: {count} بدلاً من {max} كحد أقصى. يرجى تقسيمه.',
  },
  IMPORT_DUPLICATE_SKU_IN_FILE: {
    status: 400,
    en: 'The reference "{sku}" appears more than once in the file (first seen on row {row}).',
    fr: 'La référence « {sku} » apparaît plusieurs fois dans le fichier (vue d’abord à la ligne {row}).',
    ar: 'المرجع "{sku}" يرد أكثر من مرة في الملف (أول ورود في السطر {row}).',
  },
  IMPORT_FAILED: {
    status: 500,
    en: 'Could not import the products. Nothing was saved, please try again.',
    fr: 'Impossible d’importer les produits. Rien n’a été enregistré, veuillez réessayer.',
    ar: 'تعذّر استيراد المنتجات. لم يتم حفظ أي شيء، يرجى المحاولة مرة أخرى.',
  },
} as const satisfies ErrorCatalog;
