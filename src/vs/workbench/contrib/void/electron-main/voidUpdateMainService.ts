/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IEnvironmentMainService } from '../../../../platform/environment/electron-main/environmentMainService.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IUpdateService, StateType } from '../../../../platform/update/common/update.js';
import { IVoidUpdateService } from '../common/voidUpdateService.js';
import { VoidCheckUpdateRespose } from '../common/voidUpdateServiceTypes.js';



export class VoidMainUpdateService extends Disposable implements IVoidUpdateService {
	_serviceBrand: undefined;

	constructor(
		@IProductService private readonly _productService: IProductService,
		@IEnvironmentMainService private readonly _envMainService: IEnvironmentMainService,
		@IUpdateService private readonly _updateService: IUpdateService,
	) {
		super()
	}


	async check(explicit: boolean): Promise<VoidCheckUpdateRespose> {

		const isDevMode = !this._envMainService.isBuilt // found in abstractUpdateService.ts

		if (isDevMode) {
			return { message: null } as const
		}

		// if disabled and not explicitly checking, return early
		if (this._updateService.state.type === StateType.Disabled) {
			if (!explicit)
				return { message: null } as const
		}

		this._updateService.checkForUpdates(false) // implicity check, then handle result ourselves

		console.log('updateState', this._updateService.state)

		if (this._updateService.state.type === StateType.Uninitialized) {
			// The update service hasn't been initialized yet
			return { message: explicit ? 'Checking for updates soon...' : null, action: explicit ? 'reinstall' : undefined } as const
		}

		if (this._updateService.state.type === StateType.Idle) {
			// No updates currently available
			return { message: explicit ? 'No updates found!' : null, action: explicit ? 'reinstall' : undefined } as const
		}

		if (this._updateService.state.type === StateType.CheckingForUpdates) {
			// Currently checking for updates
			return { message: explicit ? 'Checking for updates...' : null } as const
		}

		if (this._updateService.state.type === StateType.AvailableForDownload) {
			// Update available but requires manual download (mainly for Linux)
			return { message: 'A new update is available!', action: 'download', } as const
		}

		if (this._updateService.state.type === StateType.Downloading) {
			// Update is currently being downloaded
			return { message: explicit ? 'Currently downloading update...' : null } as const
		}

		if (this._updateService.state.type === StateType.Downloaded) {
			// Update has been downloaded but not yet ready
			return { message: explicit ? 'An update is ready to be applied!' : null, action: 'apply' } as const
		}

		if (this._updateService.state.type === StateType.Updating) {
			// Update is being applied
			return { message: explicit ? 'Applying update...' : null } as const
		}

		if (this._updateService.state.type === StateType.Ready) {
			// Update is ready
			return { message: 'Restart AceLabs to update!', action: 'restart' } as const
		}

		if (this._updateService.state.type === StateType.Disabled) {
			return await this._manualCheckGHTagIfDisabled(explicit)
		}
		return null
	}






	private async _manualCheckGHTagIfDisabled(explicit: boolean): Promise<VoidCheckUpdateRespose> {
		try {
			// Replace with your own GitHub repository
			const response = await fetch('https://api.github.com/repos/belkacem759/acelabs-editor/releases/latest');

			const data = await response.json();
			const version = data.tag_name;

			const myVersion = this._productService.version
			const latestVersion = version

			const isUpToDate = myVersion === latestVersion // only makes sense if response.ok

			// explicit
			if (explicit) {
				if (response.ok) {
					if (!isUpToDate) {
						return {
							message: 'A new version of AceLabs is available!',
							action: 'reinstall'
						}
					} else {
						return {
							message: 'You are using the latest version of AceLabs.'
						}
					}
				} else {
					return {
						message: 'Failed to check for updates.'
					}
				}
			}

			// not explicit
			if (response.ok && !isUpToDate) {
				return {
					message: 'A new version of AceLabs is available!',
					action: 'reinstall'
				}
			}

			return { message: null }
		} catch (error) {
			console.error('Error checking for updates:', error)
			if (explicit) {
				return {
					message: 'Failed to check for updates.'
				}
			}
			return { message: null }
		}
	}
}

