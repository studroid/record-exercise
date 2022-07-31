const SHEET = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);

const COMMAND_HEAD1 = "!운동"
const COMMAND_HEAD2 = "!기록"

// Public methods

function isRecordMessage(text) {
  if(text.startsWith(COMMAND_HEAD1) || text.startsWith(COMMAND_HEAD2))
    return true;
  return false;
}

function recordExerciseTime(text, userName) {
  const currentTime = new Date();

  const strTime = getTimesToRecord(currentTime, text);
  getTargetRange(currentTime, userName, text).setValue(strTime).setVerticalAlignment("middle").setHorizontalAlignment("center");
}

// Private methods

function getTimesToRecord(currentTime, text) {
  // TODO: Set time according to the text received
  // Example: !운동기록 어제 10:00 1h, !운동기록 10:00
  const endTime = formatHour(currentTime.getHours())+":00";
  
  currentTime.setHours(currentTime.getHours() - 1);
  const startTime = formatHour(currentTime.getHours())+":00";

  return startTime + "~" + endTime;
}

function formatHour(hour) {
  if(hour < 10) {
    return "0" + hour;
  }
  return hour;
}

function getTargetRange(currentTime, userName, text) {
  // TODO: Set target range according to the text received
  // Example: !운동기록 어제 10:00 1h, !운동기록 10:00
  const targetRow = getTargetRow(currentTime);
  const targetCol = getTargetColumn(userName);

  return SHEET.getRange(targetRow, targetCol);
}

function getTargetColumn(userName) {
  const userNameCell = SHEET.createTextFinder(userName).findNext();
  return userNameCell.getColumn();
}

function getTargetRow(currentTime) {
  const year = currentTime.getFullYear();
  const month = currentTime.getMonth() + 1;
  const day = currentTime.getDate();
  
  const theDayCell = SHEET.createTextFinder(`${year}-${month}-${day}`).findNext();
  return theDayCell.getRow();
}
