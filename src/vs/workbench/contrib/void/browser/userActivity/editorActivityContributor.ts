/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ICodeEditor } from '../../../../../editor/browser/editorBrowser.js';
import { ActivityType, IActivityContributor, IUserActivityService } from '../../../../../platform/void/common/userActivityService.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IWorkingCopyService } from '../../../../services/workingCopy/common/workingCopyService.js';

export class EditorActivityContributor extends Disposable implements IActivityContributor {
	readonly id = 'editor-activity';
	readonly priority = 1;

	private typingTimeouts = new Map<string, NodeJS.Timeout>();
	private lastTypingActivity = new Map<string, { time: number; textContent: string; charCount: number }>();
	private recentFileOperations = new Set<string>();
	private editorListeners = new Map<string, { dispose: () => void }>();
	private readonly TYPING_DEBOUNCE_MS = 1000; // 1 second as requested
	private readonly FILE_OPERATION_DEBOUNCE_MS = 1000; // 1 second

	constructor(
		private readonly activityService: IUserActivityService,
		private readonly editorService: IEditorService,
		private readonly workingCopyService: IWorkingCopyService,
		private readonly editorGroupsService: IEditorGroupsService
	) {
		super();
	}

	async initialize(): Promise<void> {


		try {
			// Wait for editor groups to be ready
			await this.editorGroupsService.whenReady;



			// Track active editor changes (file open)
			this._register(this.editorService.onDidActiveEditorChange(() => {
				const activeEditor = this.editorService.activeEditor;
				if (activeEditor?.resource) {
					this.trackFileOperation('open', activeEditor.resource.path);
				}
			}));

			// Track when visible editors change to set up typing listeners
			this._register(this.editorService.onDidVisibleEditorsChange(() => {
				this.setupTypingListeners();
			}));

			// Setup initial typing listeners
			this.setupTypingListeners();

			// Track working copy changes (file saves) - debounced
			this._register(this.workingCopyService.onDidSave(event => {
				this.trackFileOperation('save', event.workingCopy.resource.path);
			}));

			// Track file edits (when file becomes dirty) - debounced
			this._register(this.workingCopyService.onDidChangeDirty(workingCopy => {
				if (workingCopy.isDirty()) {
					this.trackFileOperation('edit', workingCopy.resource.path);
				}
			}));


		} catch (error) {

		}
	}

	private setupTypingListeners(): void {
		// Clean up existing listeners
		this.editorListeners.forEach(listener => listener.dispose());
		this.editorListeners.clear();

		const editors = this.editorService.visibleTextEditorControls;

		editors.forEach(editor => {
			if (editor && 'onDidChangeModelContent' in editor) {
				const codeEditor = editor as ICodeEditor;
				const model = codeEditor.getModel();

				if (model) {
					const resourcePath = model.uri.path;

					// Set up content change listener
					const listener = codeEditor.onDidChangeModelContent((event) => {
						// Only track actual content changes, not just cursor movements
						if (event.changes && event.changes.length > 0) {
							// Extract the actual text that was added
							const textChanges = event.changes.map(change => change.text).join('');
							this.handleTypingEvent(resourcePath, textChanges);
						}
					});

					this.editorListeners.set(resourcePath, { dispose: () => listener.dispose() });
				}
			}
		});
	}

	private handleTypingEvent(resourcePath: string, textAdded: string): void {
		const now = Date.now();
		const lastActivity = this.lastTypingActivity.get(resourcePath);

		// Update text content and character count
		const existingText = lastActivity?.textContent || '';
		const newTextContent = existingText + textAdded;
		const newCharCount = (lastActivity?.charCount || 0) + textAdded.length;

		this.lastTypingActivity.set(resourcePath, {
			time: now,
			textContent: newTextContent,
			charCount: newCharCount
		});

		// Clear existing timeout
		if (this.typingTimeouts.has(resourcePath)) {
			clearTimeout(this.typingTimeouts.get(resourcePath)!);
		}

		// Set new timeout - only log when user stops typing for 1 second
		const timeout = setTimeout(() => {
			const activityData = this.lastTypingActivity.get(resourcePath);
			if (activityData && activityData.charCount > 0) {
				this.activityService.trackActivity(ActivityType.TYPING, {
					path: resourcePath,
					fileName: this.getFileName(resourcePath),
					fileExtension: this.getFileExtension(resourcePath),
					duration: this.TYPING_DEBOUNCE_MS,
					characterCount: activityData.charCount,
					textContent: activityData.textContent, // Include the actual text typed
					timestamp: Date.now()
				});

				// Reset after logging
				this.lastTypingActivity.set(resourcePath, {
					time: now,
					textContent: '',
					charCount: 0
				});
			}
			this.typingTimeouts.delete(resourcePath);
		}, this.TYPING_DEBOUNCE_MS);

		this.typingTimeouts.set(resourcePath, timeout);
	}

	private getFileName(path: string): string {
		if (!path) return '';
		const parts = path.split('/');
		return parts[parts.length - 1] || '';
	}

	private getFileExtension(path: string): string {
		if (!path) return '';
		const fileName = this.getFileName(path);
		const dotIndex = fileName.lastIndexOf('.');
		return dotIndex > 0 ? fileName.substring(dotIndex + 1) : '';
	}

	private trackFileOperation(operation: string, path: string): void {
		const operationKey = `${operation}:${path}`;

		// Skip if we recently logged this operation
		if (this.recentFileOperations.has(operationKey)) {
			return;
		}

		// Add to recent operations
		this.recentFileOperations.add(operationKey);

		// Remove from recent operations after debounce period
		setTimeout(() => {
			this.recentFileOperations.delete(operationKey);
		}, this.FILE_OPERATION_DEBOUNCE_MS);

		// Map operation to activity type
		let activityType: ActivityType;
		switch (operation) {
			case 'open':
				activityType = ActivityType.FILE_OPEN;
				break;
			case 'save':
				activityType = ActivityType.FILE_SAVE;
				break;
			case 'edit':
				activityType = ActivityType.FILE_EDIT;
				break;
			default:
				return;
		}

		this.activityService.trackActivity(activityType, {
			path,
			fileName: this.getFileName(path),
			fileExtension: this.getFileExtension(path),
			operation,
			timestamp: Date.now()
		});
	}

	override dispose(): void {
		// Clear all timeouts
		this.typingTimeouts.forEach(timeout => clearTimeout(timeout));
		this.typingTimeouts.clear();
		this.lastTypingActivity.clear();
		this.recentFileOperations.clear();

		// Clean up editor listeners
		this.editorListeners.forEach(listener => listener.dispose());
		this.editorListeners.clear();

		super.dispose();
	}
}
