/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { createDecorator } from '../../instantiation/common/instantiation.js';
import { Event } from '../../../base/common/event.js';

export const enum ActivityType {
	TYPING = 'typing',
	FILE_OPEN = 'file_open',
	FILE_CLOSE = 'file_close',
	FILE_SAVE = 'file_save',
	FILE_EDIT = 'file_edit',
	COMMAND_EXECUTE = 'command_execute',
	AI_CHAT_QUESTION = 'ai_chat_question',
	AI_CHAT_RESPONSE = 'ai_chat_response',
	AUTOCOMPLETE_ACCEPT = 'autocomplete_accept'
}

export interface ActivityEvent {
	type: ActivityType;
	timestamp: number;
	sessionId: string;
	userId?: string;
	data: Record<string, any>;
	metadata?: Record<string, any>;
}

export interface IActivityContributor {
	readonly id: string;
	readonly priority: number;
	initialize(): Promise<void>;
	dispose(): void;
}

export interface IUserActivityService {
	readonly _serviceBrand: undefined;

	trackActivity(type: ActivityType, data: Record<string, any>): void;
	getActivities(fromDate?: Date, toDate?: Date): Promise<ActivityEvent[]>;
	clearActivities(): Promise<void>;
}

export interface IUserActivityStorageService {
	readonly _serviceBrand: undefined;

	storeActivity(activity: ActivityEvent): Promise<void>;
	getActivities(fromDate?: Date, toDate?: Date): Promise<ActivityEvent[]>;
	clearActivities(): Promise<void>;
}

export interface IUserActivitySyncService {
	readonly _serviceBrand: undefined;

	// Local storage
	storeActivityLocally(activity: ActivityEvent): Promise<void>;
	getLocalActivities(): Promise<ActivityEvent[]>;
	clearLocalActivities(): Promise<void>;

	// Remote sync
	syncToDatabase(): Promise<{ success: boolean; synced: number; error?: string }>;
	onSyncStatusChange: Event<{ isOnline: boolean; lastSync?: Date; error?: string }>;

	// Configuration
	setSyncInterval(intervalMs: number): void;
	enableAutoSync(enabled: boolean): void;
}

export const IUserActivityService = createDecorator<IUserActivityService>('userActivityService');
export const IUserActivityStorageService = createDecorator<IUserActivityStorageService>('userActivityStorageService');
export const IUserActivitySyncService = createDecorator<IUserActivitySyncService>('userActivitySyncService');
