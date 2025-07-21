/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IUserActivityService, ActivityType, IActivityContributor } from '../../../../../platform/void/common/userActivityService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { ICodeEditor } from '../../../../../editor/browser/editorBrowser.js';

export class AutocompleteActivityContributor extends Disposable implements IActivityContributor {
	readonly id = 'autocomplete';
	readonly priority = 40;

	constructor(
		private readonly activityService: IUserActivityService,
		private readonly editorService: IEditorService,
		private readonly editorGroupsService: IEditorGroupsService
	) {
		super();
	}

	async initialize(): Promise<void> {
		try {
			// Wait for editor groups to be ready
			await this.editorGroupsService.whenReady;



			// Track autocomplete usage by monitoring editor content changes
			// This is a simplified approach - in reality, VS Code has more sophisticated
			// autocomplete tracking but those APIs are not easily accessible
			this._register(this.editorService.onDidActiveEditorChange(() => {
				this.setupAutocompleteTracking();
			}));

			// Set up tracking for currently active editor
			this.setupAutocompleteTracking();

		} catch (error) {

		}
	}

	private setupAutocompleteTracking(): void {
		const activeEditor = this.editorService.activeEditorPane;
		if (!activeEditor) {
			return;
		}

		const codeEditor = activeEditor.getControl();
		if (!this.isCodeEditor(codeEditor)) {
			return;
		}

		// Track when suggestions are accepted
		// This is a simplified implementation - could be enhanced with actual completion events
		const disposable = codeEditor.onDidChangeModelContent(event => {
			// Simple heuristic: if a single character change results in multiple characters,
			// it might be autocomplete acceptance
			for (const change of event.changes) {
				if (change.text.length > 1 && change.rangeLength <= 1) {
					this.trackAutocompleteAcceptance(codeEditor, change.text);
				}
			}
		});

		this._register(disposable);
	}

	private isCodeEditor(editor: any): editor is ICodeEditor {
		return editor && typeof editor.onDidChangeModelContent === 'function';
	}

	private trackAutocompleteAcceptance(editor: ICodeEditor, acceptedText: string): void {
		const model = editor.getModel();
		if (!model) {
			return;
		}

		// Determine the type of completion based on the text
		const completionType = this.guessCompletionType(acceptedText);

		this.activityService.trackActivity(ActivityType.AUTOCOMPLETE_ACCEPT, {
			path: model.uri.path,
			fileName: model.uri.path.split('/').pop() || '',
			fileExtension: model.uri.path.split('.').pop() || '',
			scheme: model.uri.scheme,
			acceptedText: acceptedText.substring(0, 100), // Limit length for privacy
			completionType,
			languageId: model.getLanguageId()
		});
	}

	private guessCompletionType(text: string): string {
		// Simple heuristics to guess completion type
		if (text.includes('(') && text.includes(')')) {
			return 'function';
		}
		if (text.includes('{') && text.includes('}')) {
			return 'snippet';
		}
		if (text.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
			return 'variable';
		}
		if (text.includes('.')) {
			return 'property';
		}
		return 'text';
	}
}
