/**
 * Agent Router - Static Export Application Logic
 * Vanilla JS SPA with full i18n support (zh/en)
 */

// ============================================
// State Management
// ============================================

// ============================================
// FULL i18n - All strings in both languages
// ============================================
const i18n = {
  // ---- Capsules ----
  capsule1: { zh: '设备限速 50KB/s', en: 'Limit device to 50KB/s' },
  capsule2: { zh: '查看在线设备', en: 'View online devices' },
  capsule3: { zh: '拉黑未知设备', en: 'Block unknown device' },
  capsule4: { zh: '检测带宽占用', en: 'Check bandwidth usage' },
  capsule5: { zh: '一键网络诊断', en: 'Quick network diagnosis' },
  capsule6: { zh: '查看网络历史', en: 'View network history' },
  capsule7: { zh: '定时断网 23:00', en: 'Schedule disconnect at 23:00' },
  capsule8: { zh: '设备上线提醒', en: 'Device online alert' },


  // ---- Token Panel ----
  tokenUsage: { zh: 'Token 用量', en: 'Token Usage' },
  balanceInfo: { zh: '余额信息', en: 'Balance Info' },
  remainingTokens: { zh: '剩余 Tokens', en: 'Remaining Tokens' },
  used: { zh: '已用', en: 'Used' },
  usedTokens: { zh: '已使用', en: 'Used' },
  totalTokens: { zh: '总计', en: 'Total' },
  rechargeTokens: { zh: '充值 Tokens', en: 'Recharge Tokens' },
  currentModel: { zh: '当前模型', en: 'Current Model' },
  switchModel: { zh: '切换', en: 'Switch' },
  zaiAssistant: { zh: 'Z.ai智能助手', en: 'Z.ai AI Assistant' },
  defaultModelReady: { zh: '默认模型 · 开箱即用', en: 'Default Model · Ready to use' },
  customAPIService: { zh: '自定义 API', en: 'Custom API' },
  customAPIServiceDesc: { zh: '配置你自己的模型服务', en: 'Configure your own model service' },
  confirmSwitch: { zh: '确认切换', en: 'Confirm Switch' },

  // ---- Recharge ----
  rechargeTokensTitle: { zh: '充值 Tokens', en: 'Recharge Tokens' },
  currentBalance: { zh: '当前余额', en: 'Current Balance' },
  selectPackage: { zh: '选择套餐', en: 'Select Package' },
  starterPack: { zh: '入门包', en: 'Starter Pack' },
  standardPack: { zh: '标准包', en: 'Standard Pack' },
  proPack: { zh: '专业包', en: 'Pro Pack' },
  giftPack: { zh: '邀请奖励', en: 'Invitation Reward' },
  mostPopular: { zh: '最受欢迎', en: 'Most Popular' },
  limitedFree: { zh: '限时免费', en: 'Limited Free' },
  purchaseTokens: { zh: '购买', en: 'Purchase' },
  pleaseSelect: { zh: '请选择套餐', en: 'Please select a package' },
  processing: { zh: '处理中...', en: 'Processing...' },
  rechargeSuccess: { zh: '充值成功！', en: 'Recharge Successful!' },
};

// ============================================
// Dynamic Data (language-aware)
// ============================================
function getCommandCapsules() {
  return [
    { label: t('capsule1'), command: t('capsule1') },
    { label: t('capsule2'), command: t('capsule2') },
    { label: t('capsule3'), command: t('capsule3') },
    { label: t('capsule4'), command: t('capsule4') },
    { label: t('capsule5'), command: t('capsule5') },
    { label: t('capsule6'), command: t('capsule6') },
    { label: t('capsule7'), command: t('capsule7') },
    { label: t('capsule8'), command: t('capsule8') },
  ];
}


const tokenPackages = [
  { id: 'starter', tokens: 5000, price: '¥9.9', popular: false, free: false },
  { id: 'standard', tokens: 20000, price: '¥29.9', popular: true, free: false },
  { id: 'pro', tokens: 100000, price: '¥99.9', popular: false, free: false },
  { id: 'gift', tokens: 1000, price: 'Free', popular: false, free: true },
];

// ============================================
// Navigation & View Management
// ============================================
function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const view = document.getElementById(viewId);
  if (view) view.classList.add('active');
}
