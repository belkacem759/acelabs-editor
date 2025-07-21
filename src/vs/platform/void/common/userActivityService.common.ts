/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { generateUuid } from '../../../base/common/uuid.js';
import { IUserActivityService, ActivityEvent, ActivityType, IActivityContributor } from './userActivityService.js';
import { IUserActivityStorageService } from './userActivityStorageService.js';

export class UserActivityService extends Disposable implements IUserActivityService {
	declare readonly _serviceBrand: undefined;

	private readonly _onActivityEvent = this._register(new Emitter<ActivityEvent>());
	readonly onActivityEvent: Event<ActivityEvent> = this._onActivityEvent.event;

	private readonly _sessionId: string;
	private _userId: string | undefined;
	private readonly _contributors = new Map<string, IActivityContributor>();

	constructor(
		@IUserActivityStorageService private readonly storageService: IUserActivityStorageService
	) {
		super();
		this._sessionId = generateUuid();



		// Add to global scope for testing
		if (typeof window !== 'undefined') {
			(window as any).testActivityTracking = () => {

				this.trackActivity('command_execute' as any, { command: 'test.manual' }, { source: 'manual_test' });
			};
		}
	}

	trackActivity(type: ActivityType, data: any, metadata?: Record<string, any>): void {
		const event: ActivityEvent = {
			type,
			timestamp: Date.now(),
			userId: this._userId,
			sessionId: this._sessionId,
			data,
			metadata
		};

		// Fire event first
		this._onActivityEvent.fire(event);

		// Then store it
		this.storageService.storeActivity(event).catch(err => {

		});
	}

	registerContributor(contributor: IActivityContributor): void {
		if (this._contributors.has(contributor.id)) {

			return;
		}

		this._contributors.set(contributor.id, contributor);
		contributor.initialize();


	}

	unregisterContributor(contributorId: string): void {
		const contributor = this._contributors.get(contributorId);
		if (contributor) {
			contributor.dispose();
			this._contributors.delete(contributorId);

		}
	}

	getSessionId(): string {
		return this._sessionId;
	}

	setUserId(userId: string): void {
		this._userId = userId;

	}

	getUserId(): string | undefined {
		return this._userId;
	}

	async getActivities(fromDate?: Date, toDate?: Date): Promise<ActivityEvent[]> {
		const startTime = fromDate ? fromDate.getTime() : undefined;
		const endTime = toDate ? toDate.getTime() : undefined;
		return this.storageService.getActivities(startTime, endTime);
	}

	async clearActivities(): Promise<void> {
		return this.storageService.clearAllActivities();
	}

	override dispose(): void {
		// Dispose all contributors
		for (const contributor of this._contributors.values()) {
			contributor.dispose();
		}
		this._contributors.clear();

		super.dispose();
	}
}
