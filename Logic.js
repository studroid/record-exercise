const SHEET = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);

const COMMAND_HEAD1 = "!운동";
const COMMAND_HEAD2 = "!기록";

// Public methods

function isRecordMessage(text) {
  if (text.startsWith(COMMAND_HEAD1) || text.startsWith(COMMAND_HEAD2))
    return true;
  return false;
}

function recordExerciseTime(text, userName) {
  const targetTime = getTargetTime(text);

  const strTime = getTimesToRecord(targetTime);
  getTargetRange(targetTime, userName)
    .setValue(strTime)
    .setVerticalAlignment("middle")
    .setHorizontalAlignment("center");
}

// Private methods

function getTargetTime(text) {
  // TODO: Set time according to the text received
  // Example: !운동기록 어제 10:00 1h, !운동기록 10:00
  const baseTime = new Date();
  if (text.includes("어제")) {
    baseTime.setDate(baseTime.getDate() - 1);
  }
  return baseTime;
}

function getTimesToRecord(targetTime) {
  const endTime = formatHour(targetTime.getHours()) + ":00";

  targetTime.setHours(targetTime.getHours() - 1);
  const startTime = formatHour(targetTime.getHours()) + ":00";

  return startTime + "~" + endTime;
}

function formatHour(hour) {
  if (hour < 10) {
    return "0" + hour;
  }
  return hour;
}

function getTargetRange(targetTime, userName) {
  const targetRow = getTargetRow(targetTime);
  const targetCol = getTargetColumn(userName);

  return SHEET.getRange(targetRow, targetCol);
}

function getTargetColumn(userName) {
  const userNameCell = SHEET.createTextFinder(userName).findNext();
  return userNameCell.getColumn();
}

function getTargetRow(targetTime) {
  const year = targetTime.getFullYear();
  const month = targetTime.getMonth() + 1;
  const day = targetTime.getDate();

  const theDayCell = SHEET.createTextFinder(
    `${year}-${month}-${day}`
  ).findNext();
  return theDayCell.getRow();
}
