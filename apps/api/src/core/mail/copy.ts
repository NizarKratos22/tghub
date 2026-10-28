import type { Locale } from '../http/request-context';

/**
 * Everything an email says, per language. Layout and escaping live in templates.ts.
 * French puts a no-break space (U+00A0) before : ! ? so the sign never wraps alone;
 * Arabic wraps names in isolates (U+2068…U+2069) so Latin names keep their punctuation in place.
 */

export type CodePurpose = 'signup' | 'email_change' | 'password_reset';
export type NoticeKind = 'password_reset' | 'password_changed' | 'email_changed';

interface Heading {
  eyebrow: string;
  title: string;
}

export interface MailCopy {
  dir: 'ltr' | 'rtl';
  /** BCP 47 tag for dates: Tunis conventions, Latin digits everywhere (as on the site). */
  dateLocale: string;
  /** "Label: value" separator in plain text (French wants a space before the colon). */
  colon: string;
  /** An empty name gives a plain "Hi," — used when the address isn't proven yet. */
  greeting: (name: string) => string;
  signature: string;
  codes: Record<CodePurpose, Heading & { subject: (code: string) => string; intro: string; notYou: string }>;
  /** Shown in inbox previews; never used for password resets (lock screens show it). */
  codePreheader: (code: string) => string;
  codeLabel: string;
  expires: string;
  neverShare: string;
  notices: Record<NoticeKind, Heading & { subject: string; preheader: string; body: string; notYou: string }>;
  when: string;
  newEmail: string;
  tunisTime: string;
  resetCta: string;
  secureCta: string;
  /** The Settings section where signed-in devices are listed, named as on the site. */
  devicesLink: string;
  welcome: Heading & { subject: (name: string) => string; preheader: string; intro: string; cta: string; features: Array<{ name: string; text: string }> };
  footer: { tagline: string; reason: string; help: string; poweredBy: string };
}

const en: MailCopy = {
  dir: 'ltr',
  dateLocale: 'en-GB',
  colon: ': ',
  greeting: (name) => (name ? `Hi ${name},` : 'Hi,'),
  signature: 'The TG Hub team',
  codes: {
    signup: {
      subject: (code) => `${code} is your TG Hub verification code`,
      eyebrow: 'Email verification',
      title: 'Confirm your email',
      intro: 'Thanks for joining TG Hub! Enter this code to confirm your email address:',
      notYou: 'Didn’t sign up for TG Hub? Someone may have typed your address by mistake. You can safely ignore this email: no account is confirmed without this code.',
    },
    email_change: {
      subject: (code) => `${code} is the code to confirm your new TG Hub email`,
      eyebrow: 'New email address',
      title: 'Confirm your new email',
      intro: 'Enter this code to start using this address on your TG Hub account:',
      notYou: 'Didn’t ask for this? You can safely ignore this email: this address won’t be added to any account without this code.',
    },
    password_reset: {
      subject: () => 'Your TG Hub password reset code',
      eyebrow: 'Password reset',
      title: 'Reset your password',
      intro: 'We received a request to reset the password of your TG Hub account. Enter this code to choose a new one:',
      notYou: 'Didn’t ask for this? You can safely ignore this email: your password stays as it is.',
    },
  },
  codePreheader: (code) => `Your code is ${code}. It expires in 15 minutes.`,
  codeLabel: 'Your code',
  expires: 'This code expires in 15 minutes.',
  neverShare: 'Never share this code with anyone. The TG Hub team will never ask you for it.',
  notices: {
    password_reset: {
      subject: 'Your TG Hub password was reset',
      preheader: 'Every other device was signed out of your account.',
      eyebrow: 'Account security',
      title: 'Your password was reset',
      body: 'Your TG Hub password was just reset, and every other device was signed out.',
      notYou: 'Wasn’t you? Reset your password right away, then check where you’re signed in.',
    },
    password_changed: {
      subject: 'Your TG Hub password was changed',
      preheader: 'Your other devices were signed out.',
      eyebrow: 'Account security',
      title: 'Your password was changed',
      body: 'Your TG Hub password was just changed, and your other devices were signed out.',
      notYou: 'Wasn’t you? Reset your password right away, then check where you’re signed in.',
    },
    email_changed: {
      subject: 'Your TG Hub email was changed',
      preheader: 'Your account now uses a different email address.',
      eyebrow: 'Account security',
      title: 'Your email was changed',
      body: 'The email address on your TG Hub account was just changed. From now on, account emails go to the new address below instead of this one.',
      notYou: 'Wasn’t you? Reply to this email right away and we’ll help you get your account back. If you can still sign in, change your password and sign out your other devices.',
    },
  },
  when: 'When',
  newEmail: 'New email',
  tunisTime: 'Tunis time',
  resetCta: 'Reset my password',
  secureCta: 'Secure my account',
  devicesLink: 'See where you’re signed in',
  welcome: {
    subject: (name) => `Welcome to TG Hub, ${name}!`,
    preheader: 'Your email is confirmed. Here’s where to start.',
    eyebrow: 'Welcome aboard',
    title: 'Welcome to TG Hub',
    intro: 'Your email is confirmed and your account is ready. Here’s where to start:',
    cta: 'Open TG Hub',
    features: [
      { name: 'Radar', text: 'Patch notes and news for the games you play, plus deals and free games.' },
      { name: 'Tournaments', text: 'Upcoming Tunisian and international events, with reminders.' },
      { name: 'PC Lab', text: 'Check whether your PC runs a game before you buy it.' },
      { name: 'Universe', text: 'Complete missions, earn XP and climb the season standings.' },
    ],
  },
  footer: {
    tagline: 'TG Hub — Tunisian Gaming Hub',
    reason: 'You’re receiving this email because of activity on your TG Hub account.',
    help: 'Questions? Just reply to this email.',
    poweredBy: 'Powered by',
  },
};

const fr: MailCopy = {
  dir: 'ltr',
  dateLocale: 'fr-TN',
  colon: '\u00a0: ',
  greeting: (name) => (name ? `Bonjour ${name},` : 'Bonjour,'),
  signature: 'L’équipe TG Hub',
  codes: {
    signup: {
      subject: (code) => `${code} est votre code de vérification TG Hub`,
      eyebrow: 'Vérification de l’e-mail',
      title: 'Confirmez votre adresse e-mail',
      intro: 'Merci d’avoir rejoint TG Hub\u00a0! Saisissez ce code pour confirmer votre adresse e-mail\u00a0:',
      notYou:
        'Vous ne vous êtes pas inscrit sur TG Hub\u00a0? Quelqu’un a peut-être saisi votre adresse par erreur. Vous pouvez ignorer cet e-mail en toute sécurité\u00a0: aucun compte n’est confirmé sans ce code.',
    },
    email_change: {
      subject: (code) => `${code} est le code de confirmation de votre nouvelle adresse e-mail TG Hub`,
      eyebrow: 'Nouvelle adresse e-mail',
      title: 'Confirmez votre nouvelle adresse e-mail',
      intro: 'Saisissez ce code pour utiliser cette adresse sur votre compte TG Hub\u00a0:',
      notYou: 'Vous n’êtes pas à l’origine de cette demande\u00a0? Vous pouvez ignorer cet e-mail en toute sécurité\u00a0: cette adresse ne sera ajoutée à aucun compte sans ce code.',
    },
    password_reset: {
      subject: () => 'Votre code de réinitialisation du mot de passe TG Hub',
      eyebrow: 'Réinitialisation du mot de passe',
      title: 'Réinitialisez votre mot de passe',
      intro: 'Nous avons reçu une demande de réinitialisation du mot de passe de votre compte TG Hub. Saisissez ce code pour en choisir un nouveau\u00a0:',
      notYou: 'Vous n’êtes pas à l’origine de cette demande\u00a0? Vous pouvez ignorer cet e-mail en toute sécurité\u00a0: votre mot de passe reste inchangé.',
    },
  },
  codePreheader: (code) => `Votre code est ${code}. Il expire dans 15\u00a0minutes.`,
  codeLabel: 'Votre code',
  expires: 'Ce code expire dans 15\u00a0minutes.',
  neverShare: 'Ne communiquez jamais ce code à personne. L’équipe TG Hub ne vous le demandera jamais.',
  notices: {
    password_reset: {
      subject: 'Le mot de passe de votre compte TG Hub a été réinitialisé',
      preheader: 'Vos autres appareils ont été déconnectés de votre compte.',
      eyebrow: 'Sécurité du compte',
      title: 'Votre mot de passe a été réinitialisé',
      body: 'Le mot de passe de votre compte TG Hub vient d’être réinitialisé et vos autres appareils ont été déconnectés.',
      notYou: 'Ce n’était pas vous\u00a0? Réinitialisez votre mot de passe immédiatement, puis vérifiez vos appareils connectés.',
    },
    password_changed: {
      subject: 'Le mot de passe de votre compte TG Hub a été modifié',
      preheader: 'Vos autres appareils ont été déconnectés.',
      eyebrow: 'Sécurité du compte',
      title: 'Votre mot de passe a été modifié',
      body: 'Le mot de passe de votre compte TG Hub vient d’être modifié et vos autres appareils ont été déconnectés.',
      notYou: 'Ce n’était pas vous\u00a0? Réinitialisez votre mot de passe immédiatement, puis vérifiez vos appareils connectés.',
    },
    email_changed: {
      subject: 'L’adresse e-mail de votre compte TG Hub a été modifiée',
      preheader: 'Votre compte utilise désormais une autre adresse e-mail.',
      eyebrow: 'Sécurité du compte',
      title: 'Votre adresse e-mail a été modifiée',
      body: 'L’adresse e-mail de votre compte TG Hub vient d’être modifiée. Les e-mails concernant votre compte seront désormais envoyés à la nouvelle adresse indiquée ci-dessous, et non plus à celle-ci.',
      notYou:
        'Ce n’était pas vous\u00a0? Répondez immédiatement à cet e-mail et nous vous aiderons à récupérer votre compte. Si vous pouvez encore vous connecter, changez votre mot de passe et déconnectez vos autres appareils.',
    },
  },
  when: 'Date',
  newEmail: 'Nouvelle adresse',
  tunisTime: 'heure de Tunis',
  resetCta: 'Réinitialiser mon mot de passe',
  secureCta: 'Sécuriser mon compte',
  devicesLink: 'Voir les appareils connectés',
  welcome: {
    subject: (name) => `Bienvenue sur TG Hub, ${name}\u00a0!`,
    preheader: 'Votre adresse e-mail est confirmée. Voici par où commencer.',
    eyebrow: 'Bienvenue',
    title: 'Bienvenue sur TG Hub',
    intro: 'Votre adresse e-mail est confirmée et votre compte est prêt. Voici par où commencer\u00a0:',
    cta: 'Ouvrir TG Hub',
    features: [
      { name: 'Radar', text: 'Notes de patch et actus des jeux auxquels vous jouez, plus les bons plans et les jeux gratuits.' },
      { name: 'Tournois', text: 'Les prochains tournois tunisiens et internationaux, avec des rappels.' },
      { name: 'PC Lab', text: 'Vérifiez si votre PC fait tourner un jeu avant de l’acheter.' },
      { name: 'Univers', text: 'Accomplissez des missions, gagnez de l’XP et grimpez au classement de la saison.' },
    ],
  },
  footer: {
    tagline: 'TG Hub — Tunisian Gaming Hub',
    reason: 'Vous recevez cet e-mail suite à une activité sur votre compte TG Hub.',
    help: 'Une question\u00a0? Répondez simplement à cet e-mail.',
    poweredBy: 'Propulsé par',
  },
};

const ar: MailCopy = {
  dir: 'rtl',
  dateLocale: 'ar-TN-u-nu-latn',
  colon: ': ',
  greeting: (name) => (name ? `مرحبًا \u2068${name}\u2069،` : 'مرحبًا،'),
  signature: 'فريق TG Hub',
  codes: {
    signup: {
      subject: (code) => `${code} هو رمز التحقق الخاص بك في TG Hub`,
      eyebrow: 'التحقق من البريد الإلكتروني',
      title: 'أكّد بريدك الإلكتروني',
      intro: 'شكرًا لانضمامك إلى TG Hub! أدخل هذا الرمز لتأكيد عنوان بريدك الإلكتروني:',
      notYou: 'لم تسجّل في TG Hub؟ ربما أدخل أحدهم عنوانك عن طريق الخطأ. يمكنك تجاهل هذه الرسالة بأمان، فلن يتم تأكيد أي حساب من دون هذا الرمز.',
    },
    email_change: {
      subject: (code) => `${code} هو رمز تأكيد بريدك الإلكتروني الجديد في TG Hub`,
      eyebrow: 'بريد إلكتروني جديد',
      title: 'أكّد بريدك الإلكتروني الجديد',
      intro: 'أدخل هذا الرمز لاعتماد هذا العنوان في حسابك على TG Hub:',
      notYou: 'لم تطلب هذا؟ يمكنك تجاهل هذه الرسالة بأمان، فلن يُضاف هذا العنوان إلى أي حساب من دون هذا الرمز.',
    },
    password_reset: {
      subject: () => 'رمز إعادة تعيين كلمة المرور في TG Hub',
      eyebrow: 'إعادة تعيين كلمة المرور',
      title: 'أعد تعيين كلمة المرور',
      intro: 'تلقّينا طلبًا لإعادة تعيين كلمة مرور حسابك على TG Hub. أدخل هذا الرمز لاختيار كلمة مرور جديدة:',
      notYou: 'لم تطلب هذا؟ يمكنك تجاهل هذه الرسالة بأمان، وستبقى كلمة المرور كما هي.',
    },
  },
  codePreheader: (code) => `رمزك هو ${code}، وتنتهي صلاحيته خلال 15 دقيقة.`,
  codeLabel: 'رمزك',
  expires: 'تنتهي صلاحية هذا الرمز خلال 15 دقيقة.',
  neverShare: 'لا تشارك هذا الرمز مع أي شخص، فلن يطلبه منك فريق TG Hub أبدًا.',
  notices: {
    password_reset: {
      subject: 'تمت إعادة تعيين كلمة مرور حسابك في TG Hub',
      preheader: 'تم تسجيل الخروج من أجهزتك الأخرى المتصلة بحسابك.',
      eyebrow: 'أمان الحساب',
      title: 'تمت إعادة تعيين كلمة المرور',
      body: 'تمت للتو إعادة تعيين كلمة مرور حسابك في TG Hub، وتم تسجيل الخروج من أجهزتك الأخرى.',
      notYou: 'لست من قام بذلك؟ أعد تعيين كلمة المرور فورًا، ثم راجع الأجهزة المسجّل دخولك فيها.',
    },
    password_changed: {
      subject: 'تم تغيير كلمة مرور حسابك في TG Hub',
      preheader: 'تم تسجيل الخروج من أجهزتك الأخرى.',
      eyebrow: 'أمان الحساب',
      title: 'تم تغيير كلمة المرور',
      body: 'تم للتو تغيير كلمة مرور حسابك في TG Hub، وتم تسجيل الخروج من أجهزتك الأخرى.',
      notYou: 'لست من قام بذلك؟ أعد تعيين كلمة المرور فورًا، ثم راجع الأجهزة المسجّل دخولك فيها.',
    },
    email_changed: {
      subject: 'تم تغيير البريد الإلكتروني لحسابك في TG Hub',
      preheader: 'أصبح حسابك يستخدم عنوان بريد إلكتروني آخر.',
      eyebrow: 'أمان الحساب',
      title: 'تم تغيير بريدك الإلكتروني',
      body: 'تم للتو تغيير البريد الإلكتروني لحسابك في TG Hub. من الآن فصاعدًا، ستُرسل رسائل الحساب إلى العنوان الجديد المبيّن أدناه بدلًا من هذا العنوان.',
      notYou: 'لست من قام بذلك؟ ردّ على هذه الرسالة فورًا وسنساعدك على استعادة حسابك. وإن كنت لا تزال قادرًا على تسجيل الدخول، فغيّر كلمة المرور وسجّل الخروج من أجهزتك الأخرى.',
    },
  },
  when: 'التاريخ',
  newEmail: 'البريد الجديد',
  tunisTime: 'بتوقيت تونس',
  resetCta: 'إعادة تعيين كلمة المرور',
  secureCta: 'تأمين حسابي',
  devicesLink: 'عرض الأجهزة المسجّل دخولك فيها',
  welcome: {
    subject: (name) => `مرحبًا بك في TG Hub يا \u2068${name}\u2069!`,
    preheader: 'تم تأكيد بريدك الإلكتروني. إليك من أين تبدأ.',
    eyebrow: 'أهلًا بك',
    title: 'مرحبًا بك في TG Hub',
    intro: 'تم تأكيد بريدك الإلكتروني وأصبح حسابك جاهزًا. إليك من أين تبدأ:',
    cta: 'افتح TG Hub',
    features: [
      { name: 'الرادار', text: 'ملاحظات التحديث وأخبار الألعاب التي تلعبها، إلى جانب العروض والألعاب المجانية.' },
      { name: 'البطولات', text: 'البطولات التونسية والدولية القادمة، مع تذكيرات.' },
      { name: 'مختبر PC', text: 'تحقّق مما إذا كان حاسوبك يشغّل اللعبة قبل شرائها.' },
      { name: 'العالم', text: 'أنجز المهام واكسب نقاط الخبرة وتقدّم في ترتيب الموسم.' },
    ],
  },
  footer: {
    tagline: 'TG Hub — Tunisian Gaming Hub',
    reason: 'تصلك هذه الرسالة بسبب نشاط على حسابك في TG Hub.',
    help: 'لديك سؤال؟ ما عليك سوى الرد على هذه الرسالة.',
    poweredBy: 'بدعم من',
  },
};

export const MAIL_COPY: Record<Locale, MailCopy> = { en, fr, ar };
