export type Locale = "en" | "hi";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  hi: "हिन्दी",
};

export type Dictionary = {
  nav: {
    dashboard: string;
    liveMap: string;
    fleet: string;
    masterData: string;
    masterSettings: string;
    importExport: string;
    approvals: string;
    reports: string;
    alerts: string;
    targets: string;
    users: string;
    roles: string;
    notifications: string;
    payments: string;
    groups: {
      overview: string;
      fleetSync: string;
      master: string;
      insights: string;
      access: string;
      alertsPayments: string;
    };
  };
  login: {
    heading: string;
    subheading: string;
    username: string;
    password: string;
    signIn: string;
    signingIn: string;
    backToHome: string;
  };
  common: {
    save: string;
    cancel: string;
    logout: string;
  };
};

// FR-17 (multi-language UI): a hand-maintained dictionary rather than a
// full i18n library — the admin-web string surface is large, so this
// slice covers the always-visible chrome (nav + login) and is designed
// to be extended one page at a time via useTranslation() elsewhere.
export const dictionaries: Record<Locale, Dictionary> = {
  en: {
    nav: {
      dashboard: "Dashboard",
      liveMap: "Live Map",
      fleet: "Fleet",
      masterData: "Master Data",
      masterSettings: "Master Settings",
      importExport: "Import / Export",
      approvals: "Approvals & Sync",
      reports: "Reports",
      alerts: "Alerts",
      targets: "Targets",
      users: "Users",
      roles: "Roles",
      notifications: "Notifications",
      payments: "Payments",
      groups: {
        overview: "Overview",
        fleetSync: "Fleet & Sync",
        master: "Master",
        insights: "Insights",
        access: "Access",
        alertsPayments: "Alerts & Payments",
      },
    },
    login: {
      heading: "Sign in to bpro FieldOps",
      subheading: "Access the back-office console for field, fleet & finance.",
      username: "Username",
      password: "Password",
      signIn: "Sign in",
      signingIn: "Signing in…",
      backToHome: "← Back to bpro FieldOps home",
    },
    common: {
      save: "Save",
      cancel: "Cancel",
      logout: "Sign out",
    },
  },
  hi: {
    nav: {
      dashboard: "डैशबोर्ड",
      liveMap: "लाइव मैप",
      fleet: "फ्लीट",
      masterData: "मास्टर डेटा",
      masterSettings: "मास्टर सेटिंग्स",
      importExport: "आयात / निर्यात",
      approvals: "अनुमोदन और सिंक",
      reports: "रिपोर्ट",
      alerts: "अलर्ट",
      targets: "लक्ष्य",
      users: "उपयोगकर्ता",
      roles: "भूमिकाएँ",
      notifications: "सूचनाएं",
      payments: "भुगतान",
      groups: {
        overview: "अवलोकन",
        fleetSync: "फ्लीट और सिंक",
        master: "मास्टर",
        insights: "इनसाइट्स",
        access: "एक्सेस",
        alertsPayments: "अलर्ट और भुगतान",
      },
    },
    login: {
      heading: "bpro FieldOps में साइन इन करें",
      subheading: "फील्ड, फ्लीट और फाइनेंस के लिए बैक-ऑफिस कंसोल एक्सेस करें।",
      username: "उपयोगकर्ता नाम",
      password: "पासवर्ड",
      signIn: "साइन इन करें",
      signingIn: "साइन इन हो रहा है…",
      backToHome: "← bpro FieldOps होम पर वापस जाएँ",
    },
    common: {
      save: "सेव करें",
      cancel: "रद्द करें",
      logout: "साइन आउट",
    },
  },
};
