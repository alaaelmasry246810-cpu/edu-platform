import common_ar from "./ar/common.json";
import auth_ar from "./ar/auth.json";
import dashboard_ar from "./ar/dashboard.json";
import teacher_ar from "./ar/teacher.json";
import admin_ar from "./ar/admin.json";

import common_en from "./en/common.json";
import auth_en from "./en/auth.json";
import dashboard_en from "./en/dashboard.json";
import teacher_en from "./en/teacher.json";
import admin_en from "./en/admin.json";

export const dictionaries = {
  ar: {
    ...common_ar,
    auth: auth_ar,
    dashboard: dashboard_ar,
    teacher: teacher_ar,
    admin: admin_ar,
  },
  en: {
    ...common_en,
    auth: auth_en,
    dashboard: dashboard_en,
    teacher: teacher_en,
    admin: admin_en,
  },
} as const;
