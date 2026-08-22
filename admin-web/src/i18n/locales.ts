export type Locale = "en" | "ml" | "ta";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  ml: "മലയാളം",
  ta: "தமிழ்",
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
    signupRequests: string;
    notifications: string;
    payments: string;
    collections: string;
    orders: string;
    returns: string;
    groups: {
      overview: string;
      fleetSync: string;
      master: string;
      insights: string;
      access: string;
      alertsPayments: string;
      sales: string;
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
      signupRequests: "Signup Requests",
      notifications: "Notifications",
      payments: "Payments",
      collections: "Collections",
      orders: "Orders",
      returns: "Returns",
      groups: {
        overview: "Overview",
        fleetSync: "Fleet & Sync",
        master: "Master",
        insights: "Insights",
        access: "Access",
        alertsPayments: "Alerts & Payments",
        sales: "Sales",
      },
    },
    login: {
      heading: "Sign in to bpro FieldOps",
      subheading: "Access the back-office console for field sales, fleet, finance & compliance.",
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
  ml: {
    nav: {
      dashboard: "ഡാഷ്ബോർഡ്",
      liveMap: "ലൈവ് മാപ്പ്",
      fleet: "ഫ്ലീറ്റ്",
      masterData: "മാസ്റ്റർ ഡാറ്റ",
      masterSettings: "മാസ്റ്റർ സെറ്റിംഗ്സ്",
      importExport: "ഇറക്കുമതി / കയറ്റുമതി",
      approvals: "അംഗീകാരങ്ങളും സിങ്കും",
      reports: "റിപ്പോർട്ടുകൾ",
      alerts: "അലേർട്ടുകൾ",
      targets: "ലക്ഷ്യങ്ങൾ",
      users: "ഉപയോക്താക്കൾ",
      roles: "റോളുകൾ",
      signupRequests: "സൈൻഅപ്പ് അഭ്യർത്ഥനകൾ",
      notifications: "അറിയിപ്പുകൾ",
      payments: "പേയ്‌മെന്റുകൾ",
      collections: "പിരിവ്",
      orders: "ഓർഡറുകൾ",
      returns: "റിട്ടേണുകൾ",
      groups: {
        overview: "അവലോകനം",
        fleetSync: "ഫ്ലീറ്റും സിങ്കും",
        master: "മാസ്റ്റർ",
        insights: "ഇൻസൈറ്റുകൾ",
        access: "ആക്‌സസ്",
        alertsPayments: "അലേർട്ടുകളും പേയ്‌മെന്റുകളും",
        sales: "സെയിൽസ്",
      },
    },
    login: {
      heading: "bpro FieldOps-ൽ സൈൻ ഇൻ ചെയ്യുക",
      subheading: "ഫീൽഡ് സെയിൽസ്, ഫ്ലീറ്റ്, ഫിനാൻസ് & കംപ്ലയൻസിനുള്ള ബാക്ക്-ഓഫീസ് കൺസോൾ ആക്‌സസ് ചെയ്യുക.",
      username: "യൂസർനെയിം",
      password: "പാസ്‌വേഡ്",
      signIn: "സൈൻ ഇൻ ചെയ്യുക",
      signingIn: "സൈൻ ഇൻ ചെയ്യുന്നു…",
      backToHome: "← bpro FieldOps ഹോമിലേക്ക് മടങ്ങുക",
    },
    common: {
      save: "സേവ് ചെയ്യുക",
      cancel: "റദ്ദാക്കുക",
      logout: "സൈൻ ഔട്ട്",
    },
  },
  ta: {
    nav: {
      dashboard: "டாஷ்போர்டு",
      liveMap: "நேரடி வரைபடம்",
      fleet: "வாகனக் குழு",
      masterData: "மாஸ்டர் தரவு",
      masterSettings: "மாஸ்டர் அமைப்புகள்",
      importExport: "இறக்குமதி / ஏற்றுமதி",
      approvals: "ஒப்புதல்கள் & ஒத்திசைவு",
      reports: "அறிக்கைகள்",
      alerts: "எச்சரிக்கைகள்",
      targets: "இலக்குகள்",
      users: "பயனர்கள்",
      roles: "பங்குகள்",
      signupRequests: "பதிவு கோரிக்கைகள்",
      notifications: "அறிவிப்புகள்",
      payments: "கட்டணங்கள்",
      collections: "வசூல்",
      orders: "ஆர்டர்கள்",
      returns: "திருப்பி அனுப்புதல்கள்",
      groups: {
        overview: "கண்ணோட்டம்",
        fleetSync: "வாகனக் குழு & ஒத்திசைவு",
        master: "மாஸ்டர்",
        insights: "நுண்ணறிவுகள்",
        access: "அணுகல்",
        alertsPayments: "எச்சரிக்கைகள் & கட்டணங்கள்",
        sales: "விற்பனை",
      },
    },
    login: {
      heading: "bpro FieldOps இல் உள்நுழையவும்",
      subheading: "கள விற்பனை, வாகனக் குழு, நிதி & இணக்கத்திற்கான பின் அலுவலக பணியகத்தை அணுகவும்.",
      username: "பயனர்பெயர்",
      password: "கடவுச்சொல்",
      signIn: "உள்நுழை",
      signingIn: "உள்நுழைகிறது…",
      backToHome: "← bpro FieldOps முகப்புக்குத் திரும்பு",
    },
    common: {
      save: "சேமி",
      cancel: "ரத்து செய்",
      logout: "வெளியேறு",
    },
  },
};
