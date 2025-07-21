/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { createDecorator } from '../../instantiation/common/instantiation.js';
import { ActivityEvent } from './userActivityService.js';

export const IUserActivityStorageService = createDecorator<IUserActivityStorageService>('userActivityStorageService');

export interface StorageStats {
	totalEvents: number;
	lastEventTimestamp: number;
	storageSize: number;
	oldestEventTimestamp: number;
}

export interface IUserActivityStorageService {
	readonly _serviceBrand: undefined;

	storeActivity(event: ActivityEvent): Promise<void>;
	getActivities(startTime?: number, endTime?: number, limit?: number): Promise<ActivityEvent[]>;
	getStorageStats(): Promise<StorageStats>;
	clearOldActivities(olderThan: number): Promise<void>;
	clearAllActivities(): Promise<void>;
}
