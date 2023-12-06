import { GForms, Events, GSheets, Base, GDocs, GDrive, GMail, YEAR_CODE } from "./general.ts";

// HELPERS INVOLVED IN BUILDING TEMPLATE ID
// retrieve the headers from the spreadsheet at spreadsheetID (which should be preset to correspond to the templates to be filled with the corresponding entries) and return as a dict and a list
export function buildTemplateIDDict(spreadsheetID: String | void): [Array<string>, {}] {
  let responseSheet = retrieveResponseSheet(spreadsheetID);
  let headerRange = responseSheet.getRange(1, 1, 1, responseSheet.getLastColumn()); // get a range for the header row of the spreadsheet (again, there SHOULD be one pre-set)
  let headerValues = headerRange.getValues();
  let templateIDList = new Array<string>();
  let templateIDDict = {};
  // add all elements of the header row to the idList and to the idDict as keys
  headerValues[0].forEach((elem) => {
    templateIDList.push(elem);
    templateIDDict[elem] = "";
  });

  return [templateIDList, templateIDDict];
}
// mutates the templateDict and sets the values for keys to their corresponding values according to the response by first searching for the timestamp corresponding to the response
export function fillTemplateIDDict(spreadsheetID: String, templateIDDict: {}, templateIDList: Array<string>, dateObject: Base.Date): {} {
  let responseSheet = retrieveResponseSheet(spreadsheetID);
  let responseRowRange: GSheets.Range = findSheetRowByKey(responseSheet, dateObject, isSameDaySameTime);
  // assign the templateIDDict value for a given key from iterating over the templateIDList
  for (let i = 0; i < responseRowRange.getNumColumns(); i++) {
    templateIDDict[templateIDList[i]] = responseRowRange.getValues()[0][i];
  }

  return templateIDDict;
}
// returns a row of a sheet as a range identified by the value of its first column (key) using the comparatorFunction
function findSheetRowByKey(sheetObject, key, comparatorFunction): GSheets.Range | never {

  // start search at second row because we assume first row is headers not of the same datatype as our key (in which case our comparator function would error)
  for (let i = 2; i <= sheetObject.getLastRow(); i++) {

    if (comparatorFunction(sheetObject.getRange(i, 1).getValue(), key)) {
      return sheetObject.getRange(i, 1, i, sheetObject.getLastColumn());
    }
  }
  raiseException(`The key ${key} was not found in key position for the sheet with ID ${sheetObject.getSheetId()}`);
}
// roughly compare two date objects, check for equality
function isSameDaySameTime(datetime1: Base.Date, datetime2: Base.Date) {
  return datetime1.valueOf() === datetime2.valueOf();
}
// helper function that throws errors for me because i definitely didn't forget i could just go "throw new Error(error_message)"
export function raiseException(error_message): never {
  throw new Error(error_message);
}
// retrieves the Sheet object (which we expect to hold all the responses) referenced by the given spreadsheetID
function retrieveResponseSheet(spreadsheetID) {
  return SpreadsheetApp.openById(spreadsheetID).getActiveSheet();
}
// takes a Date object and returns a string representing it the same way GSheets formats dates (VERY PRONE TO ERROR, NEEDS TESTING ON DIFFERENT DATES)
function gSheetsTimeStringBuilder(timestamp) {
  return `${timestamp.getMonth() + 1}/${String(timestamp.getDate()).padStart(2, '0')}/${timestamp.getFullYear()} ${timestamp.getHours()}:${String(timestamp.getMinutes()).padStart(2, '0')}:${String(timestamp.getSeconds()).padStart(2, '0')}`;
}
// does special processing unique to this scenario (e.g. sum of discounts + amounts = total)
export function specialProcessing(templateIDDict: Object) {

  // calculate total amount of currency
  let total = 0;

  // calculate amount for rate, quantity, discount, amount, etc of row
  for (let i of [1, 2, 3, 4, 5]) {
    let discount: boolean = templateIDDict[`Is this a discount?`] == "Yes";
    let rate = Number(templateIDDict[`Rate #${i}`]) * (discount ? -1 : 1); // check if discounted, if yes negative else positive
    let quant = templateIDDict[`Quantity #${i}`];
    let vat = templateIDDict[`VAT #${i}`] == "" ? Number(rate) * 0.12 : templateIDDict[`VAT #${i}`]; // assume VAT will either be manually entered or set to 12% of rate
    let amt: number = Number(rate) * Number(quant);

    total += amt;

    templateIDDict[`Rate #${i}`] = rate;
    templateIDDict[`VAT #${i}`] = vat;
    templateIDDict[`Amount #${i}`] = amt;
  }

  templateIDDict[`Total`] = total;

  // build invoice number string by checking for participation in events
  let evtParticipation: string = templateIDDict["Event Participation"];
  let evtParticipationString = evtParticipation.split(", ").map((elem) => elem[0]).join(""); // split the string into comma-delimited parts, then take the first letters and stick them back together
  let invoiceString = `${YEAR_CODE}-${templateIDDict["Formal Company Name"]}-${evtParticipationString}`;
  templateIDDict[`Invoice Number`] = invoiceString;

  return templateIDDict;
}
