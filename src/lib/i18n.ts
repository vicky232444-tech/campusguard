'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Language = 'en' | 'hi'

interface I18nStore {
  lang: Language
  setLang: (lang: Language) => void
  toggleLang: () => void
  t: (key: string) => string
}

export const TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    // Navigation
    'nav.dashboard': 'Command Center',
    'nav.dashboard.hint': 'Building overview',
    'nav.monitoring': 'Building Monitor',
    'nav.monitoring.hint': 'Live sensors & limits',
    'nav.security': 'Security',
    'nav.security.hint': 'Access & visitors',
    'nav.sos': 'Emergency SOS',
    'nav.sos.hint': 'Trigger & respond',
    'nav.maintenance': 'Maintenance',
    'nav.maintenance.hint': 'Fault reports & repairs',

    // Header & Global
    'header.title': 'CampusGuard',
    'header.subtitle': 'Unified Safety, Security & Maintenance Command',
    'header.offline': 'Offline Mode (Actions saved locally)',
    'header.online': 'Online & Synchronized',
    'header.signout': 'Sign out / Switch account',
    'header.siren_active': 'Emergency Siren Active (30s continuous)',
    'header.silence_siren': 'Silence Alarm',

    // Login / Register
    'auth.signin': 'Sign In',
    'auth.create_account': 'Create Account',
    'auth.welcome': 'Welcome to CampusGuard',
    'auth.subtitle': 'Enter your credentials to access the security command center',
    'auth.fullname': 'Full Name',
    'auth.username': 'Username',
    'auth.email': 'Email Address',
    'auth.password': 'Password',
    'auth.role': 'Account Role',
    'auth.dept': 'Department / Year',
    'auth.btn_signin': 'Sign In to Command Center',
    'auth.btn_create': 'Create & Open Dashboard',
    'auth.demo_helper': 'Demo Accounts (1-Click Fill)',
    'auth.have_account': 'Already have an account? Sign in',
    'auth.new_account': 'New to CampusGuard? Create an account',

    // SOS
    'sos.title': 'Emergency SOS Trigger',
    'sos.subtitle': 'Sends high-priority distress alerts with continuous audio alarm',
    'sos.hold_btn': 'HOLD FOR SOS',
    'sos.holding': 'KEEP HOLDING…',
    'sos.voice_trigger': 'Voice SOS Activation',
    'sos.voice_desc': 'Speak trigger keywords: "Help", "Bachao", "Emergency", "Fire"',
    'sos.voice_listening': 'Voice Listening Active…',
    'sos.voice_start': 'Start Voice SOS Mode',
    'sos.voice_stop': 'Stop Voice Listening',
    'sos.environmental_checks': 'Live Environmental Hazard Checks',
    'sos.ppm': 'Smoke / Toxic Gas (PPM)',
    'sos.particle': 'Dust & Particles (PM2.5)',
    'sos.noise': 'Ambient Noise (dB)',
    'sos.noise_normal': 'Normal',
    'sos.noise_loud': 'High Noise',
    'sos.emergency_numbers': 'Direct Emergency Helplines',
    'sos.cancel_false': 'Mark False Alarm / Cancel SOS',
    'sos.false_desc': 'If triggered by mistake, confirm to notify security of no danger',

    // Maintenance
    'maint.report_fault': 'Report a Fault',
    'maint.what_broken': 'What is broken / malfunctioning?',
    'maint.category': 'Category',
    'maint.tech_field': 'Select Technician by Field',
    'maint.camera_capture': 'Take Photo with Camera',
    'maint.photo_validation': 'Photo Verified (Good clarity & resolution)',
    'maint.submit_report': 'Submit Complaint',

    // Security & Visitors
    'sec.visitor_checkin': 'Visitor Check-in',
    'sec.auto_fill': 'Instant Smart Auto-Fill',
    'sec.templates': 'Quick Templates',
    'sec.issue_pass': 'Issue Pass & Check In',
  },
  hi: {
    // Navigation
    'nav.dashboard': 'कमान केंद्र',
    'nav.dashboard.hint': 'परिसर का संपूर्ण दृश्य',
    'nav.monitoring': 'बिल्डिंग मॉनिटर',
    'nav.monitoring.hint': 'सेंसर्स व सीमाएं',
    'nav.security': 'सुरक्षा नियंत्रण',
    'nav.security.hint': 'प्रवेश व आगंतुक',
    'nav.sos': 'आपातकालीन SOS',
    'nav.sos.hint': 'अलर्ट भेजें व देखें',
    'nav.maintenance': 'रखरखाव व मरम्मत',
    'nav.maintenance.hint': 'दोष रिपोर्ट व शिकायतें',

    // Header & Global
    'header.title': 'कैंपसगार्ड',
    'header.subtitle': 'एकीकृत सुरक्षा, संरक्षा व रखरखाव प्रणाली',
    'header.offline': 'ऑफलाइन मोड (कार्य लोकल सेव हो रहे हैं)',
    'header.online': 'ऑनलाइन व सिंक',
    'header.signout': 'लॉग आउट / खाता बदलें',
    'header.siren_active': 'आपातकालीन सायरन चालू है (30 सेकंड निरंतर)',
    'header.silence_siren': 'सायरन बंद करें',

    // Login / Register
    'auth.signin': 'साइन इन',
    'auth.create_account': 'नया खाता बनाएं',
    'auth.welcome': 'कैंपसगार्ड में आपका स्वागत है',
    'auth.subtitle': 'सुरक्षा कमांड सेंटर में प्रवेश करने के लिए विवरण दर्ज करें',
    'auth.fullname': 'पूरा नाम',
    'auth.username': 'उपयोगकर्ता नाम (Username)',
    'auth.email': 'ईमेल पता',
    'auth.password': 'पासवर्ड',
    'auth.role': 'भूमिका (Role)',
    'auth.dept': 'विभाग / कक्षा',
    'auth.btn_signin': 'कमांड सेंटर में साइन इन करें',
    'auth.btn_create': 'खाता बनाएं व डैशबोर्ड खोलें',
    'auth.demo_helper': 'डेमो खाते (1-क्लिक ऑटोफिल)',
    'auth.have_account': 'पहले से खाता है? साइन इन करें',
    'auth.new_account': 'नया खाता चाहिए? यहाँ रजिस्टर करें',

    // SOS
    'sos.title': 'आपातकालीन SOS अलर्ट',
    'sos.subtitle': 'तत्काल सुरक्षा दल को सतर्क करें और 30 सेकंड सायरन बजाएं',
    'sos.hold_btn': 'SOS के लिए दबाए रखें',
    'sos.holding': 'दबाए रखें…',
    'sos.voice_trigger': 'आवाज़ द्वारा SOS ट्रिगर',
    'sos.voice_desc': 'बोलें: "Help", "बचाओ", "Emergency", "आग", "खतरा"',
    'sos.voice_listening': 'आवाज़ पहचान चालू है… सुन रहे हैं',
    'sos.voice_start': 'वॉयस SOS मोड चालू करें',
    'sos.voice_stop': 'वॉयस मोड बंद करें',
    'sos.environmental_checks': 'पर्यावरण व खतरा जांच',
    'sos.ppm': 'धुआं व जहरीली गैस (PPM)',
    'sos.particle': 'धूल कण (PM2.5 / PM10)',
    'sos.noise': 'परिवेश का शोर स्तर (dB)',
    'sos.noise_normal': 'सामान्य',
    'sos.noise_loud': 'अत्यधिक शोर / चीख',
    'sos.emergency_numbers': 'सीधे आपातकालीन हेल्पलाइन नंबर',
    'sos.cancel_false': 'झूठा अलर्ट / SOS रद्द करें',
    'sos.false_desc': 'गलती से दबा हो तो तुरंत सुरक्षा दल को सूचित करें',

    // Maintenance
    'maint.report_fault': 'दोष / खराबी की शिकायत दर्ज करें',
    'maint.what_broken': 'क्या खराब या टूटा हुआ है?',
    'maint.category': 'श्रेणी चुनें',
    'maint.tech_field': 'कार्यक्षेत्र अनुसार तकनीशियन चुनें',
    'maint.camera_capture': 'कैमरे से सीधा फोटो खींचें',
    'maint.photo_validation': 'फोटो सत्यापित (स्पष्ट रोशनी व रेजोल्यूशन)',
    'maint.submit_report': 'शिकायत दर्ज करें',

    // Security & Visitors
    'sec.visitor_checkin': 'आगंतुक प्रवेश पर्ची',
    'sec.auto_fill': 'त्वरित स्मार्ट ऑटो-फिल',
    'sec.templates': 'तैयार टेम्पलेट्स',
    'sec.issue_pass': 'पास जारी करें व प्रवेश दें',
  },
}

export const useI18n = create<I18nStore>()(
  persist(
    (set, get) => ({
      lang: 'en',
      setLang: (lang) => set({ lang }),
      toggleLang: () => set({ lang: get().lang === 'en' ? 'hi' : 'en' }),
      t: (key) => {
        const lang = get().lang
        return TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.en[key] ?? key
      },
    }),
    {
      name: 'campusguard_lang',
    }
  )
)
