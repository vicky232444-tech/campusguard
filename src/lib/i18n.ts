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
    'header.title': 'OmniGuard',
    'header.subtitle': 'Unified Building Operations, Safety & Maintenance Hub',
    'header.offline': 'Offline Mode (Actions saved locally)',
    'header.online': 'Online & Synchronized',
    'header.signout': 'Sign out / Switch account',
    'header.siren_active': 'Emergency Siren Active (30s continuous)',
    'header.silence_siren': 'Silence Alarm',

    // Login / Register
    'auth.signin': 'Sign In',
    'auth.create_account': 'Create Account',
    'auth.welcome': 'Welcome to OmniGuard',
    'auth.subtitle': 'Enter your credentials to access the facility command center',
    'auth.fullname': 'Full Name',
    'auth.username': 'Username',
    'auth.email': 'Email Address',
    'auth.password': 'Password',
    'auth.role': 'Account Role',
    'auth.dept': 'Department / Unit / Floor',
    'auth.btn_signin': 'Sign In to Command Center',
    'auth.btn_create': 'Create & Open Dashboard',
    'auth.demo_helper': 'Quick Test Accounts (1-Click Fill)',
    'auth.have_account': 'Already have an account? Sign in',
    'auth.new_account': 'New to OmniGuard? Create an account',

    // Dashboard — Admin
    'dash.admin.title': 'Facility Command & Control Center',
    'dash.kpi.alerts': 'Active Alerts',
    'dash.kpi.sos': 'Active SOS',
    'dash.kpi.verif': 'Resident & Member Records',
    'dash.kpi.repairs': 'Open Repairs',
    'dash.kpi.visitors': 'Visitors Inside',
    'dash.kpi.sensors': 'Sensors Online',
    'dash.telemetry.trend': 'Sensor Telemetry Trend — 2 Hours',
    'dash.alerts.severity': 'Alerts by Severity (24h)',
    'dash.repair.pipeline': 'Repair Pipeline Status',
    'dash.building.zones': 'Building Zones Status',
    'dash.operations.feed': 'Building Operations Feed',
    'dash.sos.action_required': 'Action Required: Pending SOS Broadcast Requests',
    'dash.sos.approve_all': 'Approve & Trigger All Devices',
    'dash.sos.decline': 'Decline',

    // Dashboard — Resident & Student
    'dash.res.id_card': 'Digital Resident & Member Card',
    'dash.res.unit': 'Flat / Unit / Room',
    'dash.res.enrolled': 'Membership / Enrolled Year',
    'dash.res.status': 'Active Occupant',
    'dash.res.emergency_hub': 'Emergency Safety Hub',
    'dash.res.free_will': 'Free Will SOS',
    'dash.res.goto_sos': 'Go to Emergency SOS',
    'dash.res.my_reports': 'My Registered Building Complaints',
    'dash.res.directory': 'Quick Emergency Directory',
    'dash.res.assembly': 'Designated Safety Assembly Points',

    // Dashboard — Technician
    'dash.tech.work_orders': 'Active Work Orders',
    'dash.tech.ai_check': 'In AI Tamper Check',
    'dash.tech.resolved': 'Resolved Repairs',
    'dash.tech.total': 'Total Tracked Repairs',
    'dash.tech.queue_title': 'Field Work Orders Requiring Action',

    // Dashboard — Security
    'dash.sec.visitors_inside': 'Active Visitors Inside',
    'dash.sec.sos_signals': 'Active SOS Signals',
    'dash.sec.incidents': 'Security Incidents (24h)',
    'dash.sec.swipes': 'Total Gate Swipes',
    'dash.sec.protocols': 'Perimeter & Gate Protocols',

    // SOS
    'sos.title': 'Emergency SOS Trigger',
    'sos.subtitle': 'Sends high-priority distress alerts with continuous audio alarm',
    'sos.access_control': 'SOS Access & Permission Control',
    'sos.admin_mass_title': 'Facility-Wide Mass Evacuation Broadcast (Admin)',
    'sos.personal_distress_title': 'Personal Emergency Distress SOS (Free Will)',
    'sos.request_broadcast_title': 'Request Facility-Wide All-Devices Broadcast',
    'sos.pending_requests': 'Pending SOS Broadcast Requests',
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
    'maint.student_verification': 'Identity & Resident Verification (Admin)',
    'maint.tab_repairs': 'Building Repairs & Complaints',
    'maint.tab_students': 'Identity & Resident Verification Records',

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
    'header.title': 'ओम्नीगार्ड (OmniGuard)',
    'header.subtitle': 'एकीकृत भवन सुरक्षा, संरक्षा व रखरखाव प्रणाली',
    'header.offline': 'ऑफलाइन मोड (कार्य लोकल सेव हो रहे हैं)',
    'header.online': 'ऑनलाइन व सिंक',
    'header.signout': 'लॉग आउट / खाता बदलें',
    'header.siren_active': 'आपातकालीन सायरन चालू है (30 सेकंड निरंतर)',
    'header.silence_siren': 'सायरन बंद करें',

    // Login / Register
    'auth.signin': 'साइन इन',
    'auth.create_account': 'नया खाता बनाएं',
    'auth.welcome': 'ओम्नीगार्ड में आपका स्वागत है',
    'auth.subtitle': 'सुरक्षा कमांड सेंटर में प्रवेश करने के लिए विवरण दर्ज करें',
    'auth.fullname': 'पूरा नाम',
    'auth.username': 'उपयोगकर्ता नाम (Username)',
    'auth.email': 'ईमेल पता',
    'auth.password': 'पासवर्ड',
    'auth.role': 'भूमिका (Role)',
    'auth.dept': 'विभाग / फ्लैट / तल',
    'auth.btn_signin': 'कमांड सेंटर में साइन इन करें',
    'auth.btn_create': 'खाता बनाएं व डैशबोर्ड खोलें',
    'auth.demo_helper': 'परीक्षण खाते (1-क्लिक ऑटोफिल)',
    'auth.have_account': 'पहले से खाता है? साइन इन करें',
    'auth.new_account': 'नया खाता चाहिए? यहाँ रजिस्टर करें',

    // Dashboard — Admin
    'dash.admin.title': 'भवन कमान व नियंत्रण केंद्र',
    'dash.kpi.alerts': 'सक्रिय अलर्ट',
    'dash.kpi.sos': 'सक्रिय SOS',
    'dash.kpi.verif': 'निवासी व सदस्य रिकॉर्ड',
    'dash.kpi.repairs': 'लंबित मरम्मत कार्य',
    'dash.kpi.visitors': 'अंदर उपस्थित आगंतुक',
    'dash.kpi.sensors': 'सेंसर्स ऑनलाइन',
    'dash.telemetry.trend': 'सेंसर टेलीमेट्री रुझान — 2 घंटे',
    'dash.alerts.severity': 'गंभीरता अनुसार अलर्ट (24 घंटे)',
    'dash.repair.pipeline': 'मरम्मत कार्य स्थिति',
    'dash.building.zones': 'भवन क्षेत्र स्थिति',
    'dash.operations.feed': 'परिचालन गतिविधि फीड',
    'dash.sos.action_required': 'कार्रवाई आवश्यक: लंबित SOS प्रसारण अनुरोध',
    'dash.sos.approve_all': 'स्वीकृत करें व सभी उपकरणों पर अलर्ट बजाएं',
    'dash.sos.decline': 'अस्वीकार करें',

    // Dashboard — Resident & Student
    'dash.res.id_card': 'डिजिटल पहचान पत्र (निवासी / सदस्य)',
    'dash.res.unit': 'फ्लैट / यूनिट / कमरा',
    'dash.res.enrolled': 'संबद्ध वर्ष / सत्र',
    'dash.res.status': 'सक्रिय निवासी / सदस्य',
    'dash.res.emergency_hub': 'आपातकालीन सुरक्षा हब',
    'dash.res.free_will': 'फ्री विल संकट SOS',
    'dash.res.goto_sos': 'आपातकालीन SOS खोलें',
    'dash.res.my_reports': 'मेरी पंजीकृत भवन शिकायतें',
    'dash.res.directory': 'त्वरित आपातकालीन हेल्पलाइन',
    'dash.res.assembly': 'निर्धारित सुरक्षा निकासी स्थल',

    // Dashboard — Technician
    'dash.tech.work_orders': 'सक्रिय कार्य आदेश',
    'dash.tech.ai_check': 'AI जांच प्रक्रिया में',
    'dash.tech.resolved': 'पूर्ण मरम्मत कार्य',
    'dash.tech.total': 'कुल ट्रैक की गई शिकायतें',
    'dash.tech.queue_title': 'आवश्यक कार्रवाई वाले कार्य आदेश',

    // Dashboard — Security
    'dash.sec.visitors_inside': 'अंदर उपस्थित आगंतुक',
    'dash.sec.sos_signals': 'सक्रिय संकट सिग्नल',
    'dash.sec.incidents': 'सुरक्षा घटनाएं (24 घंटे)',
    'dash.sec.swipes': 'कुल गेट एक्सेस एंट्रीज',
    'dash.sec.protocols': 'मुख्य द्वार व परिधि सुरक्षा',

    // SOS
    'sos.title': 'आपातकालीन SOS अलर्ट',
    'sos.subtitle': 'तत्काल सुरक्षा दल को सतर्क करें और 30 सेकंड सायरन बजाएं',
    'sos.access_control': 'SOS कमान व अनुमति नियंत्रण',
    'sos.admin_mass_title': 'भवन-व्यापी सामूहिक निकासी प्रसारण (व्यवस्थापक)',
    'sos.personal_distress_title': 'व्यक्तिगत आपातकालीन संकट सहायता (फ्री विल)',
    'sos.request_broadcast_title': 'भवन-व्यापी प्रसारण अनुमति का अनुरोध',
    'sos.pending_requests': 'लंबित SOS प्रसारण अनुरोध',
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
    'maint.student_verification': 'पहचान व सदस्य सत्यापन (व्यवस्थापक)',
    'maint.tab_repairs': 'शिकायतें व मरम्मत कार्य',
    'maint.tab_students': 'पहचान व सदस्य सत्यापन रिकॉर्ड्स',

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
      name: 'omniguard_lang',
    }
  )
)
