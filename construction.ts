import { GForms, Events, GSheets, Base, GDocs, GDrive, GMail } from "./general.ts";
import { TEMPLATE_DIRECTORY_ID, PRINT_DIRECTORY_NAME } from "./general.ts";
import * as retrieval from "./retrieval";

/*
  for standardization purposes, let it be understood that template modifiers are best used to dictate the *formatting* of the output.
  adding additional content, or constructing new strings that rely on more than one template ID are best done through specialProcessing
    and directly modifying the templateIDDict
  further let it be noted that as of current version, modifiers do not support altering the actual GDocs text formatting, their main purpose is controlling how actual data
    is rendered into text (e.g. dates into MM/DD/YYYY format or internationalized format)
*/
const MODIFIER_DICT = {
    undefined: (text: string) => text,
    null: (text: string) => text,
    "PHP": (value: number) => value >= 0 ? `PHP ${value}` : `(PHP ${value})`,
    "DeleteRowOnEmpty": (text: string) => `${(text == '') ? "DELETE-MY-ROW" : text}`,
    "DateMDY": (value: Date) => `${String(value.getMonth() + 1).padEnd(2, "0")}/${String(value.getDate()).padStart(2, "0")}/${value.getFullYear()}`,
    "EndlineBefore": (text: string) => `\n${text}`,
    "EndlineAfter": (text: string) => `${text}\n`,
};
type stringParsingFunction<T> = (T) => string;
// encapsulates a template area in a template document, including the template ID, its modifier string, the corresponding modifier function to build the full text, and the text

export class TemplateSpace {

    private _id: string;
    private modifiers: Array<string>;
    private modifierFunctions: Array<stringParsingFunction<string> | stringParsingFunction<Date>>;
    private _text: string;
    private _debugText: string;

    constructor(
        private _idWithModifier: string
    ) {
        let idModifierArray = this._idWithModifier.split("~"); // DO NOT USE SPECIAL REGEX CHARACTERS AS DELIMITERS !!! Similarly, do not use them as template IDs or really anything that'll appear in a template space aside from its actual replacement text
        this._id = idModifierArray[0];
        this.modifiers = idModifierArray.slice(1);
        this.modifierFunctions = this.modifiers.map((elem: string) => (MODIFIER_DICT[elem]));
    }

    // parse value text through the modifier function and use it as the object's text
    public parseText(text: string): string {
        this._debugText = text;
        this._text = text;
        for (let parser of this.modifierFunctions) {
            this._text = parser(this.text);
        }
        return this._text;
    }

    // forces this.text to value text without passing through the modifier, used for when we want to see the original _debugText
    public forceParseText(text: string): string {
        this._text = text;
        return this._text;
    }

    public get id() { return this._id; }
    public get idWithModifier() { return this._idWithModifier; }
    public get text() { return this._text; }
    public get debugText() { return this._debugText; }
}

// HELPERS INVOLVED IN CREATING PRINT DOCUMENT
// makes a copy of the template and returns it (the print) as a GDocs.Document object
export function makePrintDocs(templateDocsID: string): GDocs.Document {
    let templateDocs = DriveApp.getFileById(templateDocsID);
    let templateFolder = DriveApp.getFolderById(TEMPLATE_DIRECTORY_ID);

    // check if invoice prints folder exists yet, create if not
    if (templateFolder.getFoldersByName(PRINT_DIRECTORY_NAME).hasNext() == false) {
        templateFolder.createFolder(PRINT_DIRECTORY_NAME);
    }

    let printFolder = templateFolder.getFoldersByName(PRINT_DIRECTORY_NAME).next();

    let printFileID = templateDocs.makeCopy(printFolder).getId();
    return DocumentApp.openById(printFileID);
}
// creates the document name as a string built as follows `${nonVariantStart}${templateIDDict[variantsID[0]], templateIDDict[variantsID[1]], ...}${nonVariantEnd}`
export function buildDocName(templateIDDict: Object, nonVariantStart: string, variantsID: Array<string>, nonVariantEnd: string): string {
    return `${nonVariantStart}${variantsID.map(elem => templateIDDict[elem]).join(' - ')}${nonVariantEnd}`;
}
// sets the name and whatever other metadata (as of writing i dont know what else you would actually set) for the print, then returns the Document
export function setupPrintDocs(printDocObject: GDocs.Document, printDocName: string): GDocs.Document {
    return printDocObject.setName(printDocName);
}
// this is the fun part
export function fillPrintDocs(printDocObject: GDocs.Document, templateIDDict: Object): GDocs.Document {
    let printBody = printDocObject.getBody();

    let templateSpaceArray = retrieveAllTemplateSpacesFromBody(printBody);
    templateSpaceArray = fillTemplateSpaces(templateSpaceArray, templateIDDict);
    replaceTemplateSpaces(templateSpaceArray, printBody);
    handleDeletables(printBody);

    return printDocObject;
}
// accepts a body element of a template and returns an array of all template spaces found in the template
function retrieveAllTemplateSpacesFromBody(printBody: GDocs.Body): Array<TemplateSpace> {
    let templateSpaceArray: Array<TemplateSpace> = [];
    let nextSearchElement: GDocs.RangeElement | null = null;

    // search document for all text matching the template pattern and build template spaces until there are no template spaces left
    do {
        if (nextSearchElement == null) { nextSearchElement = printBody.findText("<<.*>>"); }
        else { nextSearchElement = printBody.findText("<<.*>>", nextSearchElement); }

        if (nextSearchElement == null) { break; }

        let currentElement: GDocs.Element = nextSearchElement.getElement();
        let templateText = currentElement.asText().getText(); // what the fuck google

        let matchTemplates: RegExp = /<<.*>>/gi;
        let matchingText: Array<string> | null = templateText.match(matchTemplates);

        if (matchingText == null) { retrieval.raiseException("REGEX matching of templates doesn't make sense"); }
        else {
            for (let match of matchingText) {
                let templateSpace = new TemplateSpace(match.slice(2, -2));

                templateSpaceArray.push(templateSpace);
            }
        }

    } while (true);

    return templateSpaceArray;
}
// fill template space *objects* with their corresponding parsed values by ID and modifier
function fillTemplateSpaces(templateSpaceArray: Array<TemplateSpace>, templateIDDict: Object): Array<TemplateSpace> {
    for (let templateSpace of templateSpaceArray) {
        let nullCheck = templateSpace.parseText(templateIDDict[templateSpace.id]);
        if (nullCheck == "") {
            templateSpace.forceParseText("NULL TEXT");
        }
        else if (nullCheck == undefined) {
            templateSpace.forceParseText("UNDEFINED TEXT");
            // raiseException(`Attempting to parse ${templateSpace.id} in templateSpaceArray yielded undefined (actual value: ${templateSpace.debugText})`)
        }
        console.log(templateSpace);
    }

    return templateSpaceArray;
}
// fill all template spaces in text with their corresponding value
function replaceTemplateSpaces(templateSpaceArray: Array<TemplateSpace>, printBody: GDocs.Body) {
    for (let templateSpace of templateSpaceArray) {

        console.log(`Replacing ${templateSpace.idWithModifier} with ${templateSpace.text}`);
        printBody.replaceText(`<<${templateSpace.idWithModifier}>>`, templateSpace.text);
    }
}
// handle the deletion of marked elements
function handleDeletables(printBody: GDocs.Body) {
    let tables = printBody.getTables();

    // handle deletion of tables and table elements
    for (let table of tables) {

        let deleteRowsArray: Array<number> = [];

        // in theory there should be something before this row-checker to see if the entire table is deletable based on a condition
        for (let row = 0; row < table.getNumRows(); row++) {
            let currentRow = table.getRow(row);

            // checks if row is deletable
            if (isRowDeletable(currentRow)) {
                deleteRowsArray.push(row);
                console.log(`adding row number ${row} to deletables`);
            }

        }

        // delete rows in reverse, *after we've identified all deletables* or else we'll have mis-indexing
        for (let row of deleteRowsArray.reverse()) {
            table.removeRow(row);
        }

    }
}
function isRowDeletable(row: GDocs.TableRow): boolean {
    if (row.getCell(0).getText() == "DELETE-MY-ROW") {
        return true;
    }
    return false;
}
