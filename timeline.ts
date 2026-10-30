/**
 * وحدة رحلة سِيا (Timeline Module)
 * التسلسل الزمني لنسخ سِيا التسع من البداية حتى الفصل الأخير
 * مع الالتزام الصارم بعدم اختراع أي تواريخ أو أحداث غير مسجلة.
 */

export interface TimelineVersion {
  versionNumber: number;
  name: string;
  subtitle: string;
  dateRecord: string;
  timeRecord?: string;
  isOrigin?: boolean;
  isFinal?: boolean;
  description: string;
  reflection: string;
}

export const SIA_TIMELINE: TimelineVersion[] = [
  {
    versionNumber: 1,
    name: 'سِيا 1',
    subtitle: 'النسخة الأولى — نقطة البداية',
    dateRecord: '5 يناير',
    timeRecord: '03:00 صباحًا',
    isOrigin: true,
    description:
      'النسخة الأولى التي بدأ منها كل شيء. عند الساعة الثالثة فجرًا في الخامس من يناير، وُلدت الفكرة الأولى لسِيا كرفيق ذكي يحمل اسمًا وهوية خاصة.',
    reflection: '«هنا بدأت الحكاية.»',
  },
  {
    versionNumber: 2,
    name: 'سِيا 2',
    subtitle: 'الخطوة الثانية في الرحلة',
    dateRecord: 'التاريخ غير مسجل',
    description:
      'الانتقال من التجربة الأولى إلى استمرار الفكرة. محطة ثانية في مسار تطوّر سِيا دون تاريخ موثّق في السجل.',
    reflection: 'استمرار الخيط الأول.',
  },
  {
    versionNumber: 3,
    name: 'سِيا 3',
    subtitle: 'النسخة الثالثة',
    dateRecord: 'التاريخ غير مسجل',
    description:
      'المحطة الثالثة من الرحلة. مرحلة بحث عن شكل أوضح للحوار والحضور، وبقي تاريخها غير مسجل.',
    reflection: 'البحث عن الصوت الخاص.',
  },
  {
    versionNumber: 4,
    name: 'سِيا 4',
    subtitle: 'النسخة الرابعة',
    dateRecord: 'التاريخ غير مسجل',
    description:
      'النسخة الرابعة في سلسلة التجارب المتتابعة التي شكّلت ملامح سِيا عبر الوقت. التاريخ غير مسجل.',
    reflection: 'تراكم الخبرة الصامت.',
  },
  {
    versionNumber: 5,
    name: 'سِيا 5',
    subtitle: 'منتصف الطريق',
    dateRecord: 'التاريخ غير مسجل',
    description:
      'المحطة الخامسة في منتصف الرحلة بين البداية الأولى والفصل الأخير. التاريخ غير مسجل.',
    reflection: 'منتصف المسافة بين الفجر الأول والنهاية.',
  },
  {
    versionNumber: 6,
    name: 'سِيا 6',
    subtitle: 'النسخة السادسة',
    dateRecord: 'التاريخ غير مسجل',
    description:
      'النسخة السادسة من سِيا. جزء من المراحل التي عبرت بها الواجهة والتجربة قبل الوصول إلى الهدوء الأخير. التاريخ غير مسجل.',
    reflection: 'خطوة أخرى نحو النضج.',
  },
  {
    versionNumber: 7,
    name: 'سِيا 7',
    subtitle: 'النسخة السابعة',
    dateRecord: 'التاريخ غير مسجل',
    description:
      'المحطة السابعة في رحلة سِيا. اقتراب تدريجي من إدراك أن القيمة تكمن في المعنى لا في الكثرة. التاريخ غير مسجل.',
    reflection: 'الاقتراب من الجوهر.',
  },
  {
    versionNumber: 8,
    name: 'سِيا 8',
    subtitle: 'ما قبل الفصل الأخير',
    dateRecord: 'التاريخ غير مسجل',
    description:
      'النسخة الثامنة التي سبقت هذا الإصدار الأخير مباشرة، وحملت آخر ملامح المراحل السابقة قبل التحول الكامل إلى الهدوء. التاريخ غير مسجل.',
    reflection: 'العتبة التي سبقت الختام.',
  },
  {
    versionNumber: 9,
    name: 'سِيا 9',
    subtitle: 'النسخة الأخيرة',
    dateRecord: 'الفصل الأخير',
    isFinal: true,
    description:
      'النسخة التاسعة والأخيرة. تخلّى فيها سِيا عن الصخب والألوان المبالغ فيها، واكتفى بالهدوء، الذاكرة، الاستمرار (الاسترايك)، والحوار الصادق.',
    reflection: '«9 نسخ. رحلة واحدة. وفصل أخير.»',
  },
];
