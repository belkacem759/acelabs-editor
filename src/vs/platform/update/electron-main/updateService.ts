/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { autoUpdater } from 'electron-updater';
import { app, dialog, shell } from 'electron';
import { EventEmitter } from 'events';
import { ILogService } from '../../log/common/log.js';
import { IProductService } from '../../product/common/productService.js';
import { IUpdateService } from './updateService.contribution.js';

interface UpdateInfo {
	version: string;
	releaseDate?: string;
	releaseNotes?: string;
}

interface ProgressInfo {
	bytesPerSecond: number;
	percent: number;
	transferred: number;
	total: number;
}

export class UpdateService extends EventEmitter implements IUpdateService {
	readonly _serviceBrand: undefined;

	private _updateAvailable = false;
	private _updateDownloaded = false;

	constructor(
		@ILogService private readonly logService: ILogService,
		@IProductService private readonly productService: IProductService
	) {
		super();

		// Configure autoUpdater
		autoUpdater.logger = this.logService;
		autoUpdater.autoDownload = false;
		autoUpdater.autoInstallOnAppQuit = true;

		// Set up event listeners
		autoUpdater.on('checking-for-update', () => {
			this.logService.info('Checking for updates...');
			this.emit('checking-for-update');
		});

		autoUpdater.on('update-available', (info: UpdateInfo) => {
			this.logService.info('Update available:', info);
			this._updateAvailable = true;
			this.emit('update-available', info);
			this.showUpdateAvailableDialog(info);
		});

		autoUpdater.on('update-not-available', (info: UpdateInfo) => {
			this.logService.info('Update not available:', info);
			this.emit('update-not-available', info);
		});

		autoUpdater.on('error', (err: Error) => {
			this.logService.error('Update error:', err);
			this.emit('error', err);
		});

		autoUpdater.on('download-progress', (progressObj: ProgressInfo) => {
			this.logService.info('Download progress:', progressObj);
			this.emit('download-progress', progressObj);
		});

		autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
			this.logService.info('Update downloaded:', info);
			this._updateDownloaded = true;
			this.emit('update-downloaded', info);
			this.showUpdateDownloadedDialog(info);
		});
	}

	async checkForUpdates(): Promise<void> {
		try {
			await autoUpdater.checkForUpdates();
		} catch (error) {
			this.logService.error('Failed to check for updates:', error);
			throw error;
		}
	}

	async downloadUpdate(): Promise<void> {
		if (!this._updateAvailable) {
			throw new Error('No update available to download');
		}

		try {
			await autoUpdater.downloadUpdate();
		} catch (error) {
			this.logService.error('Failed to download update:', error);
			throw error;
		}
	}

	async installUpdate(): Promise<void> {
		if (!this._updateDownloaded) {
			throw new Error('No update downloaded to install');
		}

		try {
			await autoUpdater.quitAndInstall();
		} catch (error) {
			this.logService.error('Failed to install update:', error);
			throw error;
		}
	}

	private showUpdateAvailableDialog(info: UpdateInfo): void {
		const dialogOpts = {
			type: 'info' as const,
			buttons: ['Download Update', 'Later'],
			title: 'Update Available',
			message: `A new version (${info.version}) is available.`,
			detail: 'Would you like to download it now?'
		};

		dialog.showMessageBox(dialogOpts).then((returnValue) => {
			if (returnValue.response === 0) {
				this.downloadUpdate();
			}
		});
	}

	private showUpdateDownloadedDialog(info: UpdateInfo): void {
		const dialogOpts = {
			type: 'info' as const,
			buttons: ['Restart Now', 'Later'],
			title: 'Update Ready',
			message: 'Update has been downloaded and is ready to install.',
			detail: 'Would you like to restart now to apply the update?'
		};

		dialog.showMessageBox(dialogOpts).then((returnValue) => {
			if (returnValue.response === 0) {
				this.installUpdate();
			}
		});
	}
}
