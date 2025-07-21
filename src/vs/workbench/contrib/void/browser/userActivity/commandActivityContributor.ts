/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IUserActivityService, ActivityType, IActivityContributor } from '../../../../../platform/void/common/userActivityService.js';
import { ILifecycleService, LifecyclePhase } from '../../../../services/lifecycle/common/lifecycle.js';

export class CommandActivityContributor extends Disposable implements IActivityContributor {
	readonly id = 'command-activity';
	readonly priority = 3;

	// Flag to control command execution logging - disabled by default
	private readonly ENABLE_COMMAND_LOGGING = false;

	private readonly excludedCommands = new Set([
		'workbench.action.files.save',
		'workbench.action.files.saveAll',
		'workbench.action.acceptSelectedSuggestion',
		'editor.action.triggerSuggest',
		'editor.action.insertLineAfter',
		'editor.action.insertLineBefore',
		'deleteLeft',
		'deleteRight',
		'cursorMove',
		'cursorEnd',
		'cursorHome',
		'cursorWordLeft',
		'cursorWordRight',
		'cursorUp',
		'cursorDown',
		'cursorLeft',
		'cursorRight',
		'cursorPageDown',
		'cursorPageUp',
		'scrollLineUp',
		'scrollLineDown',
		'scrollPageUp',
		'scrollPageDown',
		'undo',
		'redo',
		'cut',
		'copy',
		'paste',
		'selectAll',
		'find',
		'replace',
		'closeFindWidget',
		'workbench.action.focusActiveEditorGroup',
		'workbench.action.focusSideBar',
		'workbench.action.toggleSidebarVisibility',
		'workbench.action.togglePanel',
		'workbench.action.quickOpen',
		'workbench.action.showCommands',
		'workbench.action.terminal.toggleTerminal',
		'editor.action.format',
		'editor.action.formatDocument',
		'editor.action.formatSelection'
	]);

	constructor(
		private readonly activityService: IUserActivityService,
		private readonly commandService: ICommandService,
		private readonly lifecycleService: ILifecycleService
	) {
		super();
	}

	async initialize(): Promise<void> {


		try {
			// Wait for lifecycle to be restored
			await this.lifecycleService.when(LifecyclePhase.Restored);



			// Only set up listeners if logging is enabled
			if (this.ENABLE_COMMAND_LOGGING) {
				// Track command execution
				this._register(this.commandService.onDidExecuteCommand(event => {
					if (event.commandId && !this.excludedCommands.has(event.commandId)) {
						this.activityService.trackActivity(ActivityType.COMMAND_EXECUTE, {
							command: event.commandId,
							args: event.args,
							timestamp: Date.now()
						});
					}
				}));


			} else {

			}


		} catch (error) {

		}
	}
}
