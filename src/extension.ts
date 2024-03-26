import * as vscode from 'vscode';
import axios from 'axios';

export function activate(context: vscode.ExtensionContext) {
    let disposableSendToOllama = vscode.commands.registerCommand('llm-mem.sendToOllama', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const text = editor.document.getText(editor.selection);

            try {
                const response = await axios({
                    method: 'post',
                    url: 'http://localhost:11434/api/generate',
                    data: {
                        prompt: text,
                        model: "llama2"
                    },
                    responseType: 'stream'
                });

                let completeResponse = '';
                response.data.on('data', (chunk) => {
                    let part = chunk.toString();
                    try {
                        const json = JSON.parse(part);
                        completeResponse += json.response;
                        if (json.done) {
                            vscode.window.showInformationMessage(completeResponse);
                        }
                    } catch (error) {
                        console.error("Error parsing JSON part:", error, part);
                    }
                });

                response.data.on('end', () => {
                    console.log('Stream ended');
                });

            } catch (error) {
                console.error("Failed to send text to Ollama:", error);
                vscode.window.showErrorMessage(`Failed to send text to Ollama: ${error}`);
            }
        } else {
            vscode.window.showInformationMessage('No active editor with selected text.');
        }
    });

    context.subscriptions.push(disposableSendToOllama);
}

export function deactivate() {}
