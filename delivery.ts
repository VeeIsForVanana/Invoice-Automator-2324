import { GForms, Events, GSheets, Base, GDocs, GDrive, GMail } from "./general.ts";
import { TEMPLATE_DIRECTORY_ID, PDF_DIRECTORY_NAME, YEAR_CODE } from "./general.ts";


// HELPERS INVOLVED IN EMAILING PRINT DOCUMENT
export function makePrintPDF(printDocsID: string): GDrive.File {
    let printDocsObject = DriveApp.getFileById(printDocsID);
    let templateFolder = DriveApp.getFolderById(TEMPLATE_DIRECTORY_ID);

    // check if invoice prints folder exists yet, create if not
    if (templateFolder.getFoldersByName(PDF_DIRECTORY_NAME).hasNext() == false) {
        templateFolder.createFolder(PDF_DIRECTORY_NAME);
    }

    let pdfFolder = templateFolder.getFoldersByName(PDF_DIRECTORY_NAME).next();

    DocumentApp.openById(printDocsID).saveAndClose();

    let pdfBlob = DriveApp.getFileById(printDocsID).getAs('application/pdf');
    let pdfFileID = pdfFolder.createFile(pdfBlob).getId();

    return DriveApp.getFileById(pdfFileID);
}
export function sendEmail(targetEmail: string, pdfID: string, docsID: string, companyName: string, marketerName: string) {
    let options = {
        attachments: [DriveApp.getFileById(pdfID)]
    };

    let subject = `UP CAPES ${YEAR_CODE} Invoice - ${companyName}`;
    let body = '<p>Hi ' + marketerName + ',</p><p>Attached is the Invoice for ' + companyName
        + '. Kindly review the document carefully before affixing your signature. Once verified by your !VERIFIER!, send it to'
        + ' your Discord Team channel and mention !SIGNATORIES! for !THEIR! signature.'
        + '</p><p>You may access the PDF version through the attachment below'
        + '. If you want to edit the file, you may access the docs'
        + ' version through this URL: ' + DriveApp.getFileById(docsID).getUrl()
        + '. </p><p>For any questions, don\'t hesitate to ask any of the !ADVISERS!.'
        + '</p><p>Thank you!</p><p>-!CLOSING LINE!</p>';

    GmailApp.sendEmail(targetEmail, subject, body, options);
}
