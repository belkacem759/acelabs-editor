/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IWorkbenchContribution } from '../../../../common/contributions.js';
import { IUserActivityService } from '../../../../../platform/void/common/userActivityService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IWorkingCopyService } from '../../../../services/workingCopy/common/workingCopyService.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IExtensionService } from '../../../../services/extensions/common/extensions.js';
import { ILifecycleService } from '../../../../services/lifecycle/common/lifecycle.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { IChatThreadService } from '../chatThreadService.js';

import { EditorActivityContributor } from './editorActivityContributor.js';
import { CommandActivityContributor } from './commandActivityContributor.js';
import { AIChatActivityContributor } from './aiChatActivityContributor.js';
import { AutocompleteActivityContributor } from './autocompleteActivityContributor.js';

export class UserActivityContribution extends Disposable implements IWorkbenchContribution {

	constructor(
		@IUserActivityService private readonly userActivityService: IUserActivityService,
		@IEditorService private readonly editorService: IEditorService,
		@IWorkingCopyService private readonly workingCopyService: IWorkingCopyService,
		@ICommandService private readonly commandService: ICommandService,
		@IExtensionService private readonly extensionService: IExtensionService,
		@ILifecycleService private readonly lifecycleService: ILifecycleService,
		@IEditorGroupsService private readonly editorGroupsService: IEditorGroupsService,
		@IChatThreadService private readonly chatThreadService: IChatThreadService
	) {
		super();


		this.initializeContributors();
		this.setupTestFunction();
	}

	private setupTestFunction(): void {
		// Add test function to global scope for manual testing
		if (typeof window !== 'undefined') {
			(window as any).testUserActivityTracking = () => {

				try {
					this.userActivityService.trackActivity('command_execute' as any, {
						command: 'test.manual',
						timestamp: Date.now(),
						source: 'manual_test'
					});

				} catch (error) {

				}
			};

			(window as any).getUserActivityStoragePath = async () => {
				try {
					const activities = await this.userActivityService.getActivities();

					return activities;
				} catch (error) {

					return [];
				}
			};

			(window as any).syncToSupabase = async () => {
				try {
					const result = await (this.userActivityService as any).manualSync();
					return result;
				} catch (error) {

					return { success: false, error: error.message };
				}
			};

			(window as any).getSyncStatus = () => {
				try {
					const status = (this.userActivityService as any).getSyncStatus();

					return status;
				} catch (error) {

					return null;
				}
			};


		}
	}

	private async initializeContributors(): Promise<void> {
		const contributors = [
			new EditorActivityContributor(
				this.userActivityService,
				this.editorService,
				this.workingCopyService,
				this.editorGroupsService
			),
			new CommandActivityContributor(
				this.userActivityService,
				this.commandService,
				this.lifecycleService
			),
			new AIChatActivityContributor(
				this.userActivityService,
				this.extensionService,
				this.chatThreadService
			),
			new AutocompleteActivityContributor(
				this.userActivityService,
				this.editorService,
				this.editorGroupsService
			)
		];

		// Register all contributors for disposal
		contributors.forEach(contributor => this._register(contributor));

		// Initialize all contributors
		const initPromises = contributors.map(contributor => contributor.initialize());

		try {
			await Promise.all(initPromises);

		} catch (error) {

		}
	}
}
