// Google Apps Script web-app URL (see labeling_app/SETUP.md). Leave empty for TEST MODE:
// in test mode nothing is sent and a red banner is shown, so a broken setup can't be launched by accident.
window.LABEL_CONFIG = {
  endpoint: "https://script.google.com/macros/s/AKfycbySp2hyx22WRXDZ_gsCWr9KSNoYrmdcakeNxtNQKLZeOWaxWYNJRbmbaa_4gtY_hwkuKQ/exec",
  study: "label-audit-v1",
  repeatGapMin: 40, // a repeated item appears at least this many items after its first showing
};
