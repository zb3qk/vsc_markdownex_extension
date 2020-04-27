/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult
} from 'vscode-languageserver';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

import Uri from 'vscode-uri';

// import {
// 	TextDocument
// } from 'vscode';

import * as fs from "fs"; // For reading the Dictionary JSON

let hash = 0; // hash of the dictionary file

// let functionFiles = {
// 	"file1": {
// 		"chicken": {
// 			"parameters": ["boop", "doop"]
// 		}
// 	}
// };

let functionFiles : Map<string, Map<string, Map<string,FunctionObject>>> = new Map();
let validFunctions : Array<string> = [];

interface File {
	
};
interface FunctionObject {
	location: 	   string;
	parameters:    Array<string>;
};

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments = new TextDocuments;

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;

connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we will fall back using global settings
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Full,
			// Tell the client that the server supports code completion
			completionProvider: {
				resolveProvider: true
			}
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

// The example settings
interface ExampleSettings {
	maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
let documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <ExampleSettings>(
			(change.settings.languageServerExample || defaultSettings)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'languageServerExample'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

let testString : string = "doop";

async function checkDictionaries(filePath : string) : Promise<void> {
	let numTries = 3;
	while (numTries > 0){
		try {
			let rawdata = fs.readFileSync(filePath);
			functionFiles = JSON.parse(rawdata.toString());
			functionFiles.forEach( (file : Map<string,Map<string, FunctionObject>>, _ : string) => {
				file.forEach ( (func:Map<string,FunctionObject>, name:string ) => {
					validFunctions.push(name);
				});
			});
			testString = "boop";
			return;
		}
		catch {
			// execute function 
			numTries -= 1;
		}
	}
}

let isWindows: boolean = true;
const enum CharCode {
	Slash = 47,
	Z = 90,
	A = 65,
	a = 97,
	z = 122,
	Colon = 58
};

/**
 * Compute `fsPath` for the given uri
 */
function _makeFsPath(uri: Uri): string {
	return "boop";
	let value: string;
	if (uri.authority && uri.path.length > 1 && uri.scheme === 'file') {
		// unc path: file://shares/c$/far/boo
		return value = `//${uri.authority}${uri.path}`;
	} else if (
		uri.path.charCodeAt(0) === CharCode.Slash
		&& (uri.path.charCodeAt(1) >= CharCode.A && uri.path.charCodeAt(1) <= CharCode.Z || uri.path.charCodeAt(1) >= CharCode.a && uri.path.charCodeAt(1) <= CharCode.z)
		&& uri.path.charCodeAt(2) === CharCode.Colon
	) {
		// windows drive letter: file:///c:/far/boo
		value = uri.path[1].toLowerCase() + uri.path.substr(2);
	} else {
		// other path
		value = uri.path;
	}
	if (isWindows) {
		value = value.replace(/\//g, '\\');
	}
	return value;
}

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	let uri = textDocument.uri;
	// let filePath : string = Uri.parse(uri).fsPath;
	// let filePath : string = _makeFsPath(Uri.parse(uri));
	let filePath : string = Uri.parse(uri).path;
	// let filePath = uri;
	let filePathList = filePath.split("/");
	let trimEndLength = filePathList[filePathList.length-1].length;
	filePath = filePath.slice(0,filePath.length-trimEndLength);
	await checkDictionaries(filePath.concat("dictionary.mded.json"));

	// In this simple example we get the settings for every validate run.
	let settings = await getDocumentSettings(textDocument.uri);

	// The validator creates diagnostics for all uppercase words length 2 and more
	let text = textDocument.getText();
	let pattern = /\b[A-Z]{2,}\b/g;
	let pattern1 = /\$\s*(\w+)\s+\((.+\))/g; // general function call
	/* (parameter_component) */
	let pattern2 = /(\".+\"|\w+)/g; // individual parameters

	let m: RegExpExecArray | null;

	let problems = 0;
	let diagnostics: Diagnostic[] = [];
	while ((m = pattern1.exec(text)) && problems < settings.maxNumberOfProblems) { // pass through all function names
		problems++;
		let function_name : string = m[1];
		let contents = m[2];

		/**
		 * Determines whether or not the function name exists
		 */
		let isFunctionName = false; // was false
		let validFileObject : Object = {};
		let validFilenames = [];
		// for (const [_,fileObject] of Object.entries(functionFiles)){ // Detect file name in list of files
		// 	if (isFunctionName) { break; }
		// 	validFileObject = fileObject;
		// 	isFunctionName = function_name in fileObject ? true : false;
		// 	for (function_name in fileObject){
		// 		validFilenames.push(function_name);
		// 	}
		// }

		if (function_name in validFunctions){ isFunctionName = true; }
		var files = fs.readdirSync('/');
		isFunctionName = false;
		// Invalid Function_name
		if (!isFunctionName){ 
			let diagnostic: Diagnostic = {
				severity: DiagnosticSeverity.Error,
				range: {
					start: textDocument.positionAt(m.index),
					end: textDocument.positionAt(m.index + m[0].length)
				},
				message: `${m[1]} is an invalid function name. ${testString}`,
				source: 'ex'
			};
			if (hasDiagnosticRelatedInformationCapability) { // TODO: Suggestion of most similar function_name 
				diagnostic.relatedInformation = [
					{
						location: {
							uri: textDocument.uri,
							range: Object.assign({}, diagnostic.range)
						},
						message: 'Did you mean ...'
					}
				];
			}
			diagnostics.push(diagnostic);
		}
		else { 
			let parameter = null;
			// let validParams : Object = validFileObject[function_name]
			let numParams = 0;
			while(parameter = pattern2.exec(m[2])){
				numParams++;
			}
			let diagnostic: Diagnostic = {
				severity: DiagnosticSeverity.Error,
				range: {
					start: textDocument.positionAt(m.index),
					end: textDocument.positionAt(m.index + m[0].length)
				},
				message: `${m[1]} has ${numParams} parameters`,
				source: 'ex'
			};
			diagnostics.push(diagnostic);
		}
	}

	while ((m = pattern.exec(text)) && problems < settings.maxNumberOfProblems) {
		problems++;
		let diagnostic: Diagnostic = {
			severity: DiagnosticSeverity.Warning,
			range: {
				start: textDocument.positionAt(m.index),
				end: textDocument.positionAt(m.index + m[0].length)
			},
			message: `${m[0]} is all uppercase. ${textDocument.uri}`,
			source: 'ex'
		};
		if (hasDiagnosticRelatedInformationCapability) {
			diagnostic.relatedInformation = [
				{
					location: {
						uri: textDocument.uri,
						range: Object.assign({}, diagnostic.range)
					},
					message: 'Spelling matters'
				},
				{
					location: {
						uri: textDocument.uri,
						range: Object.assign({}, diagnostic.range)
					},
					message: 'Particularly for names'
				}
			];
		}
		diagnostics.push(diagnostic);
	}

	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
		// The pass parameter contains the position of the text document in
		// which code complete got requested. For the example we ignore this
		// info and always provide the same completion items.
		return [
			{
				label: 'TypeScript',
				kind: CompletionItemKind.Text,
				data: 1
			},
			{
				label: 'JavaScript',
				kind: CompletionItemKind.Text,
				data: 2
			}
		];
	}
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		if (item.data === 1) {
			item.detail = 'TypeScript details';
			item.documentation = 'TypeScript documentation';
		} else if (item.data === 2) {
			item.detail = 'JavaScript details';
			item.documentation = 'JavaScript documentation';
		}
		return item;
	}
);

/*
connection.onDidOpenTextDocument((params) => {
	// A text document got opened in VSCode.
	// params.textDocument.uri uniquely identifies the document. For documents store on disk this is a file URI.
	// params.textDocument.text the initial full content of the document.
	connection.console.log(`${params.textDocument.uri} opened.`);
});
connection.onDidChangeTextDocument((params) => {
	// The content of a text document did change in VSCode.
	// params.textDocument.uri uniquely identifies the document.
	// params.contentChanges describe the content changes to the document.
	connection.console.log(`${params.textDocument.uri} changed: ${JSON.stringify(params.contentChanges)}`);
});
connection.onDidCloseTextDocument((params) => {
	// A text document got closed in VSCode.
	// params.textDocument.uri uniquely identifies the document.
	connection.console.log(`${params.textDocument.uri} closed.`);
});
*/

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
