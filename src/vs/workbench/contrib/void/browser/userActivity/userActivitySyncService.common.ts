/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../../base/common/event.js';
import { IUserActivitySyncService, ActivityEvent } from '../../../../../platform/void/common/userActivityService.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { IWorkbenchEnvironmentService } from '../../../../services/environment/common/environmentService.js';
import { URI } from '../../../../../base/common/uri.js';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { dirname } from '../../../../../base/common/resources.js';
import { importAMDNodeModule } from '../../../../../amdX.js';

interface LocalActivityStore {
	activities: ActivityEvent[];
	lastSync?: string;
	metadata: {
		createdAt: string;
		version: string;
	};
}

interface SyncConfig {
	supabaseUrl: string;
	supabaseKey: string;
	tableName: string;
	syncIntervalMs: number;
	autoSyncEnabled: boolean;
}

export class UserActivitySyncService extends Disposable implements IUserActivitySyncService {
	readonly _serviceBrand: undefined;

	private readonly _onSyncStatusChange = new Emitter<{ isOnline: boolean; lastSync?: Date; error?: string }>();
	readonly onSyncStatusChange = this._onSyncStatusChange.event;

	private _supabaseClient: any | null = null; // Changed type to any as SupabaseClient is not directly imported
	private _syncTimer: NodeJS.Timeout | null = null;
	private _localStorageUri: URI;
	private _isOnline = false;
	private _lastSync?: Date;

	private readonly _config: SyncConfig = {
		supabaseUrl: process.env.SUPABASE_URL || 'https://your-project.supabase.co',
		supabaseKey: process.env.SUPABASE_ANON_KEY || 'your-anon-key',
		tableName: 'user_activities',
		syncIntervalMs: 1 * 60 * 1000, // 5 minutes
		autoSyncEnabled: true
	};

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IWorkbenchEnvironmentService private readonly environmentService: IWorkbenchEnvironmentService
	) {
		super();



		// Set up local storage path using userRoamingDataHome for browser compatibility
		this._localStorageUri = URI.joinPath(
			this.environmentService.userRoamingDataHome,
			'void',
			'user-activities.json'
		);



		// Initialize Supabase asynchronously - it will be available when needed
		this._initializeSupabase().catch(error => {
			console.error('🔍 [Activity Sync] Failed to initialize Supabase:', error);
		});
		this._startAutoSync();
	}

	private async _initializeSupabase(): Promise<void> {
		try {
			const supabaseUrl = "https://wbcvacphaodqflwicrkr.supabase.co"
			const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndiY3ZhY3BoYW9kcWZsd2ljcmtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0MjU5MjYsImV4cCI6MjA2ODAwMTkyNn0.FtFBDO03diTPwnH5J7bXid0mAMf0Jd60yn7eGic1IE0"

			const supabaseModule = await importAMDNodeModule<typeof import('@supabase/supabase-js')>('@supabase/supabase-js', 'dist/umd/supabase.js');
			this._supabaseClient = supabaseModule.createClient(supabaseUrl, supabaseKey);
			this._isOnline = true;


		} catch (error) {
			this._isOnline = false;
		}
	}

	private _startAutoSync(): void {
		if (!this._config.autoSyncEnabled) return;

		this._syncTimer = setInterval(() => {
			this.syncToDatabase().catch(error => {

			});
		}, this._config.syncIntervalMs);
	}

	async storeActivityLocally(activity: ActivityEvent): Promise<void> {
		try {
			const existingData = await this._readLocalStorage();
			existingData.activities.push(activity);

			await this._writeLocalStorage(existingData);


		} catch (error) {

		}
	}

	async getLocalActivities(): Promise<ActivityEvent[]> {
		try {
			const data = await this._readLocalStorage();
			return data.activities;
		} catch (error) {
			return [];
		}
	}

	async clearLocalActivities(): Promise<void> {
		try {
			const emptyData: LocalActivityStore = {
				activities: [],
				lastSync: new Date().toISOString(),
				metadata: {
					createdAt: new Date().toISOString(),
					version: '1.0.0'
				}
			};

			await this._writeLocalStorage(emptyData);

		} catch (error) {

		}
	}

	async syncToDatabase(): Promise<{ success: boolean; synced: number; error?: string }> {
		if (!this._supabaseClient) {
			return { success: false, synced: 0, error: 'Supabase client not initialized' };
		}

		try {
			const localActivities = await this.getLocalActivities();

			if (localActivities.length === 0) {
				console.log('🔍 [Activity Sync] No activities to sync');
				return { success: true, synced: 0 };
			}

			// Prepare activities for database insertion
			const activitiesForDB = localActivities.map(activity => ({
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
				this._onSyncStatusChange.fire({ isOnline: false, error: error.message });
				return { success: false, synced: 0, error: error.message };
			}

			// Clear local activities after successful sync
			await this.clearLocalActivities();

			this._lastSync = new Date();
			this._isOnline = true;
			this._onSyncStatusChange.fire({ isOnline: true, lastSync: this._lastSync });



			return { success: true, synced: activitiesForDB.length };

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			this._onSyncStatusChange.fire({ isOnline: false, error: errorMessage });
			return { success: false, synced: 0, error: errorMessage };
		}
	}

	setSyncInterval(intervalMs: number): void {
		this._config.syncIntervalMs = intervalMs;

		// Restart auto-sync with new interval
		if (this._syncTimer) {
			clearInterval(this._syncTimer);
			this._syncTimer = null;
		}

		this._startAutoSync();

	}

	enableAutoSync(enabled: boolean): void {
		this._config.autoSyncEnabled = enabled;

		if (enabled) {
			this._startAutoSync();
		} else {
			if (this._syncTimer) {
				clearInterval(this._syncTimer);
				this._syncTimer = null;
			}
		}
	}

	get isOnline(): boolean {
		return this._isOnline;
	}

	get lastSync(): Date | undefined {
		return this._lastSync;
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

		this._onSyncStatusChange.dispose();
		super.dispose();
	}
}
