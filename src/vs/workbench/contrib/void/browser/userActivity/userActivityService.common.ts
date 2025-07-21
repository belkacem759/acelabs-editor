/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { importAMDNodeModule } from '../../../../../amdX.js';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { dirname } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { generateUuid } from '../../../../../base/common/uuid.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { ActivityEvent, ActivityType, IUserActivityService } from '../../../../../platform/void/common/userActivityService.js';
import { IWorkbenchEnvironmentService } from '../../../../services/environment/common/environmentService.js';

interface LocalActivityStore {
	activities: ActivityEvent[];
	lastSync?: string;
	metadata: {
		createdAt: string;
		version: string;
	};
}

export class UserActivityService extends Disposable implements IUserActivityService {
	readonly _serviceBrand: undefined;

	private readonly _sessionId: string;
	private readonly _localStorageUri: URI;
	private _supabaseClient: any | null = null;
	private _syncTimer: NodeJS.Timeout | null = null;
	private _isOnline = false;
	private _lastSync?: Date;

	private readonly _config = {
		supabaseUrl: "https://yicficnbwneoflxcgagq.supabase.co",
		supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpY2ZpY25id25lb2ZseGNnYWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2ODM2MDIsImV4cCI6MjA2ODI1OTYwMn0.1VcCKc3pjW4lCFPk1BgH9ppfaZCx8iHSSGft3e8Ybs4",
		tableName: 'user_activities',
		syncIntervalMs: 1 * 60 * 1000, // 5 minutes
		autoSyncEnabled: true
	};

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IWorkbenchEnvironmentService private readonly environmentService: IWorkbenchEnvironmentService
	) {
		super();
		this._sessionId = generateUuid();

		// Set up local storage path
		this._localStorageUri = URI.joinPath(
			this.environmentService.userRoamingDataHome,
			'void',
			'user-activities.json'
		);



		// Initialize Supabase and auto-sync
		this._initializeSupabase();
		this._startAutoSync();
	}

	private async _initializeSupabase(): Promise<void> {
		try {
			const supabaseModule = await importAMDNodeModule<typeof import('@supabase/supabase-js')>('@supabase/supabase-js', 'dist/umd/supabase.js');
			this._supabaseClient = supabaseModule.createClient(this._config.supabaseUrl, this._config.supabaseKey);
			this._isOnline = true;

		} catch (error) {

			this._isOnline = false;
		}
	}

	private _startAutoSync(): void {
		if (!this._config.autoSyncEnabled) return;

		this._syncTimer = setInterval(() => {
			this.syncToSupabase().catch(error => {

			});
		}, this._config.syncIntervalMs);


	}

	async syncToSupabase(): Promise<{ success: boolean; synced: number; error?: string }> {
		if (!this._supabaseClient) {

			return { success: false, synced: 0, error: 'Supabase client not initialized' };
		}

		try {
			const data = await this._readLocalStorage();
			const activities = data.activities;

			if (activities.length === 0) {

				return { success: true, synced: 0 };
			}

			// Prepare activities for database insertion
			const activitiesForDB = activities.map(activity => ({
				type: activity.type,
				timestamp: activity.timestamp,
				session_id: activity.sessionId,
				data: activity.data,
				created_at: new Date().toISOString()
			}));



			// Insert activities into Supabase
			const { error } = await this._supabaseClient
				.from(this._config.tableName)
				.insert(activitiesForDB);

			if (error) {

				this._isOnline = false;
				return { success: false, synced: 0, error: error.message };
			}

			// Clear local activities after successful sync
			const emptyData: LocalActivityStore = {
				activities: [],
				lastSync: new Date().toISOString(),
				metadata: data.metadata
			};
			await this._writeLocalStorage(emptyData);

			this._lastSync = new Date();
			this._isOnline = true;


			return { success: true, synced: activitiesForDB.length };

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';

			this._isOnline = false;
			return { success: false, synced: 0, error: errorMessage };
		}
	}

	trackActivity(type: ActivityType, data: Record<string, any>): void {
		const activity: ActivityEvent = {
			type,
			timestamp: Date.now(),
			sessionId: this._sessionId,
			data
		};

		// Store activity asynchronously
		this._storeActivityLocally(activity).catch(error => {

		});


	}

	async getActivities(fromDate?: Date, toDate?: Date): Promise<ActivityEvent[]> {
		try {
			const data = await this._readLocalStorage();
			let activities = data.activities;

			// Filter by date range if provided
			if (fromDate || toDate) {
				activities = activities.filter(activity => {
					const activityDate = new Date(activity.timestamp);
					if (fromDate && activityDate < fromDate) return false;
					if (toDate && activityDate > toDate) return false;
					return true;
				});
			}

			return activities;
		} catch (error) {

			return [];
		}
	}

	async clearActivities(): Promise<void> {
		try {
			const emptyData: LocalActivityStore = {
				activities: [],
				metadata: {
					createdAt: new Date().toISOString(),
					version: '1.0.0'
				}
			};

			await this._writeLocalStorage(emptyData);

		} catch (error) {

		}
	}

	// Public method to manually trigger sync
	async manualSync(): Promise<{ success: boolean; synced: number; error?: string }> {

		return await this.syncToSupabase();
	}

	// Get sync status
	getSyncStatus(): { isOnline: boolean; lastSync?: Date; activitiesCount: number } {
		return {
			isOnline: this._isOnline,
			lastSync: this._lastSync,
			activitiesCount: 0 // Will be updated when we read activities
		};
	}

	private async _storeActivityLocally(activity: ActivityEvent): Promise<void> {
		try {
			const existingData = await this._readLocalStorage();
			existingData.activities.push(activity);

			await this._writeLocalStorage(existingData);

		} catch (error) {

		}
	}

	private async _readLocalStorage(): Promise<LocalActivityStore> {
		try {
			const content = await this.fileService.readFile(this._localStorageUri);
			const data = JSON.parse(content.value.toString()) as LocalActivityStore;
			return data;
		} catch (error) {
			// File doesn't exist or is corrupted, return empty structure

			return {
				activities: [],
				metadata: {
					createdAt: new Date().toISOString(),
					version: '1.0.0'
				}
			};
		}
	}

	private async _writeLocalStorage(data: LocalActivityStore): Promise<void> {
		try {
			const content = JSON.stringify(data, null, 2);
			const buffer = VSBuffer.fromString(content);

			// Ensure directory exists
			await this.fileService.createFolder(dirname(this._localStorageUri));

			// Write file
			await this.fileService.writeFile(this._localStorageUri, buffer);

		} catch (error) {

			throw error;
		}
	}

	override dispose(): void {
		if (this._syncTimer) {
			clearInterval(this._syncTimer);
			this._syncTimer = null;
		}
		super.dispose();
	}
}
