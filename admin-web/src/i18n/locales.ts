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
    approvals: string;
    reports: string;
    targets: string;
    users: string;
    roles: string;
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
      approvals: "Approvals & Sync",
      reports: "Reports",
      targets: "Targets",
      users: "Users",
      roles: "Roles",
    },
    login: {
      heading: "Sign in to Van Sales",
      subheading: "Access the back-office console for field, fleet & finance.",
      username: "Username",
      password: "Password",
      signIn: "Sign in",
      signingIn: "Signing in…",
      backToHome: "← Back to Van Sales home",
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
      approvals: "अनुमोदन और सिंक",
      reports: "रिपोर्ट",
      targets: "लक्ष्य",
      users: "उपयोगकर्ता",
      roles: "भूमिकाएँ",
    },
    login: {
      heading: "वैन सेल्स में साइन इन करें",
      subheading: "फील्ड, फ्लीट और फाइनेंस के लिए बैक-ऑफिस कंसोल एक्सेस करें।",
      username: "उपयोगकर्ता नाम",
      password: "पासवर्ड",
      signIn: "साइन इन करें",
      signingIn: "साइन इन हो रहा है…",
      backToHome: "← वैन सेल्स होम पर वापस जाएँ",
    },
    common: {
      save: "सेव करें",
      cancel: "रद्द करें",
      logout: "साइन आउट",
    },
  },
};
