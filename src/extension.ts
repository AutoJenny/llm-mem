import * as vscode from 'vscode';
import axios, { AxiosResponse } from 'axios';

export function activate(context: vscode.ExtensionContext) {
    let disposableSendToOllama = vscode.commands.registerCommand('llm-mem.sendToOllama', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const text = editor.document.getText(editor.selection);

            try {
                // Sending the prompt to Ollama
                const response: AxiosResponse<any> = await axios({
                    method: 'post',
                    url: 'http://localhost:11434/api/generate',
                    data: {
                        prompt: text,
                        model: "llama2"
                    },
                    responseType: 'stream'
                });

                let completeResponse = '';
                // Explicitly typing 'chunk' as any to avoid TypeScript error
                response.data.on('data', (chunk: any) => {
                    let part = chunk.toString();
                    try {
                        const json = JSON.parse(part);
                        completeResponse += json.response;
                        if (json.done) {
                            vscode.window.showInformationMessage(completeResponse);
                            // Log the interaction to Weaviate here
                            logInteractionToWeaviate(text, completeResponse);
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

async function logInteractionToWeaviate(prompt: string, response: string) {
    const interactionData = {
        class: "CodingInteraction",
        properties: {
            prompt,
            response,
            timestamp: new Date().toISOString(), // Ensure your Weaviate schema supports this format
            // Add other metadata as needed
        }
    };

    try {
        await axios.post('http://localhost:8080/v1/objects', interactionData, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
        console.log('Interaction logged successfully');
    } catch (error) {
        console.error('Failed to log interaction to Weaviate:', error);
    }
}

export function deactivate() {}
