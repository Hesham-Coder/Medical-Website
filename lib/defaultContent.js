const DEFAULT_CONTENT = {
  siteInfo: {
    title: 'Comprehensive Cancer Center',
    tagline: 'Science That Heals. Care That Connects.',
    heroHeading: 'Science That Heals. Care That Connects.',
    heroSubheading: 'Advanced Cancer Treatment',
    heroDescription: 'Where cutting-edge oncology meets personalized patient care.',
    heroCtaPrimary: 'Schedule a Consultation',
    heroCtaSecondary: 'Learn More',
  },
  contact: {
    phone: '01120800011',
    address: '644 طريق الحرية، جناكلس، الإسكندرية',
    email: 'info@comprehensivecancercenter.com',
    emergencyPhone: '03-5865843',
  },
  stats: { patientsServed: 5000, successRate: 95, specialists: 50, yearsExperience: 20 },
  sectionsOrder: ['hero', 'services', 'team', 'testimonials', 'news', 'updates', 'articles', 'about', 'contact', 'cta'],
  sectionVisibility: { hero: true, services: true, team: true, testimonials: true, news: true, updates: true, articles: true, about: true, contact: true, cta: true },
  services: [
    { icon: 'science', title: 'Advanced Diagnostics', description: 'State-of-the-art imaging and molecular testing.' },
    { icon: 'medication', title: 'Precision Medicine', description: 'Targeted therapies tailored to your profile.' },
    { icon: 'support', title: 'Holistic Support', description: 'Nutrition, mental health, survivorship programs.' },
  ],
  aboutSection: {
    heading: 'Leading Cancer Care',
    highlightsHeading: 'Why Choose Us',
    paragraphs: ['At Comprehensive Cancer Center we address not just the disease, but the whole person.'],
    highlights: ['Nationally recognized specialists', 'Clinical trials', 'Supportive care'],
    videoUrl: 'https://www.facebook.com/reel/8113161795385494',
  },
  footer: {
    copyright: '© 2024 Comprehensive Cancer Center.',
    hours: 'Mon - Fri: 8:00 AM - 6:00 PM',
    emergencyText: '24/7 Emergency Support',
  },
  insurance: {
    blurb: {
      en: 'We work with a broad range of payers and will help you understand available coverage and payment options before treatment begins.',
      ar: 'نتعاون مع عدد كبير من الجهات الممولة للرعاية الصحية ونساعدك على فهم خيارات التغطية والتكاليف قبل بدء العلاج.',
    },
    coverageLinkLabel: { en: 'Check Your Coverage', ar: 'تحقق من التغطية' },
    coverageList: { en: '', ar: '' },
  },
  teamSection: { heading: 'World-Class Specialists', subheading: 'Our team combines decades of experience with cutting-edge research and compassionate care.' },
  testimonialsSection: {
    heading: { en: 'Patient Stories', ar: 'تجارب المرضى' },
    subheading: { en: 'Real feedback from patients and families we have supported.', ar: 'آراء حقيقية من مرضى وعائلات تلقوا الرعاية لدينا.' },
  },
  contactSection: {
    heading: { en: 'Start a confidential conversation with our team', ar: 'ابدأ تواصلاً سريًا مع فريق الرعاية لدينا' },
    subheading: { en: 'Share a few details and our patient coordination team will call you back to discuss appointment options. This form is not for emergencies.', ar: 'أخبرنا ببعض التفاصيل وسيتواصل معك فريق تنسيق المرضى لمناقشة مواعيد الزيارة. هذا النموذج غير مخصص للحالات الطارئة.' },
    privacyNotice: { en: 'Information sent through this form is reviewed by our clinical coordination team and kept confidential in line with applicable privacy standards. Please do not include full medical records or highly sensitive identifiers.', ar: 'تتم مراجعة المعلومات الواردة في هذا النموذج من قبل فريق تنسيق الرعاية مع الحفاظ على سريتها وفق المعايير المعتمدة لحماية الخصوصية. برجاء عدم إرسال تقارير طبية كاملة أو بيانات تعريفية عالية الحساسية.' },
    formRoute: { type: 'none', value: '' },
  },
  testimonials: [
    {
      quote: { en: 'The team explained every step clearly and supported my family throughout treatment.', ar: 'قام الفريق بشرح كل خطوة بوضوح وقدم دعماً مستمراً لي ولعائلتي طوال رحلة العلاج.' },
      author: { en: 'Mariam A.', ar: 'مريم أ.' },
      role: { en: 'Breast cancer survivor', ar: 'متعافية من سرطان الثدي' },
      visible: true,
    },
  ],
  experts: [
    { name: 'Dr. Sarah Chen', title: 'Chief Oncologist', imageUrl: '', bio: '25+ years specializing in precision oncology and immunotherapy.', icon: 'medical_services', visible: true },
    { name: 'Dr. Michael Torres', title: 'Radiation Specialist', imageUrl: '', bio: 'Expert in advanced radiation therapy and treatment planning.', icon: 'radiology', visible: true },
    { name: 'Dr. Priya Patel', title: 'Genetic Counselor', imageUrl: '', bio: 'Leading researcher in cancer genetics and hereditary screening.', icon: 'genetics', visible: true },
    { name: 'Dr. James Wilson', title: 'Surgical Oncologist', imageUrl: '', bio: 'Pioneer in minimally invasive surgical techniques.', icon: 'surgical', visible: true },
  ],
};

const DEFAULT_USERS = {
  admin: {
    username: 'admin',
    password: '$2b$10$YourHashedPasswordHere',
  },
};

const DEFAULT_EXPERTS = [
  { name: 'Dr. Sarah Chen', title: 'Chief Oncologist', imageUrl: '', bio: '25+ years specializing in precision oncology and immunotherapy.', icon: 'medical_services', visible: true },
  { name: 'Dr. Michael Torres', title: 'Radiation Specialist', imageUrl: '', bio: 'Expert in advanced radiation therapy and treatment planning.', icon: 'radiology', visible: true },
  { name: 'Dr. Priya Patel', title: 'Genetic Counselor', imageUrl: '', bio: 'Leading researcher in cancer genetics and hereditary screening.', icon: 'genetics', visible: true },
  { name: 'Dr. James Wilson', title: 'Surgical Oncologist', imageUrl: '', bio: 'Pioneer in minimally invasive surgical techniques.', icon: 'surgical', visible: true },
];

const DEFAULT_TESTIMONIALS = [
  {
    quote: { en: 'The team explained every step clearly and supported my family throughout treatment.', ar: 'قام الفريق بشرح كل خطوة بوضوح وقدم دعماً مستمراً لي ولعائلتي طوال رحلة العلاج.' },
    author: { en: 'Mariam A.', ar: 'مريم أ.' },
    role: { en: 'Breast cancer survivor', ar: 'متعافية من سرطان الثدي' },
    visible: true,
  },
  {
    quote: { en: 'I felt safe and respected from the first consultation. The doctors coordinated everything.', ar: 'شعرت بالأمان والاحترام منذ أول استشارة، وكان تنسيق الأطباء لكل التفاصيل ممتازاً.' },
    author: { en: 'Ahmed K.', ar: 'أحمد ك.' },
    role: { en: 'Patient family member', ar: 'أحد أفراد أسرة مريض' },
    visible: true,
  },
  {
    quote: { en: 'Fast diagnosis, clear plan, and compassionate care made a difficult time manageable.', ar: 'سرعة التشخيص ووضوح الخطة والرعاية الإنسانية جعلت فترة صعبة أكثر قابلية للتحمل.' },
    author: { en: 'Nour H.', ar: 'نور ح.' },
    role: { en: 'Lymphoma patient', ar: 'مريض ليمفوما' },
    visible: true,
  },
];

module.exports = {
  DEFAULT_CONTENT,
  DEFAULT_USERS,
  DEFAULT_EXPERTS,
  DEFAULT_TESTIMONIALS,
};
