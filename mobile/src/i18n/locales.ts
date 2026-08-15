export type Locale = 'en' | 'ml' | 'ta';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ml: 'മലയാളം',
  ta: 'தமிழ்',
};

export type Dictionary = {
  nav: {
    home: string;
    spotBilling: string;
    trip: string;
    expense: string;
    attendance: string;
    collection: string;
    order: string;
    return: string;
  };
  home: {
    signOut: string;
    checkIn: string;
    checkedInCheckOut: string;
    startTrip: string;
    tripInProgress: string;
    logExpense: string;
    logCollection: string;
    logOrder: string;
    logReturn: string;
    syncNow: string;
    todaysRoute: string;
    noRoute: string;
    unknownCustomer: string;
    outstanding: string;
    syncedMessage: string;
    pushed: string;
    failed: string;
    syncFailedMessage: string;
    notSynced: string;
    retrySync: string;
    language: string;
  };
  common: {
    save: string;
    cancel: string;
    submit: string;
    ok: string;
    saving: string;
    savedOfflineBody: string;
    outstandingPrefix: string;
  };
  pinGate: {
    setupTitle: string;
    confirmTitle: string;
    unlockTitle: string;
    errorTitle: string;
    errorBody: string;
    retry: string;
    pinMismatch: string;
    incorrectPin: string;
    genericError: string;
    useBiometricPrefix: string;
  };
  login: {
    subtitle: string;
    usernamePlaceholder: string;
    passwordPlaceholder: string;
    invalidCredentials: string;
    signIn: string;
  };
  attendance: {
    checkedInTitle: string;
    sinceLabelPrefix: string;
    syncingSuffix: string;
    checkOut: string;
    notCheckedInTitle: string;
    notCheckedInSubtitle: string;
    checkIn: string;
    checkedOutTitle: string;
    checkedOutBody: string;
    checkOutFailTitle: string;
    offlineBody: string;
    genericFailBody: string;
  };
  expense: {
    title: string;
    category: string;
    categoryFuel: string;
    categoryToll: string;
    categoryFood: string;
    categoryMisc: string;
    amount: string;
    notesOptional: string;
    notesPlaceholder: string;
    receiptPhotoOptional: string;
    takePhoto: string;
    chooseFromGallery: string;
    receiptAttached: string;
    invalidAmount: string;
    saved: string;
    save: string;
  };
  receipt: {
    title: string;
    customer: string;
    noCustomers: string;
    paymentMode: string;
    modeCash: string;
    modeCheque: string;
    modeUpi: string;
    modeCard: string;
    amount: string;
    chequeNumber: string;
    transactionReference: string;
    chequePlaceholder: string;
    upiRefPlaceholder: string;
    selectCustomer: string;
    invalidAmount: string;
    enterReference: string;
    saved: string;
    save: string;
  };
  order: {
    title: string;
    customer: string;
    items: string;
    notesOptional: string;
    notesPlaceholder: string;
    estimatedTotalPrefix: string;
    finalPricingNote: string;
    selectCustomer: string;
    enterQty: string;
    saved: string;
    save: string;
  };
  return: {
    title: string;
    invoice: string;
    noInvoices: string;
    unknownCustomer: string;
    returnedItems: string;
    soldPrefix: string;
    reason: string;
    sellable: string;
    damaged: string;
    expired: string;
    reasonDamagedInTransit: string;
    reasonExpired: string;
    reasonWrongItem: string;
    reasonCustomerRejection: string;
    selectInvoice: string;
    enterQty: string;
    overReturnPrefix: string;
    overReturnMiddle: string;
    saved: string;
    save: string;
  };
  trip: {
    startTitle: string;
    odometerStartPlaceholder: string;
    startTrip: string;
    inProgressTitle: string;
    startedAtOdometerPrefix: string;
    odometerEndPlaceholder: string;
    endTrip: string;
    notVisited: string;
    checkedIn: string;
    checkedOut: string;
    tripEndedTitle: string;
    tripEndedBody: string;
  };
  spotBilling: {
    noCustomerSelected: string;
    outstandingPrefix: string;
    scanBarcode: string;
    cancel: string;
    estimatedTotalPrefix: string;
    finalGstNote: string;
    save: string;
    itemNotFoundTitle: string;
    itemNotFoundBodyPrefix: string;
    selectCustomer: string;
    addAtLeastOneItem: string;
    missingSetupTitle: string;
    missingSetupBody: string;
    upiNotConfiguredTitle: string;
    upiNotConfiguredBody: string;
    confirmOtpTitle: string;
    sendingOtp: string;
    enterOtp: string;
    verifying: string;
    verifyOtp: string;
    backToSignature: string;
    invoiceSavedTitle: string;
    proofOfDeliveryNote: string;
    signDescription: string;
    nothingToSaveTitle: string;
    nothingToSaveBody: string;
    confirmViaOtpInstead: string;
    shareReceipt: string;
    printing: string;
    printViaBluetooth: string;
    collectViaUpi: string;
    skipSignature: string;
    scanToPayUpi: string;
    payToPrefix: string;
    done: string;
    printFailedTitle: string;
    printFailedFallbackBody: string;
    couldNotSendOtp: string;
    incorrectOtp: string;
  };
};

// FR-17 (multi-language UI): a hand-maintained dictionary rather than a
// full i18n library — the app's string surface is small enough that a
// flat key map is simpler to review and extend than machine-generated
// catalogs. Add a key here and to every other locale to keep them in sync.
//
// A handful of English values are load-bearing for CI: mobile/e2e/
// salesman-flow.yaml taps on literal button text ("Sign In", "Start
// Trip", "Save Invoice", "Skip signature", "Save Collection",
// "Save Order", "Save Return", "Sync Now", "OK", "bpro FieldOps"). The
// app always launches in the 'en' locale (see LanguageContext's default
// state) and the flow never switches it, so this is safe as long as
// those specific en values are never edited — changing them requires
// updating the E2E flow in the same change.
export const dictionaries: Record<Locale, Dictionary> = {
  en: {
    nav: {
      home: 'bpro FieldOps',
      spotBilling: 'Spot Billing',
      trip: 'Trip',
      expense: 'Expense',
      attendance: 'Attendance',
      collection: 'Collection',
      order: 'Order',
      return: 'Return',
    },
    home: {
      signOut: 'Sign out',
      checkIn: 'Check In',
      checkedInCheckOut: 'Checked in — Check Out',
      startTrip: 'Start Trip',
      tripInProgress: 'Trip in progress — Manage Trip',
      logExpense: 'Log Expense',
      logCollection: 'Collect Payment',
      logOrder: 'Take Order',
      logReturn: 'Record Return',
      syncNow: 'Sync Now',
      todaysRoute: "Today's Route",
      noRoute: 'No route assigned. Pull to sync.',
      unknownCustomer: 'Unknown customer',
      outstanding: 'Outstanding',
      syncedMessage: 'Synced.',
      pushed: 'pushed',
      failed: 'failed',
      syncFailedMessage: 'Sync failed — will retry automatically.',
      notSynced: 'not synced yet',
      retrySync: 'Retry sync',
      language: 'Language',
    },
    common: {
      save: 'Save',
      cancel: 'Cancel',
      submit: 'Submit',
      ok: 'OK',
      saving: 'Saving…',
      savedOfflineBody:
        'Saved offline. It will sync automatically once you’re online.',
      outstandingPrefix: 'Outstanding ₹',
    },
    pinGate: {
      setupTitle: 'Set a device PIN',
      confirmTitle: 'Confirm your PIN',
      unlockTitle: 'Enter your PIN',
      errorTitle: 'Unable to verify PIN status',
      errorBody:
        "The device's secure storage couldn't be read. This can happen right after a restart, before the device is unlocked once.",
      retry: 'Retry',
      pinMismatch: 'PINs did not match. Try again.',
      incorrectPin: 'Incorrect PIN.',
      genericError: 'Something went wrong. Try again.',
      useBiometricPrefix: 'Use',
    },
    login: {
      subtitle: 'Field agent sign in',
      usernamePlaceholder: 'Username',
      passwordPlaceholder: 'Password',
      invalidCredentials: 'Invalid username or password.',
      signIn: 'Sign In',
    },
    attendance: {
      checkedInTitle: 'Checked in',
      sinceLabelPrefix: 'Since ',
      syncingSuffix: ' · syncing…',
      checkOut: 'Check Out',
      notCheckedInTitle: 'Not checked in',
      notCheckedInSubtitle:
        'Start your day by checking in — your location is captured for attendance verification.',
      checkIn: 'Check In',
      checkedOutTitle: 'Checked out',
      checkedOutBody: 'Have a good day!',
      checkOutFailTitle: 'Could not check out',
      offlineBody:
        'You appear to be offline. Check-out needs a connection — try again once you’re back online.',
      genericFailBody: 'Something went wrong. Please try again.',
    },
    expense: {
      title: 'New Expense',
      category: 'Category',
      categoryFuel: 'Fuel',
      categoryToll: 'Toll',
      categoryFood: 'Food',
      categoryMisc: 'Misc',
      amount: 'Amount (₹)',
      notesOptional: 'Notes (optional)',
      notesPlaceholder: 'e.g. Diesel refill at Andheri depot',
      receiptPhotoOptional: 'Receipt photo (optional)',
      takePhoto: 'Take Photo',
      chooseFromGallery: 'Choose from Gallery',
      receiptAttached: 'Receipt attached ✓',
      invalidAmount: 'Enter a valid amount.',
      saved: 'Expense saved',
      save: 'Save Expense',
    },
    receipt: {
      title: 'New Collection',
      customer: 'Customer',
      noCustomers:
        'No customers synced yet — pull to sync from the home screen first.',
      paymentMode: 'Payment mode',
      modeCash: 'Cash',
      modeCheque: 'Cheque',
      modeUpi: 'UPI',
      modeCard: 'Card',
      amount: 'Amount (₹)',
      chequeNumber: 'Cheque number',
      transactionReference: 'Transaction reference',
      chequePlaceholder: 'e.g. 000123',
      upiRefPlaceholder: 'e.g. UPI ref',
      selectCustomer: 'Select a customer first.',
      invalidAmount: 'Enter a valid amount.',
      enterReference: 'Enter the cheque no / transaction reference.',
      saved: 'Collection saved',
      save: 'Save Collection',
    },
    order: {
      title: 'New Order',
      customer: 'Customer',
      items: 'Items',
      notesOptional: 'Notes (optional)',
      notesPlaceholder: 'e.g. Deliver Friday morning',
      estimatedTotalPrefix: 'Estimated total: ₹',
      finalPricingNote:
        'Final pricing/GST applied at fulfilment by the back office.',
      selectCustomer: 'Select a customer first.',
      enterQty: 'Enter a quantity for at least one item.',
      saved: 'Order saved',
      save: 'Save Order',
    },
    return: {
      title: 'New Return',
      invoice: 'Invoice',
      noInvoices:
        'No synced invoices to return against yet — a return needs its original sale to have synced first.',
      unknownCustomer: 'Unknown customer',
      returnedItems: 'Returned items',
      soldPrefix: 'Sold ',
      reason: 'Reason',
      sellable: 'Sellable',
      damaged: 'Damaged',
      expired: 'Expired',
      reasonDamagedInTransit: 'Damaged in transit',
      reasonExpired: 'Expired',
      reasonWrongItem: 'Wrong item',
      reasonCustomerRejection: 'Customer rejected',
      selectInvoice: 'Select an invoice first.',
      enterQty: 'Enter a returned quantity for at least one line.',
      overReturnPrefix: "Can't return more than the",
      overReturnMiddle: 'originally sold of',
      saved: 'Return saved',
      save: 'Save Return',
    },
    trip: {
      startTitle: 'Start your trip',
      odometerStartPlaceholder: 'Starting odometer reading',
      startTrip: 'Start Trip',
      inProgressTitle: 'Trip in progress',
      startedAtOdometerPrefix: 'Started at odometer ',
      odometerEndPlaceholder: 'Ending odometer reading',
      endTrip: 'End Trip',
      notVisited: 'Not visited',
      checkedIn: 'Checked in',
      checkedOut: 'Checked out',
      tripEndedTitle: 'Trip ended',
      tripEndedBody: 'Saved offline and will sync automatically.',
    },
    spotBilling: {
      noCustomerSelected: 'No customer selected',
      outstandingPrefix: 'Outstanding ₹',
      scanBarcode: 'Scan Barcode',
      cancel: 'Cancel',
      estimatedTotalPrefix: 'Estimated total: ₹',
      finalGstNote: 'Final GST/discount recomputed by the server at sync.',
      save: 'Save Invoice',
      itemNotFoundTitle: 'Item not found',
      itemNotFoundBodyPrefix: 'No item matches barcode',
      selectCustomer: 'Select a customer first.',
      addAtLeastOneItem: 'Add at least one item.',
      missingSetupTitle: 'Missing setup data',
      missingSetupBody:
        'Sync at least once before billing so van stock and GST setup are available offline.',
      upiNotConfiguredTitle: 'UPI not configured',
      upiNotConfiguredBody:
        'No UPI ID has been set up for this deployment yet — ask your admin to add one in Master Settings.',
      confirmOtpTitle: 'Confirm via OTP',
      sendingOtp: 'Sending OTP to the customer’s registered phone…',
      enterOtp: 'Enter the 6-digit code sent to the customer.',
      verifying: 'Verifying…',
      verifyOtp: 'Verify OTP',
      backToSignature: 'Back to signature',
      invoiceSavedTitle: 'Invoice saved — capture signature',
      proofOfDeliveryNote:
        'Optional proof of delivery (FR-12). Skip if not needed.',
      signDescription: 'Sign to confirm delivery',
      nothingToSaveTitle: 'Nothing to save',
      nothingToSaveBody: 'Draw a signature first, or skip.',
      confirmViaOtpInstead: 'Confirm via OTP instead',
      shareReceipt: 'Share Receipt',
      printing: 'Printing…',
      printViaBluetooth: 'Print via Bluetooth',
      collectViaUpi: 'Collect via UPI',
      skipSignature: 'Skip signature',
      scanToPayUpi: 'Scan to pay via UPI',
      payToPrefix: 'to',
      done: 'Done',
      printFailedTitle: 'Print failed',
      printFailedFallbackBody:
        'Could not print — check the printer is paired and powered on.',
      couldNotSendOtp:
        'Could not send OTP — needs an internet connection. Use signature instead, or try again.',
      incorrectOtp: 'Incorrect or expired OTP.',
    },
  },
  ml: {
    nav: {
      home: 'bpro FieldOps',
      spotBilling: 'സ്പോട്ട് ബില്ലിംഗ്',
      trip: 'ട്രിപ്പ്',
      expense: 'ചെലവ്',
      attendance: 'ഹാജർ',
      collection: 'പിരിവ്',
      order: 'ഓർഡർ',
      return: 'റിട്ടേൺ',
    },
    home: {
      signOut: 'സൈൻ ഔട്ട്',
      checkIn: 'ചെക്ക് ഇൻ',
      checkedInCheckOut: 'ചെക്ക് ഇൻ ചെയ്തു — ചെക്ക് ഔട്ട് ചെയ്യുക',
      startTrip: 'ട്രിപ്പ് ആരംഭിക്കുക',
      tripInProgress: 'ട്രിപ്പ് നടക്കുന്നു — നിയന്ത്രിക്കുക',
      logExpense: 'ചെലവ് രേഖപ്പെടുത്തുക',
      logCollection: 'പണം പിരിക്കുക',
      logOrder: 'ഓർഡർ എടുക്കുക',
      logReturn: 'റിട്ടേൺ രേഖപ്പെടുത്തുക',
      syncNow: 'ഇപ്പോൾ സിങ്ക് ചെയ്യുക',
      todaysRoute: 'ഇന്നത്തെ റൂട്ട്',
      noRoute: 'റൂട്ട് നൽകിയിട്ടില്ല. സിങ്ക് ചെയ്യാൻ വലിച്ചിടുക.',
      unknownCustomer: 'അജ്ഞാത കസ്റ്റമർ',
      outstanding: 'ബാക്കി കുടിശ്ശിക',
      syncedMessage: 'സിങ്ക് ചെയ്തു.',
      pushed: 'അയച്ചു',
      failed: 'പരാജയപ്പെട്ടു',
      syncFailedMessage: 'സിങ്ക് പരാജയപ്പെട്ടു — ഇത് വീണ്ടും ശ്രമിക്കും.',
      notSynced: 'ഇതുവരെ സിങ്ക് ചെയ്തിട്ടില്ല',
      retrySync: 'വീണ്ടും സിങ്ക് ചെയ്യുക',
      language: 'ഭാഷ',
    },
    common: {
      save: 'സേവ് ചെയ്യുക',
      cancel: 'റദ്ദാക്കുക',
      submit: 'സമർപ്പിക്കുക',
      ok: 'ശരി',
      saving: 'സേവ് ചെയ്യുന്നു…',
      savedOfflineBody:
        'ഓഫ്‌ലൈനായി സേവ് ചെയ്തു. ഓൺലൈനാകുമ്പോൾ ഇത് സ്വയമേവ സിങ്ക് ചെയ്യും.',
      outstandingPrefix: 'ബാക്കി ₹',
    },
    pinGate: {
      setupTitle: 'ഡിവൈസ് പിൻ സെറ്റ് ചെയ്യുക',
      confirmTitle: 'നിങ്ങളുടെ പിൻ സ്ഥിരീകരിക്കുക',
      unlockTitle: 'നിങ്ങളുടെ പിൻ നൽകുക',
      errorTitle: 'പിൻ സ്ഥിതി പരിശോധിക്കാനായില്ല',
      errorBody:
        'ഡിവൈസിന്റെ സുരക്ഷിത സ്റ്റോറേജ് വായിക്കാനായില്ല. റീസ്റ്റാർട്ടിന് ശേഷം, ഡിവൈസ് ഒരു തവണ അൺലോക്ക് ചെയ്യുന്നതിന് മുൻപ് ഇത് സംഭവിക്കാം.',
      retry: 'വീണ്ടും ശ്രമിക്കുക',
      pinMismatch: 'പിൻ പൊരുത്തപ്പെട്ടില്ല. വീണ്ടും ശ്രമിക്കുക.',
      incorrectPin: 'തെറ്റായ പിൻ.',
      genericError: 'എന്തോ കുഴപ്പം സംഭവിച്ചു. വീണ്ടും ശ്രമിക്കുക.',
      useBiometricPrefix: 'ഉപയോഗിക്കുക',
    },
    login: {
      subtitle: 'ഫീൽഡ് ഏജന്റ് സൈൻ ഇൻ',
      usernamePlaceholder: 'യൂസർനെയിം',
      passwordPlaceholder: 'പാസ്‌വേഡ്',
      invalidCredentials: 'തെറ്റായ യൂസർനെയിം അല്ലെങ്കിൽ പാസ്‌വേഡ്.',
      signIn: 'സൈൻ ഇൻ',
    },
    attendance: {
      checkedInTitle: 'ചെക്ക് ഇൻ ചെയ്തു',
      sinceLabelPrefix: 'മുതൽ ',
      syncingSuffix: ' · സിങ്ക് ചെയ്യുന്നു…',
      checkOut: 'ചെക്ക് ഔട്ട് ചെയ്യുക',
      notCheckedInTitle: 'ചെക്ക് ഇൻ ചെയ്തിട്ടില്ല',
      notCheckedInSubtitle:
        'ചെക്ക് ഇൻ ചെയ്ത് നിങ്ങളുടെ ദിവസം ആരംഭിക്കുക — ഹാജർ പരിശോധനയ്ക്കായി നിങ്ങളുടെ ലൊക്കേഷൻ രേഖപ്പെടുത്തുന്നു.',
      checkIn: 'ചെക്ക് ഇൻ',
      checkedOutTitle: 'ചെക്ക് ഔട്ട് ചെയ്തു',
      checkedOutBody: 'നല്ല ദിവസം ആശംസിക്കുന്നു!',
      checkOutFailTitle: 'ചെക്ക് ഔട്ട് ചെയ്യാനായില്ല',
      offlineBody:
        'നിങ്ങൾ ഓഫ്‌ലൈനിലാണെന്ന് തോന്നുന്നു. ചെക്ക്-ഔട്ടിന് ഇന്റർനെറ്റ് കണക്ഷൻ വേണം — ഓൺലൈനാകുമ്പോൾ വീണ്ടും ശ്രമിക്കുക.',
      genericFailBody: 'എന്തോ കുഴപ്പം സംഭവിച്ചു. ദയവായി വീണ്ടും ശ്രമിക്കുക.',
    },
    expense: {
      title: 'പുതിയ ചെലവ്',
      category: 'വിഭാഗം',
      categoryFuel: 'ഇന്ധനം',
      categoryToll: 'ടോൾ',
      categoryFood: 'ഭക്ഷണം',
      categoryMisc: 'മറ്റുള്ളവ',
      amount: 'തുക (₹)',
      notesOptional: 'കുറിപ്പുകൾ (ഐച്ഛികം)',
      notesPlaceholder: 'ഉദാ. അന്ധേരി ഡിപ്പോയിൽ ഡീസൽ അടിച്ചു',
      receiptPhotoOptional: 'രസീത് ഫോട്ടോ (ഐച്ഛികം)',
      takePhoto: 'ഫോട്ടോ എടുക്കുക',
      chooseFromGallery: 'ഗാലറിയിൽ നിന്ന് തിരഞ്ഞെടുക്കുക',
      receiptAttached: 'രസീത് ചേർത്തു ✓',
      invalidAmount: 'ശരിയായ തുക നൽകുക.',
      saved: 'ചെലവ് സേവ് ചെയ്തു',
      save: 'ചെലവ് സേവ് ചെയ്യുക',
    },
    receipt: {
      title: 'പുതിയ പിരിവ്',
      customer: 'കസ്റ്റമർ',
      noCustomers:
        'ഇതുവരെ കസ്റ്റമേഴ്‌സ് സിങ്ക് ചെയ്തിട്ടില്ല — ആദ്യം ഹോം സ്ക്രീനിൽ നിന്ന് സിങ്ക് ചെയ്യുക.',
      paymentMode: 'പേയ്‌മെന്റ് രീതി',
      modeCash: 'ക്യാഷ്',
      modeCheque: 'ചെക്ക്',
      modeUpi: 'യുപിഐ',
      modeCard: 'കാർഡ്',
      amount: 'തുക (₹)',
      chequeNumber: 'ചെക്ക് നമ്പർ',
      transactionReference: 'ട്രാൻസാക്ഷൻ റഫറൻസ്',
      chequePlaceholder: 'ഉദാ. 000123',
      upiRefPlaceholder: 'ഉദാ. യുപിഐ റഫ്',
      selectCustomer: 'ആദ്യം ഒരു കസ്റ്റമറെ തിരഞ്ഞെടുക്കുക.',
      invalidAmount: 'ശരിയായ തുക നൽകുക.',
      enterReference: 'ചെക്ക് നമ്പർ / ട്രാൻസാക്ഷൻ റഫറൻസ് നൽകുക.',
      saved: 'പിരിവ് സേവ് ചെയ്തു',
      save: 'പിരിവ് സേവ് ചെയ്യുക',
    },
    order: {
      title: 'പുതിയ ഓർഡർ',
      customer: 'കസ്റ്റമർ',
      items: 'ഇനങ്ങൾ',
      notesOptional: 'കുറിപ്പുകൾ (ഐച്ഛികം)',
      notesPlaceholder: 'ഉദാ. വെള്ളിയാഴ്ച രാവിലെ ഡെലിവർ ചെയ്യുക',
      estimatedTotalPrefix: 'ഏകദേശ ആകെ: ₹',
      finalPricingNote:
        'അന്തിമ വില/ജിഎസ്ടി ഫുൾഫിൽമെന്റ് സമയത്ത് ബാക്ക് ഓഫീസ് പ്രയോഗിക്കും.',
      selectCustomer: 'ആദ്യം ഒരു കസ്റ്റമറെ തിരഞ്ഞെടുക്കുക.',
      enterQty: 'കുറഞ്ഞത് ഒരു ഇനത്തിനെങ്കിലും അളവ് നൽകുക.',
      saved: 'ഓർഡർ സേവ് ചെയ്തു',
      save: 'ഓർഡർ സേവ് ചെയ്യുക',
    },
    return: {
      title: 'പുതിയ റിട്ടേൺ',
      invoice: 'ഇൻവോയ്സ്',
      noInvoices:
        'റിട്ടേൺ ചെയ്യാൻ ഇതുവരെ സിങ്ക് ചെയ്ത ഇൻവോയ്സുകൾ ഇല്ല — റിട്ടേണിന് അതിന്റെ യഥാർത്ഥ വിൽപ്പന സിങ്ക് ചെയ്തിരിക്കണം.',
      unknownCustomer: 'അജ്ഞാത കസ്റ്റമർ',
      returnedItems: 'തിരികെ നൽകിയ ഇനങ്ങൾ',
      soldPrefix: 'വിറ്റത് ',
      reason: 'കാരണം',
      sellable: 'വിൽക്കാവുന്നത്',
      damaged: 'കേടായത്',
      expired: 'കാലാവധി കഴിഞ്ഞത്',
      reasonDamagedInTransit: 'യാത്രാമധ്യേ കേടായത്',
      reasonExpired: 'കാലാവധി കഴിഞ്ഞത്',
      reasonWrongItem: 'തെറ്റായ ഇനം',
      reasonCustomerRejection: 'കസ്റ്റമർ നിരസിച്ചു',
      selectInvoice: 'ആദ്യം ഒരു ഇൻവോയ്സ് തിരഞ്ഞെടുക്കുക.',
      enterQty: 'കുറഞ്ഞത് ഒരു വരിക്കെങ്കിലും തിരികെ നൽകിയ അളവ് നൽകുക.',
      overReturnPrefix: 'ഇതിലധികം തിരികെ നൽകാനാവില്ല —',
      overReturnMiddle: 'വിറ്റതിൽ നിന്ന്',
      saved: 'റിട്ടേൺ സേവ് ചെയ്തു',
      save: 'റിട്ടേൺ സേവ് ചെയ്യുക',
    },
    trip: {
      startTitle: 'നിങ്ങളുടെ ട്രിപ്പ് ആരംഭിക്കുക',
      odometerStartPlaceholder: 'ആരംഭ ഓഡോമീറ്റർ റീഡിംഗ്',
      startTrip: 'ട്രിപ്പ് ആരംഭിക്കുക',
      inProgressTitle: 'ട്രിപ്പ് നടക്കുന്നു',
      startedAtOdometerPrefix: 'ഓഡോമീറ്ററിൽ ആരംഭിച്ചു ',
      odometerEndPlaceholder: 'അവസാന ഓഡോമീറ്റർ റീഡിംഗ്',
      endTrip: 'ട്രിപ്പ് അവസാനിപ്പിക്കുക',
      notVisited: 'സന്ദർശിച്ചിട്ടില്ല',
      checkedIn: 'ചെക്ക് ഇൻ ചെയ്തു',
      checkedOut: 'ചെക്ക് ഔട്ട് ചെയ്തു',
      tripEndedTitle: 'ട്രിപ്പ് അവസാനിച്ചു',
      tripEndedBody: 'ഓഫ്‌ലൈനായി സേവ് ചെയ്തു, സ്വയമേവ സിങ്ക് ചെയ്യും.',
    },
    spotBilling: {
      noCustomerSelected: 'കസ്റ്റമറെ തിരഞ്ഞെടുത്തിട്ടില്ല',
      outstandingPrefix: 'ബാക്കി ₹',
      scanBarcode: 'ബാർകോഡ് സ്കാൻ ചെയ്യുക',
      cancel: 'റദ്ദാക്കുക',
      estimatedTotalPrefix: 'ഏകദേശ ആകെ: ₹',
      finalGstNote:
        'സിങ്ക് സമയത്ത് സെർവർ അന്തിമ ജിഎസ്ടി/കിഴിവ് വീണ്ടും കണക്കാക്കും.',
      save: 'ഇൻവോയ്സ് സേവ് ചെയ്യുക',
      itemNotFoundTitle: 'ഇനം കണ്ടെത്തിയില്ല',
      itemNotFoundBodyPrefix: 'ബാർകോഡുമായി പൊരുത്തപ്പെടുന്ന ഇനമില്ല',
      selectCustomer: 'ആദ്യം ഒരു കസ്റ്റമറെ തിരഞ്ഞെടുക്കുക.',
      addAtLeastOneItem: 'കുറഞ്ഞത് ഒരു ഇനമെങ്കിലും ചേർക്കുക.',
      missingSetupTitle: 'സെറ്റപ്പ് ഡാറ്റ ഇല്ല',
      missingSetupBody:
        'വാൻ സ്റ്റോക്കും ജിഎസ്ടി സെറ്റപ്പും ഓഫ്‌ലൈനിൽ ലഭ്യമാകാൻ ബില്ലിംഗിന് മുൻപ് കുറഞ്ഞത് ഒരു തവണയെങ്കിലും സിങ്ക് ചെയ്യുക.',
      upiNotConfiguredTitle: 'യുപിഐ സെറ്റ് ചെയ്തിട്ടില്ല',
      upiNotConfiguredBody:
        'ഈ ഡിപ്ലോയ്‌മെന്റിന് ഇതുവരെ യുപിഐ ഐഡി സെറ്റ് ചെയ്തിട്ടില്ല — മാസ്റ്റർ സെറ്റിംഗ്സിൽ ഒന്ന് ചേർക്കാൻ അഡ്മിനോട് ആവശ്യപ്പെടുക.',
      confirmOtpTitle: 'ഒടിപി വഴി സ്ഥിരീകരിക്കുക',
      sendingOtp: 'കസ്റ്റമറുടെ രജിസ്റ്റർ ചെയ്ത ഫോണിലേക്ക് ഒടിപി അയക്കുന്നു…',
      enterOtp: 'കസ്റ്റമർക്ക് അയച്ച 6 അക്ക കോഡ് നൽകുക.',
      verifying: 'സ്ഥിരീകരിക്കുന്നു…',
      verifyOtp: 'ഒടിപി സ്ഥിരീകരിക്കുക',
      backToSignature: 'ഒപ്പിലേക്ക് തിരികെ പോകുക',
      invoiceSavedTitle: 'ഇൻവോയ്സ് സേവ് ചെയ്തു — ഒപ്പ് എടുക്കുക',
      proofOfDeliveryNote:
        'ഐച്ഛിക ഡെലിവറി തെളിവ് (FR-12). ആവശ്യമില്ലെങ്കിൽ ഒഴിവാക്കുക.',
      signDescription: 'ഡെലിവറി സ്ഥിരീകരിക്കാൻ ഒപ്പിടുക',
      nothingToSaveTitle: 'സേവ് ചെയ്യാൻ ഒന്നുമില്ല',
      nothingToSaveBody: 'ആദ്യം ഒരു ഒപ്പ് ഇടുക, അല്ലെങ്കിൽ ഒഴിവാക്കുക.',
      confirmViaOtpInstead: 'പകരം ഒടിപി വഴി സ്ഥിരീകരിക്കുക',
      shareReceipt: 'രസീത് ഷെയർ ചെയ്യുക',
      printing: 'പ്രിന്റ് ചെയ്യുന്നു…',
      printViaBluetooth: 'ബ്ലൂടൂത്ത് വഴി പ്രിന്റ് ചെയ്യുക',
      collectViaUpi: 'യുപിഐ വഴി പിരിക്കുക',
      skipSignature: 'ഒപ്പ് ഒഴിവാക്കുക',
      scanToPayUpi: 'യുപിഐ വഴി പണമടയ്ക്കാൻ സ്കാൻ ചെയ്യുക',
      payToPrefix: 'ലേക്ക്',
      done: 'ചെയ്തു',
      printFailedTitle: 'പ്രിന്റ് പരാജയപ്പെട്ടു',
      printFailedFallbackBody:
        'പ്രിന്റ് ചെയ്യാനായില്ല — പ്രിന്റർ ജോടിയാക്കിയിട്ടുണ്ടോ, ഓണാണോ എന്ന് പരിശോധിക്കുക.',
      couldNotSendOtp:
        'ഒടിപി അയക്കാനായില്ല — ഇന്റർനെറ്റ് കണക്ഷൻ വേണം. പകരം ഒപ്പ് ഉപയോഗിക്കുക, അല്ലെങ്കിൽ വീണ്ടും ശ്രമിക്കുക.',
      incorrectOtp: 'തെറ്റായ അല്ലെങ്കിൽ കാലഹരണപ്പെട്ട ഒടിപി.',
    },
  },
  ta: {
    nav: {
      home: 'bpro FieldOps',
      spotBilling: 'ஸ்பாட் பில்லிங்',
      trip: 'பயணம்',
      expense: 'செலவு',
      attendance: 'வருகை',
      collection: 'வசூல்',
      order: 'ஆர்டர்',
      return: 'திருப்பி அனுப்புதல்',
    },
    home: {
      signOut: 'வெளியேறு',
      checkIn: 'செக் இன்',
      checkedInCheckOut: 'செக் இன் ஆனது — செக் அவுட் செய்யவும்',
      startTrip: 'பயணத்தைத் தொடங்கு',
      tripInProgress: 'பயணம் நடைபெறுகிறது — நிர்வகிக்கவும்',
      logExpense: 'செலவைப் பதிவு செய்யவும்',
      logCollection: 'பணம் வசூலிக்கவும்',
      logOrder: 'ஆர்டர் எடுக்கவும்',
      logReturn: 'திருப்பி அனுப்புதலைப் பதிவு செய்யவும்',
      syncNow: 'இப்போது ஒத்திசைக்கவும்',
      todaysRoute: 'இன்றைய பாதை',
      noRoute: 'பாதை ஒதுக்கப்படவில்லை. ஒத்திசைக்க இழுக்கவும்.',
      unknownCustomer: 'அறியப்படாத வாடிக்கையாளர்',
      outstanding: 'நிலுவை',
      syncedMessage: 'ஒத்திசைக்கப்பட்டது.',
      pushed: 'அனுப்பப்பட்டது',
      failed: 'தோல்வியடைந்தது',
      syncFailedMessage:
        'ஒத்திசைவு தோல்வியடைந்தது — தானாகவே மீண்டும் முயற்சிக்கும்.',
      notSynced: 'இன்னும் ஒத்திசைக்கப்படவில்லை',
      retrySync: 'மீண்டும் ஒத்திசைக்கவும்',
      language: 'மொழி',
    },
    common: {
      save: 'சேமி',
      cancel: 'ரத்து செய்',
      submit: 'சமர்ப்பி',
      ok: 'சரி',
      saving: 'சேமிக்கிறது…',
      savedOfflineBody:
        'ஆஃப்லைனில் சேமிக்கப்பட்டது. ஆன்லைனில் வந்தவுடன் இது தானாகவே ஒத்திசைக்கப்படும்.',
      outstandingPrefix: 'நிலுவை ₹',
    },
    pinGate: {
      setupTitle: 'சாதன பின்னை அமைக்கவும்',
      confirmTitle: 'உங்கள் பின்னை உறுதிப்படுத்தவும்',
      unlockTitle: 'உங்கள் பின்னை உள்ளிடவும்',
      errorTitle: 'பின் நிலையை சரிபார்க்க முடியவில்லை',
      errorBody:
        'சாதனத்தின் பாதுகாப்பான சேமிப்பகத்தைப் படிக்க முடியவில்லை. மறுதொடக்கத்திற்குப் பிறகு, சாதனம் ஒருமுறை திறக்கப்படுவதற்கு முன் இது நிகழலாம்.',
      retry: 'மீண்டும் முயற்சிக்கவும்',
      pinMismatch: 'பின்கள் பொருந்தவில்லை. மீண்டும் முயற்சிக்கவும்.',
      incorrectPin: 'தவறான பின்.',
      genericError: 'ஏதோ தவறு நடந்தது. மீண்டும் முயற்சிக்கவும்.',
      useBiometricPrefix: 'பயன்படுத்து',
    },
    login: {
      subtitle: 'கள முகவர் உள்நுழைவு',
      usernamePlaceholder: 'பயனர்பெயர்',
      passwordPlaceholder: 'கடவுச்சொல்',
      invalidCredentials: 'தவறான பயனர்பெயர் அல்லது கடவுச்சொல்.',
      signIn: 'உள்நுழை',
    },
    attendance: {
      checkedInTitle: 'செக் இன் ஆனது',
      sinceLabelPrefix: 'முதல் ',
      syncingSuffix: ' · ஒத்திசைக்கிறது…',
      checkOut: 'செக் அவுட் செய்யவும்',
      notCheckedInTitle: 'செக் இன் ஆகவில்லை',
      notCheckedInSubtitle:
        'செக் இன் செய்து உங்கள் நாளைத் தொடங்குங்கள் — வருகை சரிபார்ப்புக்காக உங்கள் இருப்பிடம் பதிவு செய்யப்படுகிறது.',
      checkIn: 'செக் இன்',
      checkedOutTitle: 'செக் அவுட் ஆனது',
      checkedOutBody: 'நல்ல நாள் அமையட்டும்!',
      checkOutFailTitle: 'செக் அவுட் செய்ய முடியவில்லை',
      offlineBody:
        'நீங்கள் ஆஃப்லைனில் இருப்பதாகத் தெரிகிறது. செக்-அவுட்டுக்கு இணைப்பு தேவை — ஆன்லைனுக்கு வந்தவுடன் மீண்டும் முயற்சிக்கவும்.',
      genericFailBody: 'ஏதோ தவறு நடந்தது. மீண்டும் முயற்சிக்கவும்.',
    },
    expense: {
      title: 'புதிய செலவு',
      category: 'வகை',
      categoryFuel: 'எரிபொருள்',
      categoryToll: 'சுங்கச்சாவடி',
      categoryFood: 'உணவு',
      categoryMisc: 'மற்றவை',
      amount: 'தொகை (₹)',
      notesOptional: 'குறிப்புகள் (விருப்பம்)',
      notesPlaceholder: 'எ.கா. அந்தேரி டிப்போவில் டீசல் நிரப்பியது',
      receiptPhotoOptional: 'ரசீது புகைப்படம் (விருப்பம்)',
      takePhoto: 'புகைப்படம் எடு',
      chooseFromGallery: 'கேலரியில் இருந்து தேர்வு செய்',
      receiptAttached: 'ரசீது இணைக்கப்பட்டது ✓',
      invalidAmount: 'சரியான தொகையை உள்ளிடவும்.',
      saved: 'செலவு சேமிக்கப்பட்டது',
      save: 'செலவைச் சேமி',
    },
    receipt: {
      title: 'புதிய வசூல்',
      customer: 'வாடிக்கையாளர்',
      noCustomers:
        'இன்னும் வாடிக்கையாளர்கள் ஒத்திசைக்கப்படவில்லை — முதலில் முகப்புத் திரையில் இருந்து ஒத்திசைக்கவும்.',
      paymentMode: 'கட்டண முறை',
      modeCash: 'பணம்',
      modeCheque: 'காசோலை',
      modeUpi: 'UPI',
      modeCard: 'கார்டு',
      amount: 'தொகை (₹)',
      chequeNumber: 'காசோலை எண்',
      transactionReference: 'பரிவர்த்தனை குறிப்பு',
      chequePlaceholder: 'எ.கா. 000123',
      upiRefPlaceholder: 'எ.கா. UPI குறிப்பு',
      selectCustomer: 'முதலில் ஒரு வாடிக்கையாளரைத் தேர்வு செய்யவும்.',
      invalidAmount: 'சரியான தொகையை உள்ளிடவும்.',
      enterReference: 'காசோலை எண் / பரிவர்த்தனை குறிப்பை உள்ளிடவும்.',
      saved: 'வசூல் சேமிக்கப்பட்டது',
      save: 'வசூலைச் சேமி',
    },
    order: {
      title: 'புதிய ஆர்டர்',
      customer: 'வாடிக்கையாளர்',
      items: 'பொருட்கள்',
      notesOptional: 'குறிப்புகள் (விருப்பம்)',
      notesPlaceholder: 'எ.கா. வெள்ளிக்கிழமை காலை வழங்கவும்',
      estimatedTotalPrefix: 'மதிப்பிடப்பட்ட மொத்தம்: ₹',
      finalPricingNote:
        'இறுதி விலை/ஜிஎஸ்டி நிறைவேற்றும் போது பின் அலுவலகத்தால் பயன்படுத்தப்படும்.',
      selectCustomer: 'முதலில் ஒரு வாடிக்கையாளரைத் தேர்வு செய்யவும்.',
      enterQty: 'குறைந்தது ஒரு பொருளுக்கேனும் அளவை உள்ளிடவும்.',
      saved: 'ஆர்டர் சேமிக்கப்பட்டது',
      save: 'ஆர்டரைச் சேமி',
    },
    return: {
      title: 'புதிய திருப்பி அனுப்புதல்',
      invoice: 'விலைப்பட்டியல்',
      noInvoices:
        'திருப்பி அனுப்ப ஒத்திசைக்கப்பட்ட விலைப்பட்டியல்கள் இன்னும் இல்லை — திருப்பி அனுப்புவதற்கு அதன் அசல் விற்பனை ஒத்திசைக்கப்பட்டிருக்க வேண்டும்.',
      unknownCustomer: 'அறியப்படாத வாடிக்கையாளர்',
      returnedItems: 'திருப்பி அனுப்பப்பட்ட பொருட்கள்',
      soldPrefix: 'விற்றது ',
      reason: 'காரணம்',
      sellable: 'விற்கக்கூடியது',
      damaged: 'சேதமடைந்தது',
      expired: 'காலாவதியானது',
      reasonDamagedInTransit: 'போக்குவரத்தில் சேதமடைந்தது',
      reasonExpired: 'காலாவதியானது',
      reasonWrongItem: 'தவறான பொருள்',
      reasonCustomerRejection: 'வாடிக்கையாளர் நிராகரித்தார்',
      selectInvoice: 'முதலில் ஒரு விலைப்பட்டியலைத் தேர்வு செய்யவும்.',
      enterQty: 'குறைந்தது ஒரு வரிக்கேனும் திருப்பி அனுப்பிய அளவை உள்ளிடவும்.',
      overReturnPrefix: 'இதற்கு மேல் திருப்பி அனுப்ப முடியாது —',
      overReturnMiddle: 'விற்கப்பட்டதில் இருந்து',
      saved: 'திருப்பி அனுப்புதல் சேமிக்கப்பட்டது',
      save: 'திருப்பி அனுப்புதலைச் சேமி',
    },
    trip: {
      startTitle: 'உங்கள் பயணத்தைத் தொடங்கவும்',
      odometerStartPlaceholder: 'தொடக்க ஓடோமீட்டர் அளவீடு',
      startTrip: 'பயணத்தைத் தொடங்கு',
      inProgressTitle: 'பயணம் நடைபெறுகிறது',
      startedAtOdometerPrefix: 'ஓடோமீட்டரில் தொடங்கியது ',
      odometerEndPlaceholder: 'இறுதி ஓடோமீட்டர் அளவீடு',
      endTrip: 'பயணத்தை முடி',
      notVisited: 'சென்று வரவில்லை',
      checkedIn: 'செக் இன் ஆனது',
      checkedOut: 'செக் அவுட் ஆனது',
      tripEndedTitle: 'பயணம் முடிந்தது',
      tripEndedBody: 'ஆஃப்லைனில் சேமிக்கப்பட்டது, தானாகவே ஒத்திசைக்கப்படும்.',
    },
    spotBilling: {
      noCustomerSelected: 'வாடிக்கையாளர் தேர்வு செய்யப்படவில்லை',
      outstandingPrefix: 'நிலுவை ₹',
      scanBarcode: 'பார்கோடை ஸ்கேன் செய்',
      cancel: 'ரத்து செய்',
      estimatedTotalPrefix: 'மதிப்பிடப்பட்ட மொத்தம்: ₹',
      finalGstNote:
        'ஒத்திசைவின் போது இறுதி ஜிஎஸ்டி/தள்ளுபடி சர்வரால் மீண்டும் கணக்கிடப்படும்.',
      save: 'விலைப்பட்டியலைச் சேமி',
      itemNotFoundTitle: 'பொருள் கிடைக்கவில்லை',
      itemNotFoundBodyPrefix: 'பார்கோடுடன் பொருந்தும் பொருள் இல்லை',
      selectCustomer: 'முதலில் ஒரு வாடிக்கையாளரைத் தேர்வு செய்யவும்.',
      addAtLeastOneItem: 'குறைந்தது ஒரு பொருளையாவது சேர்க்கவும்.',
      missingSetupTitle: 'அமைப்பு தரவு இல்லை',
      missingSetupBody:
        'வேன் ஸ்டாக் மற்றும் ஜிஎஸ்டி அமைப்பு ஆஃப்லைனில் கிடைக்க, பில்லிங் செய்வதற்கு முன் குறைந்தது ஒரு முறையாவது ஒத்திசைக்கவும்.',
      upiNotConfiguredTitle: 'UPI அமைக்கப்படவில்லை',
      upiNotConfiguredBody:
        'இந்த வரிசைப்படுத்தலுக்கு UPI ஐடி இன்னும் அமைக்கப்படவில்லை — மாஸ்டர் அமைப்புகளில் ஒன்றைச் சேர்க்க உங்கள் நிர்வாகியிடம் கேளுங்கள்.',
      confirmOtpTitle: 'OTP மூலம் உறுதிப்படுத்தவும்',
      sendingOtp:
        'வாடிக்கையாளரின் பதிவுசெய்யப்பட்ட தொலைபேசிக்கு OTP அனுப்பப்படுகிறது…',
      enterOtp: 'வாடிக்கையாளருக்கு அனுப்பப்பட்ட 6 இலக்க குறியீட்டை உள்ளிடவும்.',
      verifying: 'சரிபார்க்கிறது…',
      verifyOtp: 'OTP-ஐச் சரிபார்க்கவும்',
      backToSignature: 'கையொப்பத்திற்குத் திரும்பு',
      invoiceSavedTitle: 'விலைப்பட்டியல் சேமிக்கப்பட்டது — கையொப்பம் பெறவும்',
      proofOfDeliveryNote:
        'விருப்பமான டெலிவரி சான்று (FR-12). தேவையில்லை என்றால் தவிர்க்கவும்.',
      signDescription: 'டெலிவரியை உறுதிப்படுத்த கையொப்பமிடவும்',
      nothingToSaveTitle: 'சேமிக்க எதுவும் இல்லை',
      nothingToSaveBody: 'முதலில் ஒரு கையொப்பம் இடவும், அல்லது தவிர்க்கவும்.',
      confirmViaOtpInstead: 'அதற்குப் பதிலாக OTP மூலம் உறுதிப்படுத்தவும்',
      shareReceipt: 'ரசீதைப் பகிர்',
      printing: 'அச்சிடுகிறது…',
      printViaBluetooth: 'ப்ளூடூத் மூலம் அச்சிடு',
      collectViaUpi: 'UPI மூலம் வசூலிக்கவும்',
      skipSignature: 'கையொப்பத்தைத் தவிர்க்கவும்',
      scanToPayUpi: 'UPI மூலம் செலுத்த ஸ்கேன் செய்யவும்',
      payToPrefix: 'க்கு',
      done: 'முடிந்தது',
      printFailedTitle: 'அச்சிடல் தோல்வியடைந்தது',
      printFailedFallbackBody:
        'அச்சிட முடியவில்லை — பிரிண்டர் இணைக்கப்பட்டு, இயக்கத்தில் உள்ளதா எனச் சரிபார்க்கவும்.',
      couldNotSendOtp:
        'OTP அனுப்ப முடியவில்லை — இணைய இணைப்பு தேவை. அதற்குப் பதிலாக கையொப்பத்தைப் பயன்படுத்தவும், அல்லது மீண்டும் முயற்சிக்கவும்.',
      incorrectOtp: 'தவறான அல்லது காலாவதியான OTP.',
    },
  },
};
