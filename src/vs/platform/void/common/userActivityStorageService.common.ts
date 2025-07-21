/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ActivityEvent } from './userActivityService.js';
import { IUserActivityStorageService, StorageStats } from './userActivityStorageService.js';

export class UserActivityStorageService implements IUserActivityStorageService {
	declare readonly _serviceBrand: undefined;

	private _activities: ActivityEvent[] = [];

	async storeActivity(event: ActivityEvent): Promise<void> {
		// Store in memory for now (for stats purposes)
		this._activities.push(event);

		// Keep only last 1000 events in memory to prevent memory leaks
		if (this._activities.length > 1000) {
			this._activities = this._activities.slice(-1000);
		}
	}

	async getActivities(startTime?: number, endTime?: number, limit?: number): Promise<ActivityEvent[]> {
		let filtered = this._activities;

		if (startTime !== undefined) {
			filtered = filtered.filter(event => event.timestamp >= startTime);
		}

		if (endTime !== undefined) {
			filtered = filtered.filter(event => event.timestamp <= endTime);
		}

		if (limit !== undefined) {
			filtered = filtered.slice(-limit);
		}

		return filtered;
	}

	async getStorageStats(): Promise<StorageStats> {
		const stats = {
			totalEvents: this._activities.length,
			lastEventTimestamp: this._activities.length > 0 ? this._activities[this._activities.length - 1].timestamp : 0,
			storageSize: JSON.stringify(this._activities).length,
			oldestEventTimestamp: this._activities.length > 0 ? this._activities[0].timestamp : 0
		};

		return stats;
	}

	async clearOldActivities(olderThan: number): Promise<void> {
		this._activities = this._activities.filter(event => event.timestamp >= olderThan);
	}

	async clearAllActivities(): Promise<void> {
		this._activities = [];
	}
}
