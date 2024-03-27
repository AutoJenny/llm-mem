import * as vscode from 'vscode';
import axios, { AxiosResponse } from 'axios';

// Sanitizes a string by escaping special characters
function sanitizeString(str: string): string {
    return str.replace(/\\/g, '\\\\') // Escape backslashes
              .replace(/"/g, '\\"') // Escape double quotes
              .replace(/\n/g, '\\n') // Replace newlines with \n
              .replace(/\r/g, '\\r'); // Replace carriage returns with \r
}

export function activate(context: vscode.ExtensionContext) {
    let disposableSendToOllama = vscode.commands.registerCommand('llm-mem.sendToOllama', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            let text = editor.document.getText(editor.selection);

            // Show input box to prepend instructions
            const instruction = await vscode.window.showInputBox({
                prompt: "Type instruction to prepend to the selected text (press Enter to proceed without instructions)",
                placeHolder: "For example, 'Explain the following code:'",
            });

            if (instruction) {
                text = instruction + " " + text; // Prepend instruction if provided
            }

            text = sanitizeString(text); // Sanitize the text to be used in a GraphQL query

            // First, search Weaviate for relevant past interactions
            const pastInteraction = await searchWeaviateForInteractions(text);
            if (pastInteraction) {
                console.log(`Found a relevant past interaction: ${pastInteraction}`);
                text += ` Previous relevant interaction: ${pastInteraction}`; // Append past interaction to the query
            }

            try {
                // Then send the query to Ollama
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
                response.data.on('data', (chunk: any) => {
                    let part = chunk.toString();
                    try {
                        const json = JSON.parse(part);
                        completeResponse += json.response;
                        if (json.done) {
                            vscode.window.showInformationMessage(completeResponse);
                            // Log the interaction to Weaviate
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

async function searchWeaviateForInteractions(query: string): Promise<string | null> {
    try {
        const response = await axios.post('http://localhost:8080/v1/graphql', {
            query: `
            {
                Get {
                    CodingInteraction(
                        nearText: {
                            concepts: ["${query}"]
                        }
                    ) {
                        prompt
                        response
                    }
                }
            }`,
        });

        console.log("Weaviate search response:", JSON.stringify(response.data, null, 2));

        if (response.data.data && response.data.data.Get.CodingInteraction.length > 0) {
            return response.data.data.Get.CodingInteraction[0].response;
        } else {
            console.log("No relevant past interactions found in Weaviate.");
            return null;
        }
    } catch (error) {
        console.error("Failed to search Weaviate:", error);
        return null;
    }
}

async function logInteractionToWeaviate(prompt: string, response: string) {
    const interactionData = {
        class: "CodingInteraction",
        properties: {
            prompt,
            response,
            timestamp: new Date().toISOString(),
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
