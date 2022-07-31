const LOG_SHEET = SpreadsheetApp.openById(LOG_SHEET_ID).getSheetByName(LOG_SHEET_NAME);

function logPostEventToSheet(e) {
  LOG_SHEET.appendRow([new Date(), JSON.stringify(e)]);
}

function logTextToSheet(text) {
  LOG_SHEET.appendRow([new Date(), text]);
}
