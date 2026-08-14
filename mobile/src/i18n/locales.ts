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
  hi: {
    nav: {
      home: 'bpro FieldOps',
      spotBilling: 'स्पॉट बिलिंग',
      trip: 'ट्रिप',
      expense: 'खर्च',
      attendance: 'हाज़िरी',
      collection: 'वसूली',
      order: 'ऑर्डर',
      return: 'वापसी',
    },
    home: {
      signOut: 'साइन आउट',
      checkIn: 'चेक इन करें',
      checkedInCheckOut: 'चेक इन है — चेक आउट करें',
      startTrip: 'ट्रिप शुरू करें',
      tripInProgress: 'ट्रिप चालू है — प्रबंधित करें',
      logExpense: 'खर्च दर्ज करें',
      logCollection: 'भुगतान वसूलें',
      logOrder: 'ऑर्डर लें',
      logReturn: 'वापसी दर्ज करें',
      syncNow: 'अभी सिंक करें',
      todaysRoute: 'आज का रूट',
      noRoute: 'कोई रूट असाइन नहीं है। सिंक के लिए खींचें।',
      unknownCustomer: 'अज्ञात ग्राहक',
      outstanding: 'बकाया',
      syncedMessage: 'सिंक हो गया।',
      pushed: 'भेजे गए',
      failed: 'विफल',
      syncFailedMessage: 'सिंक विफल — यह अपने आप फिर से कोशिश करेगा।',
      notSynced: 'सिंक नहीं हुए',
      retrySync: 'फिर से सिंक करें',
      language: 'भाषा',
    },
    common: {
      save: 'सेव करें',
      cancel: 'रद्द करें',
      submit: 'जमा करें',
      ok: 'ठीक है',
      saving: 'सेव हो रहा है…',
      savedOfflineBody:
        'ऑफ़लाइन सेव हो गया। ऑनलाइन होते ही यह अपने आप सिंक हो जाएगा।',
      outstandingPrefix: 'बकाया ₹',
    },
    pinGate: {
      setupTitle: 'डिवाइस पिन सेट करें',
      confirmTitle: 'अपना पिन कन्फर्म करें',
      unlockTitle: 'अपना पिन डालें',
      errorTitle: 'पिन स्थिति सत्यापित नहीं हो सकी',
      errorBody:
        'डिवाइस का सुरक्षित स्टोरेज नहीं पढ़ा जा सका। यह रीस्टार्ट के तुरंत बाद हो सकता है, डिवाइस के एक बार अनलॉक होने से पहले।',
      retry: 'फिर से कोशिश करें',
      pinMismatch: 'पिन मेल नहीं खाए। फिर से कोशिश करें।',
      incorrectPin: 'गलत पिन।',
      genericError: 'कुछ गड़बड़ हो गई। फिर से कोशिश करें।',
      useBiometricPrefix: 'इस्तेमाल करें',
    },
    login: {
      subtitle: 'फील्ड एजेंट साइन इन',
      usernamePlaceholder: 'यूज़रनेम',
      passwordPlaceholder: 'पासवर्ड',
      invalidCredentials: 'गलत यूज़रनेम या पासवर्ड।',
      signIn: 'साइन इन करें',
    },
    attendance: {
      checkedInTitle: 'चेक इन है',
      sinceLabelPrefix: 'तब से ',
      syncingSuffix: ' · सिंक हो रहा है…',
      checkOut: 'चेक आउट करें',
      notCheckedInTitle: 'चेक इन नहीं है',
      notCheckedInSubtitle:
        'चेक इन करके अपना दिन शुरू करें — हाज़िरी सत्यापन के लिए आपका स्थान दर्ज किया जाता है।',
      checkIn: 'चेक इन करें',
      checkedOutTitle: 'चेक आउट हो गया',
      checkedOutBody: 'आपका दिन शुभ हो!',
      checkOutFailTitle: 'चेक आउट नहीं हो सका',
      offlineBody:
        'लगता है आप ऑफ़लाइन हैं। चेक-आउट के लिए इंटरनेट कनेक्शन चाहिए — ऑनलाइन होने पर फिर से कोशिश करें।',
      genericFailBody: 'कुछ गड़बड़ हो गई। कृपया फिर से कोशिश करें।',
    },
    expense: {
      title: 'नया खर्च',
      category: 'श्रेणी',
      categoryFuel: 'ईंधन',
      categoryToll: 'टोल',
      categoryFood: 'भोजन',
      categoryMisc: 'अन्य',
      amount: 'राशि (₹)',
      notesOptional: 'नोट्स (वैकल्पिक)',
      notesPlaceholder: 'जैसे अंधेरी डिपो पर डीज़ल भराया',
      receiptPhotoOptional: 'रसीद फ़ोटो (वैकल्पिक)',
      takePhoto: 'फ़ोटो लें',
      chooseFromGallery: 'गैलरी से चुनें',
      receiptAttached: 'रसीद जोड़ी गई ✓',
      invalidAmount: 'सही राशि दर्ज करें।',
      saved: 'खर्च सेव हो गया',
      save: 'खर्च सेव करें',
    },
    receipt: {
      title: 'नई वसूली',
      customer: 'ग्राहक',
      noCustomers:
        'अभी कोई ग्राहक सिंक नहीं हुआ — पहले होम स्क्रीन से सिंक करें।',
      paymentMode: 'भुगतान का तरीका',
      modeCash: 'नकद',
      modeCheque: 'चेक',
      modeUpi: 'यूपीआई',
      modeCard: 'कार्ड',
      amount: 'राशि (₹)',
      chequeNumber: 'चेक नंबर',
      transactionReference: 'ट्रांज़ैक्शन रेफरेंस',
      chequePlaceholder: 'जैसे 000123',
      upiRefPlaceholder: 'जैसे यूपीआई रेफ',
      selectCustomer: 'पहले एक ग्राहक चुनें।',
      invalidAmount: 'सही राशि दर्ज करें।',
      enterReference: 'चेक नंबर / ट्रांज़ैक्शन रेफरेंस दर्ज करें।',
      saved: 'वसूली सेव हो गई',
      save: 'वसूली सेव करें',
    },
    order: {
      title: 'नया ऑर्डर',
      customer: 'ग्राहक',
      items: 'आइटम',
      notesOptional: 'नोट्स (वैकल्पिक)',
      notesPlaceholder: 'जैसे शुक्रवार सुबह डिलीवर करें',
      estimatedTotalPrefix: 'अनुमानित कुल: ₹',
      finalPricingNote:
        'अंतिम मूल्य/जीएसटी पूर्ति के समय बैक ऑफ़िस द्वारा लागू किया जाएगा।',
      selectCustomer: 'पहले एक ग्राहक चुनें।',
      enterQty: 'कम से कम एक आइटम की मात्रा दर्ज करें।',
      saved: 'ऑर्डर सेव हो गया',
      save: 'ऑर्डर सेव करें',
    },
    return: {
      title: 'नई वापसी',
      invoice: 'इनवॉइस',
      noInvoices:
        'वापसी के लिए अभी कोई सिंक इनवॉइस नहीं है — वापसी के लिए मूल बिक्री का सिंक होना ज़रूरी है।',
      unknownCustomer: 'अज्ञात ग्राहक',
      returnedItems: 'लौटाए गए आइटम',
      soldPrefix: 'बेचा ',
      reason: 'कारण',
      sellable: 'बिक्री योग्य',
      damaged: 'क्षतिग्रस्त',
      expired: 'एक्सपायर्ड',
      reasonDamagedInTransit: 'रास्ते में क्षतिग्रस्त',
      reasonExpired: 'एक्सपायर्ड',
      reasonWrongItem: 'गलत आइटम',
      reasonCustomerRejection: 'ग्राहक ने अस्वीकार किया',
      selectInvoice: 'पहले एक इनवॉइस चुनें।',
      enterQty: 'कम से कम एक लाइन की लौटाई गई मात्रा दर्ज करें।',
      overReturnPrefix: 'इससे ज़्यादा वापस नहीं कर सकते —',
      overReturnMiddle: 'बेचे गए में से',
      saved: 'वापसी सेव हो गई',
      save: 'वापसी सेव करें',
    },
    trip: {
      startTitle: 'अपनी ट्रिप शुरू करें',
      odometerStartPlaceholder: 'शुरुआती ओडोमीटर रीडिंग',
      startTrip: 'ट्रिप शुरू करें',
      inProgressTitle: 'ट्रिप चालू है',
      startedAtOdometerPrefix: 'ओडोमीटर पर शुरू हुई ',
      odometerEndPlaceholder: 'अंतिम ओडोमीटर रीडिंग',
      endTrip: 'ट्रिप खत्म करें',
      notVisited: 'नहीं गए',
      checkedIn: 'चेक इन है',
      checkedOut: 'चेक आउट हो गया',
      tripEndedTitle: 'ट्रिप खत्म हुई',
      tripEndedBody: 'ऑफ़लाइन सेव हो गई और अपने आप सिंक होगी।',
    },
    spotBilling: {
      noCustomerSelected: 'कोई ग्राहक नहीं चुना गया',
      outstandingPrefix: 'बकाया ₹',
      scanBarcode: 'बारकोड स्कैन करें',
      cancel: 'रद्द करें',
      estimatedTotalPrefix: 'अनुमानित कुल: ₹',
      finalGstNote:
        'अंतिम जीएसटी/छूट सिंक के समय सर्वर द्वारा फिर से गणना की जाएगी।',
      save: 'इनवॉइस सेव करें',
      itemNotFoundTitle: 'आइटम नहीं मिला',
      itemNotFoundBodyPrefix: 'बारकोड से कोई आइटम मेल नहीं खाता',
      selectCustomer: 'पहले एक ग्राहक चुनें।',
      addAtLeastOneItem: 'कम से कम एक आइटम जोड़ें।',
      missingSetupTitle: 'सेटअप डेटा गायब है',
      missingSetupBody:
        'बिलिंग से पहले कम से कम एक बार सिंक करें ताकि वैन स्टॉक और जीएसटी सेटअप ऑफ़लाइन उपलब्ध हों।',
      upiNotConfiguredTitle: 'यूपीआई सेट नहीं है',
      upiNotConfiguredBody:
        'इस डिप्लॉयमेंट के लिए अभी कोई यूपीआई आईडी सेट नहीं है — अपने एडमिन से मास्टर सेटिंग्स में एक जोड़ने को कहें।',
      confirmOtpTitle: 'ओटीपी से पुष्टि करें',
      sendingOtp: 'ग्राहक के रजिस्टर्ड फ़ोन पर ओटीपी भेजा जा रहा है…',
      enterOtp: 'ग्राहक को भेजा गया 6 अंकों का कोड दर्ज करें।',
      verifying: 'सत्यापित हो रहा है…',
      verifyOtp: 'ओटीपी सत्यापित करें',
      backToSignature: 'हस्ताक्षर पर वापस जाएं',
      invoiceSavedTitle: 'इनवॉइस सेव हुआ — हस्ताक्षर लें',
      proofOfDeliveryNote:
        'डिलीवरी का वैकल्पिक प्रमाण (FR-12)। ज़रूरत न हो तो छोड़ें।',
      signDescription: 'डिलीवरी की पुष्टि के लिए हस्ताक्षर करें',
      nothingToSaveTitle: 'सेव करने के लिए कुछ नहीं',
      nothingToSaveBody: 'पहले हस्ताक्षर बनाएं, या छोड़ें।',
      confirmViaOtpInstead: 'इसके बजाय ओटीपी से पुष्टि करें',
      shareReceipt: 'रसीद शेयर करें',
      printing: 'प्रिंट हो रहा है…',
      printViaBluetooth: 'ब्लूटूथ से प्रिंट करें',
      collectViaUpi: 'यूपीआई से वसूलें',
      skipSignature: 'हस्ताक्षर छोड़ें',
      scanToPayUpi: 'यूपीआई से भुगतान के लिए स्कैन करें',
      payToPrefix: 'को',
      done: 'हो गया',
      printFailedTitle: 'प्रिंट विफल',
      printFailedFallbackBody:
        'प्रिंट नहीं हो सका — जांचें कि प्रिंटर जोड़ा और चालू है।',
      couldNotSendOtp:
        'ओटीपी नहीं भेजा जा सका — इंटरनेट कनेक्शन चाहिए। इसके बजाय हस्ताक्षर का उपयोग करें, या फिर से कोशिश करें।',
      incorrectOtp: 'गलत या एक्सपायर्ड ओटीपी।',
    },
  },
};
