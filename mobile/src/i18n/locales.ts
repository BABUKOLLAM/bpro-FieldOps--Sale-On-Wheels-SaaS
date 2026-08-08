export type Locale = 'en' | 'hi';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  hi: 'हिन्दी',
};

export type Dictionary = {
  nav: {
    home: string;
    spotBilling: string;
    trip: string;
    expense: string;
    attendance: string;
  };
  home: {
    signOut: string;
    checkIn: string;
    checkedInCheckOut: string;
    startTrip: string;
    tripInProgress: string;
    logExpense: string;
    syncNow: string;
    todaysRoute: string;
    noRoute: string;
    unknownCustomer: string;
    outstanding: string;
    syncedMessage: string;
    pushed: string;
    failed: string;
    syncFailedMessage: string;
    language: string;
  };
  common: {
    save: string;
    cancel: string;
    submit: string;
  };
};

// FR-17 (multi-language UI): a hand-maintained dictionary rather than a
// full i18n library — the app's string surface is small enough that a
// flat key map is simpler to review and extend than machine-generated
// catalogs. Add a key here and to every other locale to keep them in sync.
export const dictionaries: Record<Locale, Dictionary> = {
  en: {
    nav: {
      home: 'Van Sales',
      spotBilling: 'Spot Billing',
      trip: 'Trip',
      expense: 'Expense',
      attendance: 'Attendance',
    },
    home: {
      signOut: 'Sign out',
      checkIn: 'Check In',
      checkedInCheckOut: 'Checked in — Check Out',
      startTrip: 'Start Trip',
      tripInProgress: 'Trip in progress — Manage Trip',
      logExpense: 'Log Expense',
      syncNow: 'Sync Now',
      todaysRoute: "Today's Route",
      noRoute: 'No route assigned. Pull to sync.',
      unknownCustomer: 'Unknown customer',
      outstanding: 'Outstanding',
      syncedMessage: 'Synced.',
      pushed: 'pushed',
      failed: 'failed',
      syncFailedMessage: 'Sync failed — will retry automatically.',
      language: 'Language',
    },
    common: {
      save: 'Save',
      cancel: 'Cancel',
      submit: 'Submit',
    },
  },
  hi: {
    nav: {
      home: 'वैन सेल्स',
      spotBilling: 'स्पॉट बिलिंग',
      trip: 'ट्रिप',
      expense: 'खर्च',
      attendance: 'हाज़िरी',
    },
    home: {
      signOut: 'साइन आउट',
      checkIn: 'चेक इन करें',
      checkedInCheckOut: 'चेक इन है — चेक आउट करें',
      startTrip: 'ट्रिप शुरू करें',
      tripInProgress: 'ट्रिप चालू है — प्रबंधित करें',
      logExpense: 'खर्च दर्ज करें',
      syncNow: 'अभी सिंक करें',
      todaysRoute: 'आज का रूट',
      noRoute: 'कोई रूट असाइन नहीं है। सिंक के लिए खींचें।',
      unknownCustomer: 'अज्ञात ग्राहक',
      outstanding: 'बकाया',
      syncedMessage: 'सिंक हो गया।',
      pushed: 'भेजे गए',
      failed: 'विफल',
      syncFailedMessage: 'सिंक विफल — यह अपने आप फिर से कोशिश करेगा।',
      language: 'भाषा',
    },
    common: {
      save: 'सेव करें',
      cancel: 'रद्द करें',
      submit: 'जमा करें',
    },
  },
};
