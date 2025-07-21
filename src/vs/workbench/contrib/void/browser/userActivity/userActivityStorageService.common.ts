/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IUserActivityStorageService, ActivityEvent, IUserActivitySyncService } from '../../../../../platform/void/common/userActivityService.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';

export class UserActivityStorageService implements IUserActivityStorageService {
	readonly _serviceBrand: undefined;

	private _syncService: IUserActivitySyncService | undefined;

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {


		// Initialize sync service lazily
		this._initializeSyncService();
	}

	private _initializeSyncService(): void {
		try {
			this._syncService = this.instantiationService.invokeFunction(accessor => accessor.get(IUserActivitySyncService));

		} catch (error) {

			// Retry after a short delay
			setTimeout(() => this._initializeSyncService(), 100);
		}
	}

	private _getSyncService(): IUserActivitySyncService | undefined {
		if (!this._syncService) {
			this._initializeSyncService();
		}
		return this._syncService;
	}

	async storeActivity(activity: ActivityEvent): Promise<void> {
		const syncService = this._getSyncService();
		if (!syncService) {

			return;
		}

		// Store locally first
		await syncService.storeActivityLocally(activity);


	}

	async getActivities(fromDate?: Date, toDate?: Date): Promise<ActivityEvent[]> {
		const syncService = this._getSyncService();
		if (!syncService) {

			return [];
		}

		const activities = await syncService.getLocalActivities();

		// Filter by date range if provided
		if (fromDate || toDate) {
			return activities.filter(activity => {
				const activityDate = new Date(activity.timestamp);
				if (fromDate && activityDate < fromDate) return false;
				if (toDate && activityDate > toDate) return false;
				return true;
			});
		}

		return activities;
	}

	async clearActivities(): Promise<void> {
		const syncService = this._getSyncService();
		if (!syncService) {

			return;
		}
		await syncService.clearLocalActivities();

	}
}
