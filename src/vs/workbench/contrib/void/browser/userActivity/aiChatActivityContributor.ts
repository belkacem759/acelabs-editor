/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IUserActivityService, ActivityType, IActivityContributor } from '../../../../../platform/void/common/userActivityService.js';
import { IExtensionService } from '../../../../services/extensions/common/extensions.js';
import { IChatThreadService } from '../chatThreadService.js';
import { ChatMessage } from '../../common/chatThreadServiceTypes.js';

export class AIChatActivityContributor extends Disposable implements IActivityContributor {
	readonly id = 'ai-chat-activity';
	readonly priority = 2;

	private lastMessageCount = 0;
	private lastStreamingResponse = new Map<string, { startTime: number; content: string; threadId: string }>();

	constructor(
		private readonly activityService: IUserActivityService,
		private readonly extensionService: IExtensionService,
		private readonly chatThreadService: IChatThreadService
	) {
		super();
	}

	async initialize(): Promise<void> {


		try {
			// Wait for extensions to be ready
			await this.extensionService.whenInstalledExtensionsRegistered();



			// Listen for changes in the current thread (new messages added)
			this._register(this.chatThreadService.onDidChangeCurrentThread(() => {
				this.checkForNewMessages();
			}));

			// Listen for streaming state changes to track when responses are complete
			this._register(this.chatThreadService.onDidChangeStreamState(({ threadId }) => {
				this.handleStreamStateChange(threadId);
			}));

			// Check for existing messages
			this.checkForNewMessages();


		} catch (error) {

		}
	}

	private checkForNewMessages(): void {
		try {
			const currentThread = this.chatThreadService.getCurrentThread();
			if (!currentThread) return;

			const messages = currentThread.messages;
			const messageCount = messages.length;

			// Check if we have new messages
			if (messageCount > this.lastMessageCount) {
				const newMessages = messages.slice(this.lastMessageCount);

				for (const message of newMessages) {
					this.processMessage(message, currentThread.id);
				}

				this.lastMessageCount = messageCount;
			}
		} catch (error) {

		}
	}

	private processMessage(message: ChatMessage, threadId: string): void {
		try {
			if (message.role === 'user') {
				// Track user questions
				this.activityService.trackActivity(ActivityType.AI_CHAT_QUESTION, {
					question: message.displayContent,
					timestamp: Date.now()
				});
			} else if (message.role === 'assistant') {
				// Track assistant messages for streaming completion
				const messageKey = `${threadId}-${this.lastMessageCount}`;
				this.lastStreamingResponse.set(messageKey, {
					startTime: Date.now(),
					content: message.displayContent,
					threadId
				});
			}
		} catch (error) {

		}
	}

	private handleStreamStateChange(threadId: string): void {
		try {
			const streamState = this.chatThreadService.streamState[threadId];
			if (!streamState) return;

			// Only log when streaming is complete (not running)
			if (streamState.isRunning === undefined || streamState.isRunning === 'idle') {
				// Find completed responses to log
				this.lastStreamingResponse.forEach((responseData, messageKey) => {
					if (responseData.threadId === threadId && responseData.content.trim()) {
						this.activityService.trackActivity(ActivityType.AI_CHAT_RESPONSE, {
							response: responseData.content,
							duration: Date.now() - responseData.startTime,
							timestamp: Date.now()
						});
					}
				});

				// Clear tracked responses for this thread after logging
				this.lastStreamingResponse.forEach((_, key) => {
					if (_.threadId === threadId) {
						this.lastStreamingResponse.delete(key);
					}
				});
			}
		} catch (error) {

		}
	}
}
