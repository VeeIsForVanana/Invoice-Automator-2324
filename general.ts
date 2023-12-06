import GForms = GoogleAppsScript.Forms;
import Events = GoogleAppsScript.Events;
import GSheets = GoogleAppsScript.Spreadsheet;
import Base = GoogleAppsScript.Base;
import GDocs = GoogleAppsScript.Document;
import GDrive = GoogleAppsScript.Drive;
import GMail = GoogleAppsScript.Gmail;

export { GForms, Events, GSheets, Base, GDocs, GDrive, GMail };


export const TEMPLATE_DIRECTORY_ID = "1WHtjmtzy7E1_GLnrqq0UNeIqeQRinSBw"; // ID for the parent directory, will need to be configured with every move
export const PRINT_DIRECTORY_NAME = "Invoices";
export const PDF_DIRECTORY_NAME = "Invoice PDFs";
export const TEMPLATE_DOCS_ID = "1a81BScK-XEVyvuBtXeJbNgnKZ_3QMdyZdsiXDPMTDBs";
export const YEAR_CODE = "2324"